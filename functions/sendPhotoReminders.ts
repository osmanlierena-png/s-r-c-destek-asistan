import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // 📋 SADECE bugünkü ve onaylanmış siparişleri al
        const orders = await base44.asServiceRole.entities.DailyOrder.filter({
            order_date: today,
            status: 'Sürücü Onayladı'
        });

        console.log(`📊 Toplam ${orders.length} onaylanmış sipariş bulundu (${today})`);

        // Twilio bilgilerini kontrol et
        const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        let twilioFromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
            console.error('❌ Twilio bilgileri eksik');
            return Response.json({
                success: false,
                error: 'Twilio bilgileri eksik',
                results
            });
        }

        twilioFromNumber = twilioFromNumber.replace(/[^\d+]/g, '');

        for (const order of orders) {
            try {
                // 🛡️ GÜVENLIK: Eksik bilgileri kontrol et
                if (!order.dropoff_time || !order.driver_phone || !order.driver_id) {
                    console.log(`⏩ Atlanan: ${order.ezcater_order_id} - Eksik bilgi`);
                    continue;
                }

                // 🛡️ GÜVENLIK: Order date formatını kontrol et
                if (!order.order_date || !/^\d{4}-\d{2}-\d{2}$/.test(order.order_date)) {
                    console.error(`❌ ${order.ezcater_order_id}: Geçersiz order_date formatı: ${order.order_date}`);
                    continue;
                }

                // 📅 Dropoff time'ı parse et (AM/PM desteği)
                let dropoffDate;
                try {
                    const timeStr = order.dropoff_time.trim();
                    const isPM = timeStr.toLowerCase().includes('pm');
                    const isAM = timeStr.toLowerCase().includes('am');
                    const timePart = timeStr.replace(/\s*(am|pm)/gi, '').trim();
                    const [hourStr, minStr] = timePart.split(':');

                    if (!hourStr || !minStr) {
                        throw new Error(`Geçersiz time formatı: ${order.dropoff_time}`);
                    }

                    let hours = parseInt(hourStr, 10);
                    const minutes = parseInt(minStr, 10);

                    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                        throw new Error(`Geçersiz saat/dakika değeri: ${order.dropoff_time}`);
                    }

                    if (isPM && hours !== 12) {
                        hours += 12;
                    } else if (isAM && hours === 12) {
                        hours = 0;
                    }

                    // Dropoff tarih-saat oluştur
                    dropoffDate = new Date(order.order_date + 'T00:00:00');
                    dropoffDate.setHours(hours, minutes, 0, 0);

                    if (isNaN(dropoffDate.getTime())) {
                        throw new Error(`Tarih oluşturulamadı: ${order.order_date} ${order.dropoff_time}`);
                    }
                } catch (parseError) {
                    console.error(`❌ ${order.ezcater_order_id}: Time parse hatası: ${parseError.message}`);
                    continue;
                }

                // ⏰ 5 dakika önce kontrolü
                const fiveMinutesBefore = new Date(dropoffDate.getTime() - 5 * 60 * 1000);
                const diffMinutes = (fiveMinutesBefore - now) / (1000 * 60);

                // ±1 dakika tolerans
                if (diffMinutes < -1 || diffMinutes > 1) continue;

                // 🛡️ MALİYET KONTROLÜ: Dropoff geçmiş mi?
                if (dropoffDate < now) {
                    console.log(`⏩ Atlanan: ${order.ezcater_order_id} - Dropoff geçmiş (${order.dropoff_time})`);
                    continue;
                }

                // 🔍 Daha önce mesaj gönderilmiş mi kontrol et
                const existingMessages = await base44.asServiceRole.entities.CheckMessage.filter({
                    order_id: order.id,
                    message_type: '5dk_Fotograf_Hatirlatma'
                });

                if (existingMessages.length > 0) {
                    console.log(`⏩ Atlanan: ${order.ezcater_order_id} - Mesaj zaten gönderilmiş`);
                    continue;
                }

                // 💬 Mesaj içeriği (SADECE İNGİLİZCE - CEVAP BEKLENMİYOR)
                const messageContent = `📸 Don't forget to take a photo!`;

                // 📞 Telefon numarası temizleme ve validasyon
                const rawPhone = order.driver_phone.trim();

                // "MISSING" kontrolü
                if (rawPhone.toUpperCase().includes('MISSING') || rawPhone === '' || rawPhone === '-') {
                    console.log(`⏩ Atlanan: ${order.ezcater_order_id} - Telefon numarası eksik (${rawPhone})`);
                    continue;
                }

                let toPhoneNumber = rawPhone;
                if (!toPhoneNumber.startsWith('+')) {
                    toPhoneNumber = '+' + toPhoneNumber.replace(/[^\d]/g, '');
                }

                if (!toPhoneNumber.startsWith('+1') || toPhoneNumber.length !== 12) {
                    console.error(`❌ ${order.ezcater_order_id}: Geçersiz telefon numarası: ${toPhoneNumber}`);

                    // Başarısız mesaj kaydı oluştur
                    await base44.asServiceRole.entities.CheckMessage.create({
                        order_id: order.id,
                        driver_phone: order.driver_phone,
                        message_type: '5dk_Fotograf_Hatirlatma',
                        message_content: messageContent,
                        sent_time: now.toISOString(),
                        message_status: 'failed',
                        failure_reason: 'Geçersiz telefon numarası',
                        alert_level: 'Uyarı'
                    });
                    continue;
                }

                // 📤 SMS gönder
                console.log(`📤 ${order.ezcater_order_id} → ${order.driver_name}`);

                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
                const formData = new URLSearchParams();
                formData.append('To', toPhoneNumber);
                formData.append('From', twilioFromNumber);
                formData.append('Body', messageContent);

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
                    await base44.asServiceRole.entities.CheckMessage.create({
                        order_id: order.id,
                        driver_phone: order.driver_phone,
                        message_type: '5dk_Fotograf_Hatirlatma',
                        message_content: messageContent,
                        sent_time: now.toISOString(),
                        response_received: false, // ⚠️ CEVAP BEKLENMİYOR
                        message_status: 'sent',
                        twilio_sid: data.sid,
                        alert_level: 'Normal'
                    });
                    console.log(`✅ ${order.ezcater_order_id}: Mesaj gönderildi`);
                } else {
                    const errorData = await response.json();
                    await base44.asServiceRole.entities.CheckMessage.create({
                        order_id: order.id,
                        driver_phone: order.driver_phone,
                        message_type: '5dk_Fotograf_Hatirlatma',
                        message_content: messageContent,
                        sent_time: now.toISOString(),
                        response_received: false,
                        message_status: 'failed',
                        failure_reason: errorData.message || 'SMS gönderilemedi',
                        alert_level: 'Uyarı'
                    });
                    console.error(`❌ ${order.ezcater_order_id}: SMS hatası: ${errorData.message}`);
                }

                // Rate limiting
                await new Promise(r => setTimeout(r, 1000));

            } catch (error) {
                console.error(`❌ ${order.ezcater_order_id}: Beklenmeyen hata: ${error.message}`);

                // Kritik hatalarda da kayıt oluştur
                try {
                    await base44.asServiceRole.entities.CheckMessage.create({
                        order_id: order.id,
                        driver_phone: order.driver_phone || 'UNKNOWN',
                        message_type: '5dk_Fotograf_Hatirlatma',
                        message_content: 'Error occurred before sending',
                        sent_time: now.toISOString(),
                        message_status: 'failed',
                        failure_reason: `Kritik hata: ${error.message}`,
                        alert_level: 'Acil'
                    });
                } catch (logError) {
                    console.error(`❌ Hata kaydı bile oluşturulamadı: ${logError.message}`);
                }
            }
        }

        return Response.json({ 
            success: true,
            message: `Foto hatırlatma kontrolü tamamlandı - ${today}`
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});