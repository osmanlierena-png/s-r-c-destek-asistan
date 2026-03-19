import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        console.log(`\n🔧 ${targetDate} - EKSİK ADRESLERİ DÜZELT\n`);
        
        // Manuel düzeltmeler
        const manualFixes = {
            'RHV04A9F': {
                dropoff_address: '1201 Wilson Blvd, Arlington, VA 22209' // Wlison → Wilson
            },
            'EzRVAK61': {
                dropoff_address: '30 W Watkins Mill Rd, Gaithersburg, MD 20878' // Watkina → Watkins
            },
            'EzJY5WRH': {
                dropoff_address: '702 King Farm Blvd, Rockville, MD 20850' // suite kaldırıldı
            },
            'EzC8P747': {
                dropoff_address: '3700 Reservoir Rd NW, Washington, DC 20007' // St. Mary's kaldırıldı
            },
            'Ez5HVZCP': {
                dropoff_address: '181 Centreport Pkwy, Fredericksburg, VA 22406'
            },
            'EzGTUR7K': {
                dropoff_address: '44679 Endicott Dr, Ashburn, VA 20147' // suite kaldırıldı
            },
            'EzWJOM7H': {
                dropoff_address: '13800 Wall Rd, Herndon, VA 20171'
            },
            'Ez2U46WC': {
                pickup_address: '1210 18th St NW, Washington, DC 20036' // 20001 → 20036 (doğru zip)
            },
            'EzGXWT99': {
                pickup_address: '12120 Sunset Hills Rd, Reston, VA 20190'
            }
        };
        
        const allOrders = await base44.entities.DailyOrder.filter({ 
            order_date: targetDate 
        });
        
        let successCount = 0;
        let failCount = 0;
        
        for (const [orderId, fixes] of Object.entries(manualFixes)) {
            const order = allOrders.find(o => o.ezcater_order_id === orderId);
            
            if (!order) {
                console.log(`⚠️ ${orderId} bulunamadı, atlanıyor`);
                continue;
            }
            
            console.log(`\n🔧 ${orderId}:`);
            
            let pickupCoords = order.pickup_coords;
            let dropoffCoords = order.dropoff_coords;
            
            // PICKUP GEOCODING (eğer fix varsa)
            if (fixes.pickup_address && !pickupCoords) {
                console.log(`  📍 Pickup: ${fixes.pickup_address}`);
                
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fixes.pickup_address + ', USA')}&limit=1&countrycodes=us`,
                        { headers: { 'User-Agent': 'FixMissingAddresses/1.0' } }
                    );
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.length > 0) {
                            pickupCoords = {
                                lat: parseFloat(data[0].lat),
                                lng: parseFloat(data[0].lon)
                            };
                            console.log(`  ✅ Pickup: ${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}`);
                        } else {
                            console.log(`  ❌ Pickup bulunamadı`);
                        }
                    }
                    
                    await new Promise(r => setTimeout(r, 1100));
                } catch (error) {
                    console.error(`  ❌ Pickup error: ${error.message}`);
                }
            }
            
            // DROPOFF GEOCODING (eğer fix varsa)
            if (fixes.dropoff_address && !dropoffCoords) {
                console.log(`  📍 Dropoff: ${fixes.dropoff_address}`);
                
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fixes.dropoff_address + ', USA')}&limit=1&countrycodes=us`,
                        { headers: { 'User-Agent': 'FixMissingAddresses/1.0' } }
                    );
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.length > 0) {
                            dropoffCoords = {
                                lat: parseFloat(data[0].lat),
                                lng: parseFloat(data[0].lon)
                            };
                            console.log(`  ✅ Dropoff: ${dropoffCoords.lat.toFixed(4)}, ${dropoffCoords.lng.toFixed(4)}`);
                        } else {
                            console.log(`  ❌ Dropoff bulunamadı`);
                        }
                    }
                    
                    await new Promise(r => setTimeout(r, 1100));
                } catch (error) {
                    console.error(`  ❌ Dropoff error: ${error.message}`);
                }
            }
            
            // DATABASE UPDATE
            if (pickupCoords || dropoffCoords) {
                try {
                    const updateData = {};
                    if (pickupCoords) updateData.pickup_coords = pickupCoords;
                    if (dropoffCoords) updateData.dropoff_coords = dropoffCoords;
                    
                    await base44.entities.DailyOrder.update(order.id, updateData);
                    successCount++;
                    console.log(`  💾 Database güncellendi`);
                } catch (error) {
                    failCount++;
                    console.error(`  ⚠️ Database hatası: ${error.message}`);
                }
            }
        }
        
        console.log(`\n📊 SONUÇ:`);
        console.log(`  ✅ Başarılı: ${successCount}`);
        console.log(`  ❌ Başarısız: ${failCount}`);
        
        return Response.json({
            success: true,
            message: `${successCount} sipariş düzeltildi`,
            successful: successCount,
            failed: failCount
        });
        
    } catch (error) {
        console.error('Fix hatası:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});