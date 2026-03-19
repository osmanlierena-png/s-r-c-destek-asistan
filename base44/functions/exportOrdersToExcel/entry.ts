import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    console.log(`📊 CSV export başlatılıyor: ${startDate} - ${endDate}`);

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

    // CSV formatında veri hazırla
    const headers = ['Sipariş Kodu', 'Tarih', 'Gün', 'Pickup Saati', 'Pickup Adres', 'Dropoff Saati', 'Dropoff Adres', 'Sürücü', 'Ödeme (Canvas)'];
    
    const rows = filteredOrders.map(order => [
      order.ezcater_order_id || '',
      order.order_date || '',
      order.order_date ? new Date(order.order_date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long' }) : '',
      order.pickup_time || '',
      order.pickup_address || '',
      order.dropoff_time || '',
      order.dropoff_address || '',
      order.driver_name || '',
      order.canvas_price || 0
    ]);

    // CSV string oluştur
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Virgül veya tırnak içeren hücreleri escape et
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    console.log(`📦 CSV dosyası oluşturuldu: ${csvContent.length} bytes`);

    // UTF-8 BOM ekle (Excel'in Türkçe karakterleri doğru göstermesi için)
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    // Dosya adı oluştur
    const fileName = `Siparisler_${startDate}_${endDate}.csv`;

    return new Response(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });

  } catch (error) {
    console.error('❌ CSV export hatası:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});