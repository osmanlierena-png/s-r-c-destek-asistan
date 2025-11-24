import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { file_url } = await req.json();
        
        console.log("📊 1 aylık atama verisi parse ediliyor...");
        const response = await fetch(file_url);
        const htmlContent = await response.text();
        
        // HTML'den tablo verilerini çek
        const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) {
            return Response.json({ error: 'Tablo bulunamadı' }, { status: 400 });
        }
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
        
        console.log(`${rows.length} satır bulundu`);
        
        const assignments = [];
        
        // Header satırları (ilk 2-3 satır) atla
        for (let i = 2; i < rows.length; i++) {
            const row = rows[i];
            const cells = [];
            const cellMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
            
            for (const cellHtml of cellMatches) {
                let cellText = cellHtml
                    .replace(/<td[^>]*>/, '')
                    .replace(/<\/td>/, '')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\n/g, ' ')
                    .trim();
                cells.push(cellText);
            }
            
            // Format: #, Order No, Delivery Date, Delivery Address, Pickup Location, Driver, Short/Long, Distance...
            if (cells.length < 8) continue;
            
            const orderNo = cells[1];
            const deliveryAddress = cells[3];
            const pickupLocation = cells[4];
            const driverName = cells[5];
            const distanceType = cells[6]; // Short/Long
            const distance = parseFloat(cells[7]) || 0;
            
            if (!orderNo || !driverName || orderNo === 'Order No') continue;
            
            // Bölge tespiti - zip code çıkar
            const extractZip = (address) => {
                const zipMatch = address.match(/\b(\d{5})\b/);
                return zipMatch ? zipMatch[1] : null;
            };
            
            const pickupZip = extractZip(pickupLocation);
            const deliveryZip = extractZip(deliveryAddress);
            
            // Eyalet tespiti
            const extractState = (address) => {
                const stateMatch = address.match(/\b(VA|MD|DC|WV)\b/);
                return stateMatch ? stateMatch[1] : null;
            };
            
            const pickupState = extractState(pickupLocation);
            const deliveryState = extractState(deliveryAddress);
            
            // Şehir tespiti (zip'ten önce gelen kelime)
            const extractCity = (address) => {
                const cityMatch = address.match(/([A-Za-z\s]+),?\s+(VA|MD|DC|WV)\s+\d{5}/);
                return cityMatch ? cityMatch[1].trim() : null;
            };
            
            const pickupCity = extractCity(pickupLocation);
            const deliveryCity = extractCity(deliveryAddress);
            
            assignments.push({
                order_no: orderNo,
                driver_name: driverName,
                pickup_location: pickupLocation,
                delivery_address: deliveryAddress,
                pickup_zip: pickupZip,
                delivery_zip: deliveryZip,
                pickup_state: pickupState,
                delivery_state: deliveryState,
                pickup_city: pickupCity,
                delivery_city: deliveryCity,
                distance_type: distanceType,
                distance: distance
            });
        }
        
        console.log(`✅ ${assignments.length} atama parse edildi`);
        
        // Sürücü bazında analiz
        const driverStats = {};
        
        for (const assignment of assignments) {
            const driver = assignment.driver_name;
            
            if (!driverStats[driver]) {
                driverStats[driver] = {
                    driver_name: driver,
                    total_orders: 0,
                    total_distance: 0,
                    long_distance_count: 0,
                    short_distance_count: 0,
                    avg_distance: 0,
                    states: {},
                    cities: {},
                    zip_codes: {},
                    cross_state_orders: 0,
                    max_distance: 0,
                    min_distance: 999
                };
            }
            
            const stats = driverStats[driver];
            stats.total_orders++;
            stats.total_distance += assignment.distance;
            
            if (assignment.distance_type === 'Long') {
                stats.long_distance_count++;
            } else {
                stats.short_distance_count++;
            }
            
            if (assignment.distance > stats.max_distance) {
                stats.max_distance = assignment.distance;
            }
            if (assignment.distance < stats.min_distance) {
                stats.min_distance = assignment.distance;
            }
            
            // Eyalet sayımı
            if (assignment.delivery_state) {
                stats.states[assignment.delivery_state] = (stats.states[assignment.delivery_state] || 0) + 1;
            }
            
            // Şehir sayımı
            if (assignment.delivery_city) {
                stats.cities[assignment.delivery_city] = (stats.cities[assignment.delivery_city] || 0) + 1;
            }
            
            // Zip code sayımı
            if (assignment.delivery_zip) {
                stats.zip_codes[assignment.delivery_zip] = (stats.zip_codes[assignment.delivery_zip] || 0) + 1;
            }
            
            // Eyalet geçişi
            if (assignment.pickup_state && assignment.delivery_state && 
                assignment.pickup_state !== assignment.delivery_state) {
                stats.cross_state_orders++;
            }
        }
        
        // Ortalama hesapla ve en çok gittiği yerleri sırala
        for (const driver in driverStats) {
            const stats = driverStats[driver];
            stats.avg_distance = (stats.total_distance / stats.total_orders).toFixed(2);
            
            // En çok gittiği 5 şehir
            stats.top_cities = Object.entries(stats.cities)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([city, count]) => ({
                    city,
                    count,
                    percentage: ((count / stats.total_orders) * 100).toFixed(1)
                }));
            
            // En çok gittiği 3 eyalet
            stats.top_states = Object.entries(stats.states)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([state, count]) => ({
                    state,
                    count,
                    percentage: ((count / stats.total_orders) * 100).toFixed(1)
                }));
            
            // En çok gittiği 10 zip code
            stats.top_zip_codes = Object.entries(stats.zip_codes)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([zip, count]) => ({
                    zip,
                    count,
                    percentage: ((count / stats.total_orders) * 100).toFixed(1)
                }));
            
            // Uzun mesafe yeteneği (Long siparişlerin yüzdesi)
            stats.long_distance_percentage = ((stats.long_distance_count / stats.total_orders) * 100).toFixed(1);
            
            // Eyalet geçiş yüzdesi
            stats.cross_state_percentage = ((stats.cross_state_orders / stats.total_orders) * 100).toFixed(1);
        }
        
        // Sırala (en çok sipariş alandan başla)
        const sortedStats = Object.values(driverStats).sort((a, b) => b.total_orders - a.total_orders);
        
        console.log(`\n📊 SÜRÜCÜ İSTATİSTİKLERİ:`);
        console.log(`  Toplam Sürücü: ${sortedStats.length}`);
        console.log(`  Toplam Sipariş: ${assignments.length}`);
        console.log(`  Ortalama: ${(assignments.length / sortedStats.length).toFixed(1)} sipariş/sürücü\n`);
        
        return Response.json({
            success: true,
            total_assignments: assignments.length,
            total_drivers: sortedStats.length,
            driver_stats: sortedStats,
            raw_assignments: assignments
        });

    } catch (error) {
        console.error("Analiz hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});