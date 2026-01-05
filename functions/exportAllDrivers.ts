import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Tüm sürücüleri çek (pagination yok, hepsini al)
        const allDrivers = await base44.asServiceRole.entities.Driver.list('', 10000);
        
        console.log(`📊 Toplam ${allDrivers.length} sürücü bulundu`);
        
        // Status'e göre ayır
        const aktif = allDrivers.filter(d => d.status === 'Aktif');
        const pasif = allDrivers.filter(d => d.status === 'Pasif');
        const izinli = allDrivers.filter(d => d.status === 'İzinli');
        
        // Sadece isimleri al
        const driverNames = allDrivers.map(d => d.name).sort();
        
        return Response.json({
            success: true,
            total: allDrivers.length,
            aktif: aktif.length,
            pasif: pasif.length,
            izinli: izinli.length,
            drivers: formatted,
        });

    } catch (error) {
        console.error('❌ Export hatası:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});