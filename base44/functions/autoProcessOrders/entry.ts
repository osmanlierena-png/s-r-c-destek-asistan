import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import { geocodeAddress } from "../../shared/geocode.ts";
import { calculateDrivingDistance } from "../../shared/distance.ts";

// Bu fonksiyon otomatik (scheduled) olarak her 5 dakikada bir çağrılır.
// 1) Koordinatı olmayan siparişleri geocode eder (Nominatim)
// 2) Koordinatı var ama sürüş mesafesi yoksa OSRM ile hesaplar
// asServiceRole kullanır → kullanıcı girişi gerektirmez (otomasyon uyumlu)

const MAX_GEOCODE_PER_RUN = 20; // Nominatim rate limit + timeout koruması

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Tüm siparişleri getir (en yeni önce)
    const orders = await base44.asServiceRole.entities.DailyOrder.filter({}, "-created_date", 500);

    // 1) Koordinatı eksik olanlar
    const needsGeocode = orders.filter(
      (o) =>
        (o.pickup_address && (!o.pickup_coords || o.pickup_coords.lat == null)) ||
        (o.dropoff_address && (!o.dropoff_coords || o.dropoff_coords.lat == null))
    );

    // 2) Koordinatı tam ama mesafe yok
    const needsDistance = orders.filter(
      (o) =>
        o.pickup_coords?.lat != null &&
        o.pickup_coords?.lng != null &&
        o.dropoff_coords?.lat != null &&
        o.dropoff_coords?.lng != null &&
        o.driving_distance_miles == null
    );

    console.log(`🔄 Otomatik işlem: ${needsGeocode.length} geocode, ${needsDistance.length} mesafe bekliyor`);

    let geocoded = 0;
    let distanceCalculated = 0;
    let failed = 0;

    // --- GEOCODING (sıralı, 1 req/sec) ---
    const geocodeBatch = needsGeocode.slice(0, MAX_GEOCODE_PER_RUN);

    for (const order of geocodeBatch) {
      let pickupCoords = order.pickup_coords;
      let dropoffCoords = order.dropoff_coords;

      if (order.pickup_address && (!pickupCoords || pickupCoords.lat == null)) {
        pickupCoords = await geocodeAddress(order.pickup_address);
        await new Promise((r) => setTimeout(r, 1000)); // Nominatim rate limit
      }

      if (order.dropoff_address && (!dropoffCoords || dropoffCoords.lat == null)) {
        dropoffCoords = await geocodeAddress(order.dropoff_address);
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (pickupCoords || dropoffCoords) {
        const updateData: any = {};
        if (pickupCoords) updateData.pickup_coords = pickupCoords;
        if (dropoffCoords) updateData.dropoff_coords = dropoffCoords;
        await base44.asServiceRole.entities.DailyOrder.update(order.id, updateData);
        geocoded++;
      } else {
        failed++;
      }
    }

    // --- MESAFE HESAPLAMA (5 paralel batch) ---
    const BATCH_SIZE = 5;

    for (let i = 0; i < needsDistance.length; i += BATCH_SIZE) {
      const batch = needsDistance.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (order) => {
          const miles = await calculateDrivingDistance(order.pickup_coords, order.dropoff_coords);
          if (miles == null) throw new Error("OSLM rota bulunamadı");
          await base44.asServiceRole.entities.DailyOrder.update(order.id, {
            driving_distance_miles: miles,
          });
          return miles;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") distanceCalculated++;
        else failed++;
      }

      if (i + BATCH_SIZE < needsDistance.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const remainingGeocode = needsGeocode.length - geocodeBatch.length;

    console.log(`✅ Tamamlandı: ${geocoded} geocode, ${distanceCalculated} mesafe, ${failed} hata, ${remainingGeocode} bekliyor`);

    return Response.json({
      success: true,
      geocoded,
      distanceCalculated,
      failed,
      remainingGeocode,
    });
  } catch (error) {
    console.error("❌ Auto process hatası:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});