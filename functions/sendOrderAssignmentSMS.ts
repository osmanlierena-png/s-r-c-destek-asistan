import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { orderIds } = await req.json();
        
        if (!orderIds || orderIds.length === 0) {
            return Response.json({ 
                success: false,
                message: 'Sipariş ID\'leri gerekli' 
            });
        }

        console.log(`\n📦 ${orderIds.length} sipariş için SMS gönderiliyor...`);
        
        // Twilio bilgilerini kontrol et
        const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        let twilioFromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
            return Response.json({ 
                success: false,
                message: 'Twilio bilgileri eksik' 
            });
        }

        // Telefon numarasını temizle
        twilioFromNumber = twilioFromNumber.replace(/[^\d+]/g, '');

        console.log(`\n🚀 PRODUCTION MODU - Tüm sürücülere SMS gönderilecek`);

        const results = {
            sent: [],
            failed: []
        };

        // Her sipariş için SMS gönder
        for (const orderId of orderIds) {
            try {
                // Siparişi getir
                const orders = await base44.asServiceRole.entities.DailyOrder.filter({ id: orderId });
                const order = orders[0];

                if (!order) {
                    results.failed.push({
                        orderId,
                        reason: 'Sipariş bulunamadı'
                    });
                    continue;
                }

                if (!order.driver_id || !order.driver_phone) {
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: 'Sürücü atanmamış veya telefonu yok'
                    });
                    continue;
                }

                // Sürücüyü getir (dil bilgisi için)
                const drivers = await base44.asServiceRole.entities.Driver.filter({ id: order.driver_id });
                const driver = drivers[0];
                const driverLanguage = driver?.language || 'tr';

                // SMS mesajı oluştur
                const messages = {
                    tr: `Merhaba ${driver?.name?.split(' ')[0] || 'Sürücü'}!

📦 Yeni Sipariş: ${order.ezcater_order_id}
📅 Tarih: ${order.order_date}
🕐 Pickup: ${order.pickup_time}
📍 ${order.pickup_address}
🕑 Delivery: ${order.dropoff_time}
📍 ${order.dropoff_address}

Bu siparişi alabilir misiniz?

✅ EVET
❌ HAYIR

Örnek: "EVET" veya "HAYIR"`,
                    
                    en: `Hello ${driver?.name?.split(' ')[0] || 'Driver'}!

📦 New Order: ${order.ezcater_order_id}
📅 Date: ${order.order_date}
🕐 Pickup: ${order.pickup_time}
📍 ${order.pickup_address}
🕑 Delivery: ${order.dropoff_time}
📍 ${order.dropoff_address}

Can you take this order?

✅ YES
❌ NO

Example: "YES" or "NO"`
                };

                const message = messages[driverLanguage];

                console.log(`📤 SMS gönderiliyor: ${order.driver_name} (${order.driver_phone})`);

                // SMS gönder
                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
                
                const formData = new URLSearchParams();
                formData.append('To', order.driver_phone);
                formData.append('From', twilioFromNumber);
                formData.append('Body', message);

                const response = await fetch(twilioUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
                    },
                    body: formData.toString()
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Sipariş durumunu güncelle
                    await base44.asServiceRole.entities.DailyOrder.update(order.id, {
                        status: "Sürücü Onayı Bekleniyor",
                        sms_sent_at: new Date().toISOString()
                    });

                    results.sent.push({
                        orderId: order.ezcater_order_id,
                        driver: order.driver_name,
                        phone: order.driver_phone,
                        sid: data.sid
                    });

                    console.log(`✅ ${order.ezcater_order_id} → ${order.driver_name} (${order.driver_phone})`);
                } else {
                    const errorData = await response.json();
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: errorData.message || 'SMS gönderilemedi'
                    });
                    
                    console.error(`❌ ${order.ezcater_order_id} → Hata: ${errorData.message}`);
                }

                // Rate limiting
                await new Promise(r => setTimeout(r, 1000));

            } catch (error) {
                results.failed.push({
                    orderId,
                    reason: error.message
                });
                console.error(`❌ Sipariş işleme hatası (${orderId}):`, error);
            }
        }

        console.log(`\n📊 Sonuç:`);
        console.log(`   ✅ Gönderilen: ${results.sent.length}`);
        console.log(`   ❌ Başarısız: ${results.failed.length}`);

        return Response.json({
            success: true,
            message: `${results.sent.length} sipariş için SMS gönderildi`,
            sent: results.sent,
            failed: results.failed
        });

    } catch (error) {
        console.error("❌ SMS gönderme hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});