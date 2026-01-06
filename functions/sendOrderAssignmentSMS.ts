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

                // Kapsamlı telefon numarası doğrulaması
                const phone = order.driver_phone;
                
                // 1. Temel kontroller
                if (!order.driver_id || !phone || phone.trim() === '') {
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: 'Sürücü atanmamış veya telefon numarası eksik'
                    });
                    console.log(`⚠️ ${order.ezcater_order_id} atlandı - Telefon numarası yok`);
                    continue;
                }

                // 2. MISSING kontrolü
                if (phone.toUpperCase().includes('MISSING')) {
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: 'Telefon numarası "MISSING" olarak işaretli'
                    });
                    console.log(`⚠️ ${order.ezcater_order_id} atlandı - MISSING: ${phone}`);
                    continue;
                }

                // 3. Boşluk ve parantez kontrolü
                if (phone.includes(' ') || phone.includes('(') || phone.includes(')')) {
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: 'Telefon numarası geçersiz karakterler içeriyor (boşluk/parantez)'
                    });
                    console.log(`⚠️ ${order.ezcater_order_id} atlandı - Geçersiz format: ${phone}`);
                    continue;
                }

                // 4. Telefon numarasını E.164 formatına çevir
                let toPhoneNumber = phone.trim();
                if (!toPhoneNumber.startsWith('+')) {
                    toPhoneNumber = '+' + toPhoneNumber.replace(/[^\d]/g, '');
                }

                // 5. ABD dışı numara kontrolü
                if (!toPhoneNumber.startsWith('+1')) {
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: `ABD dışı numara tespit edildi: ${toPhoneNumber.substring(0, 4)}...`
                    });
                    console.log(`⚠️ ${order.ezcater_order_id} atlandı - ABD dışı numara: ${toPhoneNumber}`);
                    continue;
                }

                // 6. +1'den sonra rakam kontrolü
                if (toPhoneNumber.match(/^\+1[^0-9]/)) {
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: '+1 sonrası geçersiz karakter'
                    });
                    console.log(`⚠️ ${order.ezcater_order_id} atlandı - +1 sonrası geçersiz: ${toPhoneNumber}`);
                    continue;
                }

                // 7. Uzunluk kontrolü (ABD için +1 + 10 digit = 12 karakter)
                if (toPhoneNumber.length !== 12) {
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: `Geçersiz numara uzunluğu: ${toPhoneNumber.length} karakter (12 olmalı)`
                    });
                    console.log(`⚠️ ${order.ezcater_order_id} atlandı - Yanlış uzunluk: ${toPhoneNumber} (${toPhoneNumber.length} karakter)`);
                    continue;
                }

                // 8. Sadece rakam kontrolü (+1'den sonra)
                const digitsOnly = toPhoneNumber.substring(2);
                if (!/^\d{10}$/.test(digitsOnly)) {
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: 'Telefon numarası sadece rakam içermeli'
                    });
                    console.log(`⚠️ ${order.ezcater_order_id} atlandı - Geçersiz karakter: ${toPhoneNumber}`);
                    continue;
                }

                // Sürücüyü getir (dil bilgisi için)
                const drivers = await base44.asServiceRole.entities.Driver.filter({ id: order.driver_id });
                const driver = drivers[0];
                const driverLanguage = driver?.language || 'tr';

                // Web link oluştur
                const appBaseUrl = 'https://driverapp-ihtiyac.app.base44.com';
                const orderLink = `${appBaseUrl}/DriverOrderView?driver_id=${order.driver_id}&date=${order.order_date}`;

                // SMS mesajı oluştur (link ile)
                const messages = {
                    tr: `🚚 Yeni Sipariş!

📦 ${order.ezcater_order_id}
🕐 Pickup: ${order.pickup_time}
📍 ${order.pickup_address?.substring(0, 40)}...

👉 Detaylı bilgi ve harita:
${orderLink}

✅ EVET - ❌ HAYIR`,
                    
                    en: `🚚 New Order!

📦 ${order.ezcater_order_id}
🕐 Pickup: ${order.pickup_time}
📍 ${order.pickup_address?.substring(0, 40)}...

👉 Details and map:
${orderLink}

✅ YES - ❌ NO`
                };

                const message = messages[driverLanguage];

                console.log(`📤 SMS gönderiliyor: ${order.driver_name} (${toPhoneNumber})`);

                // SMS gönder
                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
                
                const formData = new URLSearchParams();
                formData.append('To', toPhoneNumber);
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