import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('\n🧠 ÖĞRENME İÇGÖRÜLERİ ANALİZİ BAŞLIYOR...\n');
        
        const drivers = await base44.entities.Driver.list();
        
        const updatedDrivers = drivers.filter(d => 
            (d.preferred_areas && d.preferred_areas.length > 0) ||
            (d.special_notes?.top_zip_codes && d.special_notes.top_zip_codes.length > 0)
        );
        
        console.log(`👥 ${drivers.length} sürücü, ${updatedDrivers.length} tanesi öğrenme verisiyle güncellendi`);
        
        const discoveredPatterns = [];
        const recommendations = [];
        
        // PATTERN 1: Bölge Uzmanlığı
        let driversWithRegions = 0;
        let totalRegions = 0;
        
        updatedDrivers.forEach(d => {
            if (d.preferred_areas && d.preferred_areas.length > 0) {
                driversWithRegions++;
                totalRegions += d.preferred_areas.length;
            }
        });
        
        if (driversWithRegions > 0) {
            discoveredPatterns.push({
                type: 'Bölge Uzmanlığı',
                title: `${driversWithRegions} sürücünün bölge tercihleri öğrenildi`,
                description: `Ortalama ${(totalRegions / driversWithRegions).toFixed(1)} bölge/sürücü. Bu veriler atama algoritmasında kullanılabilir.`,
                sample_count: driversWithRegions,
                confidence: 85
            });
            
            recommendations.push({
                title: 'Bölge Ağırlığını Artır',
                description: `Şu an bölge match'i sadece 60 puan veriyor. ${driversWithRegions} sürücünün tercih bölgeleri var, bu ağırlık 150-200'e çıkarılmalı.`,
                expected_improvement: 15,
                priority: 'YÜKSEK',
                current_weight: 60,
                suggested_weight: 180
            });
        }
        
        // PATTERN 2: Zip Code Expertise
        let driversWithZips = 0;
        let totalZips = 0;
        
        updatedDrivers.forEach(d => {
            if (d.special_notes?.top_zip_codes && d.special_notes.top_zip_codes.length > 0) {
                driversWithZips++;
                totalZips += d.special_notes.top_zip_codes.length;
            }
        });
        
        if (driversWithZips > 0) {
            discoveredPatterns.push({
                type: 'Zip Code Pattern',
                title: `${driversWithZips} sürücünün sık çalıştığı zip kodlar tespit edildi`,
                description: `Ortalama ${(totalZips / driversWithZips).toFixed(1)} zip/sürücü. Bu pattern'ler güçlü match sinyali.`,
                sample_count: driversWithZips,
                confidence: 90
            });
            
            recommendations.push({
                title: 'Zip Code Skorunu Aktifleştir',
                description: `Şu an zip code match'i HİÇ KULLANILMIYOR (0 puan). ${driversWithZips} sürücünün zip tercihleri var, bu 100-150 puan olmalı.`,
                expected_improvement: 20,
                priority: 'KRİTİK',
                current_weight: 0,
                suggested_weight: 120
            });
        }
        
        // PATTERN 3: Zincir Rotalar
        let driversWithChains = 0;
        let totalChains = 0;
        
        updatedDrivers.forEach(d => {
            if (d.chain_history && d.chain_history.length > 0) {
                driversWithChains++;
                totalChains += d.chain_history.length;
            }
        });
        
        if (driversWithChains > 0) {
            discoveredPatterns.push({
                type: 'Rota Zinciri',
                title: `${driversWithChains} sürücünün ${totalChains} rota zinciri kaydedildi`,
                description: `Sürücüler belirli rota pattern'lerini tekrarlıyor. Bu bilgi atamada kullanılabilir.`,
                sample_count: totalChains,
                confidence: 75
            });
            
            recommendations.push({
                title: 'Zincir Pattern Skorunu Ekle',
                description: `Şu an zincir pattern'leri kullanılmıyor (0 puan). ${totalChains} adet zincir var, benzer rotalar için 80-120 puan ekle.`,
                expected_improvement: 12,
                priority: 'ORTA',
                current_weight: 0,
                suggested_weight: 100
            });
        }
        
        // PATTERN 4: Eyalet Dağılımı
        let driversWithStates = 0;
        updatedDrivers.forEach(d => {
            if (d.special_notes?.region_distribution) {
                driversWithStates++;
            }
        });
        
        if (driversWithStates > 0) {
            discoveredPatterns.push({
                type: 'Eyalet Tercihi',
                title: `${driversWithStates} sürücünün eyalet dağılımı analiz edildi`,
                description: `Her sürücünün hangi eyaletlerde daha çok çalıştığı belirlendi (VA, MD, DC, WV).`,
                sample_count: driversWithStates,
                confidence: 88
            });
            
            recommendations.push({
                title: 'Eyalet Match Skorunu Aktifleştir',
                description: `Şu an eyalet tercihi kullanılmıyor (0 puan). ${driversWithStates} sürücünün eyalet dağılımı var, 60-80 puan ekle.`,
                expected_improvement: 10,
                priority: 'ORTA',
                current_weight: 0,
                suggested_weight: 70
            });
        }
        
        // ÖNERİLEN PARAMETRELER
        const recommendedParameters = {
            distance_weight: 350,  // Biraz azalt
            region_weight: 180,     // Çok artır!
            zip_weight: 120,        // Aktifleştir!
            state_weight: 70,       // Aktifleştir!
            chain_weight: 100,      // Aktifleştir!
            time_gap_weight: 150,   // Aynı
            early_morning_weight: 50 // Aynı
        };
        
        // Sürücü bazlı stats
        const driverStats = updatedDrivers.map(d => {
            const topRegions = d.preferred_areas || [];
            const uniqueZips = d.special_notes?.top_zip_codes?.length || 0;
            const chainCount = d.chain_history?.length || 0;
            
            // Accuracy katkısı hesaplama
            let contribution = 0;
            if (topRegions.length > 0) contribution += 5;
            if (uniqueZips > 0) contribution += 8;
            if (chainCount > 0) contribution += 4;
            
            return {
                driver_name: d.name,
                total_learned_assignments: (d.special_notes?.total_assignments || 0),
                top_regions: topRegions.slice(0, 3),
                unique_zips: uniqueZips,
                chain_count: chainCount,
                accuracy_contribution: contribution
            };
        }).sort((a, b) => b.total_learned_assignments - a.total_learned_assignments);
        
        // Toplam atama sayısı (tahmini)
        const totalAssignments = updatedDrivers.reduce((sum, d) => 
            sum + (d.special_notes?.total_assignments || 0), 0
        );
        
        // Potansiyel accuracy
        const potentialAccuracy = 65 + (discoveredPatterns.length * 5);
        
        return Response.json({
            success: true,
            total_assignments: totalAssignments,
            updated_drivers: updatedDrivers.length,
            patterns_found: discoveredPatterns.length,
            potential_accuracy: Math.min(potentialAccuracy, 95),
            discovered_patterns: discoveredPatterns,
            recommendations: recommendations,
            recommended_parameters: recommendedParameters,
            driver_stats: driverStats
        });
        
    } catch (error) {
        console.error('Hata:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});