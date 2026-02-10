import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { json_data } = await req.json();

    if (!json_data) {
      return Response.json({ 
        success: false, 
        error: 'JSON verisi eksik' 
      }, { status: 400 });
    }

    let ordersData;
    try {
      ordersData = JSON.parse(json_data);
    } catch (e) {
      return Response.json({ 
        success: false, 
        error: 'Geçersiz JSON formatı: ' + e.message 
      }, { status: 400 });
    }

    if (!Array.isArray(ordersData)) {
      return Response.json({ 
        success: false, 
        error: 'JSON bir array olmalı' 
      }, { status: 400 });
    }

    const results = {
      total: ordersData.length,
      added: 0,
      skipped: 0,
      errors: []
    };

    for (const orderData of ordersData) {
      try {
        // Gerekli alanları kontrol et
        if (!orderData.orderNo || !orderData.deliveryTime) {
          results.errors.push({
            orderNo: orderData.orderNo || 'unknown',
            error: 'orderNo veya deliveryTime eksik'
          });
          results.skipped++;
          continue;
        }

        // Tip ve price'dan $ işaretini kaldır ve sayıya çevir
        const tip = orderData.tip ? parseFloat(orderData.tip.toString().replace('$', '')) : 0;
        const price = orderData.price ? parseFloat(orderData.price.toString().replace('$', '')) : 0;

        // deliveryTime'dan tarih ve saat ayrıştır
        // Format: "2/11/2026 7:45:00 AM"
        let orderDate, dropoffTime;
        try {
          const deliveryDate = new Date(orderData.deliveryTime);
          
          // YYYY-MM-DD formatına çevir
          const year = deliveryDate.getFullYear();
          const month = String(deliveryDate.getMonth() + 1).padStart(2, '0');
          const day = String(deliveryDate.getDate()).padStart(2, '0');
          orderDate = `${year}-${month}-${day}`;
          
          // HH:MM formatına çevir
          const hours = String(deliveryDate.getHours()).padStart(2, '0');
          const minutes = String(deliveryDate.getMinutes()).padStart(2, '0');
          dropoffTime = `${hours}:${minutes}`;
        } catch (e) {
          results.errors.push({
            orderNo: orderData.orderNo,
            error: 'Tarih formatı hatalı: ' + e.message
          });
          results.skipped++;
          continue;
        }

        // pickupTime'ı parse et (format: "07:15 AM")
        let pickupTime = '';
        if (orderData.pickupTime) {
          try {
            const [time, period] = orderData.pickupTime.split(' ');
            const [hours, minutes] = time.split(':');
            let hour = parseInt(hours);
            
            if (period === 'PM' && hour !== 12) {
              hour += 12;
            } else if (period === 'AM' && hour === 12) {
              hour = 0;
            }
            
            pickupTime = `${String(hour).padStart(2, '0')}:${minutes}`;
          } catch (e) {
            // Pickup time parse edilemezse boş bırak
            pickupTime = orderData.pickupTime;
          }
        }

        // Duplicate kontrolü: aynı orderNo + order_date var mı?
        const existingOrders = await base44.entities.DailyOrder.filter({
          ezcater_order_id: orderData.orderNo,
          order_date: orderDate
        });

        if (existingOrders.length > 0) {
          results.skipped++;
          continue;
        }

        // Yeni sipariş oluştur
        await base44.entities.DailyOrder.create({
          ezcater_order_id: orderData.orderNo,
          order_date: orderDate,
          pickup_address: orderData.pickupAddress || '',
          pickup_time: pickupTime,
          dropoff_address: orderData.deliveryAddress || '',
          dropoff_time: dropoffTime,
          customer_name: orderData.customerName || '',
          ezcater_notes: orderData.notes || '',
          tip: tip,
          price: price,
          status: 'Çekildi'
        });

        results.added++;
      } catch (error) {
        results.errors.push({
          orderNo: orderData.orderNo || 'unknown',
          error: error.message
        });
        results.skipped++;
      }
    }

    return Response.json({
      success: true,
      ...results,
      message: `${results.added} sipariş eklendi, ${results.skipped} sipariş atlandı`
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});