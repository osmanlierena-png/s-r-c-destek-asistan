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

        // Base URL'i al (production/development)
        const baseUrl = Deno.env.get("BASE44_APP_URL") || "https://your-app.base44.com";

        // O tarihteki atanmış siparişleri al
        const assignedOrders = await base44.entities.DailyOrder.filter({
            order_date: targetDate,
            status: "Atandı"
        }, 'pickup_time');

        if (assignedOrders.length === 0) {
            return Response.json({ 
                success: false,
                message: 'Bu tarihte atanmış sipariş bulunamadı' 
            });
        }

        // Sürücülere göre grupla
        const ordersByDriver = {};
        
        for (const order of assignedOrders) {
            if (!ordersByDriver[order.driver_id]) {
                ordersByDriver[order.driver_id] = {
                    driverName: order.driver_name,
                    orders: []
                };
            }
            ordersByDriver[order.driver_id].orders.push(order);
        }

        const results = {
            sent: [],
            failed: []
        };

        // Her sürücüye SMS gönder
        for (const [driverId, data] of Object.entries(ordersByDriver)) {
            try {
                // Sürücüyü bul
                const drivers = await base44.entities.Driver.filter({ id: driverId });
                const driver = drivers[0];

                if (!driver || !driver.phone) {
                    results.failed.push({
                        driver: data.driverName,
                        reason: 'Telefon numarası bulunamadı'
                    });
                    continue;
                }

                // Sipariş görüntüleme linki oluştur
                const orderLink = `${baseUrl}/driver-orders?driver_id=${driverId}&date=${targetDate}`;

                // SMS mesajı (kısa ve öz + link)
                const message = `Merhaba ${driver.name.split(' ')[0]}!\n\n` +
                    `${targetDate} tarihinde ${data.orders.length} siparişiniz var.\n\n` +
                    `Sipariş detaylarını görmek için:\n${orderLink}\n\n` +
                    `İyi çalışmalar! 🚚`;

                // SMS gönder
                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
                
                const formData = new URLSearchParams();
                formData.append('To', driver.phone);
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
                    // Siparişlerin durumunu güncelle
                    for (const order of data.orders) {
                        base44.entities.DailyOrder.update(order.id, {
                            status: "Sürücüye Gönderildi"
                        }).catch(err => console.error('Durum güncellenemedi:', err));
                    }

                    results.sent.push({
                        driver: driver.name,
                        phone: driver.phone,
                        orderCount: data.orders.length,
                        link: orderLink
                    });
                } else {
                    const responseData = await response.json();
                    results.failed.push({
                        driver: driver.name,
                        reason: responseData.message || 'SMS gönderilemedi'
                    });
                }

            } catch (error) {
                results.failed.push({
                    driver: data.driverName,
                    reason: error.message
                });
            }
        }

        return Response.json({
            success: true,
            message: `${results.sent.length} sürücüye sipariş listesi gönderildi`,
            results: results
        });

    } catch (error) {
        console.error("Sipariş gönderme hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});