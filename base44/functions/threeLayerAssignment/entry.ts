import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ==================== CONFIG ====================
const PRIORITY_DRIVERS = [
    'Ersad',
    'Onur Uzonur', 
    'Sertan Qwert',
    'Caleb'
];

// Priority driver bonusları - DENGELI (sistemi bozmadan öncelik verir)
const PRIORITY_DRIVER_CONFIG = {
    maxOrderBonus: 1,        // Max order +1 (5 → 6, çok sipariş varsa 1 fazla alabilir)
    firstOrderBonus: 3,       // İlk sipariş +3 puan (makul öncelik)
    chainOrderBonus: 6        // Zincir sipariş +6 puan (güçlü ama dengeli)
};

// ==================== HELPER FUNCTIONS ====================

const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 69; // mil cinsinden (1 derece ≈ 69 mil)
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    return Math.sqrt(dLat * dLat + dLng * dLng) * R;
};

const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

const extractRegion = (address) => {
    const zipMatch = address.match(/\b(\d{5})\b/);
    const stateMatch = address.match(/\b(VA|MD|DC|WV)\b/);
    const cityMatch = address.match(/([A-Za-z\s]+),?\s+(VA|MD|DC|WV)/i);
    return { 
        zip: zipMatch?.[1], 
        state: stateMatch?.[1], 
        city: cityMatch?.[1]?.trim().toLowerCase()
    };
};

const getRegionPriority = (driver, orderRegion) => {
    // Bölge önceliklerini kontrol et
    const regionPriorities = driver.special_notes?.region_priorities || {};
    
    // City bazlı kontrol
    if (orderRegion.city && regionPriorities[orderRegion.city]) {
        return regionPriorities[orderRegion.city];
    }
    
    // State bazlı kontrol (fallback)
    if (orderRegion.state && regionPriorities[orderRegion.state]) {
        return regionPriorities[orderRegion.state];
    }
    
    // Zip bazlı kontrol
    if (orderRegion.zip && regionPriorities[orderRegion.zip]) {
        return regionPriorities[orderRegion.zip];
    }
    
    return null; // Öncelik yok
};

