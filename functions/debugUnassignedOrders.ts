import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const extractRegion = (address) => {
    const zipMatch = address.match(/\b(\d{5})\b/);
    const stateMatch = address.match(/\b(VA|MD|DC|WV)\b/);
    const cityMatch = address.match(/([A-Za-z\s]+),?\s+(VA|MD|DC|WV)/i);
    
    return {
        zip: zipMatch ? zipMatch[1] : null,
        state: stateMatch ? stateMatch[1] : null,
        city: cityMatch ? cityMatch[1].trim() : null
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

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        console.log(`\n🔍 ${targetDate} - DETAYLI DEBUG (ATANAMAYAN SİPARİŞLER)\n`);
        
        // 🆕 DATABASE'DEN GERÇEK SAYILARI AL
        const allOrders = await base44.entities.DailyOrder.filter({ 
            order_date: targetDate 
        }, 'pickup_time', 500);
        
        const unassignedOrders = allOrders.filter(o => o.status === 'Çekildi');
        const assignedOrders = allOrders.filter(o => o.status === 'Atandı');
        
        console.log(`📦 TOPLAM: ${allOrders.length}`);
        console.log(`✅ ATANAN: ${assignedOrders.length}`);
        console.log(`❌ ATANAMAYAN: ${unassignedOrders.length}\n`);
        
        if (unassignedOrders.length === 0) {
            return Response.json({
                success: true,
                message: 'Tüm siparişler atandı!',
                summary: {
                    totalOrders: allOrders.length,
                    assignedOrders: assignedOrders.length,
                    unassignedOrders: 0,
                    workingDrivers: 0,
                    driversAtMax: 0
                },
                unassignedDetails: []
            });
        }
        
        const allDrivers = await base44.entities.Driver.list();
        
        const activeTopDashers = allDrivers.filter(d => 
            d.status === 'Aktif' && d.is_top_dasher === true
        );
        
        console.log(`⭐ ${activeTopDashers.length} Top Dasher aktif`);
        
        const dayOfWeek = new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
        
        const workingDrivers = activeTopDashers.filter(d => {
            const workingDays = d.assignment_preferences?.working_days || [];
            return workingDays.length === 0 || workingDays.includes(dayOfWeek);
        });
        
        console.log(`👥 ${workingDrivers.length} Top Dasher çalışıyor (${dayOfWeek})`);
        
        const driverOrderCounts = {};
        assignedOrders.forEach(o => {
            if (o.driver_id) {
                driverOrderCounts[o.driver_id] = (driverOrderCounts[o.driver_id] || 0) + 1;
            }
        });
        
        const driversAtMax = workingDrivers.filter(d => {
            const maxOrders = d.assignment_preferences?.max_orders_per_day || 5;
            const currentCount = driverOrderCounts[d.id] || 0;
            return currentCount >= maxOrders;
        }).length;
        
        console.log(`🔴 ${driversAtMax} Top Dasher max order'da\n`);
        
        const detailedUnassigned = [];
        
        for (const order of unassignedOrders) {
            console.log(`\n❌ ANALİZ: ${order.ezcater_order_id} (${order.pickup_time})`);
            console.log(`   Pickup: ${order.pickup_address}`);
            console.log(`   Dropoff: ${order.dropoff_address}`);
            
            const analysis = {
                order_id: order.ezcater_order_id,
                pickup_time: order.pickup_time,
                pickup_address: order.pickup_address,
                dropoff_address: order.dropoff_address,
                pickup_coords: order.pickup_coords,
                dropoff_coords: order.dropoff_coords,
                evaluated_drivers: 0,
                rejected_count: 0,
                suitable_count: 0,
                main_reason: 'Bilinmiyor',
                rejection_reasons: {},
                top_3_candidates: [],
                all_rejections: []
            };
            
            const pickupTime = parseTime(order.pickup_time);
            const isEarlyMorning = pickupTime && pickupTime < 540;
            const orderRegion = extractRegion(order.dropoff_address);
            const orderPickupRegion = extractRegion(order.pickup_address);
            
            console.log(`   Bölge: ${orderPickupRegion.city || '?'}, ${orderPickupRegion.state || '?'} → ${orderRegion.city || '?'}, ${orderRegion.state || '?'}`);
            console.log(`   Erken Sabah: ${isEarlyMorning ? 'EVET' : 'Hayır'}`);
            
            let noHomeCoords = 0;
            let maxOrderReached = 0;
            let avoidDC = 0;
            let noEarlyMorning = 0;
            let tooFarFromHome = 0;
            let stateChange = 0;
            let noPickupCoords = 0;
            let tooFarChain = 0;
            let noTimeGap = 0;
            let predictionTooLong = 0;
            
            if (!order.pickup_coords || !order.dropoff_coords) {
                console.log(`   ⚠️ Koordinat eksik!`);
                if (!order.pickup_coords) noPickupCoords++;
            }
            
            const suitableCandidates = [];
            
            for (const driver of workingDrivers) {
                analysis.evaluated_drivers++;
                
                const maxOrders = driver.assignment_preferences?.max_orders_per_day || 5;
                const currentCount = driverOrderCounts[driver.id] || 0;
                const isJoker = driver.is_joker_driver === true;
                
                const driverAnalysis = {
                    driverName: driver.name,
                    driverHome: driver.address,
                    currentOrders: `${currentCount}/${maxOrders}`,
                    isJoker: isJoker,
                    rejected: false,
                    rejectionReason: null,
                    distance: null,
                    predictedTime: null,
                    estimatedScore: null
                };
                
                // CHECK 1: Max Order
                if (currentCount >= maxOrders) {
                    maxOrderReached++;
                    driverAnalysis.rejected = true;
                    driverAnalysis.rejectionReason = `Max order doldu: ${currentCount}/${maxOrders}`;
                    analysis.all_rejections.push(driverAnalysis);
                    continue;
                }
                
                // CHECK 2: Home Coords
                if (!driver.home_coordinates || !driver.home_coordinates.lat) {
                    noHomeCoords++;
                    driverAnalysis.rejected = true;
                    driverAnalysis.rejectionReason = 'Ev koordinatı yok';
                    analysis.all_rejections.push(driverAnalysis);
                    continue;
                }
                
                // CHECK 3: Pickup Coords
                if (!order.pickup_coords) {
                    driverAnalysis.rejected = true;
                    driverAnalysis.rejectionReason = 'Sipariş pickup koordinatı yok';
                    analysis.all_rejections.push(driverAnalysis);
                    continue;
                }
                
                // CHECK 4: Distance (ilk sipariş veya zincir)
                let anchor = null;
                const driverLastOrder = assignedOrders
                    .filter(o => o.driver_id === driver.id)
                    .sort((a, b) => parseTime(b.dropoff_time) - parseTime(a.dropoff_time))[0];
                
                if (currentCount === 0) {
                    // İlk sipariş - evden
                    anchor = driver.home_coordinates;
                } else if (driverLastOrder && driverLastOrder.dropoff_coords) {
                    // Zincir - son dropoff'tan
                    const gap = pickupTime - parseTime(driverLastOrder.dropoff_time);
                    
                    if (gap > 120) {
                        // 2 saat+ → Eve dön
                        anchor = driver.home_coordinates;
                    } else {
                        anchor = driverLastOrder.dropoff_coords;
                    }
                } else {
                    anchor = driver.home_coordinates;
                }
                
                const homeDistance = calculateDistance(
                    anchor.lat,
                    anchor.lng,
                    order.pickup_coords.lat,
                    order.pickup_coords.lng
                );
                
                driverAnalysis.distance = homeDistance.toFixed(1) + ' mil';
                
                const maxHomeDistance = currentCount === 0 ? 20 : 25;
                
                if (homeDistance > maxHomeDistance) {
                    if (currentCount === 0) {
                        tooFarFromHome++;
                    } else {
                        tooFarChain++;
                    }
                    driverAnalysis.rejected = true;
                    driverAnalysis.rejectionReason = `Çok uzak: ${homeDistance.toFixed(1)} mil (max: ${maxHomeDistance})${currentCount > 0 ? ' [Zincir]' : ''}`;
                    analysis.all_rejections.push(driverAnalysis);
                    continue;
                }
                
                // CHECK 5: Time Gap (chain)
                if (driverLastOrder) {
                    const gap = pickupTime - parseTime(driverLastOrder.dropoff_time);
                    const predictedTime = Math.round(homeDistance * 2.5); // Basit hesaplama
                    const gapBuffer = 15;
                    const need = predictedTime + gapBuffer;
                    
                    driverAnalysis.predictedTime = predictedTime + ' dakika';
                    
                    if (gap < need) {
                        noTimeGap++;
                        driverAnalysis.rejected = true;
                        driverAnalysis.rejectionReason = `Yeterli zaman yok: ${gap} dk < ${need} dk`;
                        analysis.all_rejections.push(driverAnalysis);
                        continue;
                    }
                }
                
                // CHECK 6: Prediction Time
                const predictedTime = Math.round(homeDistance * 2.5);
                driverAnalysis.predictedTime = predictedTime + ' dakika';
                
                const maxPredTime = currentCount === 0 ? 35 : 40;
                
                if (predictedTime > maxPredTime) {
                    predictionTooLong++;
                    driverAnalysis.rejected = true;
                    driverAnalysis.rejectionReason = `Tahmin çok uzun: ${predictedTime} dk > ${maxPredTime} dk`;
                    analysis.all_rejections.push(driverAnalysis);
                    continue;
                }
                
                // CHECK 7: Early Morning
                if (isEarlyMorning && !driver.early_morning_eligible) {
                    noEarlyMorning++;
                    driverAnalysis.rejected = true;
                    driverAnalysis.rejectionReason = 'Erken sabah uygun değil';
                    analysis.all_rejections.push(driverAnalysis);
                    continue;
                }
                
                // CHECK 8: Avoid DC
                if (driver.special_notes?.avoid_dc && orderPickupRegion.state === 'DC') {
                    avoidDC++;
                    driverAnalysis.rejected = true;
                    driverAnalysis.rejectionReason = 'DC kısıtlaması (avoid_dc: true)';
                    analysis.all_rejections.push(driverAnalysis);
                    continue;
                }
                
                // CHECK 9: State Change (Round 1 only)
                if (currentCount === 0) {
                    const driverHomeRegion = extractRegion(driver.address);
                    
                    if (driverHomeRegion.state && orderPickupRegion.state && 
                        driverHomeRegion.state !== orderPickupRegion.state && !isJoker) {
                        stateChange++;
                        driverAnalysis.rejected = true;
                        driverAnalysis.rejectionReason = `Eyalet değişimi (Round 1): ${driverHomeRegion.state} → ${orderPickupRegion.state}`;
                        analysis.all_rejections.push(driverAnalysis);
                        continue;
                    }
                }
                
                // ✅ UYGUN SÜRÜCÜ!
                analysis.suitable_count++;
                
                // Basit skor tahmini
                const proximityScore = (maxHomeDistance - homeDistance) / maxHomeDistance;
                const fairnessScore = currentCount === 0 ? 1.0 : (currentCount === 1 ? 0.67 : 0.33);
                const estimatedScore = (proximityScore * 0.5) + (fairnessScore * 0.1);
                
                driverAnalysis.estimatedScore = estimatedScore.toFixed(3);
                
                suitableCandidates.push(driverAnalysis);
                
                analysis.rejected_count++;
            }
            
            // En iyi 3 adayı bul
            suitableCandidates.sort((a, b) => parseFloat(b.estimatedScore) - parseFloat(a.estimatedScore));
            analysis.top_3_candidates = suitableCandidates.slice(0, 3);
            
            analysis.rejection_reasons = {
                max_order_reached: maxOrderReached,
                no_home_coords: noHomeCoords,
                avoid_dc: avoidDC,
                no_early_morning: noEarlyMorning,
                too_far_from_home: tooFarFromHome,
                too_far_chain: tooFarChain,
                no_time_gap: noTimeGap,
                prediction_too_long: predictionTooLong,
                state_change_penalty: stateChange,
                no_pickup_coords: noPickupCoords
            };
            
            // Ana sebep belirle
            if (noPickupCoords > 0) {
                analysis.main_reason = '🔴 KRİTİK: Sipariş koordinatı eksik (geocoding hatası)';
            } else if (analysis.suitable_count > 0) {
                analysis.main_reason = `⚠️ ${analysis.suitable_count} uygun sürücü var ama min score altında (Round 1: 0.28, Round 2: 0.15)`;
            } else if (maxOrderReached >= workingDrivers.length * 0.7) {
                analysis.main_reason = '🔴 Çoğu sürücü max order\'da (%70+)';
            } else if (tooFarFromHome + tooFarChain > workingDrivers.length * 0.5) {
                analysis.main_reason = '🔴 Tüm sürücülar çok uzakta (>20-25 mil)';
            } else if (noTimeGap > workingDrivers.length * 0.5) {
                analysis.main_reason = '⏰ Zincir için yeterli zaman yok';
            } else if (predictionTooLong > workingDrivers.length * 0.5) {
                analysis.main_reason = '⏱️ Tahmin edilen süre çok uzun (>35-40 dk)';
            } else if (noEarlyMorning > 0 && isEarlyMorning) {
                analysis.main_reason = '🌅 Erken sabah - uygun sürücü yok';
            } else if (avoidDC > 0 && orderPickupRegion.state === 'DC') {
                analysis.main_reason = '🏛️ DC kısıtlaması - uygun sürücü yok';
            } else if (stateChange > 0) {
                analysis.main_reason = `🗺️ Eyalet değişimi cezası (${orderPickupRegion.state} siparişi)`;
            } else if (noHomeCoords > 0) {
                analysis.main_reason = '📍 Ev koordinatı eksik sürücüler var';
            } else {
                analysis.main_reason = '❓ Bilinmeyen sebep (muhtemelen score yetersiz)';
            }
            
            console.log(`   Ana Sebep: ${analysis.main_reason}`);
            console.log(`   Değerlendirilen: ${analysis.evaluated_drivers}`);
            console.log(`   Uygun: ${analysis.suitable_count}`);
            console.log(`   Reddedilen: ${analysis.rejected_count}`);
            console.log(`   Sebep Dağılımı:`, analysis.rejection_reasons);
            
            detailedUnassigned.push(analysis);
        }
        
        return Response.json({
            success: true,
            targetDate,
            dayOfWeek,
            summary: {
                totalOrders: allOrders.length,
                assignedOrders: assignedOrders.length,
                unassignedOrders: unassignedOrders.length,
                workingDrivers: workingDrivers.length,
                driversAtMax: driversAtMax
            },
            unassignedDetails: detailedUnassigned
        });

    } catch (error) {
        console.error("Debug hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});