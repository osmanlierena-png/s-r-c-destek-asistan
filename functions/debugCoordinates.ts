import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        console.log('\n🔍 KOORDİNAT RAPORU');
        console.log(`📅 Tarih: ${targetDate}`);
        console.log('='.repeat(80));
        
        // ==================== SÜRÜCÜLER ====================
        
        const allDrivers = await base44.asServiceRole.entities.Driver.list();
        const activeTopDashers = allDrivers.filter(d => 
            d.status === 'Aktif' && d.is_top_dasher === true
        );
        
        const dayOfWeek = new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
        
        const workingDrivers = activeTopDashers.filter(d => {
            const workingDays = d.assignment_preferences?.working_days || [];
            return workingDays.includes(dayOfWeek);
        });
        
        const driversWithCoords = workingDrivers.filter(d => 
            d.home_coordinates?.lat && d.home_coordinates?.lng
        ).length;
        
        const driversWithoutCoords = workingDrivers.length - driversWithCoords;
        
        const missingDrivers = workingDrivers
            .filter(d => !d.home_coordinates?.lat || !d.home_coordinates?.lng)
            .map(d => ({
                name: d.name,
                address: d.address || 'Adres yok'
            }));
        
        // ==================== SİPARİŞLER ====================
        
        // Service role ile TAZE veri çek
        const allOrders = await base44.asServiceRole.entities.DailyOrder.filter({ 
            order_date: targetDate 
        }, 'pickup_time', 500);
        
        console.log(`\n📦 ${targetDate} - Toplam ${allOrders.length} sipariş`);
        
        const cekildi = allOrders.filter(o => o.status === 'Çekildi').length;
        const atandi = allOrders.filter(o => o.status === 'Atandı').length;
        const tamamlandi = allOrders.filter(o => o.status === 'Tamamlandı').length;
        
        // Koordinat kontrolü
        let ordersWithBothCoords = 0;
        let ordersWithPickupOnly = 0;
        let ordersWithDropoffOnly = 0;
        let ordersWithNoCoords = 0;
        
        const missingOrders = [];
        
        for (const order of allOrders) {
            const hasPickup = order.pickup_coords?.lat && order.pickup_coords?.lng;
            const hasDropoff = order.dropoff_coords?.lat && order.dropoff_coords?.lng;
            
            if (hasPickup && hasDropoff) {
                ordersWithBothCoords++;
            } else if (hasPickup && !hasDropoff) {
                ordersWithPickupOnly++;
                missingOrders.push({
                    order_id: order.ezcater_order_id,
                    missing: 'dropoff',
                    dropoff_address: order.dropoff_address,
                    status: order.status
                });
            } else if (!hasPickup && hasDropoff) {
                ordersWithDropoffOnly++;
                missingOrders.push({
                    order_id: order.ezcater_order_id,
                    missing: 'pickup',
                    pickup_address: order.pickup_address,
                    status: order.status
                });
            } else {
                ordersWithNoCoords++;
                missingOrders.push({
                    order_id: order.ezcater_order_id,
                    missing: 'both',
                    pickup_address: order.pickup_address,
                    dropoff_address: order.dropoff_address,
                    status: order.status
                });
            }
        }
        
        const totalMissing = ordersWithPickupOnly + ordersWithDropoffOnly + ordersWithNoCoords;
        
        console.log(`\n📊 DURUM:`);
        console.log(`   Çekildi: ${cekildi}`);
        console.log(`   Atandı: ${atandi}`);
        console.log(`   Tamamlandı: ${tamamlandi}`);
        console.log(`\n   ✅ Her iki nokta: ${ordersWithBothCoords}`);
        console.log(`   ⚠️ Sadece pickup: ${ordersWithPickupOnly}`);
        console.log(`   ⚠️ Sadece dropoff: ${ordersWithDropoffOnly}`);
        console.log(`   ❌ Hiçbiri yok: ${ordersWithNoCoords}`);
        console.log(`   📊 TOPLAM EKSİK: ${totalMissing}`);
        
        if (missingOrders.length > 0) {
            console.log(`\n⚠️ İLK 10 EKSİK:`);
            missingOrders.slice(0, 10).forEach(o => {
                console.log(`   • ${o.order_id}: ${o.missing.toUpperCase()} eksik`);
            });
        }
        
        return Response.json({
            success: true,
            date: targetDate,
            dayOfWeek,
            drivers: {
                total: allDrivers.length,
                activeTopDashers: activeTopDashers.length,
                workingToday: workingDrivers.length,
                withCoords: driversWithCoords,
                withoutCoords: driversWithoutCoords,
                missing: missingDrivers
            },
            orders: {
                total: allOrders.length,
                byStatus: {
                    cekildi: cekildi,
                    atandi: atandi,
                    tamamlandi: tamamlandi
                },
                withBothCoords: ordersWithBothCoords,
                withPickupOnly: ordersWithPickupOnly,
                withDropoffOnly: ordersWithDropoffOnly,
                withNoCoords: ordersWithNoCoords,
                totalMissing,
                missing: missingOrders.slice(0, 20)
            }
        });
        
    } catch (error) {
        console.error('Debug hatası:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});