import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const HTML_FILE_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/687922c274a70a2de1788cbe/26c308ade_all_83_drivers_FOR_AI.html';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    const logs = []; // Logları buraya toplayacağız
    
    try {
        logs.push("🔍 HTML dosyası indiriliyor...");
        const response = await fetch(HTML_FILE_URL);
        const htmlContent = await response.text();
        
        logs.push("✅ HTML indirildi, parse başlıyor...\n");
        
        // tbody içeriğini bul
        const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) {
            return Response.json({ error: 'tbody bulunamadı', logs }, { status: 400 });
        }
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr>[\s\S]*?<\/tr>/g) || [];
        
        logs.push(`📊 Toplam ${rows.length} satır bulundu\n`);
        
        // İlk satırı detaylı incele
        if (rows.length > 0) {
            logs.push("=== İLK SATIR DETAYLI ANALİZ ===\n");
            
            const firstRow = rows[0];
            const cells = [];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
            let cellMatch;
            
            while ((cellMatch = cellRegex.exec(firstRow)) !== null) {
                let cellText = cellMatch[1]
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .trim();
                cells.push(cellText);
            }
            
            logs.push(`📋 Toplam ${cells.length} KOLON bulundu\n`);
            
            // Her kolonu numaralandırarak yazdır
            const columnDetails = [];
            cells.forEach((cell, index) => {
                columnDetails.push(`Kolon ${index}: "${cell}"`);
            });
            
            logs.push("\n=== TÜM KOLONLAR ===");
            logs.push(...columnDetails);
            
            logs.push("\n=== KOLON ANLAMLANDIRMA ===");
            logs.push(`0. Driver: ${cells[0]}`);
            logs.push(`1. Status: ${cells[1]}`);
            logs.push(`2. Total Orders: ${cells[2]}`);
            logs.push(`3. Workdays: ${cells[3]}`);
            logs.push(`4. Weeks Worked: ${cells[4]}`);
            logs.push(`5. Avg Orders: ${cells[5]}`);
            logs.push(`6. P90: ${cells[6]}`);
            logs.push(`7. Max Orders: ${cells[7]}`);
            logs.push(`8. Recommended Max: ${cells[8]}`);
            logs.push(`9. Usually Days: ${cells[9]}`);
            logs.push(`10. Region Tags: ${cells[10]}`);
            logs.push(`11. Notes: ${cells[11]}`);
            logs.push(`12. Early Morning Eligible: ${cells[12]}`);
            logs.push(`13. Early Morning Specialist: ${cells[13]}`);
            logs.push(`14. Assignment Score: ${cells[14]}`);
            logs.push(`15. Assignment Priority: ${cells[15]}`);
            if (cells[16]) logs.push(`16. ${cells[16]}`);
            if (cells[17]) logs.push(`17. ${cells[17]}`);
            if (cells[18]) logs.push(`18. ${cells[18]}`);
            if (cells[19]) logs.push(`19. ${cells[19]}`);
            if (cells[20]) logs.push(`20. ${cells[20]}`);
        }
        
        // İlk 5 sürücüyü parse et ve göster
        logs.push("\n\n=== İLK 5 SÜRÜCÜ PARSE SONUÇLARI ===\n");
        
        const sampleDrivers = [];
        
        for (let i = 0; i < Math.min(5, rows.length); i++) {
            const row = rows[i];
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
            
            if (cells.length < 12) {
                logs.push(`⚠️ Satır ${i}: Yetersiz kolon (${cells.length})`);
                continue;
            }
            
            const driverName = cells[0];
            const statusText = cells[1];
            const totalOrders = cells[2];
            const weeksWorked = cells[4];
            const maxOrders = cells[7];
            const recommendedMax = cells[8];
            const usuallyDays = cells[9];
            const regionTags = cells[10];
            const notes = cells[11];
            const earlyMorningEligible = cells[12];
            const earlyMorningSpecialist = cells[13];
            const assignmentScore = cells[14];
            const assignmentPriority = cells[15];
            
            // Günleri parse et
            const daysArray = usuallyDays
                .split(',')
                .map(d => d.trim())
                .filter(Boolean);
            
            // Bölgeleri parse et
            const regions = regionTags
                .split(',')
                .map(r => r.trim())
                .filter(Boolean);
            
            // Status çevir
            let driverStatus = 'Aktif';
            if (statusText.includes('Passive')) driverStatus = 'Pasif';
            else if (statusText.includes('not recent')) driverStatus = 'İzinli';
            
            // Recommended max
            let maxOrdersPerDay = parseFloat(recommendedMax);
            if (isNaN(maxOrdersPerDay)) {
                maxOrdersPerDay = parseInt(maxOrders) || 5;
            }
            
            // Haftalık ortalama
            const avgPerWeek = Math.round(
                parseFloat(totalOrders) / parseFloat(weeksWorked) || 0
            );
            
            const driverData = {
                name: driverName,
                status: driverStatus,
                working_days: daysArray,
                preferred_areas: regions,
                notes: notes === 'NaN' ? '' : notes,
                early_morning_eligible: earlyMorningEligible === 'Yes',
                early_morning_specialist: earlyMorningSpecialist === 'Yes',
                assignment_score: parseFloat(assignmentScore) || 0,
                assignment_priority: assignmentPriority || 'None',
                max_orders_per_day: maxOrdersPerDay,
                avg_orders_per_week: avgPerWeek
            };
            
            sampleDrivers.push(driverData);
            
            logs.push(`\n--- Sürücü ${i + 1}: ${driverName} ---`);
            logs.push(JSON.stringify(driverData, null, 2));
        }
        
        return Response.json({
            success: true,
            totalRows: rows.length,
            firstRowColumns: rows.length > 0 ? rows[0].match(/<td[^>]*>[\s\S]*?<\/td>/g).length : 0,
            sampleDrivers: sampleDrivers,
            logs: logs,
            message: "✅ Test tamamlandı!"
        });

    } catch (error) {
        logs.push(`❌ Test hatası: ${error.message}`);
        return Response.json({ 
            error: error.message,
            stack: error.stack,
            logs: logs
        }, { status: 500 });
    }
});