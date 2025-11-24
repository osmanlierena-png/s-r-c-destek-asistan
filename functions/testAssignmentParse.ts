import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { file_url } = await req.json();
        
        const logs = [];
        
        logs.push("🔍 Dosya indiriliyor: " + file_url);
        const response = await fetch(file_url);
        const htmlContent = await response.text();
        
        logs.push(`✅ İndirildi (${htmlContent.length} karakter)`);
        logs.push("\n=== HTML İÇERİĞİ İLK 1000 KARAKTER ===");
        logs.push(htmlContent.substring(0, 1000));
        
        // tbody bul
        const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) {
            logs.push("\n❌ tbody bulunamadı!");
            return Response.json({ success: false, logs });
        }
        
        logs.push("\n✅ tbody bulundu");
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
        
        logs.push(`\n📊 ${rows.length} satır bulundu`);
        
        if (rows.length > 0) {
            logs.push("\n=== İLK 3 SATIR ===");
            for (let i = 0; i < Math.min(3, rows.length); i++) {
                const row = rows[i];
                const cells = [];
                const cellMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
                
                for (const cellHtml of cellMatches) {
                    let cellText = cellHtml
                        .replace(/<td[^>]*>/, '')
                        .replace(/<\/td>/, '')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\n/g, ' ')
                        .trim();
                    cells.push(cellText);
                }
                
                logs.push(`\nSatır ${i}: ${cells.length} kolon`);
                cells.forEach((cell, idx) => {
                    logs.push(`  [${idx}] ${cell}`);
                });
            }
        }
        
        // Şimdi gerçek parse'ı dene
        logs.push("\n\n=== PARSE DENEMESI ===");
        
        let startIndex = 0;
        if (rows.length > 0) {
            const firstRow = rows[0];
            if (firstRow.includes('Order No') || firstRow.includes('#')) {
                startIndex = 1;
                logs.push("✓ Header satırı atlandı");
            }
        }
        
        const assignments = [];
        
        for (let i = startIndex; i < Math.min(startIndex + 5, rows.length); i++) {
            const row = rows[i];
            const cells = [];
            const cellMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
            
            for (const cellHtml of cellMatches) {
                let cellText = cellHtml
                    .replace(/<td[^>]*>/, '')
                    .replace(/<\/td>/, '')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\n/g, ' ')
                    .trim();
                cells.push(cellText);
            }
            
            if (cells.length < 6) {
                logs.push(`\nSatır ${i}: Atlandı (${cells.length} kolon, minimum 6 gerekli)`);
                continue;
            }
            
            if (cells[1] === 'NaN' || !cells[1] || cells[1].includes('Order No')) {
                logs.push(`\nSatır ${i}: Atlandı (NaN veya header)`);
                continue;
            }
            
            const orderNo = cells[1];
            const deliveryDateTime = cells[2];
            const deliveryAddress = cells[3];
            const pickupLocation = cells[4];
            const driverName = cells[5];
            
            logs.push(`\n✓ Satır ${i} Parse Edildi:`);
            logs.push(`  Order: ${orderNo}`);
            logs.push(`  Driver: ${driverName}`);
            logs.push(`  Pickup: ${pickupLocation}`);
            logs.push(`  Dropoff: ${deliveryAddress}`);
            logs.push(`  Time: ${deliveryDateTime}`);
            
            assignments.push({
                order_id: orderNo,
                driver_name: driverName,
                pickup_address: pickupLocation,
                dropoff_address: deliveryAddress
            });
        }
        
        logs.push(`\n\n✅ Toplam ${assignments.length} atama parse edildi`);
        
        return Response.json({
            success: true,
            logs,
            sample_assignments: assignments
        });

    } catch (error) {
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});