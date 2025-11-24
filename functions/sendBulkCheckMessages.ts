import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        // Twilio bilgilerini kontrol et
        const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioFromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
            return Response.json({ 
                success: false,
                message: 'Twilio bilgileri eksik. Lütfen ayarlardan Twilio bilgilerinizi girin.' 
            });
        }

        // O tarihteki atanmış siparişleri al
        const assignedOrders = await base44.entities.DailyOrder.filter({
            order_date: targetDate,
            status: "Atandı"
        });

        if (assignedOrders.length === 0) {
            return Response.json({ 
                success: false,
                message: 'Bu tarihte atanmış sipariş bulunamadı' 
            });
        }

        const defaultMessage = "Merhaba {driver_name}, bugün {order_id} nolu siparişiniz var. Her şey hazır mı?";

        const results = {
            sent: [],
            failed: [],
            skipped: []
        };

        // Paralel işleme için promise array
        const sendPromises = assignedOrders.map(async (order) => {
            try {
                // Sürücüyü bul
                const drivers = await base44.entities.Driver.filter({ id: order.driver_id });
                const driver = drivers[0];

                if (!driver) {
                    return { type: 'failed', order: order.ezcater_order_id, reason: 'Sürücü bulunamadı' };
                }

                if (!driver.phone) {
                    return { type: 'failed', order: order.ezcater_order_id, driver: driver.name, reason: 'Telefon numarası yok' };
                }

                // Daha önce mesaj gönderilmiş mi kontrol et
                const existingMessages = await base44.entities.CheckMessage.filter({
                    order_id: order.id,
                    message_type: "Manuel_Kontrol"
                });

                if (existingMessages.length > 0) {
                    return { type: 'skipped', order: order.ezcater_order_id, driver: driver.name, reason: 'Daha önce mesaj gönderilmiş' };
                }

                // Mesajı kişiselleştir
                const personalizedMessage = defaultMessage
                    .replace('{driver_name}', driver.name.split(' ')[0])
                    .replace('{order_id}', order.ezcater_order_id);

                // SMS gönder
                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
                
                const formData = new URLSearchParams();
                formData.append('To', driver.phone);
                formData.append('From', twilioFromNumber);
                formData.append('Body', personalizedMessage);

                const response = await fetch(twilioUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
                    },
                    body: formData.toString()
                });

                if (response.ok) {
                    // CheckMessage kaydı oluştur (await etmeden devam et)
                    base44.entities.CheckMessage.create({
                        order_id: order.id,
                        driver_phone: driver.phone,
                        message_type: "Manuel_Kontrol",
                        message_content: personalizedMessage,
                        sent_time: new Date().toISOString(),
                        alert_level: "Normal"
                    }).catch(err => console.error('CheckMessage kaydı oluşturulamadı:', err));

                    return {
                        type: 'sent',
                        order: order.ezcater_order_id,
                        driver: driver.name,
                        phone: driver.phone,
                        message: personalizedMessage
                    };
                } else {
                    const responseData = await response.json();
                    return {
                        type: 'failed',
                        order: order.ezcater_order_id,
                        driver: driver.name,
                        reason: responseData.message || 'Twilio API hatası'
                    };
                }

            } catch (error) {
                return {
                    type: 'failed',
                    order: order.ezcater_order_id,
                    reason: error.message
                };
            }
        });

        // Tüm mesajları paralel gönder (max 10 batch)
        const batchSize = 10;
        for (let i = 0; i < sendPromises.length; i += batchSize) {
            const batch = sendPromises.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch);
            
            batchResults.forEach(result => {
                if (result.type === 'sent') results.sent.push(result);
                else if (result.type === 'failed') results.failed.push(result);
                else if (result.type === 'skipped') results.skipped.push(result);
            });
        }

        return Response.json({
            success: true,
            message: `${results.sent.length} mesaj gönderildi, ${results.failed.length} başarısız, ${results.skipped.length} atlandı`,
            results: results,
            totalOrders: assignedOrders.length
        });

    } catch (error) {
        console.error("Toplu mesaj gönderim hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});