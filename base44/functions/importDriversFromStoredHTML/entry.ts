
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const HTML_FILE_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/687922c274a470a2de1788cbe/26c308ade_all_83_drivers_FOR_AI.html';

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
        console.log("HTML dosyası indiriliyor:", HTML_FILE_URL);
        const response = await fetch(HTML_FILE_URL);
        const htmlContent = await response.text();
        
        console.log("HTML parse ediliyor...");
        
        // tbody içindeki tüm tr'leri bul
        const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) {
            return Response.json({ error: 'tbody bulunamadı' }, { status: 400 });
        }
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr>[\s\S]*?<\/tr>/g) || [];
        
        console.log(`${rows.length} satır bulundu`);
        
        const drivers = [];
        
        for (const row of rows) {
            // Her satırdaki tüm td'leri çıkar
            const cells = [];
            const cellRegex = /<td>([\s\S]*?)<\/td>/g;
            let cellMatch;
            
            while ((cellMatch = cellRegex.exec(row)) !== null) {
                cells.push(cellMatch[1].trim());
            }
            
            if (cells.length < 12) {
                console.log(`⚠️ Yetersiz kolon: ${cells.length}`);
                continue;
            }
            
            // Kolonlar: 0=driver, 1=status, 2=total_orders, 3=workdays, 4=weeks_worked, 
            // 5=avg_orders, 6=p90, 7=max_orders, 8=recommended_max, 9=usually_days, 
            // 10=region_tags, 11=notes
            
            const driverName = cells[0];
            const statusText = cells[1];
            const totalOrders = cells[2];
            const weeksWorked = cells[4];
            const maxOrders = cells[7];
            const recommendedMax = cells[8];
            const usuallyDays = cells[9];
            const regionTags = cells[10];
            const notes = cells[11];
            
            // Günleri parse et
            const daysArray = usuallyDays
                .split(',')
                .map(d => translateDay(d.trim()))
                .filter(Boolean);
            
            // Bölgeleri parse et
            const regions = regionTags
                .split(',')
                .map(r => r.trim())
                .filter(Boolean);
            
            // Status'ü Türkçe'ye çevir
            let driverStatus = 'Aktif';
            if (statusText.includes('Passive')) {
                driverStatus = 'Pasif';
            } else if (statusText.includes('not recent')) {
                driverStatus = 'İzinli';
            }
            
            // Dil tespiti
            const language = isTurkishName(driverName) ? 'tr' : 'en';
            
            // Recommended max
            let maxOrdersPerDay = parseFloat(recommendedMax);
            if (isNaN(maxOrdersPerDay)) {
                maxOrdersPerDay = parseInt(maxOrders) || 5;
            }
            
            // Haftalık ortalama
            const avgPerWeek = Math.round(
                parseFloat(totalOrders) / parseFloat(weeksWorked) || 0
            );
            
            drivers.push({
                name: driverName,
                phone: "",
                status: driverStatus,
                language: language,
                address: "",
                preferred_areas: regions,
                assignment_preferences: {
                    max_orders_per_day: maxOrdersPerDay,
                    avg_orders_per_week: avgPerWeek,
                    working_days: daysArray
                },
                notes: notes === 'NaN' ? '' : notes.substring(0, 500)
            });
            
            console.log(`✓ ${drivers.length}: ${driverName} (${language}) - ${driverStatus} - ${daysArray.join(',')}`);
        }
        
        console.log(`\n✅ Toplam ${drivers.length} sürücü parse edildi`);
        
        if (drivers.length === 0) {
            return Response.json({ 
                error: 'Hiç sürücü parse edilemedi',
                rowsFound: rows.length
            }, { status: 400 });
        }
        
        // Sürücüleri sisteme ekle
        console.log("\nSürücüler ekleniyor...");
        let addedCount = 0;
        const errors = [];
        
        for (const driver of drivers) {
            try {
                await base44.entities.Driver.create(driver);
                addedCount++;
                console.log(`✅ ${addedCount}/${drivers.length}: ${driver.name}`);
            } catch (error) {
                console.error(`❌ Eklenemedi: ${driver.name}`, error.message);
                errors.push({ name: driver.name, error: error.message });
            }
        }
        
        return Response.json({
            success: true,
            message: `${addedCount} sürücü başarıyla eklendi!`,
            addedCount,
            totalParsed: drivers.length,
            expectedTotal: 83,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("Import hatası:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});
