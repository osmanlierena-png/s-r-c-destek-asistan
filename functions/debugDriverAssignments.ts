import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate, driverName } = await req.json();
        
        console.log(`\n🔍 DEBUG: ${driverName || 'Tüm Sürücüler'} - ${targetDate}\n`);
        
        // Tüm sürücüleri getir
        const allDrivers = await base44.entities.Driver.list();
        const activeDrivers = allDrivers.filter(d => d.status === 'Aktif');
        
        // Günü bul
        const dayOfWeek = new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
        
        // Çalışan sürücüler
        const workingDrivers = activeDrivers.filter(d => {
            const workingDays = d.assignment_preferences?.working_days || [];
            return workingDays.includes(dayOfWeek);
        });
        
        console.log(`📅 Gün: ${dayOfWeek}`);
        console.log(`👥 Aktif Sürücü: ${activeDrivers.length}`);
        console.log(`💼 ${dayOfWeek} Çalışan: ${workingDrivers.length}\n`);
        
        // Siparişleri getir
        const allOrders = await base44.entities.DailyOrder.filter({ 
            order_date: targetDate 
        });
        
        const assignedOrders = allOrders.filter(o => o.status === 'Atandı');
        
        console.log(`📦 Atanmış Sipariş: ${assignedOrders.length}\n`);
        console.log(`${'='.repeat(80)}\n`);
        
        // Her sürücü için detay
        const driverStats = [];
        
        for (const driver of workingDrivers) {
            const driverOrders = assignedOrders.filter(o => o.driver_id === driver.id);
            
            const maxOrders = driver.assignment_preferences?.max_orders_per_day || 5;
            const workingDays = driver.assignment_preferences?.working_days || [];
            const primaryRegion = driver.special_notes?.primary_region || 'YOK';
            const topZips = driver.special_notes?.top_zip_codes || [];
            const canDoLong = driver.assignment_preferences?.can_do_long_distance || false;
            
            const stat = {
                name: driver.name,
                assignedCount: driverOrders.length,
                maxOrders: maxOrders,
                exceeded: driverOrders.length > maxOrders,
                workingDays: workingDays,
                worksToday: workingDays.includes(dayOfWeek),
                primaryRegion: primaryRegion,
                topZips: topZips.slice(0, 3),
                canDoLongDistance: canDoLong,
                orders: driverOrders.map(o => ({
                    id: o.ezcater_order_id,
                    pickup: o.pickup_address,
                    dropoff: o.dropoff_address
                }))
            };
            
            driverStats.push(stat);
            
            // Log
            console.log(`🚗 ${driver.name}`);
            console.log(`   Atanan: ${driverOrders.length}/${maxOrders} ${stat.exceeded ? '⚠️ AŞTI!' : '✅'}`);
            console.log(`   Bölge: ${primaryRegion}`);
            console.log(`   Top Zip: ${topZips.slice(0, 3).join(', ')}`);
            console.log(`   Uzun Mesafe: ${canDoLong ? '✅' : '❌'}`);
            console.log(`   Çalışma Günleri: ${workingDays.join(', ')}`);
            
            if (driverOrders.length > 0) {
                console.log(`   Siparişler:`);
                driverOrders.forEach((o, i) => {
                    console.log(`      ${i+1}. ${o.ezcater_order_id}: ${o.dropoff_address}`);
                });
            }
            console.log('');
        }
        
        // Fazla atanmış sürücüler
        const exceeded = driverStats.filter(s => s.exceeded);
        
        if (exceeded.length > 0) {
            console.log(`\n⚠️ MAX ORDER AŞAN SÜRÜCÜLER:\n`);
            exceeded.forEach(s => {
                console.log(`   ${s.name}: ${s.assignedCount}/${s.maxOrders}`);
            });
        }
        
        return Response.json({
            success: true,
            targetDate,
            dayOfWeek,
            summary: {
                totalActiveDrivers: activeDrivers.length,
                workingToday: workingDrivers.length,
                totalAssignedOrders: assignedOrders.length,
                driversExceedingMax: exceeded.length
            },
            driverStats: driverStats.sort((a, b) => b.assignedCount - a.assignedCount),
            exceededDrivers: exceeded
        });

    } catch (error) {
        console.error("Debug hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});