const isPriorityDriver = (driverName) => {
    return PRIORITY_DRIVERS.some(name => 
        driverName.toLowerCase().includes(name.toLowerCase())
    );
};

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        console.log(`\n🚀 RULE-BASED ASSIGNMENT V9 (${targetDate})`);
        console.log(`✨ DENGELİ Priority Driver sistemi (Ersad, Onur, Sertan, Caleb)`);
        console.log(`⚡ SUPERVISOR LLM KALDIRILDI - Timeout önleme\n`);
        
        // ===========================================
        // DATA LOADING
        // ===========================================
        
        const allDrivers = await base44.asServiceRole.entities.Driver.filter({ status: 'Aktif' });
        const topDashers = allDrivers.filter(d => d.is_top_dasher === true);
        
        const dayOfWeek = new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
        
        const workingDrivers = topDashers.filter(d => {
            const workingDays = d.assignment_preferences?.working_days || [];
            const hasCoords = d.home_coordinates?.lat && d.home_coordinates?.lng;
            const isWorkingToday = workingDays.length === 0 || workingDays.includes(dayOfWeek);
            return hasCoords && isWorkingToday;
        });
        
        console.log(`✅ ${workingDrivers.length} çalışan sürücü (koordinatlı, bugün çalışıyor)`);
        
        // Priority driver sayısını logla
        const priorityCount = workingDrivers.filter(d => isPriorityDriver(d.name)).length;
        console.log(`⭐ ${priorityCount} priority driver aktif: ${PRIORITY_DRIVERS.join(', ')}`);
        
        // Siparişleri yükle
        const allOrders = await base44.asServiceRole.entities.DailyOrder.filter({ 
            order_date: targetDate 
        }, 'pickup_time', 200);
        
        const unassignedOrders = allOrders
            .filter(o => o.status === 'Çekildi')
            .filter(o => o.pickup_coords?.lat && o.pickup_coords?.lng)
            .sort((a, b) => (parseTime(a.pickup_time) || 0) - (parseTime(b.pickup_time) || 0));
        
        console.log(`📦 ${unassignedOrders.length} atanacak sipariş (koordinatlı, sıralı)`);
        
        if (unassignedOrders.length === 0) {
            return Response.json({
                success: true,
                message: 'Atanacak sipariş yok',
                assignedCount: 0,
                totalOrders: 0,
                assignments: []
            });
        }
        
        // Mevcut atamaları yükle
        const assignedOrders = allOrders.filter(o => o.driver_id && o.status === 'Atandı');
        
        // Driver state'leri oluştur
        const driverStates = new Map();
        
        for (const driver of workingDrivers) {
            const currentOrders = assignedOrders.filter(o => o.driver_id === driver.id);
            const maxOrders = driver.assignment_preferences?.max_orders_per_day || 5;
            
            // ⚖️ Priority driver ise max'ı SADECE +1 artır (dengeli)
            const isPriority = isPriorityDriver(driver.name);
            const adjustedMax = isPriority ? maxOrders + PRIORITY_DRIVER_CONFIG.maxOrderBonus : maxOrders;
            
            // Son dropoff'u bul
            let lastDropoffTime = null;
            let lastDropoffCoords = null;
            
            for (const order of currentOrders) {
                const dropTime = parseTime(order.dropoff_time);
                if (dropTime && (!lastDropoffTime || dropTime > lastDropoffTime)) {
                    lastDropoffTime = dropTime;
                    lastDropoffCoords = order.dropoff_coords;
                }
            }
            
            driverStates.set(driver.id, {
                driver,
                currentOrders,
                assignedCount: currentOrders.length,
                maxOrders: adjustedMax,
                isPriorityDriver: isPriority,
                lastDropoffTime,
                lastDropoffCoords,
                newAssignments: []
            });
        }
        
        // ===========================================
        // RULE-BASED ASSIGNMENT ALGORITHM
        // ===========================================
        
        console.log(`\n🎯 RULE-BASED ASSIGNMENT BAŞLIYOR...\n`);
        
        const assignments = [];
        const rejections = [];
        
        for (const order of unassignedOrders) {
            const pickupTime = parseTime(order.pickup_time);
            const dropoffTime = parseTime(order.dropoff_time);
            
            if (!pickupTime || !dropoffTime) {
                rejections.push({
                    order_id: order.ezcater_order_id,
                    reason: 'Geçersiz pickup/dropoff time'
                });
                continue;
            }
            
            const orderRegion = extractRegion(order.pickup_address);
            
            console.log(`\n📦 Sipariş: ${order.ezcater_order_id} (${order.pickup_time})`);
            console.log(`   Bölge: ${orderRegion.city || orderRegion.state || 'Unknown'}`);
            
            // Her sürücüyü değerlendir ve bölge önceliklerine göre grupla
            const candidatesByPriority = {
                1: [],
                2: [],
                3: [],
                null: [] // Öncelik tanımlanmamış
            };
            
            for (const [driverId, state] of driverStates.entries()) {
                const driver = state.driver;
                
                // KURAL 1: Max order limit
                if (state.assignedCount >= state.maxOrders) {
                    continue;
                }
                
                // İlk sipariş mi?
                const isFirstOrder = state.assignedCount === 0;
                
                // KURAL 2: İlk sipariş 10 mil
                if (isFirstOrder) {
                    const distanceFromHome = calculateDistance(
                        driver.home_coordinates.lat,
                        driver.home_coordinates.lng,
                        order.pickup_coords.lat,
                        order.pickup_coords.lng
                    );
                    
                    if (distanceFromHome > 10) {
                        continue;
                    }
                    
                    // Bölge önceliğini kontrol et
                    const regionPriority = getRegionPriority(driver, orderRegion);
                    
                    // İlk sipariş için base score
                    let score = 10 - distanceFromHome;
                    
                    // ⚖️ Priority driver bonusu (dengeli)
                    if (state.isPriorityDriver) {
                        score += PRIORITY_DRIVER_CONFIG.firstOrderBonus; // +3 puan
                    }
                    
                    candidatesByPriority[regionPriority].push({
                        driverId,
                        state,
                        driverName: driver.name,
                        score,
                        distanceFromHome,
                        isFirstOrder: true,
                        regionPriority,
                        isPriorityDriver: state.isPriorityDriver
                    });
                    
                } else {
                    // Zincirleme sipariş için zaman ve mesafe kontrolü
                    
                    // KURAL 3: Zaman çakışması kontrolü
                    const timeGap = pickupTime - state.lastDropoffTime;
                    
                    if (timeGap < 0) {
                        continue;
                    }
                    
                    // KURAL 4: Fiziksel erişme kontrolü
                    if (!state.lastDropoffCoords?.lat || !state.lastDropoffCoords?.lng) {
                        continue;
                    }
                    
                    const distance = calculateDistance(
                        state.lastDropoffCoords.lat,
                        state.lastDropoffCoords.lng,
                        order.pickup_coords.lat,
                        order.pickup_coords.lng
                    );
                    
                    const estimatedTravelTime = distance * 3; // 1 mil = 3 dakika
                    const requiredTime = estimatedTravelTime + 15; // 15 dk buffer
                    
                    if (timeGap < requiredTime) {
                        continue;
                    }
                    
                    // Bölge önceliğini kontrol et
                    const regionPriority = getRegionPriority(driver, orderRegion);
                    
                    // Zincirleme sipariş için score
                    const timeEfficiency = Math.min(timeGap / 60, 2);
                    const distanceScore = Math.max(0, 10 - distance);
                    let score = timeEfficiency + distanceScore;
                    
                    // ⚖️ Priority driver bonusu (dengeli - güçlü ama sistemi bozmaz)
                    if (state.isPriorityDriver) {
                        score += PRIORITY_DRIVER_CONFIG.chainOrderBonus; // +6 puan
                    }
                    
                    candidatesByPriority[regionPriority].push({
                        driverId,
                        state,
                        driverName: driver.name,
                        score,
                        distance,
                        timeGap,
                        estimatedTravelTime,
                        isFirstOrder: false,
                        regionPriority,
                        isPriorityDriver: state.isPriorityDriver
                    });
                }
            }
            
            // Bölge önceliklerine göre en iyi adayı seç
            let bestCandidate = null;
            
            // Önce 1. öncelikli sürücülere bak
            if (candidatesByPriority[1].length > 0) {
                candidatesByPriority[1].sort((a, b) => b.score - a.score);
                bestCandidate = candidatesByPriority[1][0];
                console.log(`   ⭐ 1. ÖNCELİKLİ sürücü bulundu: ${bestCandidate.driverName}`);
            }
            // 1. öncelikli yoksa 2. öncelikli
            else if (candidatesByPriority[2].length > 0) {
                candidatesByPriority[2].sort((a, b) => b.score - a.score);
                bestCandidate = candidatesByPriority[2][0];
                console.log(`   ⭐ 2. ÖNCELİKLİ sürücü bulundu: ${bestCandidate.driverName}`);
            }
            // 2. öncelikli yoksa 3. öncelikli
            else if (candidatesByPriority[3].length > 0) {
                candidatesByPriority[3].sort((a, b) => b.score - a.score);
                bestCandidate = candidatesByPriority[3][0];
                console.log(`   ⭐ 3. ÖNCELİKLİ sürücü bulundu: ${bestCandidate.driverName}`);
            }
            // Öncelik tanımlanmamış olanlar
            else if (candidatesByPriority[null].length > 0) {
                candidatesByPriority[null].sort((a, b) => b.score - a.score);
                bestCandidate = candidatesByPriority[null][0];
                console.log(`   ℹ️ Öncelik tanımsız sürücü seçildi: ${bestCandidate.driverName}`);
            }
            
            // Atama yap
            if (bestCandidate) {
                const { driverId, state } = bestCandidate;
                const driver = state.driver;
                
                console.log(`✅ ATANDI: ${driver.name} (score: ${bestCandidate.score.toFixed(2)}${state.isPriorityDriver ? ', PRIORITY DRIVER ⭐' : ''})`);
                
                const assignmentData = {
                    order_id: order.ezcater_order_id,
                    driver_id: driverId,
                    driver_name: driver.name,
                    driver_phone: driver.phone,
                    pickup_time: order.pickup_time,
                    dropoff_time: order.dropoff_time,
                    pickup_address: order.pickup_address,
                    dropoff_address: order.dropoff_address,
                    isFirstOrder: bestCandidate.isFirstOrder,
                    score: bestCandidate.score.toFixed(2),
                    regionPriority: bestCandidate.regionPriority,
                    isPriorityDriver: state.isPriorityDriver
                };
                
                if (bestCandidate.isFirstOrder) {
                    assignmentData.distanceFromHome = bestCandidate.distanceFromHome.toFixed(1);
                } else {
                    assignmentData.distance = bestCandidate.distance.toFixed(1);
                    assignmentData.timeGap = bestCandidate.timeGap;
                    assignmentData.estimatedTravel = Math.ceil(bestCandidate.estimatedTravelTime);
                }
                
                assignments.push(assignmentData);
                
                // State güncelle
                state.assignedCount++;
                state.lastDropoffTime = dropoffTime;
                state.lastDropoffCoords = order.dropoff_coords;
                state.newAssignments.push(order.ezcater_order_id);
                
                // Database'e kaydet - 🔧 DRIVER_PHONE EKLENDI!
                try {
                    await base44.asServiceRole.entities.DailyOrder.update(order.id, {
                        driver_id: driverId,
                        driver_name: driver.name,
                        driver_phone: driver.phone, // ✅ EKLENDI!
                        status: 'Atandı'
                    });
                } catch (error) {
                    console.error(`❌ ${order.ezcater_order_id} kaydedilemedi:`, error.message);
                }
                
            } else {
                console.log(`❌ ATANAMADI: Uygun sürücü bulunamadı`);
                
                // Detaylı log: Hangi öncelik seviyelerinde kaç aday vardı
                const priorityLog = Object.entries(candidatesByPriority)
                    .filter(([_, candidates]) => candidates.length > 0)
                    .map(([priority, candidates]) => `${priority}: ${candidates.length} aday`)
                    .join(', ');
                
                rejections.push({
                    order_id: order.ezcater_order_id,
                    reason: `Tüm öncelik seviyeleri kontrol edildi (${priorityLog || 'hiç aday yok'})`,
                    region: `${orderRegion.city || orderRegion.state || 'Unknown'}`
                });
            }
        }
        
        console.log(`\n✅ ATAMA TAMAMLANDI:`);
        console.log(`   Atanan: ${assignments.length}`);
        console.log(`   Atanmayan: ${rejections.length}`);
        
        // Priority driver istatistikleri
        const priorityDriverAssignments = assignments.filter(a => a.isPriorityDriver);
        const priorityDriverChains = priorityDriverAssignments.filter(a => !a.isFirstOrder).length;
        console.log(`   Priority driver'lara atanan: ${priorityDriverAssignments.length}`);
        console.log(`   Priority driver zincirleri: ${priorityDriverChains}`);
        
        // Her priority driver için istatistik
        PRIORITY_DRIVERS.forEach(driverPattern => {
            const count = assignments.filter(a => 
                a.driver_name.toLowerCase().includes(driverPattern.toLowerCase()) ||
                driverPattern.toLowerCase().includes(a.driver_name.toLowerCase())
            ).length;
            
            if (count > 0) {
                const chainCount = assignments.filter(a => 
                    !a.isFirstOrder && (
                        a.driver_name.toLowerCase().includes(driverPattern.toLowerCase()) ||
                        driverPattern.toLowerCase().includes(a.driver_name.toLowerCase())
                    )
                ).length;
                console.log(`      ${driverPattern}: ${count} sipariş (${chainCount} zincir)`);
            }
        });
        
        // ===========================================
        // BASİT KALİTE SKORU HESAPLAMA (LLM YOK)
        // ===========================================
        
        console.log('\n📊 KALİTE SKORU HESAPLANIYOR (LLM yok - timeout önleme)...');
        
        // Bölge öncelik istatistikleri
        const regionPriorityStats = {
            1: assignments.filter(a => a.regionPriority === 1).length,
            2: assignments.filter(a => a.regionPriority === 2).length,
            3: assignments.filter(a => a.regionPriority === 3).length,
            null: assignments.filter(a => a.regionPriority === null).length
        };
        
        // Basit kalite skoru formülü
        const assignmentRate = assignments.length / unassignedOrders.length;
        const priorityDriverRate = priorityDriverAssignments.length / assignments.length;
        const regionPriority1Rate = regionPriorityStats[1] / assignments.length;
        
        // 0-100 arası skor
        const qualityScore = Math.round(
            (assignmentRate * 40) + // %40 atama oranı
            (priorityDriverRate * 30) + // %30 priority driver kullanımı
            (regionPriority1Rate * 30) // %30 bölge önceliği kullanımı
        );
        
        console.log(`✅ Kalite Skoru: ${qualityScore}/100`);
        console.log(`   - Atama Oranı: ${Math.round(assignmentRate * 100)}%`);
        console.log(`   - Priority Driver: ${Math.round(priorityDriverRate * 100)}%`);
        console.log(`   - 1. Öncelik Bölge: ${Math.round(regionPriority1Rate * 100)}%`);
        
        // ===========================================
        // SONUÇLARI DÖNDÜR
        // ===========================================
        
        return Response.json({
            success: true,
            message: `Rule-based V9 ile ${assignments.length} sipariş atandı`,
            assignedCount: assignments.length,
            totalOrders: unassignedOrders.length,
            rejectedCount: rejections.length,
            assignment_rate: Math.round(assignmentRate * 100),
            available_drivers: workingDrivers.length,
            priority_drivers_count: priorityCount,
            priority_driver_assignments: priorityDriverAssignments.length,
            priority_driver_chains: priorityDriverChains,
            region_priority_stats: regionPriorityStats,
            layer1_summary: `${workingDrivers.length} sürücü yüklendi (${priorityCount} priority: ${PRIORITY_DRIVERS.join(', ')})`,
            layer2_summary: `Rule-based V9: DENGELİ Priority Driver sistemi`,
            layer3_summary: `Basit kalite skoru: ${qualityScore}/100 (LLM timeout önleme için kaldırıldı)`,
            quality_score: qualityScore,
            violations: [],
            rejected_assignments: rejections,
            unassigned_orders: rejections.map(r => ({ 
                order_id: r.order_id, 
                reason: r.reason,
                region: r.region
            })),
            assignments: assignments
        });

    } catch (error) {
        console.error("❌ Rule-Based Assignment Hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});