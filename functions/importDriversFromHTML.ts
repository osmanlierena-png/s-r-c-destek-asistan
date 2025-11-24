import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const dayMapping = {
    'Mon': 'Pazartesi',
    'Tue': 'Salı',
    'Wed': 'Çarşamba',
    'Thu': 'Perşembe',
    'Fri': 'Cuma',
    'Sat': 'Cumartesi',
    'Sun': 'Pazar'
};

const statusMapping = {
    'Reel Active': 'Aktif',
    'Active but not recent': 'İzinli',
    'Passive': 'Pasif'
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        const { htmlContent } = await req.json();
        
        if (!htmlContent) {
            return Response.json({ error: 'HTML içeriği gerekli' }, { status: 400 });
        }

        // HTML'i parse et (basit regex ile - table row'ları bul)
        const rowRegex = /<tr>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/g;
        
        const drivers = [];
        let match;
        
        while ((match = rowRegex.exec(htmlContent)) !== null) {
            const [_, name, status, total_orders, workdays, weeks_worked, avg_orders, p90_orders, max_orders, recommended_max, usually_days, region_tags, notes, active_flag] = match;
            
            // Günleri parse et ve Türkçe'ye çevir
            const daysEn = usually_days.split(',').map(d => d.trim());
            const daysTr = daysEn.map(d => dayMapping[d] || d).filter(Boolean);
            
            // Bölgeleri parse et
            const regions = region_tags.split(',').map(r => r.trim()).filter(Boolean);
            
            // Status'ü çevir
            const statusTr = statusMapping[status] || status;
            
            drivers.push({
                name: name.trim(),
                phone: "", // Telefon numarası veri setinde yok, boş bırakıyoruz
                status: statusTr,
                language: "en", // Varsayılan İngilizce
                notes: notes === 'NaN' ? '' : notes.substring(0, 500), // Notları kısalt
                address: "", // Adres veri setinde yok
                preferred_areas: regions,
                assignment_preferences: {
                    max_orders_per_day: parseFloat(recommended_max) || parseInt(max_orders) || 5,
                    avg_orders_per_week: Math.round(parseFloat(total_orders) / parseFloat(weeks_worked) || 0),
                    working_days: daysTr,
                    max_distance_km: 25
                }
            });
        }
        
        console.log(`Parse edilen sürücü sayısı: ${drivers.length}`);
        
        // Sürücüleri sisteme ekle
        let addedCount = 0;
        const errors = [];
        
        for (const driver of drivers) {
            try {
                await base44.entities.Driver.create(driver);
                addedCount++;
                console.log(`✅ Eklendi: ${driver.name}`);
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
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("Import hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});