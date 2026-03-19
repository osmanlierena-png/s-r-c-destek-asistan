
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Türkçe gün isimlerini İngilizce'ye çevir
const translateDays = (dayString) => {
    const dayMap = {
        'Pazartesi': 'Monday',
        'Salı': 'Tuesday',
        'Çarşamba': 'Wednesday',
        'Perşembe': 'Thursday',
        'Cuma': 'Friday',
        'Cumartesi': 'Saturday',
        'Pazar': 'Sunday',
        'Monday': 'Monday',
        'Tuesday': 'Tuesday',
        'Wednesday': 'Wednesday',
        'Thursday': 'Thursday',
        'Friday': 'Friday',
        'Saturday': 'Saturday',
        'Sunday': 'Sunday'
    };
    
    const days = dayString.split(',').map(d => d.trim());
    return days.map(d => dayMap[d] || d).filter(Boolean);
};

// Normalize et
const normalize = (name) => {
    return name.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '');
};

// 🔥 HAFIFLETILMIŞ - Sadece Basit Eşleştirme
const smartNameMatch = (formName, systemName) => {
    const formNorm = normalize(formName);
    const sysNorm = normalize(systemName);
    
    // 1. TAM EŞLEŞME
    if (formNorm === sysNorm) {
        return { match: true, score: 1.0, reason: 'Tam eşleşme' };
    }
    
    // 2. KELIME BAZLI KONTROLLER
    const formParts = formNorm.split(' ');
    const sysParts = sysNorm.split(' ');
    
    // 2a. SOYAD-AD ters kontrol
    if (formParts.length >= 2 && sysParts.length >= 2) {
        const formReversed = [formParts[formParts.length - 1], formParts[0]].join(' ');
        const sysReversed = [sysParts[sysParts.length - 1], sysParts[0]].join(' ');
        
        if (formNorm === sysReversed || formReversed === sysNorm) {
            return { match: true, score: 0.95, reason: 'Soyad-Ad ters eşleşme' };
        }
    }
    
    // 2b. İlk ve son kelime kontrolü
    const formFirst = formParts[0];
    const formLast = formParts[formParts.length - 1];
    const sysFirst = sysParts[0];
    const sysLast = sysParts[sysParts.length - 1];
    
    // İlk + son eşleşmesi
    if (formFirst === sysFirst && formLast === sysLast) {
        return { match: true, score: 0.9, reason: 'İlk ve son kelime eşleşme' };
    }
    
    // İlk kelime eşleşmesi (ters de kontrol et)
    if (formFirst === sysFirst || formFirst === sysLast) {
        return { match: true, score: 0.85, reason: 'İlk kelime eşleşme' };
    }
    
    // Son kelime eşleşmesi
    if (formLast === sysLast && formLast.length > 3) {
        return { match: true, score: 0.80, reason: 'Son kelime eşleşme' };
    }
    
    // 3. KISMI EŞLEŞME (biri diğerinin içinde)
    if (formNorm.includes(sysNorm) || sysNorm.includes(formNorm)) {
        return { match: true, score: 0.88, reason: 'Kısmi eşleşme' };
    }
    
    // 4. ORTAK KELİME SAYISI
    const commonWords = formParts.filter(w => sysParts.includes(w)).length;
    const totalWords = Math.max(formParts.length, sysParts.length);
    
    if (commonWords > 0) {
        const wordSimilarity = commonWords / totalWords;
        if (wordSimilarity >= 0.5) {
            return { 
                match: true, 
                score: 0.7 + wordSimilarity * 0.15, 
                reason: `${commonWords}/${totalWords} ortak kelime` 
            };
        }
    }
    
    return { match: false, score: 0, reason: 'Eşleşme yok' };
};

