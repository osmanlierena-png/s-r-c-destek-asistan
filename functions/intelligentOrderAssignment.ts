import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// ==================== CONFIG ====================
const CONFIG = {
  mode: "time_slot_chaining", // 🆕 Sabah/Akşam zincirleri
  policy: {
    first_order_anchor: "home_coords",
    next_orders_anchor: "last_dropoff_coords",
    long_gap_threshold: 120 // 2 saat+ → Eve dön
  },
  time_slots: {
    morning: { start: 420, end: 840 },  // 07:00-14:00
    evening: { start: 840, end: 1260 }  // 14:00-21:00
  },
  speed_factors: {
    base_min_per_mile: 2.5,
    by_state: { DC: 3.2, VA: 2.4, MD: 2.6 },
    by_city_overrides: {
      Washington: 3.2, Arlington: 2.6, Alexandria: 2.7,
      Reston: 2.8, Tysons: 3.0, Leesburg: 3.0,
      Frederick: 3.0, Waldorf: 3.1, Fredericksburg: 3.1
    },
    rush_hour: { 
      morning: { start: 420, end: 600 },
      evening: { start: 960, end: 1140 },
      multiplier: 1.15 
    },
    downtown_zip_penalty_min: 6,
    bridge_cross_penalty_min: 5
  },
  candidate_pruning: {
    first_max_miles: 10,  // İLK SİPARİŞ: 10 MIL
    chain_max_miles: 20   // ZİNCİR: 20 MIL
  },
  thresholds: {
    gap_buffer_min: 15,
    round1: {
      first_order: { min_final_score: 0.28, max_pred_min: 35 },
      chain_order: { min_final_score: 0.25, max_pred_min: 40 }
    },
    round2: {
      first_order: { min_final_score: 0.15, max_pred_min: 45 },
      chain_order: { min_final_score: 0.12, max_pred_min: 50 },
      max_distance: 20,  // ROUND 2: 20 MIL
      gap_buffer_min: 10
    }
  },
  weights: {
    time_chain: 0.30,              // ⬇️ Azaltıldı (0.35'ten)
    first_order_proximity: 0.12,   // ⬇️ Azaltıldı (0.15'ten)
    preferences: 0.08,
    performance: 0.05,
    fairness: 0.08,                // ⬇️ Azaltıldı (0.10'dan)
    time_slot_bonus: 0.20,         // ⬇️ Azaltıldı (0.27'den)
    shift_match_bonus: 0.08,       // 🆕 Vardiya eşleşme bonusu
    joker_bonus: 0.05,             // 🆕 Joker driver bonusu
    priority_bonus: 0.04           // 🆕 VIP sürücü bonusu
  },
  penalties: {
    state_change_soft: 0.02,
    dc_soft: 0.02
  },
  time_slot_chain_config: {
    morning_gap: { min: 15, max: 90, bonus: 0.25 },
    evening_gap: { min: 15, max: 90, bonus: 0.25 }
  },
  // 🆕 ZOR SİPARİŞ TANIMLARI
  difficult_order_thresholds: {
    long_distance: 15,      // 15+ mil = uzak
    late_evening: 1140,     // 19:00+ = geç akşam
    early_morning: 420,     // 07:00 öncesi = erken sabah
    dc_order: true          // DC = zor
  },
  random_jitter_range: 0.02
};

// ==================== HELPER FUNCTIONS ====================

