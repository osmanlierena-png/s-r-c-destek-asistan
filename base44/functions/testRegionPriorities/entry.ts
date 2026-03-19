import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('\n🧪 BÖLGE ÖNCELİK TESTİ\n');
        
        // Tüm aktif Top Dasher'ları çek
        const allDrivers = await base44.asServiceRole.entities.Driver.filter({ status: 'Aktif' });
        const topDashers = allDrivers.filter(d => d.is_top_dasher === true);
        
        console.log(`📊 ${topDashers.length} aktif Top Dasher bulundu`);
        
        // Bölge önceliği olan sürücüleri bul
        const driversWithRegionPriorities = topDashers.filter(d => {
            const priorities = d.special_notes?.region_priorities;
            return priorities && Object.keys(priorities).length > 0;
        });
        
        console.log(`\n🎯 ${driversWithRegionPriorities.length} sürücünün BÖLGE ÖNCELİĞİ VAR:`);
        
        const report = {
            totalDrivers: topDashers.length,
            driversWithPriorities: driversWithRegionPriorities.length,
            details: []
        };
        
        // Her sürücü için detay
        driversWithRegionPriorities.forEach(driver => {
            const priorities = driver.special_notes?.region_priorities || {};
            const priorityCount = Object.keys(priorities).length;
            
            console.log(`\n👤 ${driver.name}`);
            console.log(`   📍 ${priorityCount} bölge için öncelik:`);
            
            const priorityDetails = {};
            
            Object.entries(priorities).forEach(([region, priority]) => {
                console.log(`      • ${region}: ${priority}. öncelik`);
                priorityDetails[region] = priority;
            });
            
            report.details.push({
                name: driver.name,
                phone: driver.phone,
                region_priorities: priorityDetails,
                priority_count: priorityCount
            });
        });
        
        // Bölge önceliği OLMAYAN sürücüleri de göster
        const driversWithoutPriorities = topDashers.filter(d => {
            const priorities = d.special_notes?.region_priorities;
            return !priorities || Object.keys(priorities).length === 0;
        });
        
        console.log(`\n\n❌ ${driversWithoutPriorities.length} sürücünün bölge önceliği YOK:`);
        driversWithoutPriorities.slice(0, 10).forEach(d => {
            console.log(`   • ${d.name}`);
        });
        
        if (driversWithoutPriorities.length > 10) {
            console.log(`   ... ve ${driversWithoutPriorities.length - 10} sürücü daha`);
        }
        
        // Test: Fredericksburg siparişi için kim uygun?
        console.log(`\n\n🧪 TEST: "Fredericksburg, VA" siparişi için kim öncelikli?`);
        
        const fredericksburgOrder = {
            address: "123 Main St, Fredericksburg, VA 22401"
        };
        
        // Adresi parse et (extractRegion mantığı)
        const parseAddress = (address) => {
            const zipMatch = address.match(/\b(\d{5})\b/);
            const stateMatch = address.match(/\b(VA|MD|DC|WV)\b/);
            const cityMatch = address.match(/([A-Za-z\s]+),?\s+(VA|MD|DC|WV)/i);
            return { 
                zip: zipMatch?.[1], 
                state: stateMatch?.[1], 
                city: cityMatch?.[1]?.trim().toLowerCase()
            };
        };
        
        const orderRegion = parseAddress(fredericksburgOrder.address);
        console.log(`📍 Sipariş bölgesi:`, orderRegion);
        
        // Her sürücü için öncelik kontrol et
        const prioritizedDrivers = {
            1: [],
            2: [],
            3: [],
            null: []
        };
        
        topDashers.forEach(driver => {
            const priorities = driver.special_notes?.region_priorities || {};
            
            // City bazlı
            let priority = null;
            if (orderRegion.city && priorities[orderRegion.city]) {
                priority = priorities[orderRegion.city];
            }
            // State bazlı
            else if (orderRegion.state && priorities[orderRegion.state.toLowerCase()]) {
                priority = priorities[orderRegion.state.toLowerCase()];
            }
            // Zip bazlı
            else if (orderRegion.zip && priorities[orderRegion.zip]) {
                priority = priorities[orderRegion.zip];
            }
            
            prioritizedDrivers[priority].push({
                name: driver.name,
                phone: driver.phone,
                matched_region: priority ? Object.keys(priorities).find(k => priorities[k] === priority) : null
            });
        });
        
        console.log(`\n✅ 1. ÖNCELİKLİ SÜRÜCÜLER (${prioritizedDrivers[1].length}):`);
        prioritizedDrivers[1].forEach(d => {
            console.log(`   • ${d.name} (eşleşen: ${d.matched_region})`);
        });
        
        console.log(`\n⚠️ 2. ÖNCELİKLİ SÜRÜCÜLER (${prioritizedDrivers[2].length}):`);
        prioritizedDrivers[2].forEach(d => {
            console.log(`   • ${d.name} (eşleşen: ${d.matched_region})`);
        });
        
        console.log(`\n🔵 3. ÖNCELİKLİ SÜRÜCÜLER (${prioritizedDrivers[3].length}):`);
        prioritizedDrivers[3].forEach(d => {
            console.log(`   • ${d.name} (eşleşen: ${d.matched_region})`);
        });
        
        console.log(`\n⚪ ÖNCELİK YOK (${prioritizedDrivers[null].length}):`);
        prioritizedDrivers[null].slice(0, 5).forEach(d => {
            console.log(`   • ${d.name}`);
        });
        
        if (prioritizedDrivers[null].length > 5) {
            console.log(`   ... ve ${prioritizedDrivers[null].length - 5} sürücü daha`);
        }
        
        return Response.json({
            success: true,
            summary: {
                totalDrivers: report.totalDrivers,
                driversWithPriorities: report.driversWithPriorities,
                driversWithoutPriorities: driversWithoutPriorities.length
            },
            driversWithRegionPriorities: report.details,
            fredericksburgTest: {
                orderRegion,
                priorityLevel1: prioritizedDrivers[1],
                priorityLevel2: prioritizedDrivers[2],
                priorityLevel3: prioritizedDrivers[3],
                noPriority: prioritizedDrivers[null].length
            }
        });

    } catch (error) {
        console.error("❌ TEST HATASI:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});