// En iyi eşleşmeyi bul (telefon + isim)
const findBestMatch = (formDriver, systemDrivers) => {
    let bestMatch = null;
    let bestResult = { score: 0 };
    
    for (const sysDriver of systemDrivers) {
        // İsimle eşleştir
        const nameResult = smartNameMatch(formDriver.fullName, sysDriver.name);
        
        // Telefon numarası kontrolü (bonus)
        const formPhoneLast10 = formDriver.phone.slice(-10);
        const sysPhoneLast10 = (sysDriver.phone || '').replace(/\D/g, '').slice(-10);
        const phoneMatch = formPhoneLast10 === sysPhoneLast10 && formPhoneLast10.length === 10;
        
        let finalScore = nameResult.score;
        let finalReason = nameResult.reason;
        
        // Telefon eşleşiyorsa bonus puan
        if (phoneMatch) {
            finalScore = Math.min(1.0, finalScore + 0.2);
            finalReason += ' + telefon eşleşmesi';
        }
        
        if (nameResult.match && finalScore > bestResult.score) {
            bestMatch = sysDriver;
            bestResult = { score: finalScore, reason: finalReason };
        }
    }
    
    // En az %65 benzerlik istiyoruz
    if (bestMatch && bestResult.score >= 0.65) {
        return { driver: bestMatch, ...bestResult };
    }
    
    return null;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        const { dryRun = true, formHtmlUrl } = await req.json();
        
        // URL kontrolü
        if (!formHtmlUrl) {
            return Response.json({ 
                success: false,
                error: 'Form HTML URL gerekli!' 
            }, { status: 400 });
        }
        
        console.log(`🔍 Form verileri ${dryRun ? 'ANALİZ EDİLİYOR' : 'GÜNCELLENİYOR'}...`);
        console.log(`📄 Form URL: ${formHtmlUrl}`);
        
        // HTML'i indir
        console.log("📥 HTML indiriliyor...");
        const response = await fetch(formHtmlUrl);
        const htmlContent = await response.text();
        console.log("✅ HTML indirme tamamlandı");
        
        // Tabloyu parse et
        const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) {
            return Response.json({ error: 'tbody bulunamadı' }, { status: 400 });
        }
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
        
        console.log(`📋 ${rows.length} satır bulundu`);
        
        const formData = [];
        
        // İlk satır başlık, 2. satır boş olabilir
        for (let i = 2; i < rows.length; i++) {
            const row = rows[i];
            
            // Her hücreyi çıkar
            const cells = [];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
            let cellMatch;
            
            while ((cellMatch = cellRegex.exec(row)) !== null) {
                // HTML tag'lerini temizle
                let content = cellMatch[1].replace(/<[^>]*>/g, '').trim();
                cells.push(content);
            }
            
            if (cells.length < 10) {
                continue;
            }
            
            const fullName = cells[2];
            const homeAddress = cells[3];
            const preferredArea = cells[4];
            const phone = cells[5];
            const workingDays = cells[6];
            
            if (!fullName || !phone) {
                continue;
            }
            
            formData.push({
                fullName: fullName,
                homeAddress: homeAddress,
                preferredArea: preferredArea,
                phone: phone.replace(/\D/g, ''),
                workingDays: translateDays(workingDays)
            });
        }
        
        console.log(`✅ ${formData.length} sürücü parse edildi`);
        
        // Sistemdeki sürücüleri getir
        console.log("📥 Sistem sürücüleri getiriliyor...");
        const systemDrivers = await base44.entities.Driver.list();
        console.log(`✅ Sistemde ${systemDrivers.length} sürücü var`);
        
        // Eşleştirme analizi
        console.log("🔍 Eşleştirme başlıyor...");
        const matched = [];
        const notFoundInSystem = [];
        
        for (const formDriver of formData) {
            const matchResult = findBestMatch(formDriver, systemDrivers);
            
            if (!matchResult) {
                notFoundInSystem.push(formDriver.fullName);
                console.log(`❌ "${formDriver.fullName}" - Eşleşme bulunamadı`);
                continue;
            }
            
            const systemDriver = matchResult.driver;
            console.log(`✅ "${formDriver.fullName}" → "${systemDriver.name}" (${matchResult.reason}, skor: ${(matchResult.score * 100).toFixed(0)}%)`);
            
            // Değişiklik kontrolü
            const changes = [];
            
            // Adres
            if (formDriver.homeAddress && formDriver.homeAddress !== systemDriver.address) {
                changes.push({
                    field: 'address',
                    current: systemDriver.address || 'YOK',
                    new: formDriver.homeAddress
                });
            }
            
            // Telefon
            const currentPhone = (systemDriver.phone || '').replace(/\D/g, '');
            if (formDriver.phone && formDriver.phone !== currentPhone) {
                changes.push({
                    field: 'phone',
                    current: systemDriver.phone || 'YOK',
                    new: '+1' + formDriver.phone
                });
            }
            
            // Çalışma günleri
            const currentDays = systemDriver.assignment_preferences?.working_days || [];
            const newDays = formDriver.workingDays;
            
            const daysChanged = JSON.stringify(currentDays.sort()) !== JSON.stringify(newDays.sort());
            if (daysChanged && newDays.length > 0) {
                changes.push({
                    field: 'working_days',
                    current: currentDays.join(', ') || 'YOK',
                    new: newDays.join(', ')
                });
            }
            
            // Tercih edilen bölge (notes'a eklenebilir)
            if (formDriver.preferredArea && formDriver.preferredArea.trim()) {
                const currentNote = systemDriver.notes || '';
                if (!currentNote.includes(formDriver.preferredArea)) {
                    changes.push({
                        field: 'preferred_area_note',
                        current: 'YOK',
                        new: formDriver.preferredArea
                    });
                }
            }
            
            matched.push({
                formName: formDriver.fullName,
                systemName: systemDriver.name,
                systemDriver: systemDriver,
                formData: formDriver,
                matchScore: matchResult.score,
                matchReason: matchResult.reason,
                changes: changes,
                hasChanges: changes.length > 0
            });
        }
        
        console.log(`\n📊 ANALİZ SONUCU:`);
        console.log(`   Form'da: ${formData.length}`);
        console.log(`   Eşleşen: ${matched.length}`);
        console.log(`   Değişiklik Olan: ${matched.filter(m => m.hasChanges).length}`);
        console.log(`   Sistemde Yok: ${notFoundInSystem.length}`);
        
        // RAPOR
        const report = {
            totalInForm: formData.length,
            matchedCount: matched.length,
            notFoundCount: notFoundInSystem.length,
            withChanges: matched.filter(m => m.hasChanges).length,
            matched: matched,
            notFoundInSystem: notFoundInSystem
        };
        
        // DRY RUN ise sadece raporu dön
        if (dryRun) {
            return Response.json({
                success: true,
                message: 'Analiz tamamlandı (Güncelleme yapılmadı)',
                dryRun: true,
                report: report
            });
        }
        
        // GERÇEK GÜNCELLEME
        console.log(`\n🔄 GÜNCELLEME BAŞLIYOR...`);
        
        let updatedCount = 0;
        const errors = [];
        
        for (const match of matched) {
            if (!match.hasChanges) continue;
            
            try {
                const updateData = {};
                
                for (const change of match.changes) {
                    if (change.field === 'address') {
                        updateData.address = change.new;
                    } else if (change.field === 'phone') {
                        updateData.phone = change.new;
                    } else if (change.field === 'working_days') {
                        updateData.assignment_preferences = {
                            ...match.systemDriver.assignment_preferences,
                            working_days: match.formData.workingDays
                        };
                    } else if (change.field === 'preferred_area_note') {
                        const oldNotes = match.systemDriver.notes || '';
                        const newNote = `Tercih Edilen Alan: ${change.new}`;
                        updateData.notes = oldNotes ? `${oldNotes}\n\n${newNote}` : newNote;
                    }
                }
                
                await base44.entities.Driver.update(match.systemDriver.id, updateData);
                updatedCount++;
                console.log(`✅ ${match.systemName} güncellendi`);
                
            } catch (error) {
                console.error(`❌ ${match.systemName} güncellenemedi:`, error.message);
                errors.push({ name: match.systemName, error: error.message });
            }
        }
        
        return Response.json({
            success: true,
            message: `${updatedCount} sürücü güncellendi`,
            dryRun: false,
            updatedCount: updatedCount,
            report: report,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("❌ Form güncelleme hatası:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});
