import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const extractRegion = (address) => {
    const zipMatch = address.match(/\b(\d{5})\b/);
    const stateMatch = address.match(/\b(VA|MD|DC|WV)\b/);
    
    return {
        zip: zipMatch ? zipMatch[1] : null,
        state: stateMatch ? stateMatch[1] : null
    };
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

const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

const geocodeAddress = async (address) => {
    if (!address) return null;
    
    try {
        const cleanAddress = address
            .replace(/\\n/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress + ', USA')}&limit=1&countrycodes=us`,
            { headers: { 'User-Agent': 'OrderGrouping/1.0' } }
        );
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    
    return null;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        console.log(`\n🎯 ${targetDate} - SABAH/AKŞAM GRUPLAMASI\n`);
        
        const allOrders = await base44.entities.DailyOrder.filter({ 
            order_date: targetDate,
            status: 'Çekildi'
        }, 'pickup_time', 500);
        
        if (allOrders.length === 0) {
            return Response.json({
                success: false,
                error: 'Atanmamış sipariş yok'
            });
        }
        
        console.log(`📦 ${allOrders.length} sipariş\n`);
        
        // Geocode
        console.log('📍 Geocoding...');
        for (let i = 0; i < allOrders.length; i++) {
            const order = allOrders[i];
            if (!order.pickup_coords) {
                const pickupCoords = await geocodeAddress(order.pickup_address);
                if (pickupCoords) order.pickup_coords = pickupCoords;
            }
            if (!order.dropoff_coords) {
                const dropoffCoords = await geocodeAddress(order.dropoff_address);
                if (dropoffCoords) order.dropoff_coords = dropoffCoords;
            }
            
            if ((i + 1) % 3 === 0 && i < allOrders.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        console.log('✅ Geocoding tamamlandı\n');
        
        // Pickup time'a göre sırala
        const sortedOrders = allOrders.sort((a, b) => {
            const timeA = parseTime(a.pickup_time) || 0;
            const timeB = parseTime(b.pickup_time) || 0;
            return timeA - timeB;
        });
        
        // 📅 SABAH/AKŞAM AYIR (07:30 - 14:00 | 14:00 - 21:00)
        const morningOrders = sortedOrders.filter(o => {
            const time = parseTime(o.pickup_time);
            return time >= 450 && time < 840; // 07:30 - 14:00
        });
        
        const eveningOrders = sortedOrders.filter(o => {
            const time = parseTime(o.pickup_time);
            return time >= 840 && time <= 1260; // 14:00 - 21:00
        });
        
        console.log(`📅 SABAH: ${morningOrders.length} sipariş (07:30-14:00)`);
        console.log(`📅 AKŞAM: ${eveningOrders.length} sipariş (14:00-21:00)\n`);
        
        // Active drivers'ı al
        const allDrivers = await base44.entities.Driver.list();
        const activeDrivers = allDrivers.filter(d => d.status === 'Aktif');
        
        // Günü bul
        const dayOfWeek = new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
        const workingDrivers = activeDrivers.filter(d => {
            const workingDays = d.assignment_preferences?.working_days || [];
            return workingDays.includes(dayOfWeek);
        });
        
        console.log(`👥 ${workingDrivers.length} sürücü çalışıyor (${dayOfWeek})\n`);
        
        // 🔥 3 TURLU GRUPLAMA FONKSİYONU
        const performGrouping = (orders, shift, maxDistanceFromHome) => {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📅 ${shift} GRUPLAMASI`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            const pairs1 = [];
            const pairs2 = [];
            const pairs3 = [];
            
            // TUR 1: SIKI KURALLAR (Aynı bölge, yakın mesafe)
            console.log('🔵 TUR 1: Perfect Match (<15 mil, 15-90 dk)\n');
            
            for (let i = 0; i < orders.length; i++) {
                const order1 = orders[i];
                const order1DropoffTime = parseTime(order1.dropoff_time);
                const order1DropoffCoords = order1.dropoff_coords;
                const order1State = extractRegion(order1.dropoff_address).state;
                
                for (let j = i + 1; j < orders.length; j++) {
                    const order2 = orders[j];
                    const order2PickupTime = parseTime(order2.pickup_time);
                    const order2State = extractRegion(order2.pickup_address).state;
                    
                    const gap = order2PickupTime - order1DropoffTime;
                    
                    if (gap < 15 || gap > 90) continue;
                    
                    let distance = 999;
                    if (order1DropoffCoords && order2.pickup_coords) {
                        distance = calculateDistance(
                            order1DropoffCoords.lat,
                            order1DropoffCoords.lng,
                            order2.pickup_coords.lat,
                            order2.pickup_coords.lng
                        );
                    }
                    
                    if (distance > 15) continue;
                    
                    let score = 0;
                    
                    if (distance < 3) score += 100;
                    else if (distance < 7) score += 80;
                    else if (distance < 12) score += 60;
                    else score += 40;
                    
                    if (gap >= 20 && gap <= 60) score += 60;
                    else score += 30;
                    
                    if (order1State === order2State) score += 40;
                    
                    pairs1.push({
                        order1_idx: i,
                        order2_idx: j,
                        score,
                        distance: distance.toFixed(1),
                        gap
                    });
                }
            }
            
            pairs1.sort((a, b) => b.score - a.score);
            console.log(`✅ ${pairs1.length} perfect match bulundu\n`);
            
            // TUR 2: ORTA KURALLAR
            console.log('🟢 TUR 2: İyi Eşleşmeler (<30 mil, 10-120 dk)\n');
            
            for (let i = 0; i < orders.length; i++) {
                const order1 = orders[i];
                const order1DropoffTime = parseTime(order1.dropoff_time);
                const order1DropoffCoords = order1.dropoff_coords;
                const order1State = extractRegion(order1.dropoff_address).state;
                
                for (let j = i + 1; j < orders.length; j++) {
                    const order2 = orders[j];
                    const order2PickupTime = parseTime(order2.pickup_time);
                    const order2State = extractRegion(order2.pickup_address).state;
                    
                    const gap = order2PickupTime - order1DropoffTime;
                    
                    if (gap < 10 || gap > 120) continue;
                    
                    let distance = 999;
                    if (order1DropoffCoords && order2.pickup_coords) {
                        distance = calculateDistance(
                            order1DropoffCoords.lat,
                            order1DropoffCoords.lng,
                            order2.pickup_coords.lat,
                            order2.pickup_coords.lng
                        );
                    }
                    
                    if (distance > 30) continue;
                    
                    let score = 0;
                    
                    if (distance < 5) score += 70;
                    else if (distance < 15) score += 50;
                    else if (distance < 25) score += 30;
                    else score += 15;
                    
                    if (gap >= 15 && gap <= 90) score += 40;
                    else score += 20;
                    
                    if (order1State === order2State) score += 30;
                    
                    pairs2.push({
                        order1_idx: i,
                        order2_idx: j,
                        score,
                        distance: distance.toFixed(1),
                        gap
                    });
                }
            }
            
            pairs2.sort((a, b) => b.score - a.score);
            console.log(`✅ ${pairs2.length} iyi eşleşme bulundu\n`);
            
            // TUR 3: GEVŞEK KURALLAR
            console.log('🟡 TUR 3: Zorla Birleştir (<50 mil, 5-180 dk)\n');
            
            for (let i = 0; i < orders.length; i++) {
                const order1 = orders[i];
                const order1DropoffTime = parseTime(order1.dropoff_time);
                const order1DropoffCoords = order1.dropoff_coords;
                
                for (let j = i + 1; j < orders.length; j++) {
                    const order2 = orders[j];
                    const order2PickupTime = parseTime(order2.pickup_time);
                    
                    const gap = order2PickupTime - order1DropoffTime;
                    
                    if (gap < 5 || gap > 180) continue;
                    
                    let distance = 999;
                    if (order1DropoffCoords && order2.pickup_coords) {
                        distance = calculateDistance(
                            order1DropoffCoords.lat,
                            order1DropoffCoords.lng,
                            order2.pickup_coords.lat,
                            order2.pickup_coords.lng
                        );
                    }
                    
                    if (distance > 50) continue;
                    
                    let score = 0;
                    
                    if (distance < 10) score += 40;
                    else if (distance < 25) score += 25;
                    else score += 10;
                    
                    if (gap >= 10 && gap <= 120) score += 20;
                    else score += 5;
                    
                    pairs3.push({
                        order1_idx: i,
                        order2_idx: j,
                        score,
                        distance: distance.toFixed(1),
                        gap
                    });
                }
            }
            
            pairs3.sort((a, b) => b.score - a.score);
            console.log(`✅ ${pairs3.length} gevşek eşleşme bulundu\n`);
            
            // GRUPLARI OLUŞTUR
            const groups = [];
            const assigned = new Set();
            const orderToGroup = {};
            
            // TUR 1 Gruplama
            for (const pair of pairs1) {
                const idx1 = pair.order1_idx;
                const idx2 = pair.order2_idx;
                
                if (assigned.has(idx1) && assigned.has(idx2)) continue;
                
                if (assigned.has(idx1) && !assigned.has(idx2)) {
                    const groupId = orderToGroup[idx1];
                    const group = groups.find(g => g.id === groupId);
                    
                    if (group && group.orders.length < 4) {
                        group.orders.push(orders[idx2]);
                        group.endTime = orders[idx2].dropoff_time;
                        assigned.add(idx2);
                        orderToGroup[idx2] = groupId;
                    }
                    continue;
                }
                
                if (!assigned.has(idx1) && assigned.has(idx2)) continue;
                
                if (!assigned.has(idx1) && !assigned.has(idx2)) {
                    const groupId = `group_${shift}_${Date.now()}_${groups.length}`;
                    const newGroup = {
                        id: groupId,
                        shift: shift,
                        orders: [orders[idx1], orders[idx2]],
                        regions: [],
                        startTime: orders[idx1].pickup_time,
                        endTime: orders[idx2].dropoff_time,
                        isCrossRegion: false,
                        firstPickupCoords: orders[idx1].pickup_coords
                    };
                    
                    groups.push(newGroup);
                    assigned.add(idx1);
                    assigned.add(idx2);
                    orderToGroup[idx1] = groupId;
                    orderToGroup[idx2] = groupId;
                }
            }
            
            console.log(`📊 TUR 1 Sonuç: ${groups.length} grup, ${assigned.size} sipariş\n`);
            
            // TUR 2 Gruplama
            for (const pair of pairs2) {
                const idx1 = pair.order1_idx;
                const idx2 = pair.order2_idx;
                
                if (assigned.has(idx1) && assigned.has(idx2)) continue;
                
                if (assigned.has(idx1) && !assigned.has(idx2)) {
                    const groupId = orderToGroup[idx1];
                    const group = groups.find(g => g.id === groupId);
                    
                    if (group && group.orders.length < 4) {
                        group.orders.push(orders[idx2]);
                        group.endTime = orders[idx2].dropoff_time;
                        assigned.add(idx2);
                        orderToGroup[idx2] = groupId;
                    }
                    continue;
                }
                
                if (!assigned.has(idx1) && assigned.has(idx2)) continue;
                
                if (!assigned.has(idx1) && !assigned.has(idx2)) {
                    const groupId = `group_${shift}_${Date.now()}_${groups.length}`;
                    const newGroup = {
                        id: groupId,
                        shift: shift,
                        orders: [orders[idx1], orders[idx2]],
                        regions: [],
                        startTime: orders[idx1].pickup_time,
                        endTime: orders[idx2].dropoff_time,
                        isCrossRegion: false,
                        firstPickupCoords: orders[idx1].pickup_coords
                    };
                    
                    groups.push(newGroup);
                    assigned.add(idx1);
                    assigned.add(idx2);
                    orderToGroup[idx1] = groupId;
                    orderToGroup[idx2] = groupId;
                }
            }
            
            console.log(`📊 TUR 2 Sonuç: ${groups.length} grup, ${assigned.size} sipariş\n`);
            
            // TUR 3 Gruplama
            for (const pair of pairs3) {
                const idx1 = pair.order1_idx;
                const idx2 = pair.order2_idx;
                
                if (assigned.has(idx1) && assigned.has(idx2)) continue;
                
                if (assigned.has(idx1) && !assigned.has(idx2)) {
                    const groupId = orderToGroup[idx1];
                    const group = groups.find(g => g.id === groupId);
                    
                    if (group && group.orders.length < 4) {
                        group.orders.push(orders[idx2]);
                        group.endTime = orders[idx2].dropoff_time;
                        assigned.add(idx2);
                        orderToGroup[idx2] = groupId;
                    }
                    continue;
                }
                
                if (!assigned.has(idx1) && assigned.has(idx2)) continue;
                
                if (!assigned.has(idx1) && !assigned.has(idx2)) {
                    const groupId = `group_${shift}_${Date.now()}_${groups.length}`;
                    const newGroup = {
                        id: groupId,
                        shift: shift,
                        orders: [orders[idx1], orders[idx2]],
                        regions: [],
                        startTime: orders[idx1].pickup_time,
                        endTime: orders[idx2].dropoff_time,
                        isCrossRegion: false,
                        firstPickupCoords: orders[idx1].pickup_coords
                    };
                    
                    groups.push(newGroup);
                    assigned.add(idx1);
                    assigned.add(idx2);
                    orderToGroup[idx1] = groupId;
                    orderToGroup[idx2] = groupId;
                }
            }
            
            const standalone = orders.filter((_, idx) => !assigned.has(idx));
            
            console.log(`\n✅ ${shift} TOPLAM:`);
            console.log(`   Grup: ${groups.length}`);
            console.log(`   Gruplu Sipariş: ${assigned.size}`);
            console.log(`   Tekli: ${standalone.length}\n`);
            
            // Bölge bilgilerini doldur
            groups.forEach(g => {
                const states = new Set();
                g.orders.forEach(o => {
                    const region = extractRegion(o.dropoff_address);
                    if (region.state) states.add(region.state);
                });
                g.regions = Array.from(states);
                g.isCrossRegion = g.regions.length > 1;
            });
            
            // 🎯 HER GRUP İÇİN ÖNERİLEN SÜRÜCÜLER
            for (const group of groups) {
                const firstPickupCoords = group.firstPickupCoords;
                
                if (!firstPickupCoords) {
                    group.suggestedDrivers = [];
                    continue;
                }
                
                const driverScores = [];
                
                for (const driver of workingDrivers) {
                    let score = 0;
                    let reasons = [];
                    
                    // Ev yakınlığı
                    if (driver.home_coordinates) {
                        const homeDistance = calculateDistance(
                            driver.home_coordinates.lat,
                            driver.home_coordinates.lng,
                            firstPickupCoords.lat,
                            firstPickupCoords.lng
                        );
                        
                        if (homeDistance < 5) {
                            score += 100;
                            reasons.push(`Eve ${homeDistance.toFixed(1)} mil`);
                        } else if (homeDistance < maxDistanceFromHome) {
                            score += 60;
                            reasons.push(`Eve ${homeDistance.toFixed(1)} mil`);
                        } else {
                            score -= 50;
                            reasons.push(`❌ Çok uzak (${homeDistance.toFixed(1)} mil)`);
                        }
                    }
                    
                    // Preferred areas
                    if (driver.preferred_areas && driver.preferred_areas.length > 0) {
                        const groupRegion = extractRegion(group.orders[0].pickup_address);
                        if (groupRegion.state && driver.preferred_areas.includes(groupRegion.state)) {
                            score += 50;
                            reasons.push('Tercih bölgesi');
                        }
                    }
                    
                    // DC kısıtlaması
                    if (driver.special_notes?.avoid_dc && group.regions.includes('DC')) {
                        score -= 500;
                        reasons.push('❌ DC\'ye girmek istemiyor');
                    }
                    
                    // Early morning
                    if (shift === 'SABAH') {
                        if (driver.early_morning_eligible) {
                            score += 30;
                            reasons.push('Erken sabah uygun');
                        }
                    }
                    
                    driverScores.push({
                        driverId: driver.id,
                        driverName: driver.name,
                        score,
                        reasons: reasons.join(', ')
                    });
                }
                
                driverScores.sort((a, b) => b.score - a.score);
                group.suggestedDrivers = driverScores.slice(0, 5);
            }
            
            return { groups, standalone };
        };
        
        // SABAH GRUPLAMASI
        const morningResult = performGrouping(morningOrders, 'SABAH', 10);
        
        // AKŞAM GRUPLAMASI
        const eveningResult = performGrouping(eveningOrders, 'AKŞAM', 15);
        
        // Birleştir
        const allGroups = [...morningResult.groups, ...eveningResult.groups];
        const allStandalone = [...morningResult.standalone, ...eveningResult.standalone];
        
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 GENEL SONUÇ`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Toplam Sipariş: ${sortedOrders.length}`);
        console.log(`Toplam Grup: ${allGroups.length}`);
        console.log(`Gruplu Sipariş: ${sortedOrders.length - allStandalone.length}`);
        console.log(`Tekli Sipariş: ${allStandalone.length} (%${((allStandalone.length / sortedOrders.length) * 100).toFixed(1)})`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        return Response.json({
            success: true,
            groups: allGroups,
            standalone: allStandalone,
            stats: {
                totalOrders: sortedOrders.length,
                groupCount: allGroups.length,
                standaloneCount: allStandalone.length,
                standalonePercent: ((allStandalone.length / sortedOrders.length) * 100).toFixed(1),
                crossRegionGroups: allGroups.filter(g => g.isCrossRegion).length,
                avgGroupSize: allGroups.length > 0 ? (sortedOrders.length - allStandalone.length) / allGroups.length : 0,
                groupedOrders: sortedOrders.length - allStandalone.length,
                morningGroups: morningResult.groups.length,
                eveningGroups: eveningResult.groups.length
            }
        });

    } catch (error) {
        console.error("Gruplama hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});