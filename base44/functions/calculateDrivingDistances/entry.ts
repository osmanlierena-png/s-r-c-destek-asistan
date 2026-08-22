import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getDrivingDistance } from '../../shared/googleDistance.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || body.targetDate;
    const forceRecalculate = body.force === true;

    console.log(`🚗 Sürüş mesafesi hesaplanıyor... Tarih: ${targetDate || 'tümü'}`);

    // Siparişleri getir
    const filter = targetDate ? { order_date: targetDate } : {};
    const orders = await base44.asServiceRole.entities.DailyOrder.filter(
      filter, '-created_date', 500
    );

    console.log(`📦 ${orders.length} sipariş bulundu`);

    // Adresi olan ve mesafesi/süresi olmayan (veya force) siparişleri filtrele
    // Google Distance Matrix ham adres kullanır, koordinat gerekmez
    const needsCalc = orders.filter(o =>
      o.pickup_address && o.dropoff_address &&
      (forceRecalculate || o.driving_distance_miles == null || o.driving_duration_minutes == null)
    );

    console.log(`🎯 ${needsCalc.length} sipariş için mesafe hesaplanacak`);

    if (needsCalc.length === 0) {
      return Response.json({
        success: true,
        message: 'Hesaplanacak sipariş yok (koordinat eksik veya zaten hesaplanmış)',
        total_orders: orders.length,
        needs_calc: 0,
        calculated: 0,
        failed: 0
      });
    }

    let calculated = 0;
    let failed = 0;
    const errors = [];

    // Sıralı işle (Google Distance Matrix + cache)
    for (const order of needsCalc) {
      try {
        const result = await getDrivingDistance(base44.asServiceRole, order.pickup_address, order.dropoff_address);
        if (result == null) {
          failed++;
          console.error(`❌ ${order.ezcater_order_id}: Google mesafe bulunamadı`);
          errors.push({ orderId: order.ezcater_order_id, reason: 'Google: NOT_FOUND' });
          continue;
        }

        await base44.asServiceRole.entities.DailyOrder.update(order.id, {
          driving_distance_miles: result.miles,
          driving_duration_minutes: result.durationMinutes
        });

        calculated++;
        console.log(`✅ ${order.ezcater_order_id}: ${result.miles} mil, ${result.durationMinutes} dk${result.fromCache ? ' (cache)' : ''}`);
      } catch (error) {
        failed++;
        console.error(`❌ ${order.ezcater_order_id}: ${error.message}`);
        errors.push({ orderId: order.ezcater_order_id, reason: error.message });
      }
    }

    console.log(`\n📊 ÖZET: ${calculated} hesaplandı, ${failed} hata`);

    return Response.json({
      success: true,
      message: `${calculated} sipariş için sürüş mesafesi hesaplandı`,
      total_orders: orders.length,
      needs_calc: needsCalc.length,
      calculated,
      failed,
      errors: errors.slice(0, 10)
    });

  } catch (error) {
    console.error('❌ Genel hata:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});