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
        
        // Her sürücüyü format'la
        const formatted = allDrivers.map(d => ({
            id: d.id,
            name: d.name,
            phone: d.phone || '',
            status: d.status || 'Bilinmiyor',
            language: d.language || '',
            is_top_dasher: d.is_top_dasher ? 'Evet' : 'Hayır',
            is_joker_driver: d.is_joker_driver ? 'Evet' : 'Hayır',
            preferred_shift: d.preferred_shift || 'all_day',
            max_orders_per_day: d.assignment_preferences?.max_orders_per_day || 5,
            working_days: (d.assignment_preferences?.working_days || []).join(', '),
            early_morning_eligible: d.early_morning_eligible ? 'Evet' : 'Hayır',
            avoid_dc: d.special_notes?.avoid_dc ? 'Evet' : 'Hayır',
            avoid_long_distance: d.special_notes?.avoid_long_distance ? 'Evet' : 'Hayır',
            priority_level: d.special_notes?.priority_level || 0,
            created_date: new Date(d.created_date).toLocaleDateString('tr-TR'),
        }));
        
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