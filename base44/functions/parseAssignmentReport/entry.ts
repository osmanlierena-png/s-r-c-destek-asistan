import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { file_url } = await req.json();
        
        console.log("📂 Dosya indiriliyor:", file_url);
        const response = await fetch(file_url);
        const content = await response.text();
        
        console.log(`✅ İndirildi (${content.length} karakter)`);
        
        // Dosya tipini belirle
        const isCSV = file_url.toLowerCase().endsWith('.csv') || content.includes(',');
        const isHTML = content.includes('<table') || content.includes('<tbody');
        
        console.log(`📋 Format: ${isCSV ? 'CSV' : isHTML ? 'HTML' : 'UNKNOWN'}`);
        
        let assignments = [];
        
        if (isCSV) {
            // CSV PARSER
            console.log("🔍 CSV parse ediliyor...\n");
            
            const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
            console.log(`📊 ${lines.length} satır bulundu`);
            
            if (lines.length === 0) {
                return Response.json({
                    success: false,
                    error: 'CSV dosyası boş'
                });
            }
            
            // İlk 3 satırı logla
            console.log("\n=== İLK 3 SATIR ===");
            lines.slice(0, 3).forEach((line, i) => {
                console.log(`${i}: ${line}`);
            });
            console.log("===================\n");
            
            // Header'ı bul
            let headerIndex = 0;
            for (let i = 0; i < Math.min(3, lines.length); i++) {
                const line = lines[i].toLowerCase();
                if (line.includes('order') || line.includes('driver') || line.includes('pickup')) {
                    headerIndex = i;
                    console.log(`✅ Header satırı: ${i}`);
                    break;
                }
            }
            
            const headers = lines[headerIndex].split(',').map(h => h.trim());
            console.log(`📋 Kolonlar (${headers.length}):`);
            headers.forEach((h, i) => console.log(`  [${i}] ${h}`));
            
            // Kolon indekslerini bul
            const findColumnIndex = (keywords) => {
                for (let i = 0; i < headers.length; i++) {
                    const header = headers[i].toLowerCase();
                    for (const keyword of keywords) {
                        if (header.includes(keyword.toLowerCase())) {
                            return i;
                        }
                    }
                }
                return -1;
            };
            
            const orderIdx = findColumnIndex(['order', 'sipariş', 'id']);
            const driverIdx = findColumnIndex(['driver', 'sürücü']);
            const pickupAddrIdx = findColumnIndex(['pickup address', 'pickup location', 'alış', 'pickup']);
            const dropoffAddrIdx = findColumnIndex(['dropoff address', 'delivery address', 'teslim', 'dropoff', 'delivery']);
            const pickupTimeIdx = findColumnIndex(['pickup time', 'alış saati']);
            const dropoffTimeIdx = findColumnIndex(['dropoff time', 'delivery time', 'teslim saati']);
            
            console.log(`\n🎯 Kolon eşleştirmeleri:`);
            console.log(`  Order: ${orderIdx} (${headers[orderIdx] || 'YOK'})`);
            console.log(`  Driver: ${driverIdx} (${headers[driverIdx] || 'YOK'})`);
            console.log(`  Pickup Address: ${pickupAddrIdx} (${headers[pickupAddrIdx] || 'YOK'})`);
            console.log(`  Dropoff Address: ${dropoffAddrIdx} (${headers[dropoffAddrIdx] || 'YOK'})`);
            console.log(`  Pickup Time: ${pickupTimeIdx} (${headers[pickupTimeIdx] || 'YOK'})`);
            console.log(`  Dropoff Time: ${dropoffTimeIdx} (${headers[dropoffTimeIdx] || 'YOK'})`);
            
            if (orderIdx === -1 || driverIdx === -1) {
                return Response.json({
                    success: false,
                    error: 'CSV\'de Order veya Driver kolonu bulunamadı',
                    headers: headers
                });
            }
            
            // Data satırlarını parse et
            console.log(`\n📦 Parse başlıyor (satır ${headerIndex + 1} - ${lines.length})...\n`);
            
            for (let i = headerIndex + 1; i < lines.length; i++) {
                const line = lines[i];
                
                // CSV satırını doğru şekilde parse et (virgüllü değerleri handle et)
                const cells = [];
                let currentCell = '';
                let inQuotes = false;
                
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        cells.push(currentCell.trim());
                        currentCell = '';
                    } else {
                        currentCell += char;
                    }
                }
                cells.push(currentCell.trim());
                
                // İlk 3 data satırını logla
                if (i <= headerIndex + 3) {
                    console.log(`Satır ${i} (${cells.length} kolon):`);
                    cells.forEach((cell, idx) => {
                        console.log(`  [${idx}] ${cell}`);
                    });
                    console.log('');
                }
                
                const orderNo = cells[orderIdx];
                const driverName = cells[driverIdx];
                
                if (!orderNo || !driverName || orderNo === 'NaN') {
                    if (i <= headerIndex + 5) {
                        console.log(`⏭️ Satır ${i} atlandı: Order="${orderNo}" Driver="${driverName}"\n`);
                    }
                    continue;
                }
                
                const assignment = {
                    order_id: orderNo,
                    driver_name: driverName,
                    pickup_address: pickupAddrIdx !== -1 ? cells[pickupAddrIdx] : '',
                    dropoff_address: dropoffAddrIdx !== -1 ? cells[dropoffAddrIdx] : '',
                    pickup_time: pickupTimeIdx !== -1 ? cells[pickupTimeIdx] : '',
                    dropoff_time: dropoffTimeIdx !== -1 ? cells[dropoffTimeIdx] : ''
                };
                
                if (i <= headerIndex + 5) {
                    console.log(`✅ Satır ${i} parse edildi:`);
                    console.log(`   Order: ${assignment.order_id}`);
                    console.log(`   Driver: ${assignment.driver_name}`);
                    console.log(`   Pickup: ${assignment.pickup_time} - ${assignment.pickup_address}`);
                    console.log(`   Dropoff: ${assignment.dropoff_time} - ${assignment.dropoff_address}\n`);
                }
                
                assignments.push(assignment);
            }
            
        } else if (isHTML) {
            // HTML PARSER (mevcut kod)
            console.log("🔍 HTML parse ediliyor...\n");
            
            let tbodyMatch = content.match(/<tbody>([\s\S]*?)<\/tbody>/);
            
            if (!tbodyMatch) {
                const rows = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
                console.log(`📊 ${rows.length} <tr> tag bulundu`);
                
                if (rows.length === 0) {
                    return Response.json({ 
                        success: false,
                        error: 'HTML içinde tablo satırı bulunamadı'
                    });
                }
                
                tbodyMatch = [null, rows.join('')];
            }
            
            const tbodyContent = tbodyMatch[1];
            const rows = tbodyContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
            
            console.log(`📊 ${rows.length} satır bulundu`);
            
            // Header satırlarını atla
            let startIndex = 0;
            for (let i = 0; i < Math.min(5, rows.length); i++) {
                const row = rows[i];
                if (row.includes('Order No') || row.includes('#') || row.includes('NaN') || 
                    row.includes('Sipariş') || row.includes('Driver') || row.includes('Sürücü')) {
                    startIndex = i + 1;
                }
            }
            
            for (let i = startIndex; i < rows.length; i++) {
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
                        .replace(/\s+/g, ' ')
                        .trim();
                    cells.push(cellText);
                }
                
                if (cells.length < 6) continue;
                if (!cells[1] || cells[1] === 'NaN' || cells[1].includes('Order')) continue;
                
                const orderNo = cells[1];
                const deliveryDateTime = cells[2];
                const deliveryAddress = cells[3];
                const pickupLocation = cells[4];
                const driverName = cells[5];
                
                if (!orderNo || !driverName) continue;
                
                // Delivery time'ı parse et
                let deliveryTime = '';
                let pickupTime = '';
                
                if (deliveryDateTime) {
                    const timeMatch = deliveryDateTime.match(/(\d{1,2}):(\d{2})(:(\d{2}))?\s*(AM|PM)/i);
                    if (timeMatch) {
                        let hours = parseInt(timeMatch[1]);
                        const minutes = timeMatch[2];
                        const ampm = timeMatch[5].toUpperCase();
                        
                        if (ampm === 'PM' && hours !== 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        
                        deliveryTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
                        
                        let pickupHours = hours;
                        let pickupMinutes = parseInt(minutes) - 30;
                        
                        if (pickupMinutes < 0) {
                            pickupMinutes += 60;
                            pickupHours -= 1;
                        }
                        
                        if (pickupHours < 0) pickupHours = 0;
                        
                        pickupTime = `${pickupHours.toString().padStart(2, '0')}:${pickupMinutes.toString().padStart(2, '0')}`;
                    }
                }
                
                assignments.push({
                    order_id: orderNo,
                    driver_name: driverName,
                    pickup_time: pickupTime,
                    pickup_address: pickupLocation || '',
                    dropoff_time: deliveryTime,
                    dropoff_address: deliveryAddress || ''
                });
            }
        } else {
            return Response.json({
                success: false,
                error: 'Dosya formatı tanınmadı (HTML veya CSV olmalı)'
            });
        }
        
        console.log(`\n✅ TOPLAM ${assignments.length} atama parse edildi!`);
        
        if (assignments.length === 0) {
            return Response.json({
                success: false,
                error: 'Hiç sipariş parse edilemedi'
            });
        }
        
        return Response.json({
            success: true,
            assignments: assignments,
            total: assignments.length
        });

    } catch (error) {
        console.error("❌ Parse hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});