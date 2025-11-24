import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Erken sabah güvenilirlik seviyeleri
        const earlyMorningData = {
            // Seviye 1 - Çok Güvenilir (Her hafta)
            "Archimede Samoth": { reliability: 1, eligible: true, specialist: true },
            
            // Seviye 2 - Yüksek Güven (Çoğu hafta)
            "Akram Khan": { reliability: 2, eligible: true, specialist: false },
            "Enis Kiziltoprak": { reliability: 2, eligible: true, specialist: false },
            "Fatih Yalcin": { reliability: 2, eligible: true, specialist: false },
            
            // Seviye 3 - Orta Güven (Yarısından fazla)
            "Fagan Ismailov": { reliability: 3, eligible: true, specialist: false },
            "Kerem Colakkadioglu": { reliability: 3, eligible: true, specialist: false },
            "Seyit Gumus": { reliability: 3, eligible: true, specialist: false },
            
            // Seviye 4 - Düşük Güven (Ara sıra)
            "Adam Saidi": { reliability: 4, eligible: true, specialist: false },
            "Aleks Berk Ergene": { reliability: 4, eligible: true, specialist: false },
            "Baran Hanci": { reliability: 4, eligible: true, specialist: false },
            "Charles Ajoku": { reliability: 4, eligible: true, specialist: false },
            "Damon Thompson": { reliability: 4, eligible: true, specialist: false },
            "Ersad Alp": { reliability: 4, eligible: true, specialist: false },
            "Huseyin Orkmez": { reliability: 4, eligible: true, specialist: false },
            "Huseyin Yilmaz Kartal": { reliability: 4, eligible: true, specialist: false },
            "Ilyas Valiyev": { reliability: 4, eligible: true, specialist: false },
            "Jose Beltrain": { reliability: 4, eligible: true, specialist: false },
            "Mehmet Sahin Yildirim": { reliability: 4, eligible: true, specialist: false },
            "Onur Uzonur": { reliability: 4, eligible: true, specialist: false },
            "Rojhat Tolog": { reliability: 4, eligible: true, specialist: false },
            "Selin Okan": { reliability: 4, eligible: true, specialist: false },
            "Sertan Qwert": { reliability: 4, eligible: true, specialist: false },
            "Seyda Basoglu": { reliability: 4, eligible: true, specialist: false },
            "Vedat Ozdemir": { reliability: 4, eligible: true, specialist: false },
            "Victor Victor": { reliability: 4, eligible: true, specialist: false }
        };

        const drivers = await base44.entities.Driver.list();
        let updatedCount = 0;
        const errors = [];

        for (const driver of drivers) {
            const earlyData = earlyMorningData[driver.name];
            
            if (earlyData) {
                try {
                    await base44.entities.Driver.update(driver.id, {
                        early_morning_eligible: earlyData.eligible,
                        early_morning_specialist: earlyData.specialist,
                        early_morning_reliability: earlyData.reliability
                    });
                    updatedCount++;
                    console.log(`✅ ${driver.name} - Seviye ${earlyData.reliability}`);
                } catch (error) {
                    console.error(`❌ ${driver.name} güncellenemedi:`, error.message);
                    errors.push({ name: driver.name, error: error.message });
                }
            }
        }

        return Response.json({
            success: true,
            message: `${updatedCount} sürücünün erken sabah güvenilirlik bilgileri güncellendi`,
            updatedCount,
            totalDrivers: drivers.length,
            driversInData: Object.keys(earlyMorningData).length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("Erken sabah güncelleme hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});