import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import { validateAddressZip } from "../../shared/zipValidator.ts";

// Sipariş verilerini doğrular:
// 1) Pickup/dropoff ZIP kodlarını Google Geocoding ile doğrular ve düzeltir
// 2) Koordinatları Google'dan set eder (Nominatim'den daha doğru)
// 3) Fiyat/bahşiş anomalisi tespit eder → data_quality_flag atar
// 4) Düzeltilen adreslerin orijinalini original_pickup/dropoff_address'a kaydeder
// Hiçbir siparişi engellemez — sadece işaretler ve düzeltir

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { date, order_ids } = await req.json();
        const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

        if (!apiKey) {
            return Response.json({ error: 'GOOGLE_MAPS_API_KEY eksik' }, { status: 500 });
        }

        // Siparişleri çek
        let orders;
        if (order_ids && Array.isArray(order_ids) && order_ids.length > 0) {
            orders = await base44.asServiceRole.entities.DailyOrder.filter({
                id: { $in: order_ids }
            }, '-created_date', 500);
        } else if (date) {
            orders = await base44.asServiceRole.entities.DailyOrder.filter({
                order_date: date
            }, '-created_date', 500);
        } else {
            return Response.json({ error: 'date veya order_ids gerekli' });
        }

        let zipFixed = 0;
        let zipSuspect = 0;
        let priceFlagged = 0;
        let coordsSet = 0;
        const errors = [];

        for (const order of orders) {
            try {
                const updates: any = {};
                const flags: string[] = [];

                // Pickup ZIP doğrula
                if (order.pickup_address) {
                    const pickupResult = await validateAddressZip(order.pickup_address, apiKey);
                    if (pickupResult.fixed_address) {
                        updates.original_pickup_address = order.pickup_address;
                        updates.pickup_address = pickupResult.fixed_address;
                        zipFixed++;
                    }
                    if (pickupResult.coords) {
                        updates.pickup_coords = pickupResult.coords;
                        coordsSet++;
                    }
                    if (pickupResult.quality_flag) {
                        flags.push(pickupResult.quality_flag);
                    }
                }

                await new Promise(r => setTimeout(r, 100)); // Rate limit

                // Dropoff ZIP doğrula
                if (order.dropoff_address) {
                    const dropoffResult = await validateAddressZip(order.dropoff_address, apiKey);
                    if (dropoffResult.fixed_address) {
                        updates.original_dropoff_address = order.dropoff_address;
                        updates.dropoff_address = dropoffResult.fixed_address;
                        zipFixed++;
                    }
                    if (dropoffResult.coords) {
                        updates.dropoff_coords = dropoffResult.coords;
                        coordsSet++;
                    }
                    if (dropoffResult.quality_flag) {
                        flags.push(dropoffResult.quality_flag);
                    }
                }

                // Fiyat/bahşiş anomali kontrolü
                const price = Number(order.price);
                const tip = Number(order.tip);
                if (!price || price === 0 || isNaN(price)) {
                    flags.push('Fiyat kontrol');
                    priceFlagged++;
                } else if (tip > 0 && (tip / price) > 0.5) {
                    flags.push('Fiyat kontrol');
                    priceFlagged++;
                }

                if (flags.length > 0) {
                    updates.data_quality_flag = flags.join(', ');
                    if (flags.includes('ZIP şüpheli')) zipSuspect++;
                }

                // Update order
                if (Object.keys(updates).length > 0) {
                    await base44.asServiceRole.entities.DailyOrder.update(order.id, updates);
                }

                await new Promise(r => setTimeout(r, 100)); // Rate limit
            } catch (e) {
                errors.push({ order_id: order.ezcater_order_id, error: e.message });
            }
        }

        return Response.json({
            success: true,
            totalOrders: orders.length,
            zipFixed,
            zipSuspect,
            priceFlagged,
            coordsSet,
            errors
        });

    } catch (error) {
        console.error("validateOrderData hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});