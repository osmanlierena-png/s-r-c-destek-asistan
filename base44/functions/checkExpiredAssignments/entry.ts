import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        console.log('⏰ Zaman aşımı kontrolü başlatılıyor...');

        // "Sürücü Onayı Bekleniyor" durumundaki tüm siparişleri al
        const pendingOrders = await base44.asServiceRole.entities.DailyOrder.filter({
            status: 'Sürücü Onayı Bekleniyor'
        });

        console.log(`📦 ${pendingOrders.length} bekleyen sipariş bulundu`);

        const now = new Date();
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

        const expired = [];
        const skipped = [];

        for (const order of pendingOrders) {
            if (!order.sms_sent_at) {
                skipped.push({ id: order.ezcater_order_id, reason: 'sms_sent_at yok' });
                continue;
            }

            const smsSentAt = new Date(order.sms_sent_at);
            const elapsed = now - smsSentAt;

            if (elapsed >= TWO_HOURS_MS) {
                console.log(`⌛ Zaman aşımı: ${order.ezcater_order_id} (${Math.round(elapsed / 60000)} dk geçti)`);

                await base44.asServiceRole.entities.DailyOrder.update(order.id, {
                    status: 'Sürücü Reddetti',
                    driver_response: 'Zaman Aşımı',
                    driver_response_at: now.toISOString()
                });

                // Zaman aşımı geçmişini logla (driver puanlaması için)
                try {
                    await base44.asServiceRole.entities.DriverTimeoutLog.create({
                        driver_id: order.driver_id,
                        driver_name: order.driver_name,
                        driver_phone: order.driver_phone,
                        order_id: order.id,
                        ezcater_order_id: order.ezcater_order_id,
                        order_date: order.order_date,
                        pickup_time: order.pickup_time,
                        sms_sent_at: order.sms_sent_at,
                        timed_out_at: now.toISOString(),
                        elapsed_minutes: Math.round(elapsed / 60000)
                    });
                } catch (logErr) {
                    console.error('⚠️ Timeout log yazılamadı:', logErr.message);
                }

                expired.push(order.ezcater_order_id);
            } else {
                skipped.push({ id: order.ezcater_order_id, reason: `${Math.round((TWO_HOURS_MS - elapsed) / 60000)} dk kaldı` });
            }
        }

        console.log(`✅ ${expired.length} sipariş zaman aşımına uğradı`);
        console.log(`⏩ ${skipped.length} sipariş atlandı`);

        return Response.json({
            success: true,
            expiredCount: expired.length,
            expired,
            skipped
        });

    } catch (error) {
        console.error('❌ Hata:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});