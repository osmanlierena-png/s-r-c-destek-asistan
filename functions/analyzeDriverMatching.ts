import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Manuel veri dosyasındaki sürücü isimleri (HTML'den)
        const manualDriverNames = [
            "Victor Victor",
            "Fatih Yalcin",
            "Onur Uzonur",
            "Baran Hanci",
            "Jr Sergio Sorto",
            "Armi Armi",
            "Serkan Beder",
            "Seyit Gumus",
            "Murad Najafov",
            "Can Timur",
            "Dequan Spencer",
            "Shannil Muhammed",
            "Fagan Ismailov",
            "Archimede Samoth",
            "Jose Beltrain",
            "Marcus Nunes",
            "Akram Khan",
            "Ghiyasiddin Mansory",
            "Sayed Haamid Tore",
            "Sertan Qwert"
        ];

        // Sistemdeki tüm sürücüleri çek
        const allDrivers = await base44.entities.Driver.list();
        
        const analysis = {
            totalManualDrivers: manualDriverNames.length,
            totalSystemDrivers: allDrivers.length,
            matched: [],
            notFoundInSystem: [],
            systemDriversNotInManual: [],
            fuzzyMatches: []
        };

        // İsim normalizasyon fonksiyonu
        const normalize = (name) => {
            return name.toLowerCase()
                .replace(/\s+/g, ' ')  // Çoklu boşlukları tek boşluğa
                .trim();
        };

        // Manuel listedeki her sürücü için sistem kontrolü
        for (const manualName of manualDriverNames) {
            const normalizedManual = normalize(manualName);
            
            // Tam eşleşme ara
            const exactMatch = allDrivers.find(d => normalize(d.name) === normalizedManual);
            
            if (exactMatch) {
                analysis.matched.push({
                    manualName: manualName,
                    systemName: exactMatch.name,
                    status: exactMatch.status,
                    id: exactMatch.id
                });
            } else {
                // Fuzzy match dene (benzer isim)
                const fuzzyMatch = allDrivers.find(d => {
                    const sysNorm = normalize(d.name);
                    return sysNorm.includes(normalizedManual) || normalizedManual.includes(sysNorm);
                });
                
                if (fuzzyMatch) {
                    analysis.fuzzyMatches.push({
                        manualName: manualName,
                        possibleMatch: fuzzyMatch.name,
                        status: fuzzyMatch.status,
                        id: fuzzyMatch.id
                    });
                } else {
                    analysis.notFoundInSystem.push(manualName);
                }
            }
        }

        // Sistemde olup manuel listede olmayan sürücüler
        for (const driver of allDrivers) {
            const normalizedDriver = normalize(driver.name);
            const inManualList = manualDriverNames.some(m => normalize(m) === normalizedDriver);
            
            if (!inManualList) {
                analysis.systemDriversNotInManual.push({
                    name: driver.name,
                    status: driver.status,
                    id: driver.id
                });
            }
        }

        return Response.json({
            success: true,
            analysis: analysis,
            summary: {
                matchedCount: analysis.matched.length,
                notFoundCount: analysis.notFoundInSystem.length,
                fuzzyMatchCount: analysis.fuzzyMatches.length,
                systemOnlyCount: analysis.systemDriversNotInManual.length
            }
        });

    } catch (error) {
        console.error("Analiz hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});