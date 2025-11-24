import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// 🔥 DOĞRU URL - parseAndUpdateDriverRules ile aynı HTML dosyası
const HTML_FILE_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/687922c274a70a2de1788cbe/2e8753107_surucu_bolgeleri_full.html';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        console.log("📥 HTML dosyası indiriliyor:", HTML_FILE_URL);
        const response = await fetch(HTML_FILE_URL);
        
        if (!response.ok) {
            return Response.json({ 
                error: `HTML dosyası indirilemedi: ${response.status}`,
                url: HTML_FILE_URL
            }, { status: 400 });
        }
        
        const htmlContent = await response.text();
        
        console.log("📋 HTML parse ediliyor...");
        console.log(`HTML boyutu: ${htmlContent.length} karakter`);
        
        // HTML'de <li class="item"> yapısını ara
        const itemRegex = /<li class="item">\s*<div class="name">(.*?)<\/div>\s*<div class="desc">(.*?)<\/div>\s*<\/li>/g;
        
        const driverStatusMap = new Map();
        let match;
        
        while ((match = itemRegex.exec(htmlContent)) !== null) {
            const name = match[1].trim();
            const desc = match[2].trim();
            
            // Geçersiz satırları atla
            if (!name || name === '' || name === 'NaN' || name.length < 2) {
                continue;
            }
            
            // ✅ DOĞRU MANTIK: "Pasif" yazmayan HERKES Aktif!
            let driverStatus = 'Aktif'; // default: Aktif
            
            if (desc && desc.toLowerCase().includes('pasif')) {
                driverStatus = 'Pasif';
            }
            
            driverStatusMap.set(name, driverStatus);
            console.log(`   ✓ ${name}: "${desc}" → ${driverStatus}`);
        }
        
        console.log(`\n✅ ${driverStatusMap.size} sürücü parse edildi`);
        
        if (driverStatusMap.size === 0) {
            return Response.json({ 
                error: 'HTML\'de geçerli sürücü bulunamadı',
                html_preview: htmlContent.substring(0, 500)
            }, { status: 400 });
        }
        
        const allDrivers = await base44.entities.Driver.list();
        console.log(`💾 Sistemde toplam ${allDrivers.length} sürücü var`);
        
        let updatedCount = 0;
        let notFoundInHTML = [];
        const statusCounts = { 'Aktif': 0, 'Pasif': 0, 'Değişmedi': 0 };
        
        for (const driver of allDrivers) {
            const htmlStatus = driverStatusMap.get(driver.name);
            
            if (!htmlStatus) {
                notFoundInHTML.push(driver.name);
                continue;
            }
            
            if (driver.status !== htmlStatus) {
                await base44.entities.Driver.update(driver.id, { status: htmlStatus });
                updatedCount++;
                statusCounts[htmlStatus]++;
                console.log(`✅ ${driver.name}: ${driver.status} → ${htmlStatus}`);
            } else {
                statusCounts['Değişmedi']++;
                console.log(`ℹ️ ${driver.name}: Zaten ${htmlStatus}`);
            }
        }
        
        console.log("\n📊 ÖZET:");
        console.log(`  Güncellenen: ${updatedCount}`);
        console.log(`  Aktif yapılan: ${statusCounts['Aktif']}`);
        console.log(`  Pasif yapılan: ${statusCounts['Pasif']}`);
        console.log(`  Değişmeden kalan: ${statusCounts['Değişmedi']}`);
        console.log(`  HTML'de bulunamayan: ${notFoundInHTML.length}`);
        
        return Response.json({
            success: true,
            message: `${updatedCount} sürücü güncellendi! (${statusCounts['Aktif']} Aktif, ${statusCounts['Pasif']} Pasif)`,
            updatedCount,
            statusCounts,
            notFoundInHTML: notFoundInHTML.length > 0 ? notFoundInHTML : undefined,
            totalDriversInSystem: allDrivers.length,
            totalDriversInHTML: driverStatusMap.size
        });

    } catch (error) {
        console.error("❌ Sürücü durumu güncelleme hatası:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});