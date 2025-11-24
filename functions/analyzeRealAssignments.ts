import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { file_url } = await req.json();
        
        console.log("📊 Gerçek atamalar parse ediliyor...");
        const response = await fetch(file_url);
        const htmlContent = await response.text();
        
        // HTML'den tabloyu parse et
        const tbodyMatch = htmlContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) {
            return Response.json({ error: 'tbody bulunamadı' }, { status: 400 });
        }
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
        
        console.log(`${rows.length} satır bulundu`);
        
        const assignments = [];
        let startIndex = 0;
        
        // Header satırlarını atla
        for (let i = 0; i < Math.min(3, rows.length); i++) {
            const row = rows[i];
            if (row.includes('Order No') || row.includes('#') || row.includes('NaN')) {
                startIndex = i + 1;
            }
        }
        
        console.log(`Parse başlangıç: satır ${startIndex}`);
        
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
                    .trim();
                cells.push(cellText);
            }
            
            // En az 6 kolon olmalı: #, Order No, Date, Delivery Addr, Pickup, Driver
            if (cells.length < 6) continue;
            
            const orderNo = cells[1];
            const deliveryDateTime = cells[2];
            const deliveryAddress = cells[3];
            const pickupLocation = cells[4];
            const driverName = cells[5];
            
            if (!orderNo || !driverName || orderNo === 'NaN') continue;
            
            // Delivery time'ı parse et
            let deliveryTime = '';
            if (deliveryDateTime) {
                const timeMatch = deliveryDateTime.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i);
                if (timeMatch) {
                    let hours = parseInt(timeMatch[1]);
                    const minutes = timeMatch[2];
                    const ampm = timeMatch[4].toUpperCase();
                    
                    if (ampm === 'PM' && hours !== 12) hours += 12;
                    if (ampm === 'AM' && hours === 12) hours = 0;
                    
                    deliveryTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
                }
            }
            
            assignments.push({
                order_id: orderNo,
                driver_name: driverName,
                delivery_time: deliveryTime,
                delivery_address: deliveryAddress,
                pickup_location: pickupLocation
            });
        }
        
        console.log(`✅ ${assignments.length} atama parse edildi`);
        
        // Sürücü bazında grupla
        const driverGroups = {};
        for (const assignment of assignments) {
            if (!driverGroups[assignment.driver_name]) {
                driverGroups[assignment.driver_name] = [];
            }
            driverGroups[assignment.driver_name].push(assignment);
        }
        
        // Her sürücünün siparişlerini delivery time'a göre sırala
        for (const driverName in driverGroups) {
            driverGroups[driverName].sort((a, b) => {
                const [aH, aM] = a.delivery_time.split(':').map(Number);
                const [bH, bM] = b.delivery_time.split(':').map(Number);
                return (aH * 60 + aM) - (bH * 60 + bM);
            });
        }
        
        // Zincir analizi
        const chains = [];
        for (const [driverName, orders] of Object.entries(driverGroups)) {
            if (orders.length > 1) {
                chains.push({
                    driver: driverName,
                    orders: orders.length,
                    times: orders.map(o => o.delivery_time).join(' → '),
                    order_ids: orders.map(o => o.order_id)
                });
            }
        }
        
        // İstatistikler
        const stats = {
            total_orders: assignments.length,
            total_drivers: Object.keys(driverGroups).length,
            drivers_with_chains: chains.length,
            avg_orders_per_driver: (assignments.length / Object.keys(driverGroups).length).toFixed(1),
            longest_chain: Math.max(...Object.values(driverGroups).map(g => g.length))
        };
        
        console.log(`\n📊 ANALİZ:`);
        console.log(`  Toplam Sipariş: ${stats.total_orders}`);
        console.log(`  Toplam Sürücü: ${stats.total_drivers}`);
        console.log(`  Zincirli Sürücü: ${stats.drivers_with_chains}`);
        console.log(`  En Uzun Zincir: ${stats.longest_chain} sipariş\n`);
        
        return Response.json({
            success: true,
            assignments,
            driver_groups: driverGroups,
            chains,
            stats
        });

    } catch (error) {
        console.error("Parse hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});