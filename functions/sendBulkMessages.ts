import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        if (!(await base44.auth.isAuthenticated())) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { targetDate, messageTemplate, messageType, specificDriverId } = await req.json();
        
        if (!messageTemplate) {
            return Response.json({ 
                success: false,
                error: 'Mesaj şablonu gerekli' 
            });
        }

        console.log(`📤 Toplu mesaj gönderiliyor... (Tip: ${messageType || 'approved_only'})`);

        const driverMap = new Map();

        if (messageType === 'specific_driver' && specificDriverId) {
            // Belirli bir sürücüye gönder
            console.log(`🎯 Belirli sürücüye gönderim: ${specificDriverId}`);
            const driver = await base44.asServiceRole.entities.Driver.get('Driver', specificDriverId);
            
            if (!driver || !driver.phone) {
                return Response.json({
                    success: false,
                    error: 'Sürücü bulunamadı veya telefon numarası eksik'
                });
            }

            driverMap.set(driver.id, {
                name: driver.name,
                phone: driver.phone,
                orderCount: 0
            });
        } else if (messageType === 'all_active') {
            // Tüm aktif sürücülere gönder
            console.log(`📞 Tüm aktif sürücülere gönderim`);
            const allDrivers = await base44.asServiceRole.entities.Driver.filter({
                status: 'Aktif'
            });

            for (const driver of allDrivers) {
                if (driver.phone && driver.phone.trim() !== '') {
                    driverMap.set(driver.id, {
                        name: driver.name,
                        phone: driver.phone,
                        orderCount: 0
                    });
                }
            }
        } else {
            // Onaylanmış siparişlerin sürücülerine gönder (varsayılan)
            if (!targetDate) {
                return Response.json({ 
                    success: false,
                    error: 'Tarih gerekli' 
                });
            }

            console.log(`✅ ${targetDate} tarihindeki onaylı siparişlere gönderim`);
            const orders = await base44.asServiceRole.entities.DailyOrder.filter({
                order_date: targetDate,
                status: 'Sürücü Onayladı'
            });

            console.log(`📦 ${orders.length} onaylanmış sipariş bulundu`);

            if (orders.length === 0) {
                return Response.json({
                    success: true,
                    message: `${targetDate} tarihinde onaylanmış sipariş bulunamadı`,
                    sent: 0,
                    failed: 0
                });
            }

            for (const order of orders) {
                if (order.driver_id && order.driver_phone && order.driver_name) {
                    if (!driverMap.has(order.driver_id)) {
                        driverMap.set(order.driver_id, {
                            name: order.driver_name,
                            phone: order.driver_phone,
                            orderCount: 0
                        });
                    }
                    driverMap.get(order.driver_id).orderCount++;
                }
            }
        }

        console.log(`👥 ${driverMap.size} farklı sürücüye mesaj gönderilecek`);

        const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

        if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
            return Response.json({
                success: false,
                error: 'Twilio bilgileri eksik'
            }, { status: 500 });
        }

        const results = {
            sent: 0,
            failed: 0,
            errors: []
        };

        // Her sürücüye mesaj gönder
        for (const [driverId, driver] of driverMap) {
            try {
                // Mesaj şablonunu kişiselleştir
                const personalizedMessage = messageTemplate.replace(/{driver_name}/g, driver.name);

                console.log(`📨 ${driver.name} (${driver.phone}) - ${driver.orderCount} sipariş`);

                const response = await fetch(
                    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: new URLSearchParams({
                            To: driver.phone,
                            From: twilioPhoneNumber,
                            Body: personalizedMessage
                        })
                    }
                );

                if (response.ok) {
                    results.sent++;
                    console.log(`✅ Başarılı: ${driver.name}`);
                } else {
                    const errorData = await response.json();
                    results.failed++;
                    results.errors.push({
                        driver: driver.name,
                        phone: driver.phone,
                        error: errorData.message
                    });
                    console.error(`❌ Başarısız: ${driver.name} - ${errorData.message}`);
                }

            } catch (error) {
                results.failed++;
                results.errors.push({
                    driver: driver.name,
                    phone: driver.phone,
                    error: error.message
                });
                console.error(`❌ Hata (${driver.name}):`, error);
            }
        }

        console.log(`\n📊 Sonuç: ${results.sent} başarılı, ${results.failed} başarısız`);

        return Response.json({
            success: true,
            message: `${results.sent} mesaj gönderildi${results.failed > 0 ? `, ${results.failed} başarısız` : ''}`,
            sent: results.sent,
            failed: results.failed,
            errors: results.errors,
            totalDrivers: driverMap.size
        });

    } catch (error) {
        console.error('❌ Toplu mesaj gönderme hatası:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});