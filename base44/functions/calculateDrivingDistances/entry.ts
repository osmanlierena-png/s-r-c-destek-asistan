import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// OSRM public demo server - sürüş mesafesi (kuş uçuşu değil)
// URL format: https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false
// Returns: { routes: [{ distance: meters, duration: seconds }] }

const METERS_TO_MILES = 0.000621371;

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

    // Koordinatları olan ve mesafesi olmayan (veya force) siparişleri filtrele
    const needsCalc = orders.filter(o =>
      o.pickup_coords?.lat != null && o.pickup_coords?.lng != null &&
      o.dropoff_coords?.lat != null && o.dropoff_coords?.lng != null &&
      (forceRecalculate || o.driving_distance_miles == null)
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
          const { lat: lat1, lng: lng1 } = order.pickup_coords;
          const { lat: lat2, lng: lng2 } = order.dropoff_coords;

          const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;

          const response = await fetch(url, {
            headers: { 'User-Agent': 'DriverSupportAssistant/1.0' }
          });

          if (!response.ok) {
            throw new Error(`OSRM HTTP ${response.status}`);
          }

          const data = await response.json();

          if (!data.routes || data.routes.length === 0) {
            throw new Error('OSRM rota bulunamadı');
          }

          const distanceMeters = data.routes[0].distance;
          const distanceMiles = Math.round(distanceMeters * METERS_TO_MILES * 10) / 10;

          // Database'e kaydet
          await base44.asServiceRole.entities.DailyOrder.update(order.id, {
            driving_distance_miles: distanceMiles
          });

          return { orderId: order.ezcater_order_id, miles: distanceMiles };
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