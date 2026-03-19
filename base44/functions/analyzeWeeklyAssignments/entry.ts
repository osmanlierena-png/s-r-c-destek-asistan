
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// 🔥 FIX: getCity fonksiyonu - daha akıllı parse
const getCity = (address) => {
    if (!address) return null;
    
    // Önce virgülle ayrılmış kısımlara böl
    const parts = address.split(',').map(p => p.trim());
    
    // Eğer virgül varsa, ikinci parça genellikle şehir
    if (parts.length >= 2) {
        // "Arlington, VA" → "Arlington"
        // "Suite 1000, Arlington, VA" → "Arlington"
        const cityPart = parts[parts.length - 2]; // Sondan 2. (VA'dan önceki)
        
        // Sayı veya "Suite" gibi şeyler değilse al
        if (!/^\d+$/.test(cityPart) && !cityPart.toLowerCase().includes('suite')) {
            return cityPart;
        }
    }
    
    // Virgül yoksa, cadde isimlerinden şehir çıkar
    // "7650 Wisconsin Ave" → "Wisconsin"
    // "2011 Crystal Dr Suite 1000" → "Crystal"
    const words = address.split(' ').filter(w => w.length > 0);
    
    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        // Sayı değilse ve "Suite", "Blvd", "Dr", "Ave", "St" gibi değilse
        if (!/^\d+$/.test(word) && 
            !['Suite', 'Apt', 'Unit', 'Floor', 'Blvd', 'Dr', 'Ave', 'Avenue', 'St', 'Street', 'Rd', 'Road'].includes(word)) {
            return word;
        }
    }
    
    // Son çare: ilk kelime
    return words[0] || null;
};

const getDayName = (dateStr) => {
  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const date = new Date(dateStr);
  return days[date.getDay()];
};

const getDayNameEnglish = (dateStr) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(dateStr);
  return days[date.getDay()];
};

// 🆕 İsim benzerlik kontrolü
const nameSimilarity = (name1, name2) => {
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, ''); // Allow numbers too in case of "driver 1"
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    // Tam eşleşme
    if (n1 === n2) return 1.0;
    
    // Biri diğerinin içinde mi? (e.g. "John D." vs "John Doe")
    if (n1.includes(n2) || n2.includes(n1)) return 0.9;
    
    // Levenshtein benzeri basit benzerlik (character overlap)
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;
    
    if (longer.length === 0) return 1.0; // Both are empty strings, considered 100% similar
    
    let matches = 0;
    // Count how many characters from the shorter string are present in the longer string
    // This is a very simplistic similarity, not a true Levenshtein
    for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i])) {
            matches++;
        }
    }
    
    // Return ratio of matches to the length of the longer string
    // A more robust similarity algorithm would be needed for complex cases
    return matches / longer.length;
};

const findBestDriverMatch = (htmlName, systemDrivers) => {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const driver of systemDrivers) {
        const score = nameSimilarity(htmlName, driver.name);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = driver;
        }
    }
    
    // %70'den fazla benzerlik varsa kabul et
    if (bestScore >= 0.7) {
        return { driver: bestMatch, score: bestScore };
    }
    
    return null;
};

