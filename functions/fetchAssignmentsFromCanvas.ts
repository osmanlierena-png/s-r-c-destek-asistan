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
                    id: assignment.id
                }, null, 1);

                if (orders.length === 0) {
                    console.log(`⚠️ Sipariş bulunamadı: ${assignment.orderNumber || assignment.orderId}`);
                    failed++;
                    continue;
                }
                
                const order = orders[0];

                // ⚠️ GÜNCEL KRİTİK KONTROLLER - Sürücü etkileşimi olan siparişleri koruma
                
                // 1. Status kontrolü - sürücü yanıt vermiş veya ilerleyen aşamadaysa atla
                const driverInteractedStatuses = [
                    'Sürücü Onayı Bekleniyor',
                    'Sürücü Onayladı',
                    'Sürücü Reddetti',
                    'Yeniden Atama Havuzu',
                    'Sürücüye Gönderildi',
                    'Yolda',
                    'Tamamlandı',
                    'Problem'
                ];

                if (driverInteractedStatuses.includes(order.status)) {
                    console.log(`⏩ Atlandı (Status): ${order.ezcater_order_id} - Durum: ${order.status}`);
                    skipped++;
                    skippedDetails.push({
                        orderId: order.ezcater_order_id,
                        reason: `Status: ${order.status}`,
                        canvasDriver: assignment.driverName
                    });
                    continue;
                }
                
                // 2. SMS gönderilmiş mi kontrolü - SMS gönderildiyse Canvas'tan güncelleme yapma
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
                
                // 3. Sürücü yanıtı var mı kontrolü - Yanıt varsa kesinlikle atla
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
                
                console.log(`   ✓ Sipariş bulundu ve güncellenebilir: ${orders[0].ezcater_order_id} - Durum: ${order.status}`);

                // Sürücüyü isimle bul
                let driverId = null;
                let driverPhone = null;

                if (assignment.driverName) {
                    const drivers = await base44.asServiceRole.entities.Driver.filter({
                        name: assignment.driverName
                    }, null, 1);
                    
                    if (drivers.length > 0) {
                        driverId = drivers[0].id;
                        driverPhone = drivers[0].phone;
                        console.log(`   ✓ Sürücü bulundu: ${assignment.driverName} (${driverPhone})`);
                    } else {
                        console.warn(`   ⚠️ Sürücü bulunamadı: ${assignment.driverName}`);
                    }
                }

                // Siparişi güncelle
                const updateData = {
                    driver_id: driverId,
                    driver_name: assignment.driverName,
                    driver_phone: driverPhone,
                    status: assignment.driverName ? 'Atandı' : 'Çekildi',
                    canvas_group_id: assignment.groupId,
                    canvas_price: assignment.price
                };
                
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