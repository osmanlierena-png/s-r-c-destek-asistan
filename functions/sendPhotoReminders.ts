import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        const orders = await base44.asServiceRole.entities.DailyOrder.filter({
            order_date: today,
            status: 'Sürücü Onayladı'
        });

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
                if (!order.dropoff_time || !order.driver_phone || !order.driver_id) continue;

                // Dropoff time'ı parse et (AM/PM desteği)
                const timeStr = order.dropoff_time.trim();
                const isPM = timeStr.toLowerCase().includes('pm');
                const isAM = timeStr.toLowerCase().includes('am');
                const timePart = timeStr.replace(/\s*(am|pm)/gi, '').trim();
                const [hourStr, minStr] = timePart.split(':');
                let hours = parseInt(hourStr, 10);
                const minutes = parseInt(minStr, 10) || 0;

                if (isPM && hours !== 12) {
                    hours += 12;
                } else if (isAM && hours === 12) {
                    hours = 0;
                }

                // Dropoff tarih-saat oluştur
                const dropoffDate = new Date(order.order_date + 'T00:00:00');
                dropoffDate.setHours(hours, minutes, 0, 0);

                // 5 dakika önce
                const fiveMinutesBefore = new Date(dropoffDate.getTime() - 5 * 60 * 1000);
                const diffMinutes = (fiveMinutesBefore - now) / (1000 * 60);

                if (diffMinutes < -1 || diffMinutes > 1) continue;

                const existingMessages = await base44.asServiceRole.entities.CheckMessage.filter({
                    order_id: order.id,
                    message_type: '5dk_Fotograf_Hatirlatma'
                });

                if (existingMessages.length > 0) continue;

                // Sürücü dilini al
                const drivers = await base44.asServiceRole.entities.Driver.filter({
                    id: order.driver_id
                });
                const driverLanguage = (drivers.length > 0 && drivers[0].language) ? drivers[0].language : 'tr';

                // Mesaj içeriği
                let messageContent;
                if (driverLanguage === 'en') {
                    messageContent = `📸 REMINDER!\n\nYour delivery to ${order.dropoff_address} is in 5 minutes.\n\n⚠️ DON'T FORGET TO TAKE A PHOTO when you drop off!\n\nOrder: ${order.ezcater_order_id}`;
                } else {
                    messageContent = `📸 HATIRLATMA!\n\n${order.dropoff_address} adresine teslimatın 5 dakika sonra.\n\n⚠️ TESLİM EDERKEN FOTOĞRAF ÇEKMEYİ UNUTMA!\n\nSipariş: ${order.ezcater_order_id}`;
                }

                // Telefon numarası temizleme ve validasyon
                let toPhoneNumber = order.driver_phone.trim();
                if (!toPhoneNumber.startsWith('+')) {
                    toPhoneNumber = '+' + toPhoneNumber.replace(/[^\d]/g, '');
                }

                if (!toPhoneNumber.startsWith('+1') || toPhoneNumber.length !== 12) continue;

                // SMS gönder
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
                        driver_language: driverLanguage,
                        message_type: '5dk_Fotograf_Hatirlatma',
                        message_content: messageContent,
                        sent_time: now.toISOString(),
                        message_status: 'sent',
                        twilio_sid: data.sid,
                        alert_level: 'Normal'
                    });
                } else {
                    const errorData = await response.json();
                    await base44.asServiceRole.entities.CheckMessage.create({
                        order_id: order.id,
                        driver_phone: order.driver_phone,
                        driver_language: driverLanguage,
                        message_type: '5dk_Fotograf_Hatirlatma',
                        message_content: messageContent,
                        sent_time: now.toISOString(),
                        message_status: 'failed',
                        failure_reason: errorData.message || 'SMS gönderilemedi',
                        alert_level: 'Uyarı'
                    });
                }

                await new Promise(r => setTimeout(r, 1000));

            } catch (error) {
                console.error(`❌ ${order.ezcater_order_id}: ${error.message}`);
            }
        }

        return Response.json({ success: true });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});