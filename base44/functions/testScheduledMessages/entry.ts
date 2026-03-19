import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;

    try {
        const body = await req.json();
        const { targetDate } = body;
        const today = targetDate || new Date().toISOString().split('T')[0];
        
        console.log("\n========================================");
        console.log("🧪 DRY RUN - TEST MODU (SMS GÖNDERİLMEZ!)");
        console.log("========================================");
        console.log(`Target Date: ${today}`);
        
        const nowUTC = new Date();
        const EST_OFFSET = -5 * 60;
        const nowEST = new Date(nowUTC.getTime() + EST_OFFSET * 60 * 1000);
        const estHours = nowEST.getUTCHours();
        const estMinutes = nowEST.getUTCMinutes();
        
        console.log(`Şu an (UTC): ${nowUTC.toISOString()}`);
        console.log(`Şu an (EST): ${estHours}:${estMinutes.toString().padStart(2, '0')}`);
        console.log("========================================\n");

        const allSettings = await base44.entities.AutoMessageSettings.list();
        
        if (!allSettings || allSettings.length === 0) {
            return Response.json({ 
                success: false,
                message: 'Otomatik mesaj ayarları bulunamadı.' 
            });
        }
        
        const settings = allSettings[0];
        console.log(`⚙️ Settings:`);
        console.log(`   is_active: ${settings.is_active}`);
        console.log(`   minutes_before: ${settings.minutes_before}`);
        console.log(`\n`);

        const orders = await base44.entities.DailyOrder.filter({
            order_date: today,
            status: "Sürücü Onayladı"
        });

        if (orders.length === 0) {
            return Response.json({ 
                success: true,
                message: `${today} tarihinde sürücü onaylı sipariş bulunamadı`,
                details: [],
                groupedMessages: []
            });
        }

        console.log(`✅ ${orders.length} sürücü onaylı sipariş bulundu\n`);

        const allDrivers = await base44.entities.Driver.list();
        const driverMap = {};
        allDrivers.forEach(driver => {
            driverMap[driver.id] = driver;
        });
        console.log(`✅ ${allDrivers.length} driver yüklendi\n`);

        // 🔥 YENİ: SÜRÜCÜ BAZINDA GRUPLA
        const ordersByDriver = {};
        
        for (const order of orders) {
            if (!order.driver_id) continue;
            
            if (!ordersByDriver[order.driver_id]) {
                ordersByDriver[order.driver_id] = [];
            }
            ordersByDriver[order.driver_id].push(order);
        }

        console.log(`👥 ${Object.keys(ordersByDriver).length} farklı sürücü için siparişler gruplandı\n`);

        const results = [];
        const groupedMessages = [];

        // 🔥 YENİ: Her sürücü için gruplandırma yap
        for (const [driverId, driverOrders] of Object.entries(ordersByDriver)) {
            const driver = driverMap[driverId];
            const driverLanguage = driver?.language || 'tr';
            
            console.log(`\n${'='.repeat(80)}`);
            console.log(`👤 SÜRÜCÜ: ${driver?.name} (${driverId})`);
            console.log(`${'='.repeat(80)}`);
            console.log(`📦 ${driverOrders.length} sipariş\n`);

            // Saat parse fonksiyonu
            const parseTime = (timeString) => {
                if (!timeString) return { hours: 0, minutes: 0 };
                
                const cleanTime = timeString.trim();
                const isPM = cleanTime.toLowerCase().includes('pm');
                const isAM = cleanTime.toLowerCase().includes('am');
                const timePart = cleanTime.replace(/\s*(am|pm)/gi, '').trim();
                const [hourStr, minStr] = timePart.split(':');
                
                let hours = parseInt(hourStr, 10);
                const minutes = parseInt(minStr, 10) || 0;
                
                if (isPM && hours !== 12) {
                    hours += 12;
                } else if (isAM && hours === 12) {
                    hours = 0;
                }
                
                return { hours, minutes };
            };

            // Pickup time'a göre sırala
            const sortedOrders = driverOrders.sort((a, b) => {
                const timeA = parseTime(a.pickup_time || '00:00');
                const timeB = parseTime(b.pickup_time || '00:00');
                const totalA = timeA.hours * 60 + timeA.minutes;
                const totalB = timeB.hours * 60 + timeB.minutes;
                return totalA - totalB;
            });

            // 🔥 YENİ: 2.5 saatlik kurala göre grupla
            const orderGroups = [];
            let currentGroup = [];
            
            for (let i = 0; i < sortedOrders.length; i++) {
                const order = sortedOrders[i];
                
                if (!order.pickup_time) continue;
                
                if (currentGroup.length === 0) {
                    currentGroup.push(order);
                } else {
                    const lastOrder = currentGroup[currentGroup.length - 1];
                    const lastTime = parseTime(lastOrder.pickup_time);
                    const currTime = parseTime(order.pickup_time);
                    
                    const lastTimeInMinutes = lastTime.hours * 60 + lastTime.minutes;
                    const currTimeInMinutes = currTime.hours * 60 + currTime.minutes;
                    const diffInMinutes = currTimeInMinutes - lastTimeInMinutes;
                    
                    console.log(`⏰ ${lastOrder.pickup_time} → ${order.pickup_time} = ${diffInMinutes} dk`);
                    
                    if (diffInMinutes <= 150) {
                        currentGroup.push(order);
                        console.log(`✅ Gruba eklendi`);
                    } else {
                        orderGroups.push([...currentGroup]);
                        currentGroup = [order];
                        console.log(`❌ Yeni grup başlatıldı`);
                    }
                }
            }
            
            if (currentGroup.length > 0) {
                orderGroups.push(currentGroup);
            }

            console.log(`\n📊 ${orderGroups.length} grup oluşturuldu\n`);

            // Her grup için analiz yap
            for (let groupIdx = 0; groupIdx < orderGroups.length; groupIdx++) {
                const group = orderGroups[groupIdx];
                const isGrouped = group.length > 1;
                const firstOrder = group[0];

                console.log(`\n--- GRUP ${groupIdx + 1}/${orderGroups.length} (${group.length} sipariş) ---`);
                
                const firstTime = parseTime(firstOrder.pickup_time);
                const pickupTimeInMinutes = firstTime.hours * 60 + firstTime.minutes;
                const currentTimeInMinutes = estHours * 60 + estMinutes;
                const minutesUntilPickup = pickupTimeInMinutes - currentTimeInMinutes;
                
                const minThreshold = settings.minutes_before - 5;
                const maxThreshold = settings.minutes_before + 5;
                const shouldSendNow = minutesUntilPickup >= minThreshold && minutesUntilPickup <= maxThreshold;
                
                console.log(`⏱️ Pickup'a ${minutesUntilPickup} dk kaldı`);
                console.log(`📏 Threshold: ${minThreshold}-${maxThreshold} dk`);
                console.log(`${shouldSendNow ? '✅' : '❌'} Zaman uygun: ${shouldSendNow}`);

                let status, reason;
                
                if (shouldSendNow) {
                    status = isGrouped ? '✅ GÖNDERİLECEK (GRUP)' : '✅ GÖNDERİLECEK (TEKİL)';
                    reason = `Zaman penceresinde (${minutesUntilPickup} dk kaldı)`;
                } else if (minutesUntilPickup > maxThreshold) {
                    status = '⏰ HENÜZ ERKEN';
                    reason = `${minutesUntilPickup - settings.minutes_before} dakika daha erken`;
                } else {
                    status = '❌ GEÇMİŞ';
                    reason = `Zaman geçti (${minutesUntilPickup} dk kaldı)`;
                }

                // Grup mesajı kaydı oluştur
                const groupRecord = {
                    driver: `${driver?.name} (${driverLanguage})`,
                    phone: firstOrder.driver_phone,
                    message_type: isGrouped ? '🔗 GRUP MESAJI' : '📄 Tekil Mesaj',
                    order_count: group.length,
                    orders: group.map(o => ({
                        order_id: o.ezcater_order_id,
                        pickup_time: o.pickup_time,
                        pickup_address: o.pickup_address
                    })),
                    pickup_time: firstOrder.pickup_time,
                    minutes_until_pickup: minutesUntilPickup,
                    status: status,
                    reason: reason,
                    would_send: shouldSendNow
                };

                groupedMessages.push(groupRecord);

                // Her sipariş için de ayrı kayıt oluştur (backward compatibility)
                for (const order of group) {
                    results.push({
                        order_id: order.ezcater_order_id,
                        driver: `${driver?.name} (${driverLanguage})`,
                        phone: order.driver_phone || 'N/A',
                        pickup_time_raw: order.pickup_time,
                        status: status,
                        reason: reason,
                        would_send: shouldSendNow,
                        is_grouped: isGrouped,
                        group_size: group.length
                    });
                }
            }
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 ÖZET`);
        console.log(`${'='.repeat(80)}`);
        console.log(`💬 Toplam Mesaj: ${groupedMessages.length}`);
        console.log(`🔗 Gruplandırılmış: ${groupedMessages.filter(m => m.order_count > 1).length}`);
        console.log(`📄 Tekil: ${groupedMessages.filter(m => m.order_count === 1).length}`);
        console.log(`✅ Gönderilecek: ${groupedMessages.filter(m => m.would_send).length}`);
        console.log(`${'='.repeat(80)}\n`);

        return Response.json({
            success: true,
            message: `Test tamamlandı - ${groupedMessages.filter(m => m.would_send).length} mesaj gönderilecek`,
            details: results,
            groupedMessages: groupedMessages,
            summary: {
                total: results.length,
                total_messages: groupedMessages.length,
                grouped_messages: groupedMessages.filter(m => m.order_count > 1).length,
                single_messages: groupedMessages.filter(m => m.order_count === 1).length,
                would_send: groupedMessages.filter(m => m.would_send).length,
                too_early: groupedMessages.filter(m => m.status.includes('ERKEN')).length,
                too_late: groupedMessages.filter(m => m.status.includes('GEÇMİŞ')).length
            },
            debug: {
                server_utc: nowUTC.toISOString(),
                est_time: `${estHours}:${estMinutes.toString().padStart(2, '0')}`
            }
        });

    } catch (error) {
        console.error("\n❌ HATA:", error);
        console.error("Stack:", error.stack);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});