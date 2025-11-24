import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const HTML_FILE_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/687922c274a70a2de1788cbe/e29226a33_reel_active_daily_chains.html';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        console.log("📥 Chain history HTML indiriliyor...");
        const response = await fetch(HTML_FILE_URL);
        const htmlContent = await response.text();
        
        console.log("✅ HTML indirildi, parse başlıyor...");
        
        // tbody içeriğini bul
        const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) {
            return Response.json({ error: 'tbody bulunamadı' }, { status: 400 });
        }
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr>[\s\S]*?<\/tr>/g) || [];
        
        console.log(`📊 ${rows.length} chain kaydı bulundu`);
        
        // Sürücü bazında chainleri topla
        const driverChains = new Map();
        
        for (const row of rows) {
            const cells = [];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
            let cellMatch;
            
            while ((cellMatch = cellRegex.exec(row)) !== null) {
                let cellText = cellMatch[1]
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .trim();
                cells.push(cellText);
            }
            
            if (cells.length < 5) continue;
            
            const driverName = cells[0];
            const date = cells[1];
            const stops = parseInt(cells[2]);
            const chain = cells[3];
            const regionsStr = cells[4];
            
            const regions = regionsStr.split(',').map(r => r.trim()).filter(Boolean);
            
            const chainData = {
                date,
                stops,
                chain,
                regions
            };
            
            if (!driverChains.has(driverName)) {
                driverChains.set(driverName, []);
            }
            driverChains.get(driverName).push(chainData);
        }
        
        console.log(`✅ ${driverChains.size} sürücü için chain verisi parse edildi`);
        
        // Her sürücüye chain_history ekle
        let updatedCount = 0;
        const errors = [];
        
        for (const [driverName, chains] of driverChains.entries()) {
            try {
                // Sürücüyü bul
                const drivers = await base44.entities.Driver.filter({ name: driverName });
                
                if (drivers.length === 0) {
                    console.log(`⚠️ ${driverName} sistemde bulunamadı, atlanıyor...`);
                    errors.push({ name: driverName, error: 'Sürücü bulunamadı' });
                    continue;
                }
                
                const driver = drivers[0];
                
                // Chain history'yi güncelle
                await base44.entities.Driver.update(driver.id, {
                    chain_history: chains
                });
                
                updatedCount++;
                console.log(`✅ ${updatedCount}/${driverChains.size}: ${driverName} - ${chains.length} chain eklendi`);
                
            } catch (error) {
                console.error(`❌ ${driverName} güncellenemedi:`, error.message);
                errors.push({ name: driverName, error: error.message });
            }
        }
        
        return Response.json({
            success: true,
            message: `${updatedCount} sürücünün chain history'si güncellendi!`,
            updatedCount,
            totalDrivers: driverChains.size,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error("Chain import hatası:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});