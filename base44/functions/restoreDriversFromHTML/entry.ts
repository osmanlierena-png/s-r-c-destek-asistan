import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const HTML_FILE_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/687922c274a70a2de1788cbe/26c308ade_all_83_drivers_FOR_AI.html';

// Türkçe/Azerice isim kontrolü
const isTurkishName = (name) => {
    const turkishNames = [
        'Adnan', 'Aleks', 'Baran', 'Berhay', 'Can', 'Enis', 'Eren', 'Ersad', 
        'Fadh', 'Fagan', 'Fatih', 'Inayat', 'Kamuran', 'Kerem', 'Murad', 
        'Necip', 'Oguzhan', 'Omer', 'Onur', 'Rojhat', 'Sadak', 'Sefik', 
        'Serhan', 'Sertan', 'Sevda', 'Seyit', 'Shahnaz', 'Tahim', 'Tuncay', 
        'Vedat', 'Emirhan', 'Ilyas', 'Raul'
    ];
    return turkishNames.some(turkishName => name.includes(turkishName));
};

// Günleri İngilizce'ye çevir
const translateDay = (day) => {
    const dayMap = {
        'Mon': 'Monday',
        'Tue': 'Tuesday', 
        'Wed': 'Wednesday',
        'Thu': 'Thursday',
        'Fri': 'Friday',
        'Sat': 'Saturday',
        'Sun': 'Sunday'
    };
    return dayMap[day] || day;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        console.log("🔄 HTML'den sürücü verileri yükleniyor...");
        const response = await fetch(HTML_FILE_URL);
        const htmlContent = await response.text();
        
        const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) {
            return Response.json({ error: 'tbody bulunamadı' }, { status: 400 });
        }
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr>[\s\S]*?<\/tr>/g) || [];
        
        const driverDataMap = new Map(); // name -> data
        
        for (const row of rows) {
            const cells = [];
            const cellRegex = /<td>([\s\S]*?)<\/td>/g;
            let cellMatch;
            
            while ((cellMatch = cellRegex.exec(row)) !== null) {
                cells.push(cellMatch[1].trim());
            }
            
            if (cells.length < 12) continue;
            
            const driverName = cells[0];
            const statusText = cells[1];
            const totalOrders = cells[2];
            const weeksWorked = cells[4];
            const maxOrders = cells[7];
            const recommendedMax = cells[8];
            const usuallyDays = cells[9];
            const regionTags = cells[10];
            const notes = cells[11];
            
            const daysArray = usuallyDays
                .split(',')
                .map(d => translateDay(d.trim()))
                .filter(Boolean);
            
            const regions = regionTags
                .split(',')
                .map(r => r.trim())
                .filter(Boolean);
            
            let driverStatus = 'Aktif';
            if (statusText.includes('Passive')) driverStatus = 'Pasif';
            else if (statusText.includes('not recent')) driverStatus = 'İzinli';
            
            const language = isTurkishName(driverName) ? 'tr' : 'en';
            
            let maxOrdersPerDay = parseFloat(recommendedMax);
            if (isNaN(maxOrdersPerDay)) {
                maxOrdersPerDay = parseInt(maxOrders) || 5;
            }
            
            const avgPerWeek = Math.round(
                parseFloat(totalOrders) / parseFloat(weeksWorked) || 0
            );
            
            driverDataMap.set(driverName, {
                status: driverStatus,
                language: language,
                preferred_areas: regions,
                assignment_preferences: {
                    max_orders_per_day: maxOrdersPerDay,
                    avg_orders_per_week: avgPerWeek,
                    working_days: daysArray
                },
                notes: notes === 'NaN' ? '' : notes.substring(0, 500)
            });
        }
        
        console.log(`✅ ${driverDataMap.size} sürücü parse edildi`);
        
        // Şimdi sistemdeki sürücüleri güncelle
        const drivers = await base44.entities.Driver.list();
        let updatedCount = 0;
        const errors = [];
        
        for (const driver of drivers) {
            const htmlData = driverDataMap.get(driver.name);
            
            if (!htmlData) {
                console.log(`⚠️ ${driver.name} HTML'de bulunamadı, atlanıyor`);
                continue;
            }
            
            try {
                // Sadece HTML'den gelen temel bilgileri güncelle
                // Bölge analiz verilerini KORU!
                await base44.entities.Driver.update(driver.id, {
                    status: htmlData.status,
                    language: htmlData.language,
                    assignment_preferences: {
                        ...driver.assignment_preferences, // Mevcut verileri koru (bölge analizi vs.)
                        max_orders_per_day: htmlData.assignment_preferences.max_orders_per_day,
                        avg_orders_per_week: htmlData.assignment_preferences.avg_orders_per_week,
                        working_days: htmlData.assignment_preferences.working_days
                    }
                });
                
                updatedCount++;
                console.log(`✅ ${updatedCount}/${drivers.length}: ${driver.name} geri yüklendi`);
            } catch (error) {
                console.error(`❌ ${driver.name} güncellenemedi:`, error.message);
                errors.push({ name: driver.name, error: error.message });
            }
        }
        
        return Response.json({
            success: true,
            message: `${updatedCount} sürücü HTML'den başarıyla geri yüklendi!`,
            updatedCount,
            totalDrivers: drivers.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("Geri yükleme hatası:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});