// 🆕 Parse fonksiyonu - direkt burada
const parseAssignmentHTML = async (file_url) => {
    console.log("HTML dosyası indiriliyor:", file_url);
    const response = await fetch(file_url);
    const htmlContent = await response.text();
    
    console.log("HTML parse ediliyor...");
    
    const assignments = [];
    
    // tbody içindeki satırları bul
    const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) {
        console.log("❌ tbody bulunamadı");
        return [];
    }
    
    const tbodyContent = tbodyMatch[1];
    const rows = tbodyContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
    
    console.log(`${rows.length} satır bulundu`);
    
    // İlk satır header mı kontrol et
    let startIndex = 0;
    if (rows.length > 0) {
        const firstRow = rows[0];
        // Check for common header indicators in the first row's cells
        if (firstRow.includes('Order') || firstRow.includes('#') || firstRow.includes('Driver') || firstRow.includes('Customer')) {
            startIndex = 1;
            console.log("Header satırı atlandı");
        }
    }
    
    console.log(`Parse başlangıç satırı: ${startIndex}`);
    
    for (let i = startIndex; i < rows.length; i++) {
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
        
        // 🔥 FIX: En az 7 kolon olmalı (Order, Customer, Pickup, Dropoff, DropoffTime, PickupTime, Driver)
        if (cells.length < 7) {
            console.log(`Satır ${i} atlandı: ${cells.length} kolon (minimum 7 gerekli)`);
            continue;
        }
        
        // NaN veya boş satırları atla
        if (!cells[0] || cells[0] === 'NaN' || cells[0].includes('Order')) {
            console.log(`Satır ${i} atlandı: Kolon 0 (${cells[0]}) geçersiz`);
            continue;
        }
        
        // 🔥 FIX: DOĞRU KOLONLAR
        // 0: Order No
        // 1: Customer Name
        // 2: Pickup Address
        // 3: Dropoff Address
        // 4: Dropoff Time
        // 5: Pickup Time ✅
        // 6: Driver Name
        
        const orderNo = cells[0];
        const customerName = cells[1];
        const pickupAddress = cells[2];
        const dropoffAddress = cells[3];
        const dropoffTime = cells[4];
        const pickupTime = cells[5];  // ✅ 6. KOLON!
        const driverName = cells[6];
        
        if (!orderNo || !driverName) {
            console.log(`Satır ${i} atlandı: Order No (${orderNo}) veya Driver Name (${driverName}) yok`);
            continue;
        }
        
        console.log(`✓ Satır ${i}: Order ${orderNo}, Driver ${driverName}, Pickup ${pickupTime}`);
        
        assignments.push({
            order_id: orderNo,
            driver_name: driverName,
            customer_name: customerName,
            pickup_time: pickupTime,
            pickup_address: pickupAddress,
            dropoff_time: dropoffTime,
            dropoff_address: dropoffAddress
        });
    }
    
    console.log(`✅ ${assignments.length} atama parse edildi`);
    return assignments;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { dailyReports } = await req.json();
        
        if (!dailyReports || dailyReports.length === 0) {
            return Response.json({ error: 'Lütfen en az bir günlük rapor yükleyin' }, { status: 400 });
        }

        console.log(`📊 ${dailyReports.length} günlük rapor analiz ediliyor...`);

        const allAssignments = [];
        const dailyData = [];

        for (const report of dailyReports) {
            console.log(`📅 ${report.date} parse ediliyor...`);
            
            // 🔥 FIX: Direkt parse fonksiyonunu çağır
            const assignments = await parseAssignmentHTML(report.file_url);
            
            if (assignments.length > 0) {
                const enrichedAssignments = assignments.map(a => ({
                    ...a,
                    date: report.date,
                    day_name: getDayName(report.date),
                    day_name_en: getDayNameEnglish(report.date)
                }));
                
                allAssignments.push(...enrichedAssignments);
                dailyData.push({
                    date: report.date,
                    day_name: getDayName(report.date),
                    assignments: assignments.length,
                    drivers: [...new Set(assignments.map(a => a.driver_name))].length
                });
                
                console.log(`✅ ${report.date}: ${assignments.length} atama, ${dailyData[dailyData.length - 1].drivers} sürücü`);
            } else {
                console.log(`❌ ${report.date}: Atama bulunamadı`);
            }
        }

        console.log(`\n📊 Toplam: ${allAssignments.length} atama parse edildi`);

        // HTML'deki sürücü isimlerini topla
        const htmlDriverNames = [...new Set(allAssignments.map(a => a.driver_name))];
        console.log(`\n📋 HTML'de bulunan sürücüler (${htmlDriverNames.length}):`);
        htmlDriverNames.forEach(name => console.log(`  - ${name}`));

        // Sistemdeki sürücüleri al
        const systemDrivers = await base44.entities.Driver.list();
        console.log(`\n💾 Sistemde kayıtlı sürücüler (${systemDrivers.length}):`);
        
        // 🆕 Fuzzy Matching ile eşleştir
        const nameMapping = {}; // HTML_name -> System_name
        const unmatchedDrivers = [];
        const matchLog = [];
        
        for (const htmlName of htmlDriverNames) {
            const match = findBestDriverMatch(htmlName, systemDrivers);
            
            if (match) {
                nameMapping[htmlName] = match.driver.name;
                const scorePercent = (match.score * 100).toFixed(0);
                console.log(`✓ "${htmlName}" → "${match.driver.name}" (${scorePercent}% benzerlik)`);
                matchLog.push({
                    html_name: htmlName,
                    system_name: match.driver.name,
                    score: parseFloat(match.score.toFixed(2))
                });
            } else {
                console.log(`✗ "${htmlName}" eşleşme bulunamadı`);
                unmatchedDrivers.push(htmlName);
            }
        }

        // 🆕 Assignment'lardaki isimleri düzelt
        for (const assignment of allAssignments) {
            if (nameMapping[assignment.driver_name]) {
                assignment.driver_name = nameMapping[assignment.driver_name];
            }
        }

        if (unmatchedDrivers.length > 0) {
            console.log(`\n⚠️ ${unmatchedDrivers.length} sürücü eşleştirilemedi:`);
            unmatchedDrivers.forEach(name => console.log(`  - ${name}`));
        }

        // Sürücü bazında analiz
        const driverAnalysis = {};

        for (const assignment of allAssignments) {
            const driverName = assignment.driver_name;
            
            if (!driverAnalysis[driverName]) {
                driverAnalysis[driverName] = {
                    total_orders: 0,
                    working_days: new Set(),
                    working_days_en: new Set(),
                    regions: {},
                    chains: [],
                    daily_orders: {},
                    time_slots: {},
                    pickup_cities: {},
                    dropoff_cities: {}
                };
            }

            const analysis = driverAnalysis[driverName];
            analysis.total_orders++;
            analysis.working_days.add(assignment.day_name);
            analysis.working_days_en.add(assignment.day_name_en);

            // Günlük sipariş sayısı
            if (!analysis.daily_orders[assignment.date]) {
                analysis.daily_orders[assignment.date] = 0;
            }
            analysis.daily_orders[assignment.date]++;

            // Bölge analizi
            const pickupCity = getCity(assignment.pickup_address);
            const dropoffCity = getCity(assignment.dropoff_address);

            if (pickupCity) {
                analysis.pickup_cities[pickupCity] = (analysis.pickup_cities[pickupCity] || 0) + 1;
            }
            if (dropoffCity) {
                analysis.dropoff_cities[dropoffCity] = (analysis.dropoff_cities[dropoffCity] || 0) + 1;
            }

            // Saat dilimi analizi
            const pickupTime = assignment.pickup_time;
            if (pickupTime) {
                // Assuming pickupTime is in "HH:MM" format
                const hourMatch = pickupTime.match(/^(\d{1,2}):\d{2}/);
                if (hourMatch) {
                    const hour = parseInt(hourMatch[1]);
                    const timeSlot = `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`;
                    analysis.time_slots[timeSlot] = (analysis.time_slots[timeSlot] || 0) + 1;
                }
            }
        }

        // Günlük rota zincirleri oluştur
        for (const report of dailyReports) {
            const dayAssignments = allAssignments.filter(a => a.date === report.date);
            
            // Sürücü bazında zincirleri oluştur
            const driverDayOrders = {};
            for (const assignment of dayAssignments) {
                if (!driverDayOrders[assignment.driver_name]) {
                    driverDayOrders[assignment.driver_name] = [];
                }
                driverDayOrders[assignment.driver_name].push(assignment);
            }

            // Her sürücünün günlük zincirini kaydet
            for (const [driverName, orders] of Object.entries(driverDayOrders)) {
                if (orders.length > 1) {
                    const cities = orders.map(o => getCity(o.dropoff_address)).filter(Boolean);
                    const uniqueCities = [...new Set(cities)];
                    
                    if (driverAnalysis[driverName]) { // Ensure driver exists in analysis after mapping
                        driverAnalysis[driverName].chains.push({
                            date: report.date,
                            stops: orders.length,
                            chain: cities.join(' → '),
                            regions: uniqueCities
                        });
                    }
                }
            }
        }

        // İstatistikleri hesapla ve formatla
        const driverStats = [];
        
        for (const [driverName, analysis] of Object.entries(driverAnalysis)) {
            const workingDaysCount = analysis.working_days.size;
            const avgOrdersPerDay = workingDaysCount > 0 ? (analysis.total_orders / workingDaysCount).toFixed(1) : 0;
            const maxOrdersInDay = Math.max(...Object.values(analysis.daily_orders));

            // En çok gittiği 5 bölge
            const topPickupCities = Object.entries(analysis.pickup_cities)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([city, count]) => ({ city, count, percentage: ((count / analysis.total_orders) * 100).toFixed(0) }));

            const topDropoffCities = Object.entries(analysis.dropoff_cities)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([city, count]) => ({ city, count, percentage: ((count / analysis.total_orders) * 100).toFixed(0) }));

            // En aktif saat dilimleri
            const topTimeSlots = Object.entries(analysis.time_slots)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3);

            driverStats.push({
                driver_name: driverName,
                total_orders: analysis.total_orders,
                working_days: [...analysis.working_days].sort(),
                working_days_en: [...analysis.working_days_en],
                working_days_count: workingDaysCount,
                avg_orders_per_day: parseFloat(avgOrdersPerDay),
                max_orders_in_day: maxOrdersInDay,
                top_pickup_cities: topPickupCities,
                top_dropoff_cities: topDropoffCities,
                top_time_slots: topTimeSlots,
                chain_count: analysis.chains.length,
                chains: analysis.chains
            });
        }

        // Sürücüleri toplam sipariş sayısına göre sırala
        driverStats.sort((a, b) => b.total_orders - a.total_orders);

        console.log(`\n✅ ${driverStats.length} sürücü analiz edildi`);

        // Sürücü veritabanını güncelle
        let updatedCount = 0;
        const errors = [];

        for (const stats of driverStats) {
            try {
                const drivers = await base44.entities.Driver.filter({ name: stats.driver_name });
                
                if (drivers.length === 0) {
                    console.log(`⚠️ ${stats.driver_name} sistemde bulunamadı`);
                    errors.push({ driver: stats.driver_name, error: 'Sistemde bulunamadı (eşleştirme sonrası)' });
                    continue;
                }

                const driver = drivers[0];
                
                // Güncelleme paketi hazırla
                const updateData = {
                    assignment_preferences: {
                        ...driver.assignment_preferences,
                        working_days: stats.working_days_en,
                        max_orders_per_day: stats.max_orders_in_day,
                        avg_orders_per_week: stats.total_orders // This is total orders from current report, not per week.
                    },
                    preferred_areas: stats.top_dropoff_cities.slice(0, 3).map(c => c.city),
                    chain_history: stats.chains
                };

                await base44.entities.Driver.update(driver.id, updateData);
                updatedCount++;
                console.log(`✅ ${updatedCount}/${driverStats.length}: ${stats.driver_name} güncellendi`);
                
            } catch (error) {
                console.error(`❌ ${stats.driver_name} güncellenemedi:`, error.message);
                errors.push({ driver: stats.driver_name, error: error.message });
            }
        }

        // Genel istatistikler
        const summary = {
            total_days: dailyReports.length,
            total_assignments: allAssignments.length,
            total_drivers_analyzed: driverStats.length,
            avg_assignments_per_day: (allAssignments.length / dailyReports.length).toFixed(1),
            updated_drivers_in_db: updatedCount,
            errors_during_update: errors.length,
            unmatched_html_drivers: unmatchedDrivers,
            name_mapping_log: matchLog
        };

        return Response.json({
            success: true,
            summary,
            daily_data: dailyData,
            driver_stats: driverStats,
            errors: errors.length > 0 ? errors : undefined,
            message: `${updatedCount} sürücü başarıyla güncellendi! (${matchLog.length} isim eşleştirildi)`
        });

    } catch (error) {
        console.error("Haftalık analiz hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});
