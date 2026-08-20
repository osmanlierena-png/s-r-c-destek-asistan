import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { calculateDrivingDistance } from '../../shared/distance.ts';

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

    // Koordinatları olan ve mesafesi/süresi olmayan (veya force) siparişleri filtrele
    const needsCalc = orders.filter(o =>
      o.pickup_coords?.lat != null && o.pickup_coords?.lng != null &&
      o.dropoff_coords?.lat != null && o.dropoff_coords?.lng != null &&
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

    // 5'erli paralel batch'ler halinde işle (OSRM demo rate limit'e saygı)
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 200;

    for (let i = 0; i < needsCalc.length; i += BATCH_SIZE) {
      const batch = needsCalc.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (order) => {
          const result = await calculateDrivingDistance(order.pickup_coords, order.dropoff_coords);
          if (result == null) {
            throw new Error('OSRM rota bulunamadı');
          }

          // Database'e kaydet
          await base44.asServiceRole.entities.DailyOrder.update(order.id, {
            driving_distance_miles: result.miles,
            driving_duration_minutes: result.durationMinutes
          });

          return { orderId: order.ezcater_order_id, miles: result.miles, minutes: result.durationMinutes };
        })
      );

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          calculated++;
          console.log(`✅ ${r.value.orderId}: ${r.value.miles} mil`);
        } else {
          failed++;
          const order = batch[j];
          console.error(`❌ ${order.ezcater_order_id}: ${r.reason}`);
          errors.push({
            orderId: order.ezcater_order_id,
            reason: r.reason?.message || String(r.reason)
          });
        }
      }

      // Batch'ler arası kısa bekleme
      if (i + BATCH_SIZE < needsCalc.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
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