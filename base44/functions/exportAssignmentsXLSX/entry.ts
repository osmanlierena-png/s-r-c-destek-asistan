import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        console.log(`📊 ${targetDate} için Excel raporu oluşturuluyor...`);
        
        // O tarihteki atanmış siparişleri al
        const assignments = await base44.entities.DailyOrder.filter({
            order_date: targetDate,
            status: 'Atandı'
        }, 'pickup_time');
        
        if (assignments.length === 0) {
            return Response.json({ 
                success: false, 
                error: 'Bu tarihte atanmış sipariş yok' 
            });
        }
        
        console.log(`✅ ${assignments.length} atanmış sipariş bulundu`);
        
        // Tüm Top Dasher'ları al
        const allDrivers = await base44.entities.Driver.list();
        const topDashers = allDrivers
            .filter(d => d.is_top_dasher && d.status === 'Aktif')
            .map(d => d.name)
            .sort();
        
        console.log(`👥 ${topDashers.length} Top Dasher bulundu`);
        
        // Sürücülere göre grupla
        const groupedByDriver = {};
        
        for (const order of assignments) {
            if (!groupedByDriver[order.driver_name]) {
                groupedByDriver[order.driver_name] = [];
            }
            groupedByDriver[order.driver_name].push(order);
        }
        
        // Pickup time'a göre sırala
        const parseTime = (timeStr) => {
            if (!timeStr) return 0;
            const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (!match) return 0;
            
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const period = match[3].toUpperCase();
            
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            
            return hours * 60 + minutes;
        };
        
        Object.keys(groupedByDriver).forEach(driverName => {
            groupedByDriver[driverName].sort((a, b) => 
                parseTime(a.pickup_time) - parseTime(b.pickup_time)
            );
        });
        
        // Excel verisi hazırla
        const excelData = [];
        
        Object.entries(groupedByDriver).forEach(([driverName, orders]) => {
            orders.forEach((order, index) => {
                excelData.push({
                    'Sürücü': driverName || '',
                    'Sıra': index + 1,
                    'Sipariş No': order.ezcater_order_id || '',
                    'Müşteri': order.customer_name || '',
                    'Pickup Saati': order.pickup_time || '',
                    'Pickup Adresi': order.pickup_address || '',
                    'Dropoff Saati': order.dropoff_time || '',
                    'Dropoff Adresi': order.dropoff_address || '',
                    'Notlar': order.ezcater_notes || ''
                });
            });
        });
        
        console.log(`📝 ${excelData.length} satır hazırlandı`);
        
        // Workbook oluştur
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // Sütun genişlikleri
        ws['!cols'] = [
            { wch: 25 }, // Sürücü
            { wch: 6 },  // Sıra
            { wch: 18 }, // Sipariş No
            { wch: 25 }, // Müşteri
            { wch: 15 }, // Pickup Saati
            { wch: 50 }, // Pickup Adresi
            { wch: 15 }, // Dropoff Saati
            { wch: 50 }, // Dropoff Adresi
            { wch: 30 }  // Notlar
        ];
        
        // Sheet'i ekle
        XLSX.utils.book_append_sheet(wb, ws, 'Atamalar');
        
        console.log('📦 Workbook oluşturuldu');
        
        // Excel buffer oluştur
        let excelBuffer;
        try {
            excelBuffer = XLSX.write(wb, { 
                type: 'buffer',
                bookType: 'xlsx'
            });
            console.log(`✅ Buffer oluşturuldu (${excelBuffer.length} bytes)`);
        } catch (writeError) {
            console.error('❌ XLSX.write hatası:', writeError);
            throw new Error(`XLSX yazma hatası: ${writeError.message}`);
        }
        
        // Response döndür
        return new Response(excelBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="atama_raporu_${targetDate}.xlsx"`,
                'Content-Length': excelBuffer.length.toString()
            }
        });

    } catch (error) {
        console.error("❌ XLSX export hatası:", error);
        console.error("Stack:", error.stack);
        
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack,
            details: error.toString()
        }, { status: 500 });
    }
});