const extractRegion = (address) => {
    const zipMatch = address.match(/\b(\d{5})\b/);
    const stateMatch = address.match(/\b(VA|MD|DC|WV)\b/);
    const cityMatch = address.match(/([A-Za-z\s]+),?\s+(VA|MD|DC|WV)/i);
    return { 
        zip: zipMatch?.[1], 
        state: stateMatch?.[1], 
        city: cityMatch?.[1]?.trim() 
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

const isDowntownZip = (zip) => {
    if (!zip) return false;
    const dc = ['20001', '20002', '20003', '20004', '20005', '20006', '20007', '20008', '20009', '20010'];
    return dc.includes(zip);
};

const isRushHour = (timeMin) => {
    const morning = CONFIG.speed_factors.rush_hour.morning;
    const evening = CONFIG.speed_factors.rush_hour.evening;
    return (timeMin >= morning.start && timeMin <= morning.end) || 
           (timeMin >= evening.start && timeMin <= evening.end);
};

const minutesPerMile = (city, state, timeMin) => {
    let k = CONFIG.speed_factors.base_min_per_mile;
    
    if (city && CONFIG.speed_factors.by_city_overrides[city]) {
        k = CONFIG.speed_factors.by_city_overrides[city];
    } else if (state && CONFIG.speed_factors.by_state[state]) {
        k = CONFIG.speed_factors.by_state[state];
    }
    
    if (isRushHour(timeMin)) {
        k *= CONFIG.speed_factors.rush_hour.multiplier;
    }
    
    return k;
};

const predictedMinutes = (miles, pickupRegion, pickupTime) => {
    const k = minutesPerMile(pickupRegion.city, pickupRegion.state, pickupTime);
    let mins = miles * k;
    
    if (isDowntownZip(pickupRegion.zip)) {
        mins += CONFIG.speed_factors.downtown_zip_penalty_min;
    }
    
    return Math.round(mins);
};

const getBucketScore = (pred, buckets) => {
    for (const b of buckets) {
        if (pred <= b) return 1.0 - (pred / b) * 0.5;
    }
    return 0.2;
};

const calcPrefScore = (driver, order) => {
    let score = 0;
    const region = extractRegion(order.dropoff_address);
    
    if (driver.preferred_areas && region.city) {
        const match = driver.preferred_areas.find(a => 
            a.toLowerCase().includes(region.city.toLowerCase())
        );
        if (match) score += 0.10;
    }
    
    if (driver.special_notes?.top_zip_codes?.includes(region.zip)) {
        score += 0.04;
    }
    
    if (driver.special_notes?.region_distribution?.[region.state] > 30) {
        score += 0.03;
    }
    
    return Math.min(score, 1.0);
};

// 🆕 ZİNCİR TİPİ BELİRLE
const getTimeSlot = (timeMin) => {
    if (timeMin >= CONFIG.time_slots.morning.start && timeMin < CONFIG.time_slots.morning.end) {
        return 'morning';
    } else if (timeMin >= CONFIG.time_slots.evening.start && timeMin < CONFIG.time_slots.evening.end) {
        return 'evening';
    }
    return null;
};

// 🆕 SÜRÜCÜNÜN ZİNCİR TİPİNİ BUL
const getDriverTimeSlot = (state) => {
    if (state.assignedOrders.length === 0) return null;
    
    const slots = state.assignedOrders.map(o => getTimeSlot(parseTime(o.pickup_time))).filter(Boolean);
    
    if (slots.length === 0) return null;
    
    const morningCount = slots.filter(s => s === 'morning').length;
    const eveningCount = slots.filter(s => s === 'evening').length;
    
    return eveningCount > morningCount ? 'evening' : 'morning';
};

// 🆕 ZOR SİPARİŞ Mİ?
const isDifficultOrder = (order, miles, pickupTime) => {
    const region = extractRegion(order.pickup_address);
    const thresholds = CONFIG.difficult_order_thresholds;
    
    let difficultyScore = 0;
    const reasons = [];
    
    if (miles > thresholds.long_distance) {
        difficultyScore += 0.4;
        reasons.push('uzak_mesafe');
    }
    
    if (region.state === 'DC') {
        difficultyScore += 0.3;
        reasons.push('dc_bolgesi');
    }
    
    if (pickupTime >= thresholds.late_evening) {
        difficultyScore += 0.2;
        reasons.push('gec_aksam');
    }
    
    if (pickupTime < thresholds.early_morning) {
        difficultyScore += 0.2;
        reasons.push('erken_sabah');
    }
    
    return {
        isDifficult: difficultyScore > 0.3,
        score: difficultyScore,
        reasons
    };
};

// 🆕 SÜRÜCÜ VARDİYA EŞLEŞMESİ
const checkShiftMatch = (driver, orderTimeSlot) => {
    if (!driver.preferred_shift || driver.preferred_shift === 'all_day') {
        return { match: true, bonus: 0.5 }; // Tüm gün = her zaman uygun
    }
    
    if (driver.preferred_shift === 'morning' && orderTimeSlot === 'morning') {
        return { match: true, bonus: 1.0 }; // Mükemmel eşleşme
    }
    
    if (driver.preferred_shift === 'evening' && orderTimeSlot === 'evening') {
        return { match: true, bonus: 1.0 }; // Mükemmel eşleşme
    }
    
    // Vardiya uyumsuzluğu - ceza değil, sadece bonus yok
    return { match: false, bonus: 0.0 };
};

// 🆕 BÖLGE KARA LİSTESİ KONTROLÜ
const checkRegionBlacklist = (driver, order) => {
    if (!driver.special_notes?.region_blacklist || driver.special_notes.region_blacklist.length === 0) {
        return { blocked: false };
    }
    
    const pickupRegion = extractRegion(order.pickup_address);
    const dropoffRegion = extractRegion(order.dropoff_address);
    
    for (const blacklisted of driver.special_notes.region_blacklist) {
        const bl = blacklisted.toLowerCase();
        
        // State check
        if (pickupRegion.state && bl.includes(pickupRegion.state.toLowerCase())) {
            return { blocked: true, reason: `Pickup: ${pickupRegion.state} yasak` };
        }
        if (dropoffRegion.state && bl.includes(dropoffRegion.state.toLowerCase())) {
            return { blocked: true, reason: `Dropoff: ${dropoffRegion.state} yasak` };
        }
        
        // City check
        if (pickupRegion.city && pickupRegion.city.toLowerCase().includes(bl)) {
            return { blocked: true, reason: `Pickup: ${pickupRegion.city} yasak` };
        }
        if (dropoffRegion.city && dropoffRegion.city.toLowerCase().includes(bl)) {
            return { blocked: true, reason: `Dropoff: ${dropoffRegion.city} yasak` };
        }
    }
    
    return { blocked: false };
};

// ==================== MAIN ASSIGNMENT FUNCTION ====================

const assignOrdersRound = async (base44, orders, drivers, driverStates, roundConfig, roundName) => {
    console.log(`\n🎯 ${roundName} BAŞLIYOR...`);
    console.log(`📦 ${orders.length} sipariş işlenecek`);
    
    const results = [];
    const detailedLogs = [];
    const updatesToMake = [];
    
    for (const order of orders) {
        const pickupTime = parseTime(order.pickup_time);
        const dropoffTime = parseTime(order.dropoff_time);
        
        if (!pickupTime || !dropoffTime) {
            detailedLogs.push({
                order: order.ezcater_order_id,
                selectedDriver: null,
                reason: 'Geçersiz pickup_time veya dropoff_time',
                allCandidates: []
            });
            continue;
        }
        
        const pickupRegion = extractRegion(order.pickup_address);
        const orderTimeSlot = getTimeSlot(pickupTime);
        
        const candidates = [];
        const allCandidates = [];
        
        for (const [driverId, state] of driverStates.entries()) {
            const driver = state.driver;
            
            // 🆕 KURAL 1: Max Order Limit
            if (state.assignedCount >= state.maxOrders) {
                allCandidates.push({
                    driverName: driver.name,
                    rejected: true,
                    rejectionReason: `Max sipariş limitine ulaşıldı (${state.maxOrders})`
                });
                continue;
            }
            
            // 🆕 KURAL 2: Avoid DC (Hard Reject)
            if (driver.special_notes?.avoid_dc && pickupRegion.state === 'DC') {
                allCandidates.push({
                    driverName: driver.name,
                    rejected: true,
                    rejectionReason: 'DC\'den kaçınıyor (avoid_dc flag)'
                });
                continue;
            }
            
            // 🆕 KURAL 3: Region Blacklist (Hard Reject)
            const blacklistCheck = checkRegionBlacklist(driver, order);
            if (blacklistCheck.blocked) {
                allCandidates.push({
                    driverName: driver.name,
                    rejected: true,
                    rejectionReason: `Bölge yasak: ${blacklistCheck.reason}`
                });
                continue;
            }
            
            // Anchor belirleme (Gap-based)
            let anchor = null;
            if (!state.hasFirstOrder) { 
                anchor = state.startLocation;
            } else {
                const gap = pickupTime - state.lastDropoffTime;
                
                if (gap > CONFIG.policy.long_gap_threshold) {
                    anchor = state.startLocation;
                } else {
                    anchor = state.lastDropoffCoords;
                }
            }
            
            if (!anchor) {
                allCandidates.push({
                    driverName: driver.name,
                    rejected: true,
                    rejectionReason: 'Geçerli bir başlangıç koordinatı yok'
                });
                continue;
            }
            
            const miles = calculateDistance(
                anchor.lat, anchor.lng,
                order.pickup_coords.lat, order.pickup_coords.lng
            );
            
            const maxMiles = !state.hasFirstOrder ? 
                CONFIG.candidate_pruning.first_max_miles : 
                (roundConfig.max_distance || CONFIG.candidate_pruning.chain_max_miles);
            
            if (miles > maxMiles) {
                allCandidates.push({
                    driverName: driver.name,
                    rejected: true,
                    rejectionReason: `Çok uzak (${miles.toFixed(1)} > ${maxMiles} mil)`
                });
                continue;
            }
            
            const predicted = predictedMinutes(miles, pickupRegion, pickupTime);
            const gapBuffer = roundConfig.gap_buffer_min || CONFIG.thresholds.gap_buffer_min;
            const need = predicted + gapBuffer;
            
            if (state.lastDropoffTime !== null) {
                const gap = pickupTime - state.lastDropoffTime;
                if (gap < need) {
                    allCandidates.push({
                        driverName: driver.name,
                        rejected: true,
                        rejectionReason: `Yeterli zaman yok (${gap} < ${need} dk)`
                    });
                    continue;
                }
            }
            
            const thresholds = !state.hasFirstOrder ? roundConfig.first_order : roundConfig.chain_order;
            
            if (predicted > thresholds.max_pred_min) {
                allCandidates.push({
                    driverName: driver.name,
                    rejected: true,
                    rejectionReason: `Tahmin çok uzun (${predicted} > ${thresholds.max_pred_min} dk)`
                });
                continue;
            }
            
            // ==================== SCORING ====================
            let score = 0;
            const scoreDetails = {};
            
            // TIME CHAIN
            const buckets = !state.hasFirstOrder ? [7, 12, 16] : [8, 12, 20];
            const f_time = getBucketScore(predicted, buckets);
            scoreDetails.time_chain = CONFIG.weights.time_chain * f_time;
            
            // FIRST ORDER PROXIMITY
            const f_first = !state.hasFirstOrder ? f_time : 0;
            scoreDetails.first_order_proximity = CONFIG.weights.first_order_proximity * f_first;
            
            // PREFERENCES
            const f_pref = calcPrefScore(driver, order);
            scoreDetails.preferences = CONFIG.weights.preferences * f_pref;
            
            // PERFORMANCE
            const f_perf = Math.min((driver.assignment_score || 0) / 1000, 1.0);
            scoreDetails.performance = CONFIG.weights.performance * f_perf;
            
            // FAIRNESS
            let f_fair = 0;
            if (state.assignedCount === 0) {
                f_fair = 1.0;
            } else if (state.assignedCount === 1) {
                f_fair = 0.67;
            } else if (state.assignedCount === 2) {
                f_fair = 0.33;
            } else {
                f_fair = 0.10;
            }
            scoreDetails.fairness = CONFIG.weights.fairness * f_fair;
            
            // TIME SLOT CHAIN BONUS (Sabah/Akşam)
            let timeSlotBonus = 0;
            if (orderTimeSlot && state.hasFirstOrder) {
                const driverTimeSlot = getDriverTimeSlot(state);
                
                if (driverTimeSlot === orderTimeSlot) {
                    const lastSlotOrder = state.assignedOrders
                        .filter(o => getTimeSlot(parseTime(o.pickup_time)) === orderTimeSlot)
                        .sort((a, b) => parseTime(b.dropoff_time) - parseTime(a.dropoff_time))[0];
                    
                    if (lastSlotOrder) {
                        const gapFromLastSlot = pickupTime - parseTime(lastSlotOrder.dropoff_time);
                        const slotConfig = orderTimeSlot === 'morning' ? 
                            CONFIG.time_slot_chain_config.morning_gap : 
                            CONFIG.time_slot_chain_config.evening_gap;
                        
                        if (gapFromLastSlot >= slotConfig.min && gapFromLastSlot <= slotConfig.max) {
                            timeSlotBonus = CONFIG.weights.time_slot_bonus * slotConfig.bonus;
                            scoreDetails.time_slot_chain = timeSlotBonus;
                        }
                    }
                }
            }
            
            // 🆕 SHIFT MATCH BONUS
            if (orderTimeSlot) {
                const shiftMatch = checkShiftMatch(driver, orderTimeSlot);
                if (shiftMatch.match) {
                    const shiftBonus = CONFIG.weights.shift_match_bonus * shiftMatch.bonus;
                    scoreDetails.shift_match_bonus = shiftBonus;
                }
            }
            
            // 🆕 JOKER DRIVER BONUS (Zor Siparişler)
            if (driver.is_joker_driver) {
                const difficulty = isDifficultOrder(order, miles, pickupTime);
                if (difficulty.isDifficult) {
                    const jokerBonus = CONFIG.weights.joker_bonus * difficulty.score;
                    scoreDetails.joker_bonus = jokerBonus;
                    scoreDetails.joker_reasons = difficulty.reasons;
                }
            }
            
            // 🆕 PRIORITY BONUS (VIP Sürücüler)
            if (driver.special_notes?.priority_level > 0) {
                const priorityBonus = CONFIG.weights.priority_bonus * (driver.special_notes.priority_level / 10);
                scoreDetails.priority_bonus = priorityBonus;
            }
            
            score = Object.values(scoreDetails).reduce((sum, val) => sum + val, 0);
            
            // STATE CHANGE PENALTY
            if (state.hasFirstOrder && state.lastDropoffCoords) {
                const lastRegion = extractRegion(driver.address); 
                if (lastRegion.state && pickupRegion.state && 
                    lastRegion.state !== pickupRegion.state && roundName === 'ROUND 1') {
                    score -= CONFIG.penalties.state_change_soft;
                    scoreDetails.state_change_penalty = -CONFIG.penalties.state_change_soft;
                }
            }
            
            // DC PENALTY
            if (pickupRegion.state === 'DC' && roundName === 'ROUND 1') {
                score -= CONFIG.penalties.dc_soft;
                scoreDetails.dc_penalty = -CONFIG.penalties.dc_soft;
            }
            
            // RANDOM JITTER
            const jitter = (Math.random() - 0.5) * CONFIG.random_jitter_range;
            score += jitter;
            scoreDetails.random_jitter = jitter;
            
            allCandidates.push({
                driverName: driver.name,
                rejected: false,
                totalScore: Math.round(score * 1000) / 1000,
                distance: miles.toFixed(1),
                predictedMin: predicted,
                scoreDetails
            });
            
            candidates.push({
                driver,
                state,
                score,
                miles,
                predicted,
                scoreDetails
            });
        }
        
        if (candidates.length === 0) {
            detailedLogs.push({
                order: order.ezcater_order_id,
                selectedDriver: null,
                reason: 'Tüm sürücüler reddedildi',
                allCandidates
            });
            continue;
        }
        
        candidates.sort((a, b) => b.score - a.score);
        const winner = candidates[0];
        
        const thresholds = !winner.state.hasFirstOrder ? roundConfig.first_order : roundConfig.chain_order;
        
        if (winner.score < thresholds.min_final_score) {
             detailedLogs.push({
                 order: order.ezcater_order_id,
                 selectedDriver: null,
                 reason: `En yüksek skor (${winner.score.toFixed(3)}) min değerin (${thresholds.min_final_score.toFixed(2)}) altında`,
                 allCandidates
             });
             continue;
        }

        updatesToMake.push({
            orderId: order.id,
            driverId: winner.driver.id,
            driverName: winner.driver.name
        });
        
        const winningDriverState = driverStates.get(winner.driver.id);
        if (winningDriverState) {
            winningDriverState.assignedCount++;
            winningDriverState.hasFirstOrder = true;
            winningDriverState.lastDropoffTime = dropoffTime;
            winningDriverState.lastDropoffCoords = order.dropoff_coords;
            winningDriverState.assignedOrders.push(order);
        }
        
        results.push({
            orderDetails: `${order.ezcater_order_id} (${order.pickup_time})`,
            driverName: winner.driver.name,
            score: Math.round(winner.score * 1000) / 1000,
            distanceKm: winner.miles.toFixed(1),
            pickupTime: order.pickup_time,
            dropoffTime: order.dropoff_time,
            pickupAddress: order.pickup_address,
            dropoffAddress: order.dropoff_address,
            scoreBreakdown: winner.scoreDetails,
            timeSlot: orderTimeSlot
        });
        
        detailedLogs.push({
            order: order.ezcater_order_id,
            selectedDriver: winner.driver.name,
            reason: null,
            allCandidates
        });
    }
    
    // DATABASE UPDATE
    if (updatesToMake.length > 0) {
        console.log(`💾 ${updatesToMake.length} sipariş güncelleniyor...`);
        
        for (const update of updatesToMake) {
            try {
                await base44.entities.DailyOrder.update(update.orderId, {
                    driver_id: update.driverId,
                    driver_name: update.driverName,
                    status: 'Atandı'
                });
            } catch (error) {
                console.error(`❌ Update error: ${error.message}`);
            }
        }
    }
    
    console.log(`✅ ${roundName}: ${updatesToMake.length} sipariş atandı`);
    
    return { results, detailedLogs, updatedCount: updatesToMake.length };
};

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        console.log(`🎯 Rule-Based Assignment v5.0 - ${targetDate}`);
        
        const allDailyOrders = await base44.entities.DailyOrder.filter({ 
            order_date: targetDate 
        }, 'pickup_time', 200);
        
        const unassignedOrders = allDailyOrders.filter(o => o.status === 'Çekildi');
        
        if (unassignedOrders.length === 0) {
            return Response.json({ 
                success: false, 
                error: 'Atanmamış sipariş yok' 
            });
        }
        
        const validUnassignedOrders = unassignedOrders.filter(o => o.pickup_coords && o.dropoff_coords);
        
        if (validUnassignedOrders.length === 0) {
            return Response.json({ success: false, error: 'Koordinat bilgisi olmayan atanmamış siparişler var!' });
        }
        
        console.log(`📦 ${validUnassignedOrders.length} sipariş işlenecek`);
        
        const allActiveDrivers = await base44.entities.Driver.filter({ status: 'Aktif' });
        const dayOfWeek = new Date(targetDate + 'T12:00:00')
            .toLocaleDateString('en-US', { weekday: 'long' });
        
        // 🆕 KURAL BAZLI SÜRÜCÜ FİLTRELEME
        const eligibleDrivers = allActiveDrivers.filter(driver => {
            // Working days check
            const workingDays = driver.assignment_preferences?.working_days || [];
            const isWorkingToday = workingDays.length === 0 || workingDays.includes(dayOfWeek);
            
            if (!isWorkingToday) {
                console.log(`⏭️ ${driver.name}: Bugün çalışmıyor (${dayOfWeek})`);
                return false;
            }
            
            // Home coordinates check
            if (!driver.home_coordinates?.lat || !driver.home_coordinates?.lng) {
                console.log(`⚠️ ${driver.name}: Home coordinates yok`);
                return false;
            }
            
            return true;
        });
        
        console.log(`👥 ${eligibleDrivers.length}/${allActiveDrivers.length} sürücü uygun (working days + coordinates)`);
        
        const scoredDrivers = eligibleDrivers.map(driver => {
            let score = 0;
            
            if (driver.is_top_dasher) score += 100;
            score += (driver.assignment_score || 0) / 10;
            if (driver.early_morning_specialist) score += 50;
            if (driver.is_joker_driver) score += 30;
            
            if (driver.assignment_priority === 'High') score += 20;
            else if (driver.assignment_priority === 'Medium') score += 10;
            
            // 🆕 Priority level bonusu
            if (driver.special_notes?.priority_level > 0) {
                score += driver.special_notes.priority_level * 5;
            }
            
            return { ...driver, selection_score: score };
        });
        
        scoredDrivers.sort((a, b) => b.selection_score - a.selection_score);
        
        const targetDriverCount = Math.min(
            Math.max(20, Math.ceil(validUnassignedOrders.length / 2)), 
            25 
        );
        
        const selectedDrivers = scoredDrivers.slice(0, targetDriverCount);

        if (selectedDrivers.length === 0) {
            return Response.json({ 
                success: false, 
                error: `Siparişleri atayacak uygun sürücü bulunamadı` 
            });
        }
        
        console.log(`👥 ${selectedDrivers.length} sürücü seçildi (top ${targetDriverCount})`);

        const assignedOrders = allDailyOrders.filter(o => o.status === 'Atandı');
        const driverStates = new Map();
        
        for (const driver of selectedDrivers) {
            const maxOrders = driver.assignment_preferences?.max_orders_per_day || 7;
            const alreadyAssigned = assignedOrders.filter(o => o.driver_id === driver.id);
            
            const driverState = {
                driver,
                assignedCount: alreadyAssigned.length,
                maxOrders,
                lastDropoffTime: null,
                lastDropoffCoords: null,
                startLocation: driver.home_coordinates,
                hasFirstOrder: alreadyAssigned.length > 0,
                assignedOrders: [...alreadyAssigned]
            };
            
            for (const order of alreadyAssigned) {
                const dropTime = parseTime(order.dropoff_time);
                if (dropTime && (!driverState.lastDropoffTime || dropTime > driverState.lastDropoffTime)) {
                    driverState.lastDropoffTime = dropTime;
                    if (order.dropoff_coords) {
                        driverState.lastDropoffCoords = order.dropoff_coords;
                    }
                }
            }
            driverStates.set(driver.id, driverState);
        }
        
        const sortedOrders = validUnassignedOrders.sort((a, b) => 
            (parseTime(a.pickup_time) || 0) - (parseTime(b.pickup_time) || 0)
        );
        
        // ROUND 1: SIKICI ATAMA
        const round1Result = await assignOrdersRound(
            base44, 
            sortedOrders, 
            selectedDrivers, 
            driverStates, 
            CONFIG.thresholds.round1,
            'ROUND 1'
        );
        
        // ROUND 2: ESNEK ATAMA
        const unassignedAfterR1 = sortedOrders.filter(o => 
            !round1Result.results.find(r => r.orderDetails.includes(o.ezcater_order_id))
        );
        
        let round2Result = { results: [], detailedLogs: [], updatedCount: 0 };
        
        if (unassignedAfterR1.length > 0) {
            console.log(`\n⚠️ ${unassignedAfterR1.length} sipariş Round 1'de atanamadı`);
            
            round2Result = await assignOrdersRound(
                base44,
                unassignedAfterR1,
                selectedDrivers,
                driverStates,
                CONFIG.thresholds.round2,
                'ROUND 2'
            );
        }
        
        const totalAssigned = round1Result.updatedCount + round2Result.updatedCount;
        const allResults = [...round1Result.results, ...round2Result.results];
        const allLogs = [...round1Result.detailedLogs, ...round2Result.detailedLogs];
        
        console.log(`\n🎉 TOPLAM: ${totalAssigned}/${validUnassignedOrders.length} sipariş atandı`);
        console.log(`   Round 1: ${round1Result.updatedCount}`);
        console.log(`   Round 2: ${round2Result.updatedCount}`);
        
        return Response.json({
            success: true,
            message: `${totalAssigned} sipariş atandı (v5.0 - Rule-Based + Time Slot Chaining)`,
            assignedCount: totalAssigned,
            round1Count: round1Result.updatedCount,
            round2Count: round2Result.updatedCount,
            totalOrders: validUnassignedOrders.length,
            available_drivers: selectedDrivers.length,
            assignments: allResults,
            detailedLogs: allLogs
        });
        
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});