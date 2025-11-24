import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Mesafe hesaplama (Haversine)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// Şehir/bölge çıkarma
const extractRegion = (address) => {
    if (!address) return { city: null, state: null, zip: null };
    
    const zipMatch = address.match(/\b(\d{5})\b/);
    const stateMatch = address.match(/\b(VA|MD|DC|WV)\b/);
    const cityMatch = address.match(/([A-Za-z\s]+),?\s+(VA|MD|DC|WV)/i);
    
    return {
        zip: zipMatch ? zipMatch[1] : null,
        state: stateMatch ? stateMatch[1] : null,
        city: cityMatch ? cityMatch[1].trim() : null
    };
};

// Saat parse
const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    
    return hours * 60 + minutes;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { ai_assignments, manual_assignments } = await req.json();
        
        console.log(`\n📊 HIZLI ATAMA ANALİZİ BAŞLIYOR...`);
        console.log(`   Akıllı Atama: ${ai_assignments.length} sipariş`);
        console.log(`   Manuel Atama: ${manual_assignments.length} sipariş\n`);
        
        // 1️⃣ ORTAK SİPARİŞLERİ BUL
        const aiMap = new Map(ai_assignments.map(a => [a.order_id, a]));
        const manualMap = new Map(manual_assignments.map(a => [a.order_id, a]));
        
        const commonOrderIds = [];
        const onlyInSystem = [];
        const onlyInManual = [];
        
        for (const orderId of aiMap.keys()) {
            if (manualMap.has(orderId)) {
                commonOrderIds.push(orderId);
            } else {
                onlyInSystem.push(orderId);
            }
        }
        
        for (const orderId of manualMap.keys()) {
            if (!aiMap.has(orderId)) {
                onlyInManual.push(orderId);
            }
        }
        
        console.log(`\n🔍 SİPARİŞ KARŞILAŞTIRMASI:`);
        console.log(`   Ortak Siparişler: ${commonOrderIds.length}`);
        console.log(`   Sadece Sistemde: ${onlyInSystem.length}`);
        console.log(`   Sadece Manuel'de: ${onlyInManual.length}`);
        console.log(`\n⚠️ Analiz sadece ${commonOrderIds.length} ortak sipariş üzerinden yapılacak!\n`);
        
        // 2️⃣ SÜRÜCÜLERİ ve SİPARİŞLERİ YÜKLE
        const drivers = await base44.entities.Driver.list();
        const driverMap = {};
        drivers.forEach(d => {
            driverMap[d.name] = d;
        });
        
        console.log(`👥 ${drivers.length} sürücü yüklendi`);
        
        // DailyOrder'ları yükle (pickup_coords için)
        const allOrders = await base44.entities.DailyOrder.list();
        const orderCoordsMap = {};
        allOrders.forEach(order => {
            if (order.pickup_coords) {
                orderCoordsMap[order.ezcater_order_id] = order.pickup_coords;
            }
        });
        
        console.log(`📦 ${allOrders.length} sipariş yüklendi (${Object.keys(orderCoordsMap).length} koordinatlı)\n`);
        
        const analysis = {
            matches: [],
            differences: [],
            patterns: {
                distance_pattern: null,
                region_pattern: null,
                time_pattern: null,
                load_pattern: null
            }
        };
        
        const distanceErrors = [];
        const regionErrors = [];
        const timeErrors = [];
        const loadIssues = [];
        
        // Saat grupları
        const timeGroups = {
            early_morning: { system: [], manual: [] },   // 05:00-09:00
            morning: { system: [], manual: [] },         // 09:00-12:00
            afternoon: { system: [], manual: [] },       // 12:00-15:00
            evening: { system: [], manual: [] }          // 15:00-21:00
        };
        
        // Sürücü yük sayacı
        const driverLoadSystem = {};
        const driverLoadManual = {};
        
        // 3️⃣ HER ORTAK SİPARİŞİ DETAYLI ANALİZ ET
        for (let i = 0; i < commonOrderIds.length; i++) {
            const orderId = commonOrderIds[i];
            const ai = aiMap.get(orderId);
            const manual = manualMap.get(orderId);
            
            console.log(`[${i+1}/${commonOrderIds.length}] 📦 ${orderId}`);
            
            const aiDriver = driverMap[ai.driver_name];
            const manualDriver = driverMap[manual.driver_name];
            
            if (!aiDriver || !manualDriver) {
                console.log(`   ⚠️ Sürücü bulunamadı`);
                continue;
            }
            
            // Yük sayacı
            driverLoadSystem[ai.driver_name] = (driverLoadSystem[ai.driver_name] || 0) + 1;
            driverLoadManual[manual.driver_name] = (driverLoadManual[manual.driver_name] || 0) + 1;
            
            // Saat grubu belirleme
            const pickupMinutes = parseTime(ai.pickup_time);
            let timeGroup = 'afternoon';
            if (pickupMinutes && pickupMinutes < 540) timeGroup = 'early_morning';
            else if (pickupMinutes && pickupMinutes < 720) timeGroup = 'morning';
            else if (pickupMinutes && pickupMinutes < 900) timeGroup = 'afternoon';
            else timeGroup = 'evening';
            
            timeGroups[timeGroup].system.push({ order_id: orderId, driver: ai.driver_name });
            timeGroups[timeGroup].manual.push({ order_id: orderId, driver: manual.driver_name });
            
            if (ai.driver_name === manual.driver_name) {
                // ✅ Aynı sürücü
                analysis.matches.push({
                    order_id: orderId,
                    driver: ai.driver_name,
                    pickup: ai.pickup_address,
                    dropoff: ai.dropoff_address,
                    time_group: timeGroup
                });
                console.log(`   ✅ EŞLEŞME: ${ai.driver_name}`);
                continue;
            }
            
            // ❌ Farklı sürücü - HIZLI ANALİZ!
            console.log(`   🔍 FARK: Sistem=${ai.driver_name}, Manuel=${manual.driver_name}`);
            
            const reasons = [];
            const aiScore = {};
            const manualScore = {};
            
            // 🔴 MESAFE ANALİZİ (mevcut koordinatları kullan)
            const pickupCoords = orderCoordsMap[orderId];
            
            if (pickupCoords && aiDriver.home_coordinates && manualDriver.home_coordinates) {
                const aiDistance = calculateDistance(
                    aiDriver.home_coordinates.lat,
                    aiDriver.home_coordinates.lng,
                    pickupCoords.lat,
                    pickupCoords.lng
                );
                
                const manualDistance = calculateDistance(
                    manualDriver.home_coordinates.lat,
                    manualDriver.home_coordinates.lng,
                    pickupCoords.lat,
                    pickupCoords.lng
                );
                
                aiScore.distance = aiDistance;
                manualScore.distance = manualDistance;
                
                const distanceDiff = manualDistance - aiDistance;
                
                console.log(`      📏 Mesafe: Sistem=${aiDistance.toFixed(1)}mi, Manuel=${manualDistance.toFixed(1)}mi`);
                
                if (Math.abs(distanceDiff) > 3) {
                    if (distanceDiff > 0) {
                        reasons.push(`Manuel ${distanceDiff.toFixed(1)} mil daha uzak ama tercih edildi`);
                        distanceErrors.push({
                            order_id: orderId,
                            system_distance: aiDistance,
                            manual_distance: manualDistance,
                            diff: distanceDiff,
                            manual_driver: manual.driver_name,
                            time_group: timeGroup
                        });
                    } else {
                        reasons.push(`Sistem ${Math.abs(distanceDiff).toFixed(1)} mil daha uzak sürücü seçti`);
                    }
                }
            } else {
                console.log(`      ⚠️ Koordinat bulunamadı`);
            }
            
            // 🔴 BÖLGE UZMANLIĞI ANALİZİ
            const dropoffRegion = extractRegion(ai.dropoff_address);
            
            const aiRegionMatch = aiDriver.preferred_areas?.some(area => 
                area.toLowerCase().includes(dropoffRegion.city?.toLowerCase() || '') ||
                area.toLowerCase().includes(dropoffRegion.state?.toLowerCase() || '') ||
                area.toLowerCase().includes(dropoffRegion.zip || '')
            );
            
            const manualRegionMatch = manualDriver.preferred_areas?.some(area => 
                area.toLowerCase().includes(dropoffRegion.city?.toLowerCase() || '') ||
                area.toLowerCase().includes(dropoffRegion.state?.toLowerCase() || '') ||
                area.toLowerCase().includes(dropoffRegion.zip || '')
            );
            
            aiScore.region = aiRegionMatch;
            manualScore.region = manualRegionMatch;
            
            console.log(`      🗺️ Bölge: Sistem=${aiRegionMatch ? '✅' : '❌'}, Manuel=${manualRegionMatch ? '✅' : '❌'}`);
            
            if (!aiRegionMatch && manualRegionMatch) {
                reasons.push(`Manuel sürücü ${dropoffRegion.city || dropoffRegion.state} bölge uzmanı`);
                regionErrors.push({
                    order_id: orderId,
                    region: dropoffRegion.city || dropoffRegion.state,
                    manual_driver: manual.driver_name,
                    system_driver: ai.driver_name,
                    time_group: timeGroup
                });
            }
            
            // 🔴 ERKEN SABAH UZMANLIĞI
            if (pickupMinutes && pickupMinutes < 540) {
                const aiReliability = aiDriver.early_morning_reliability || 0;
                const manualReliability = manualDriver.early_morning_reliability || 0;
                
                aiScore.early_morning = 5 - aiReliability;
                manualScore.early_morning = 5 - manualReliability;
                
                console.log(`      ⏰ Erken Sabah: Sistem=${aiDriver.early_morning_eligible ? `✅(${5-aiReliability}/4)` : '❌'}, Manuel=${manualDriver.early_morning_eligible ? `✅(${5-manualReliability}/4)` : '❌'}`);
                
                if (manualReliability < aiReliability) {
                    reasons.push(`Manuel sürücü daha güvenilir erken sabah (${5-manualReliability}/4 vs ${5-aiReliability}/4)`);
                    timeErrors.push({
                        order_id: orderId,
                        time: ai.pickup_time,
                        manual_driver: manual.driver_name,
                        manual_reliability: 5 - manualReliability,
                        system_driver: ai.driver_name,
                        system_reliability: 5 - aiReliability
                    });
                }
            }
            
            analysis.differences.push({
                order_id: orderId,
                pickup: ai.pickup_address,
                dropoff: ai.dropoff_address,
                time: ai.pickup_time,
                time_group: timeGroup,
                ai_driver: ai.driver_name,
                manual_driver: manual.driver_name,
                ai_score: aiScore,
                manual_score: manualScore,
                reasons: reasons
            });
        }
        
        // 4️⃣ YÜK DAĞILIMI ANALİZİ
        console.log(`\n📊 YÜK DAĞILIMI KARŞILAŞTIRMASI:`);
        
        const systemOverloaded = Object.entries(driverLoadSystem).filter(([name, count]) => {
            const driver = driverMap[name];
            return count > (driver?.assignment_preferences?.max_orders_per_day || 5);
        });
        
        const manualOverloaded = Object.entries(driverLoadManual).filter(([name, count]) => {
            const driver = driverMap[name];
            return count > (driver?.assignment_preferences?.max_orders_per_day || 5);
        });
        
        console.log(`   Sistem aşırı yüklenmiş sürücü: ${systemOverloaded.length}`);
        console.log(`   Manuel aşırı yüklenmiş sürücü: ${manualOverloaded.length}`);
        
        if (systemOverloaded.length > manualOverloaded.length) {
            analysis.patterns.load_pattern = {
                issue: `Sistem ${systemOverloaded.length} sürücüyü aşırı yükledi (manuel ${manualOverloaded.length})`,
                recommendation: 'Max order limitlerine daha sıkı uy, adil dağılım skorunu arttır',
                overloaded_drivers: systemOverloaded.map(([name, count]) => ({ name, count }))
            };
        }
        
        // 5️⃣ SAAT GRUBU ANALİZİ
        console.log(`\n⏰ SAAT GRUBU ANALİZİ:`);
        for (const [group, data] of Object.entries(timeGroups)) {
            if (data.system.length > 0) {
                const accuracy = data.system.filter((s, i) => s.driver === data.manual[i].driver).length / data.system.length * 100;
                console.log(`   ${group}: ${accuracy.toFixed(0)}% accuracy (${data.system.length} sipariş)`);
            }
        }
        
        // 6️⃣ PATTERN TESPİTİ
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 ANALİZ SONUÇLARI:`);
        console.log(`   Eşleşme: ${analysis.matches.length}`);
        console.log(`   Fark: ${analysis.differences.length}`);
        console.log(`   Accuracy: ${(analysis.matches.length / commonOrderIds.length * 100).toFixed(1)}%`);
        console.log(`${'='.repeat(80)}\n`);
        
        // 🔴 MESAFE PATTERN
        if (distanceErrors.length >= commonOrderIds.length * 0.1) {
            const avgExtraDistance = distanceErrors.reduce((sum, e) => sum + e.diff, 0) / distanceErrors.length;
            
            console.log(`\n⚠️ MESAFE PROBLEMİ TESPİT EDİLDİ!`);
            console.log(`   ${distanceErrors.length} siparişte manuel daha uzak sürücü seçti`);
            console.log(`   Ortalama ekstra mesafe: ${avgExtraDistance.toFixed(1)} mil`);
            console.log(`\n   💡 ÖNERİ: Mesafe ağırlığını azalt (400→250), diğer faktörleri arttır\n`);
            
            analysis.patterns.distance_pattern = {
                issue: `${distanceErrors.length} siparişte manuel atama daha uzak sürücü tercih etti`,
                avg_extra_distance: avgExtraDistance.toFixed(1),
                recommendation: 'Mesafe skoru ağırlığını 400→250\'ye düşür, bölge/erken sabah skorlarını arttır',
                error_count: distanceErrors.length
            };
        }
        
        // 🔴 BÖLGE PATTERN
        if (regionErrors.length >= commonOrderIds.length * 0.1) {
            console.log(`\n⚠️ BÖLGE UZMANLIĞI PROBLEMİ!`);
            console.log(`   ${regionErrors.length} siparişte manuel bölge uzmanı tercih etti`);
            console.log(`\n   💡 ÖNERİ: Bölge skoru ağırlığını arttır (50→100)\n`);
            
            analysis.patterns.region_pattern = {
                issue: `${regionErrors.length} siparişte manuel bölge uzmanını tercih etti`,
                recommendation: 'Bölge uzmanlığı skorunu 50→100\'e çıkar',
                error_count: regionErrors.length
            };
        }
        
        // 🔴 ERKEN SABAH PATTERN
        if (timeErrors.length > 0) {
            console.log(`\n⚠️ ERKEN SABAH GÜVENİLİRLİK PROBLEMİ!`);
            console.log(`   ${timeErrors.length} siparişte manuel daha güvenilir sürücü seçti`);
            console.log(`\n   💡 ÖNERİ: Erken sabah güvenilirlik skorunu arttır\n`);
            
            analysis.patterns.time_pattern = {
                issue: `${timeErrors.length} siparişte manuel daha güvenilir erken sabah sürücüsü tercih etti`,
                recommendation: 'Early morning reliability skorunu arttır (30+bonus → 50+bonus)',
                error_count: timeErrors.length
            };
        }
        
        return Response.json({
            success: true,
            accuracy: parseFloat((analysis.matches.length / commonOrderIds.length * 100).toFixed(1)),
            total_common_orders: commonOrderIds.length,
            only_in_system: onlyInSystem.length,
            only_in_manual: onlyInManual.length,
            matches: analysis.matches,
            differences: analysis.differences,
            patterns: analysis.patterns,
            time_groups: timeGroups,
            summary: {
                analyzed: commonOrderIds.length,
                matched: analysis.matches.length,
                different: analysis.differences.length,
                distance_errors: distanceErrors.length,
                region_errors: regionErrors.length,
                time_errors: timeErrors.length
            }
        });

    } catch (error) {
        console.error("❌ Analiz hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});