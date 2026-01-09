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
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (CANVAS_API_SECRET) {
            headers['X-API-Secret'] = CANVAS_API_SECRET;
        }

        const response = await fetch(canvasApiUrl, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Canvas API hatası: ${response.status}`, errorText);
            return Response.json({
                success: false,
                error: `Canvas API hatası: ${response.status} - ${errorText}`
            });
        }

        const canvasData = await response.json();

        if (!canvasData.success || !canvasData.assignments) {
            return Response.json({
                success: false,
                error: 'Canvas\'tan geçersiz veri döndü'
            });
        }

        const assignments = canvasData.assignments;
        console.log(`📦 ${assignments.length} atama alındı`);

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

        for (const assignment of assignments) {
            try {
                console.log(`\n🔍 İşleniyor: ${assignment.orderNumber || assignment.orderId} → ${assignment.driverName}`);
                
                // Siparişi orderNumber (ezcater_order_id) ile bul
                const orders = await base44.asServiceRole.entities.DailyOrder.filter({
                    ezcater_order_id: assignment.orderNumber
                }, null, 1);

                if (orders.length === 0) {
                    console.error(`⚠️ Sipariş bulunamadı: ${assignment.orderId} (${assignment.orderNumber || 'N/A'})`);
                    failed++;
                    continue;
                }
                
                console.log(`   ✓ Sipariş bulundu: ${orders[0].ezcater_order_id}`);

                const order = orders[0];

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
                
                // Base44'teki gerçek ID ile güncelle
                await base44.asServiceRole.entities.DailyOrder.update(order.id, updateData);

                updated++;
                console.log(`✅ BAŞARILI: ${assignment.orderNumber} → ${assignment.driverName || 'Atanmadı'} (Grup: ${assignment.groupId || 'N/A'})`);

            } catch (error) {
                failed++;
                console.error(`❌ Sipariş güncelleme hatası (${assignment.orderId}):`, error.message);
                console.error(`   Detay:`, error);
            }
        }

        console.log(`\n📊 Sonuç: ${updated} güncellendi, ${failed} başarısız`);

        return Response.json({
            success: failed === 0,
            message: `${updated} sipariş güncellendi${failed > 0 ? `, ${failed} başarısız` : ''}`,
            updated,
            failed,
            total: assignments.length
        });

    } catch (error) {
        console.error('❌ Canvas\'tan atama çekme hatası:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});