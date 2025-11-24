
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Saat grupları
const getTimeGroup = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const totalMinutes = hours * 60 + minutes;
    
    // 05:00 - 08:59 (300-539)
    if (totalMinutes >= 300 && totalMinutes < 540) return 'early_morning';
    // 09:00 - 11:59 (540-719)
    if (totalMinutes >= 540 && totalMinutes < 720) return 'morning';
    // 12:00 - 14:59 (720-899)
    if (totalMinutes >= 720 && totalMinutes < 900) return 'afternoon';
    // 15:00 - 20:59 (900-1259)
    if (totalMinutes >= 900 && totalMinutes < 1260) return 'evening';
    
    return null;
};

// Yeni: Zaman stringini dakika olarak ayrıştırma (zincir analizi için)
const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    return hours * 60 + minutes;
};

// Agresif bölge çıkarma
const extractRegion = (address) => {
    if (!address) return { city: null, state: null, zip: null };
    
    address = address.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    const zipMatch = address.match(/\b(\d{5})\b/);
    const zip = zipMatch ? zipMatch[1] : null;
    
    const stateMatch = address.match(/\b(VA|MD|DC|WV)\b/);
    const state = stateMatch ? stateMatch[1] : null;
    
    let city = null;
    
    const pattern1 = address.match(/,\s*([A-Za-z\s]+),\s*(VA|MD|DC|WV)/i);
    if (pattern1) {
        city = pattern1[1].trim();
    }
    
    if (!city) {
        const pattern2 = address.match(/\.\s*([A-Za-z\s]+),\s*(VA|MD|DC|WV)/i);
        if (pattern2) {
            city = pattern2[1].trim();
        }
    }
    
    if (!city && state) {
        const pattern3 = address.match(/\s+([A-Za-z\s]+)\s+(VA|MD|DC|WV)\s+\d{5}/i);
        if (pattern3) {
            city = pattern3[1].trim();
        }
    }
    
    if (!city && state) {
        const parts = address.split(',').map(p => p.trim());
        for (let i = parts.length - 1; i >= 0; i--) {
            if (parts[i].includes(state)) {
                if (i > 0) {
                    let candidate = parts[i - 1];
                    candidate = candidate.replace(/\b\d{5}\b/, '').replace(/\d+/g, '').trim();
                    if (candidate.match(/^[A-Za-z\s]+$/)) {
                        city = candidate;
                        break;
                    }
                }
            }
        }
    }
    
    if (!city) {
        const knownCities = [
            'Washington', 'Alexandria', 'Arlington', 'Fairfax', 'Reston', 
            'Herndon', 'Chantilly', 'Manassas', 'Fredericksburg', 'Leesburg',
            'Sterling', 'Ashburn', 'Centreville', 'Annandale', 'Springfield',
            'Rockville', 'Gaithersburg', 'Bethesda', 'Silver Spring', 'College Park',
            'Laurel', 'Oxon Hill'
        ];
        
        for (const knownCity of knownCities) {
            if (address.toLowerCase().includes(knownCity.toLowerCase())) {
                city = knownCity;
                break;
            }
        }
    }
    
    if (city) {
        city = city.replace(/\b(St|Rd|Ave|Blvd|Dr|Ct|Ln|Way|Pkwy|Hwy)\b\.?/gi, '').trim();
        city = city.replace(/\s+/g, ' ').trim();
        if (!city.match(/^[A-Za-z\s]+$/)) {
            city = null;
        }
    }
    
    return { zip, state, city };
};

