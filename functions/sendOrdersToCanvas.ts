import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Canvas URL'si - Environment variable kullan
const CANVAS_URL = Deno.env.get("CANVAS_URL") || 'https://order-assignment-system.vercel.app';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    // Authentication kontrolü
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { date } = await req.json();
        
        if (!date) {
            return Response.json({ 
                success: false,
                error: 'Tarih parametresi gerekli' 
            });
        }

        console.log(`📤 ${date} tarihindeki siparişler Canvas'a gönderiliyor...`);

        // 1. Sadece atanmamış siparişleri çek (Service Role ile)
        const orders = await base44.asServiceRole.entities.DailyOrder.filter({
            order_date: date,
            status: 'Çekildi'
        }, '-created_date', 500);

        if (orders.length === 0) {
            return Response.json({
                success: false,
                error: `${date} tarihinde sipariş bulunamadı`
            });
        }

        console.log(`📦 ${orders.length} sipariş Canvas'a gönderiliyor...`);

        // 3. Canvas'a gönder
        const response = await fetch(`${CANVAS_URL}/api/base44/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                orders: orders.map(o => ({
                    id: o.id,
                    orderNumber: o.ezcater_order_id || o.id,
                    pickupTime: o.pickup_time,
                    pickupAddress: o.pickup_address,
                    dropoffTime: o.dropoff_time,
                    dropoffAddress: o.dropoff_address,
                    pickupLat: o.pickup_coords?.lat,
                    pickupLng: o.pickup_coords?.lng,
                    dropoffLat: o.dropoff_coords?.lat,
                    dropoffLng: o.dropoff_coords?.lng,
                    status: o.status,
                    customerName: o.customer_name,
                    driverName: o.driver_name,
                    driverPhone: o.driver_phone
                }))
            })
        });

        // 4. Response kontrolü
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Canvas API hatası: ${response.status}`, errorText);
            return Response.json({
                success: false,
                error: `Canvas API hatası: ${response.status} - ${errorText}`
            });
        }

        const result = await response.json();

        console.log(`✅ Canvas'a gönderim başarılı: ${result.message || 'OK'}`);

        // Slack'e bildirim gönder
        const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
        if (slackWebhookUrl) {
            try {
                const slackMessage = {
                    text: `🚀 *Siparişler Canvas'a Gönderildi!*`,
                    blocks: [
                        {
                            type: "section",
                            text: {
                                type: "mrkdwn",
                                text: `🚀 *Siparişler Canvas'a Gönderildi!*\n\n📦 *Sipariş Sayısı:* ${orders.length}\n📅 *Tarih:* ${date}\n✅ *Durum:* Başarılı`
                            }
                        },
                        {
                            type: "actions",
                            elements: [
                                {
                                    type: "button",
                                    text: {
                                        type: "plain_text",
                                        text: "Canvas'ı Aç"
                                    },
                                    url: `${CANVAS_URL}/atama`
                                }
                            ]
                        }
                    ]
                };

                await fetch(slackWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(slackMessage)
                });

                console.log('✅ Slack bildirimi gönderildi');
            } catch (slackError) {
                console.error('⚠️ Slack bildirimi gönderilemedi:', slackError);
                // Slack hatası ana işlemi etkilemesin
            }
        }

        return Response.json({
            success: result.success,
            message: result.message || 'Siparişler Canvas\'a gönderildi',
            ordersCount: orders.length,
            canvasUrl: `${CANVAS_URL}/atama`,
            imported: result.imported
        });

    } catch (error) {
        console.error('❌ Canvas\'a gönderme hatası:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});