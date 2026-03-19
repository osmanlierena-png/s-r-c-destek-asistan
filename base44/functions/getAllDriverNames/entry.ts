import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Tüm driver'ları çek
        const allDrivers = await base44.asServiceRole.entities.Driver.filter({}, 'name', 500);
        
        console.log(`📊 Toplam ${allDrivers.length} driver bulundu`);
        
        // İsim ve telefon listesi
        const driverList = allDrivers.map(d => ({
            name: d.name,
            phone: d.phone || 'YOK',
            status: d.status,
            is_top_dasher: d.is_top_dasher || false
        }));
        
        // CSV formatı
        let csvContent = 'Name,Phone,Status,TopDasher\n';
        driverList.forEach(d => {
            csvContent += `"${d.name}","${d.phone}","${d.status}",${d.is_top_dasher}\n`;
        });
        
        // Sadece isimler (Canvas için)
        const justNames = allDrivers.map(d => d.name).join('\n');
        
        return Response.json({
            success: true,
            total: allDrivers.length,
            drivers: driverList,
            csv: csvContent,
            namesOnly: justNames
        });

    } catch (error) {
        console.error('❌ Driver listesi hatası:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});