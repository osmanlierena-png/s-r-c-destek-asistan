import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { analysis } = await req.json();
        
        console.log("📊 Sürücü profillerini güncelleme başlıyor...");
        
        const drivers = await base44.entities.Driver.list();
        let updatedCount = 0;
        const errors = [];
        
        for (const stat of analysis.driver_stats) {
            // Sürücüyü bul
            const driver = drivers.find(d => d.name === stat.driver_name);
            
            if (!driver) {
                console.log(`⚠️ Sürücü bulunamadı: ${stat.driver_name}`);
                errors.push({ name: stat.driver_name, error: 'Sistemde bulunamadı' });
                continue;
            }
            
            // Bölge profilini oluştur
            const topCities = stat.top_cities.map(c => c.city);
            const topZips = stat.top_zip_codes.map(z => z.zip);
            const topStates = stat.top_states.map(s => s.state);
            
            // Uzun mesafe yeteneği
            const canDoLongDistance = stat.long_distance_percentage >= 30;
            
            // Ana çalışma bölgesi tespiti
            let primaryRegion = 'MIXED';
            const dcPercentage = stat.states['DC'] ? (stat.states['DC'] / stat.total_orders * 100) : 0;
            const mdPercentage = stat.states['MD'] ? (stat.states['MD'] / stat.total_orders * 100) : 0;
            const vaPercentage = stat.states['VA'] ? (stat.states['VA'] / stat.total_orders * 100) : 0;
            
            if (dcPercentage >= 60) primaryRegion = 'DC_METRO';
            else if (mdPercentage >= 60 && topCities.some(c => ['Rockville', 'Gaithersburg', 'Bethesda'].includes(c))) {
                primaryRegion = 'MD_CENTRAL';
            }
            else if (vaPercentage >= 50 && topCities.some(c => ['Arlington', 'Alexandria'].includes(c))) {
                primaryRegion = 'NORTHERN_VA';
            }
            else if (vaPercentage >= 50 && topCities.some(c => ['Fredericksburg'].includes(c))) {
                primaryRegion = 'SOUTHERN_VA';
            }
            
            // 🔥 ÖNEMLİ: Sadece yeni alanları ekle, mevcut alanları koru!
            try {
                await base44.entities.Driver.update(driver.id, {
                    preferred_areas: topCities.slice(0, 5), // Top 5 şehir
                    assignment_preferences: {
                        ...driver.assignment_preferences, // 🔥 MEVCUT TERCİHLERİ KORU
                        // Sadece analiz sonuçlarını ekle:
                        avg_distance: parseFloat(stat.avg_distance),
                        max_distance: stat.max_distance,
                        can_do_long_distance: canDoLongDistance,
                        long_distance_percentage: parseFloat(stat.long_distance_percentage),
                        cross_state_percentage: parseFloat(stat.cross_state_percentage)
                    },
                    special_notes: {
                        ...driver.special_notes, // 🔥 MEVCUT NOTLARI KORU
                        primary_region: primaryRegion,
                        top_zip_codes: topZips.slice(0, 10),
                        top_states: topStates,
                        region_distribution: {
                            DC: dcPercentage.toFixed(1),
                            MD: mdPercentage.toFixed(1),
                            VA: vaPercentage.toFixed(1)
                        },
                        total_orders_analyzed: stat.total_orders
                    }
                });
                
                updatedCount++;
                console.log(`✅ ${stat.driver_name} güncellendi (${primaryRegion})`);
            } catch (error) {
                console.error(`❌ ${stat.driver_name} güncellenemedi:`, error.message);
                errors.push({ name: stat.driver_name, error: error.message });
            }
        }
        
        return Response.json({
            success: true,
            message: `${updatedCount} sürücünün bölge profili güncellendi`,
            updatedCount,
            totalAnalyzed: analysis.driver_stats.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("Profil güncelleme hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});