// GEOCODING FONKSİYONU
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
            {
                headers: { 'User-Agent': 'LearnFromRealAssignments/1.0' }
            }
        );
        
        if (!response.ok) return null;
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
        const { assignments } = await req.json();
        
        console.log(`\n🧠 GÜÇLÜ ÖĞRENME BAŞLIYOR...`);
        console.log(`   ${assignments.length} atama analiz edilecek\n`);
        
        const drivers = await base44.entities.Driver.list();
        const driverMap = {};
        drivers.forEach(d => {
            driverMap[d.name] = d;
        });
        
        console.log(`👥 ${drivers.length} sürücü yüklendi\n`);
        
        const driverData = {};
        
        for (const assignment of assignments) {
            const driverName = assignment.driver_name;
            if (!driverName) continue;
            
            if (!driverData[driverName]) {
                driverData[driverName] = {
                    orders: [],
                    working_hours: new Set(),
                    states: {},
                    cities: {},
                    zip_codes: {},
                    chains: [],
                    first_pickup: null // 🔥 YENİ: İlk sipariş noktası
                };
            }
            
            driverData[driverName].orders.push(assignment);
            
            const timeGroup = getTimeGroup(assignment.pickup_time);
            if (timeGroup) {
                driverData[driverName].working_hours.add(timeGroup);
            }
            
            const pickupRegion = extractRegion(assignment.pickup_address);
            const dropoffRegion = extractRegion(assignment.dropoff_address);
            
            if (pickupRegion.state) {
                driverData[driverName].states[pickupRegion.state] = (driverData[driverName].states[pickupRegion.state] || 0) + 1;
            }
            if (dropoffRegion.state) {
                driverData[driverName].states[dropoffRegion.state] = (driverData[driverName].states[dropoffRegion.state] || 0) + 1;
            }
            
            if (pickupRegion.city) {
                const cityKey = pickupRegion.city.toLowerCase();
                driverData[driverName].cities[cityKey] = (driverData[driverName].cities[cityKey] || 0) + 1;
            }
            if (dropoffRegion.city) {
                const cityKey = dropoffRegion.city.toLowerCase();
                driverData[driverName].cities[cityKey] = (driverData[driverName].cities[cityKey] || 0) + 1;
            }
            
            if (pickupRegion.zip) {
                driverData[driverName].zip_codes[pickupRegion.zip] = (driverData[driverName].zip_codes[pickupRegion.zip] || 0) + 1;
            }
            if (dropoffRegion.zip) {
                driverData[driverName].zip_codes[dropoffRegion.zip] = (driverData[driverName].zip_codes[dropoffRegion.zip] || 0) + 1;
            }
        }
        
        // 🔥 YENİ: Her sürücü için siparişleri zamana göre sırala ve ilk pickup'ı bul
        // Ve zincir analizi yap
        console.log(`\n⏳ Sürücü siparişleri sıralanıyor ve zincirler aranıyor...`);
        for (const driverName in driverData) {
            const data = driverData[driverName];
            
            // Siparişleri pickup_time'a göre sırala (datetime yerine sadece time kullanacağız)
            data.orders.sort((a, b) => {
                const timeA = parseTime(a.pickup_time) || 0;
                const timeB = parseTime(b.pickup_time) || 0;
                return timeA - timeB;
            });
            
            // İlk siparişin pickup adresini kaydet
            if (data.orders.length > 0) {
                const firstOrder = data.orders[0];
                data.first_pickup = {
                    address: firstOrder.pickup_address,
                    time: firstOrder.pickup_time
                };
                
                console.log(`\n🏁 ${driverName} - İlk Sipariş:`);
                console.log(`   ${firstOrder.pickup_time} - ${firstOrder.pickup_address}`);
            }
            
            // Zincir analizi
            let currentChain = [];
            let lastDropoffTime = null;
            
            for (let i = 0; i < data.orders.length; i++) {
                const order = data.orders[i];
                const pickupTime = parseTime(order.pickup_time);
                const dropoffTime = parseTime(order.dropoff_time);

                // Eğer son bırakış zamanı varsa ve yeni alım bu zamanın çok ötesinde değilse (örneğin 3 saat içinde)
                // ya da bu ilk siparişse zincire ekle
                if (lastDropoffTime === null || (pickupTime !== null && lastDropoffTime !== null && (pickupTime - lastDropoffTime) <= 180)) {
                    currentChain.push(order);
                } else {
                    // Yeni zincir başlat
                    if (currentChain.length >= 2) {
                        data.chains.push({
                            stops: currentChain.length,
                            orders: currentChain.map(o => o.order_id),
                            timeRange: `${currentChain[0].pickup_time || ''} - ${currentChain[currentChain.length - 1].dropoff_time || ''}`
                        });
                    }
                    currentChain = [order];
                }
                
                lastDropoffTime = dropoffTime;
            }
            
            // Son zinciri ekle
            if (currentChain.length >= 2) {
                data.chains.push({
                    stops: currentChain.length,
                    orders: currentChain.map(o => o.order_id),
                    timeRange: `${currentChain[0].pickup_time || ''} - ${currentChain[currentChain.length - 1].dropoff_time || ''}`
                });
            }
        }
        
        console.log(`\n📊 ${Object.keys(driverData).length} sürücü analiz edildi`);
        console.log(`\n💾 Sürücü profillerini güncelliyorum...\n`);
        
        let updatedCount = 0;
        const learningInsights = [];
        
        for (const driverName in driverData) {
            const data = driverData[driverName];
            const driver = driverMap[driverName];
            
            if (!driver) {
                console.log(`⚠️ ${driverName} sistemde bulunamadı`);
                continue;
            }
            
            const topCities = Object.entries(data.cities)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([city]) => city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
            
            const topZips = Object.entries(data.zip_codes)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([zip]) => zip);
            
            const totalStateOrders = Object.values(data.states).reduce((sum, count) => sum + count, 0);
            const regionDist = {};
            if (totalStateOrders > 0) {
                for (const [state, count] of Object.entries(data.states)) {
                    regionDist[state] = Math.round((count / totalStateOrders) * 100);
                }
            }
            
            const workingHoursList = Array.from(data.working_hours);
            
            // 🔥 YENİ: İlk pickup noktasını geocode et
            let firstPickupCoords = null;
            if (data.first_pickup) {
                console.log(`   🔍 ${driverName} - İlk pickup geocoding: ${data.first_pickup.address}`);
                firstPickupCoords = await geocodeAddress(data.first_pickup.address);
                
                if (firstPickupCoords) {
                    console.log(`      ✅ Koordinatlar: ${firstPickupCoords.lat.toFixed(4)}, ${firstPickupCoords.lng.toFixed(4)}`);
                } else {
                    console.log(`      ❌ Geocoding başarısız`);
                }
                
                await new Promise(r => setTimeout(r, 1000)); // Rate limit for geocoding
            }
            
            // Sürücüyü GÜNCELLE
            try {
                const updateData = {
                    preferred_areas: topCities.length > 0 ? topCities : [],
                    assignment_preferences: {
                        ...driver.assignment_preferences,
                        working_hours: workingHoursList // working_days removed as it was not in outline
                    },
                    special_notes: {
                        ...driver.special_notes,
                        // primary_region (was in old code, not in outline, keeping for consistency if it was useful)
                        top_zip_codes: topZips,
                        // top_states (was in old code, not in outline)
                        region_distribution: regionDist,
                        total_orders_analyzed: data.orders.length,
                        // 🔥 YENİ: İlk pickup noktası kaydet
                        preferred_start_location: firstPickupCoords ? {
                            address: data.first_pickup.address,
                            coords: firstPickupCoords,
                            time: data.first_pickup.time
                        } : null
                    },
                    chain_history: data.chains.slice(0, 10) // Sadece son 10 zinciri sakla
                };
                
                await base44.entities.Driver.update(driver.id, updateData);
                
                updatedCount++;
                
                learningInsights.push({
                    driver: driverName,
                    totalOrders: data.orders.length,
                    topRegions: topCities.slice(0, 3),
                    chains: data.chains.length,
                    firstPickup: data.first_pickup?.address || 'N/A',
                    firstPickupGeocoded: !!firstPickupCoords
                });
                
                console.log(`✅ ${driverName}: ${data.orders.length} sipariş, ${data.chains.length} zincir, İlk: ${data.first_pickup?.address || 'N/A'}`);
            } catch (error) {
                console.error(`   ❌ Güncelleme hatası (${driverName}): ${error.message}`);
            }
        }
        
        console.log(`\n✅ ${updatedCount} sürücü profili güncellendi`);
        
        return Response.json({
            success: true,
            message: `${updatedCount} sürücü profili güçlendirildi`,
            updatedDrivers: updatedCount,
            totalAssignments: assignments.length,
            insights: learningInsights
        });
        
    } catch (error) {
        console.error('❌ Öğrenme hatası:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});
