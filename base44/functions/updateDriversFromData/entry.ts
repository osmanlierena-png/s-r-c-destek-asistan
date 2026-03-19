import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Mevcut sürücüleri getir
        const drivers = await base44.entities.Driver.list();
        
        // 2 aylık veriden çıkardığım sürücü istatistikleri (Genişletilmiş liste)
        // working_days alanları Türkçe'den İngilizce'ye çevrildi.
        const driverStats = {
            "Musa Ozdemir": {
                preferred_areas: ["Alpharetta", "Roswell", "Johns Creek"],
                assignment_preferences: { max_orders_per_day: 8, avg_orders_per_week: 42, working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] }
            },
            "Eren Kiziltoprak": {
                preferred_areas: ["Marietta", "Smyrna", "Kennesaw"],
                assignment_preferences: { max_orders_per_day: 7, avg_orders_per_week: 31, working_days: ["Monday", "Wednesday", "Friday", "Saturday", "Sunday"] }
            },
            "Vedat Ozdemir": {
                preferred_areas: ["Decatur", "Stone Mountain", "Tucker"],
                assignment_preferences: { max_orders_per_day: 7, avg_orders_per_week: 36, working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }
            },
            // 🔥 FIX: Tüm sürücülere varsayılan olarak 5 sipariş ve varsayılan çalışma günleri
            "DEFAULT": {
                preferred_areas: [],
                assignment_preferences: { max_orders_per_day: 5, avg_orders_per_week: 20, working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }
            }
        };

        let updatedCount = 0;

        // Tüm mevcut sürücüleri kontrol et ve güncelle veya varsayılan değerleri ata
        for (const driver of drivers) {
            const stats = driverStats[driver.name] || driverStats["DEFAULT"];
            
            await base44.entities.Driver.update(driver.id, {
                preferred_areas: stats.preferred_areas,
                assignment_preferences: {
                    ...driver.assignment_preferences, // Mevcut assignment_preferences değerlerini koru
                    ...stats.assignment_preferences // Yeni değerlerle üzerine yaz
                }
            });
            updatedCount++;
        }
        
        let message = `${updatedCount} sürücünün bilgileri güncellendi. Tanımlı sürücüler için 2 aylık veriye göre, diğerleri için varsayılan değerler atandı.`;

        return Response.json({
            success: true,
            message: message,
            updatedDrivers: updatedCount,
            totalSystemDrivers: drivers.length,
            driversWithSpecificStats: Object.keys(driverStats).filter(key => key !== "DEFAULT").length
        });

    } catch (error) {
        console.error("Sürücü güncelleme hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});