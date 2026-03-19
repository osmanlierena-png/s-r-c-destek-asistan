import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Günleri İngilizce olarak tut (zaten İngilizce)
const parseWorkingDays = (daysStr) => {
    if (!daysStr || daysStr === 'NaN') return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    const days = daysStr.split(',').map(d => d.trim());
    return days.filter(d => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(d));
};

// Telefon numarasını format düzelt
const formatPhone = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
    return phone;
};

// İsim normalizasyonu
const normalize = (name) => {
    return name.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '');
};

// İsim benzerliği (basit fuzzy match)
const nameSimilarity = (name1, name2) => {
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    if (n1 === n2) return 1.0;
    if (n1.includes(n2) || n2.includes(n1)) return 0.9;
    
    const words1 = n1.split(' ');
    const words2 = n2.split(' ');
    
    // İlk veya son kelime eşleşmesi
    if (words1[0] === words2[0] || words1[words1.length - 1] === words2[words2.length - 1]) {
        return 0.85;
    }
    
    // Ortak kelime sayısı
    const common = words1.filter(w => words2.includes(w)).length;
    if (common > 0) {
        return 0.7 + (common / Math.max(words1.length, words2.length)) * 0.15;
    }
    
    return 0;
};

// En iyi eşleşmeyi bul
const findBestMatch = (appName, systemDrivers) => {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const driver of systemDrivers) {
        const score = nameSimilarity(appName, driver.name);
        if (score > bestScore && score >= 0.7) {
            bestScore = score;
            bestMatch = driver;
        }
    }
    
    return bestMatch ? { driver: bestMatch, score: bestScore } : null;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        const { file_url } = await req.json();
        
        if (!file_url) {
            return Response.json({ error: 'file_url gerekli!' }, { status: 400 });
        }
        
        console.log("📥 HTML indiriliyor:", file_url);
        const response = await fetch(file_url);
        const htmlContent = await response.text();
        
        console.log("✅ HTML indirildi, parse başlıyor...");
        
        // tbody içeriğini bul
        const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) {
            return Response.json({ error: 'tbody bulunamadı' }, { status: 400 });
        }
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
        
        console.log(`📋 ${rows.length} başvuru bulundu`);
        
        const applications = [];
        
        for (const row of rows) {
            const cells = [];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
            let cellMatch;
            
            while ((cellMatch = cellRegex.exec(row)) !== null) {
                let content = cellMatch[1].replace(/<[^>]*>/g, '').trim();
                cells.push(content);
            }
            
            if (cells.length < 10) continue;
            
            const [timestamp, email, name, address, workArea, phone, availableDays, ssn, hasCar, hasLicense] = cells;
            
            if (!name || name === 'NaN') continue;
            
            applications.push({
                timestamp,
                email,
                name,
                address,
                workArea: workArea === 'NaN' ? '' : workArea,
                phone: formatPhone(phone),
                workingDays: parseWorkingDays(availableDays),
                ssn,
                hasCar: hasCar === 'Yes',
                hasLicense: hasLicense === 'Yes'
            });
        }
        
        console.log(`✅ ${applications.length} başvuru parse edildi`);
        
        // Sistemdeki sürücüleri getir
        const systemDrivers = await base44.entities.Driver.list();
        console.log(`💾 Sistemde ${systemDrivers.length} sürücü var`);
        
        const matched = [];
        const newDrivers = [];
        
        // Eşleştirme
        for (const app of applications) {
            const matchResult = findBestMatch(app.name, systemDrivers);
            
            if (matchResult) {
                matched.push({
                    application: app,
                    systemDriver: matchResult.driver,
                    matchScore: matchResult.score
                });
                console.log(`✓ "${app.name}" → "${matchResult.driver.name}" (%${(matchResult.score * 100).toFixed(0)})`);
            } else {
                newDrivers.push(app);
                console.log(`+ "${app.name}" - Yeni sürücü olarak eklenecek`);
            }
        }
        
        console.log(`\n📊 ÖZET:`);
        console.log(`  ✓ Eşleşen: ${matched.length}`);
        console.log(`  + Yeni: ${newDrivers.length}`);
        
        // Eşleşenleri güncelle
        let updatedCount = 0;
        for (const match of matched) {
            try {
                const updateData = {
                    phone: match.application.phone || match.systemDriver.phone,
                    address: match.application.address || match.systemDriver.address,
                    is_top_dasher: true, // Top Dasher yap
                    assignment_preferences: {
                        ...match.systemDriver.assignment_preferences,
                        working_days: match.application.workingDays
                    },
                    notes: (match.systemDriver.notes || '') + `\n\nBaşvuru: ${match.application.timestamp}\nEmail: ${match.application.email}\nÇalışma Alanı: ${match.application.workArea}`
                };
                
                await base44.entities.Driver.update(match.systemDriver.id, updateData);
                updatedCount++;
                console.log(`✅ Güncellendi: ${match.systemDriver.name}`);
            } catch (error) {
                console.error(`❌ ${match.systemDriver.name} güncellenemedi:`, error.message);
            }
        }
        
        // Yenileri ekle
        let addedCount = 0;
        for (const app of newDrivers) {
            try {
                await base44.entities.Driver.create({
                    name: app.name,
                    phone: app.phone,
                    address: app.address,
                    status: 'Aktif',
                    language: 'en',
                    is_top_dasher: true, // Top Dasher olarak ekle
                    assignment_preferences: {
                        max_orders_per_day: 5,
                        avg_orders_per_week: 25,
                        working_days: app.workingDays
                    },
                    notes: `Başvuru: ${app.timestamp}\nEmail: ${app.email}\nÇalışma Alanı: ${app.workArea}\nEhliyet: ${app.hasLicense ? 'Var' : 'Yok'}\nAraç: ${app.hasCar ? 'Var' : 'Yok'}`
                });
                addedCount++;
                console.log(`✅ Eklendi: ${app.name}`);
            } catch (error) {
                console.error(`❌ ${app.name} eklenemedi:`, error.message);
            }
        }
        
        return Response.json({
            success: true,
            message: `${updatedCount} sürücü güncellendi, ${addedCount} yeni sürücü eklendi!`,
            summary: {
                totalApplications: applications.length,
                matched: matched.length,
                updated: updatedCount,
                newDrivers: newDrivers.length,
                added: addedCount
            }
        });
        
    } catch (error) {
        console.error("Import hatası:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});