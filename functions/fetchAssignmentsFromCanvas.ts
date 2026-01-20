import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CANVAS_URL = Deno.env.get("CANVAS_URL");
const CANVAS_API_SECRET = Deno.env.get("CANVAS_API_SECRET");

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
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

        if (!CANVAS_URL) {
            return Response.json({ 
                success: false,
                error: 'CANVAS_URL environment variable tanımlı değil' 
            });
        }

        console.log(`📥 ${date} tarihindeki atamalar Canvas'tan çekiliyor...`);

        // Canvas'tan atamaları çek
        const canvasApiUrl = `${CANVAS_URL}/api/base44/assignments?date=${date}`;

        console.log(`🔐 Secret durumu: ${CANVAS_API_SECRET ? 'VAR (' + CANVAS_API_SECRET.substring(0, 5) + '...)' : 'YOK'}`);
        console.log(`🌐 API URL: ${canvasApiUrl}`);

        const headers = {
            'Content-Type': 'application/json'
        };

        if (CANVAS_API_SECRET) {
            headers['X-API-Secret'] = CANVAS_API_SECRET;
        }

        console.log(`📤 Request başlıyor...`);

        let response;
        try {
            response = await fetch(canvasApiUrl, {
                method: 'GET',
                headers
            });
            console.log(`✅ Canvas response alındı: ${response.status}`);
        } catch (fetchError) {
            console.error(`❌ Canvas'a request atılamadı:`, fetchError);
            return Response.json({
                success: false,
                error: `Canvas'a bağlanılamadı: ${fetchError.message}`
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Canvas API hatası: ${response.status}`, errorText);
            return Response.json({
                success: false,
                error: `Canvas API hatası: ${response.status} - ${errorText}`
            });
        }

        let canvasData;
        try {
            canvasData = await response.json();
            console.log(`✅ JSON parse edildi`);
        } catch (jsonError) {
            console.error(`❌ JSON parse hatası:`, jsonError);
            return Response.json({
                success: false,
                error: `Canvas response parse edilemedi: ${jsonError.message}`
            });
        }
        
        console.log('🔍 Canvas Response:', JSON.stringify(canvasData, null, 2));

        if (!canvasData.success || !canvasData.assignments) {
            return Response.json({
                success: false,
                error: 'Canvas\'tan geçersiz veri döndü'
            });
        }

        const assignments = canvasData.assignments;
        console.log(`📦 ${assignments.length} atama alındı`);
        console.log('📋 İlk atama örneği:', JSON.stringify(assignments[0], null, 2));

        // 🔍 Canvas'tan gelen fiyat field'ını kontrol et
        if (assignments.length > 0) {
            const sample = assignments[0];
            console.log(`💰 Fiyat Field Analizi:`);
            console.log(`   - assignment.price: ${sample.price} (type: ${typeof sample.price})`);
            console.log(`   - assignment.offer: ${sample.offer} (type: ${typeof sample.offer})`);
            console.log(`   - assignment.payment: ${sample.payment} (type: ${typeof sample.payment})`);
            console.log(`   - assignment.driverPayment: ${sample.driverPayment} (type: ${typeof sample.driverPayment})`);
            console.log(`   - Tüm keys: ${Object.keys(sample).join(', ')}`);
        }

        if (assignments.length === 0) {
            return Response.json({
                success: true,
                message: `${date} tarihinde Canvas'ta atama bulunamadı`,
                updated: 0,
                failed: 0
            });
        }

        // Her atama için DailyOrder'ı güncelle
        let updated = 0;
        let failed = 0;
        let skipped = 0;
        const skippedDetails = [];

        for (const assignment of assignments) {
            try {
                console.log(`\n🔍 İşleniyor: ${assignment.orderNumber || assignment.id} → ${assignment.driverName}`);

                // Siparişi Base44 ID ile bul (en güvenilir yöntem)
                const orders = await base44.asServiceRole.entities.DailyOrder.filter({
                    id: assignment.orderId
                }, null, 1);

                if (orders.length === 0) {
                    console.log(`⚠️ Sipariş bulunamadı: ${assignment.orderNumber || assignment.orderId}`);
                    failed++;
                    continue;
                }
                
                const order = orders[0];

                // ⚠️ GÜNCEL KRİTİK KONTROLLER - Sürücü etkileşimi olan siparişleri koruma

                // 1. Status kontrolü - ANCAK yeniden atama yapılmışsa güncelle
                const rejectableStatuses = ['Sürücü Reddetti', 'Yeniden Atama Havuzu'];
                const finalStatuses = [
                    'Sürücü Onayladı',
                    'Sürücüye Gönderildi',
                    'Yolda',
                    'Tamamlandı',
                    'Problem'
                ];

                // Eğer Canvas'ta yeni sürücü atanmışsa ve Base44'te reddedilmiş/havuzdaysa → GÜNCELLE
                const isReassigned = rejectableStatuses.includes(order.status) && assignment.driverName;

                // Final statuslarda → ATLA
                if (finalStatuses.includes(order.status)) {
                    console.log(`⏩ Atlandı (Final Status): ${order.ezcater_order_id} - Durum: ${order.status}`);
                    skipped++;
                    skippedDetails.push({
                        orderId: order.ezcater_order_id,
                        reason: `Status: ${order.status}`,
                        canvasDriver: assignment.driverName
                    });
                    continue;
                }

                // Yeniden atama DEĞİLSE - SMS ve yanıt kontrolü yap
                if (!isReassigned) {
                    // SMS gönderilmiş mi kontrolü
                    if (order.sms_sent_at) {
                        console.log(`⏩ Atlandı (SMS): ${order.ezcater_order_id} - SMS gönderilmiş: ${order.sms_sent_at}`);
                        skipped++;
                        skippedDetails.push({
                            orderId: order.ezcater_order_id,
                            reason: 'SMS gönderilmiş',
                            canvasDriver: assignment.driverName
                        });
                        continue;
                    }

                    // Sürücü yanıtı var mı kontrolü
                    if (order.driver_response) {
                        console.log(`⏩ Atlandı (Yanıt): ${order.ezcater_order_id} - Yanıt: ${order.driver_response}`);
                        skipped++;
                        skippedDetails.push({
                            orderId: order.ezcater_order_id,
                            reason: `Yanıt: ${order.driver_response}`,
                            canvasDriver: assignment.driverName
                        });
                        continue;
                    }
                }
                
                console.log(`   ✓ Sipariş bulundu ve güncellenebilir: ${orders[0].ezcater_order_id} - Durum: ${order.status}`);

                // Canvas'ta atanmamış siparişlere dokunma
                if (!assignment.driverName) {
                    console.log(`   ⏩ Atlandı: Canvas'ta sürücü yok, Base44'teki mevcut atamaya dokunmuyoruz`);
                    skipped++;
                    skippedDetails.push({
                        orderId: order.ezcater_order_id,
                        reason: 'Canvas\'ta atanmamış',
                        currentDriver: order.driver_name || 'Yok'
                    });
                    continue;
                }

                // 🔥 Sürücüyü isimle bul - driver_id ve driver_phone al
                let driverId = null;
                let driverPhone = null;

                // Tüm aktif sürücüleri çek ve case-insensitive karşılaştırma yap
                const allDrivers = await base44.asServiceRole.entities.Driver.filter({
                    status: 'Aktif'
                });
                
                const matchedDriver = allDrivers.find(d => 
                    d.name && d.name.trim().toLowerCase() === assignment.driverName.trim().toLowerCase()
                );
                
                if (matchedDriver) {
                    driverId = matchedDriver.id;
                    driverPhone = matchedDriver.phone;
                    console.log(`   ✓ Sürücü bulundu: ${assignment.driverName} (ID: ${driverId}, Phone: ${driverPhone})`);
                } else {
                    console.error(`   ❌ Sürücü bulunamadı database'de: "${assignment.driverName}"`);
                    console.error(`   📋 Aktif sürücüler (${allDrivers.length}): ${allDrivers.map(d => `"${d.name}"`).join(', ')}`);
                }

                // Siparişi güncelle
                // Canvas'tan fiyat sadece price veya priceAmount olarak gelir
                const canvasPrice = assignment.price || assignment.priceAmount || 0;

                const updateData = {
                    driver_id: driverId,
                    driver_name: assignment.driverName,
                    driver_phone: driverPhone,
                    status: assignment.driverName ? 'Atandı' : 'Çekildi',
                    canvas_group_id: assignment.groupId,
                    canvas_price: parseFloat(canvasPrice) || 0
                };

                // Eğer yeniden atama ise, sürücü yanıtlarını temizle
                if (isReassigned) {
                    updateData.driver_response = null;
                    updateData.driver_response_at = null;
                    updateData.sms_sent_at = null;
                    console.log(`   🔄 Yeniden atama - yanıtlar temizleniyor`);
                }
                
                console.log(`   📝 Güncelleme verisi:`, JSON.stringify(updateData, null, 2));
                console.log(`   🆔 Base44 Order ID: ${order.id}`);
                console.log(`   📊 Mevcut Status: ${order.status}`);
                
                // Base44'teki gerçek ID ile güncelle
                const updateResult = await base44.asServiceRole.entities.DailyOrder.update(order.id, updateData);
                
                console.log(`   ✅ Update sonucu:`, JSON.stringify(updateResult, null, 2));

                updated++;
                console.log(`✅ BAŞARILI: ${assignment.orderNumber} → ${assignment.driverName || 'Atanmadı'} (Grup: ${assignment.groupId || 'N/A'})`);

            } catch (error) {
                failed++;
                console.error(`❌ Sipariş güncelleme hatası (${assignment.orderId}):`, error.message);
                console.error(`   📋 Full Error:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                console.error(`   🔍 Stack:`, error.stack);
            }
        }

        console.log(`\n📊 Sonuç: ${updated} güncellendi, ${failed} başarısız, ${skipped} atlandı`);

        return Response.json({
            success: true,
            message: `${updated} sipariş güncellendi${failed > 0 ? `, ${failed} başarısız` : ''}${skipped > 0 ? `, ${skipped} atlandı` : ''}`,
            updated,
            failed,
            skipped,
            skippedDetails,
            total: assignments.length
        });

    } catch (error) {
        console.error('❌ Canvas\'tan atama çekme hatası:', error);
        console.error('❌ Stack trace:', error.stack);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});