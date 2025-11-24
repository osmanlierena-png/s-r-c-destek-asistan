import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { assignments, driver_groups, chains } = await req.json();
        
        console.log(`💾 ${assignments.length} atama kaydediliyor...`);

        // 1️⃣ DailyOrder'a kaydet
        let savedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < assignments.length; i++) {
            const assignment = assignments[i];
            
            try {
                // Sipariş varsa güncelle, yoksa oluştur
                const existing = await base44.entities.DailyOrder.filter({ 
                    ezcater_order_id: assignment.order_id 
                });

                const orderData = {
                    ezcater_order_id: assignment.order_id,
                    order_date: new Date().toISOString().split('T')[0], // Bugünün tarihi
                    pickup_address: assignment.pickup_location,
                    pickup_time: assignment.delivery_time, // pickup time yok, delivery kullan
                    dropoff_address: assignment.delivery_address,
                    dropoff_time: assignment.delivery_time,
                    driver_name: assignment.driver_name,
                    status: 'Tamamlandı' // Gerçek atama = tamamlanmış
                };

                if (existing.length > 0) {
                    await base44.entities.DailyOrder.update(existing[0].id, orderData);
                } else {
                    await base44.entities.DailyOrder.create(orderData);
                }
                
                savedCount++;
                
                // Her 10 siparişte bir kısa pause (rate limiting)
                if ((i + 1) % 10 === 0) {
                    await new Promise(r => setTimeout(r, 200));
                }
                
            } catch (error) {
                console.error(`❌ ${assignment.order_id} kaydedilemedi:`, error.message);
                errorCount++;
            }
        }

        console.log(`✅ ${savedCount}/${assignments.length} sipariş kaydedildi`);

        // 2️⃣ Sürücü tercihlerini güncelle
        let updatedDrivers = 0;
        const driverNames = Object.keys(driver_groups);

        for (const driverName of driverNames) {
            try {
                const drivers = await base44.entities.Driver.filter({ name: driverName });
                if (drivers.length === 0) {
                    console.log(`⚠️ ${driverName} sistemde bulunamadı`);
                    continue;
                }

                const driver = drivers[0];
                const driverOrders = driver_groups[driverName];
                
                // Zincirlerini bul
                const driverChains = chains.filter(c => c.driver === driverName);

                // Bölgeleri çıkar
                const regions = new Set();
                for (const order of driverOrders) {
                    const pickupCity = order.pickup_location.split(',').slice(-2, -1)[0]?.trim();
                    const deliveryCity = order.delivery_address.split(',').slice(-2, -1)[0]?.trim();
                    if (pickupCity) regions.add(pickupCity);
                    if (deliveryCity) regions.add(deliveryCity);
                }

                // Güncelle
                const updateData = {
                    chain_history: [
                        ...(driver.chain_history || []),
                        ...driverChains.map(c => ({
                            date: new Date().toISOString().split('T')[0],
                            stops: c.orders,
                            chain: c.times,
                            regions: [...regions]
                        }))
                    ],
                    preferred_areas: [...regions].slice(0, 5) // En fazla 5
                };

                await base44.entities.Driver.update(driver.id, updateData);
                updatedDrivers++;
                
                console.log(`✅ ${driverName} güncellendi (${driverChains.length} zincir)`);
                
            } catch (error) {
                console.error(`❌ ${driverName} güncellenemedi:`, error.message);
            }
        }

        return Response.json({
            success: true,
            message: `${savedCount} sipariş kaydedildi, ${updatedDrivers} sürücü güncellendi!`,
            saved_count: savedCount,
            error_count: errorCount,
            updated_drivers: updatedDrivers
        });

    } catch (error) {
        console.error("Kaydetme hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});