import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { startDate, endDate } = await req.json();

    if (!startDate || !endDate) {
      return Response.json({ 
        success: false, 
        error: 'startDate ve endDate gerekli' 
      }, { status: 400 });
    }

    console.log(`📊 Excel export başlatılıyor: ${startDate} - ${endDate}`);

    // Tarih aralığındaki tüm onaylanmış siparişleri çek
    const allOrders = await base44.asServiceRole.entities.DailyOrder.filter({
      status: 'Sürücü Onayladı'
    }, '-order_date', 500);

    // Tarih aralığına göre filtrele
    const filteredOrders = allOrders.filter(order => {
      return order.order_date >= startDate && order.order_date <= endDate;
    });

    console.log(`✅ ${filteredOrders.length} sipariş bulundu`);

    if (filteredOrders.length === 0) {
      return Response.json({
        success: false,
        error: 'Belirtilen tarih aralığında onaylanmış sipariş bulunamadı'
      }, { status: 404 });
    }

    // Excel için veriyi hazırla
    const excelData = filteredOrders.map(order => ({
      'Sipariş Kodu': order.ezcater_order_id || '',
      'Tarih': order.order_date || '',
      'Gün': order.order_date ? new Date(order.order_date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long' }) : '',
      'Pickup Saati': order.pickup_time || '',
      'Dropoff Saati': order.dropoff_time || '',
      'Sürücü': order.driver_name || '',
      'Ödeme (Canvas)': order.canvas_price || 0
    }));

    // Excel workbook oluştur
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Kolon genişliklerini ayarla
    worksheet['!cols'] = [
      { wch: 15 }, // Sipariş Kodu
      { wch: 12 }, // Tarih
      { wch: 12 }, // Gün
      { wch: 12 }, // Pickup Saati
      { wch: 12 }, // Dropoff Saati
      { wch: 20 }, // Sürücü
      { wch: 15 }  // Ödeme
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Siparişler');

    // Excel dosyasını array buffer olarak oluştur
    const excelBuffer = XLSX.write(workbook, { 
      type: 'array', 
      bookType: 'xlsx' 
    });

    console.log(`📦 Excel dosyası oluşturuldu: ${excelBuffer.byteLength} bytes`);

    // Dosya adı oluştur
    const fileName = `Siparisler_${startDate}_${endDate}.xlsx`;

    // Uint8Array'e çevir
    const uint8Array = new Uint8Array(excelBuffer);

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': uint8Array.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('❌ Excel export hatası:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});