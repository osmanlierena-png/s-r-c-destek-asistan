import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        const allDrivers = await base44.entities.Driver.list();
        
        console.log(`\n📊 MEVCUT DURUM ANALİZİ:\n`);
        console.log(`Toplam sürücü: ${allDrivers.length}`);
        
        const withPhone = allDrivers.filter(d => d.phone && d.phone.trim() !== '');
        const withoutPhone = allDrivers.filter(d => !d.phone || d.phone.trim() === '');
        const topDashers = allDrivers.filter(d => d.is_top_dasher);
        const active = allDrivers.filter(d => d.status === 'Aktif');
        
        console.log(`\n✅ Telefonu olan: ${withPhone.length}`);
        console.log(`❌ Telefonu olmayan: ${withoutPhone.length}`);
        console.log(`⭐ Top Dasher: ${topDashers.length}`);
        console.log(`🟢 Aktif: ${active.length}`);
        
        // İsim duplicateleri kontrol et
        const nameCount = {};
        allDrivers.forEach(d => {
            const name = d.name;
            nameCount[name] = (nameCount[name] || 0) + 1;
        });
        
        const duplicates = Object.entries(nameCount)
            .filter(([name, count]) => count > 1)
            .map(([name, count]) => ({ name, count }));
        
        console.log(`\n🔁 Duplicate isimler: ${duplicates.length}`);
        if (duplicates.length > 0) {
            console.log('İlk 10 duplicate:');
            duplicates.slice(0, 10).forEach(d => {
                console.log(`   ${d.name}: ${d.count} adet`);
            });
        }
        
        // Telefonu olmayan ama Top Dasher olanlar (muhtemelen yeni yaratılanlar)
        const suspiciousNew = allDrivers.filter(d => 
            d.is_top_dasher && (!d.phone || d.phone.trim() === '')
        );
        
        console.log(`\n⚠️ Telefonsuz Top Dasher (muhtemelen YENİ): ${suspiciousNew.length}`);
        
        // Eski sürücüler (telefonu var ama artık atanmıyor mu?)
        const original = allDrivers.filter(d => 
            d.phone && d.phone.trim() !== '' && d.phone !== '+1'
        );
        
        console.log(`\n✅ ORİJİNAL sürücüler (telefonu var): ${original.length}`);
        console.log('İlk 10:');
        original.slice(0, 10).forEach(d => {
            console.log(`   ${d.name}: ${d.phone} (${d.status})`);
        });
        
        return Response.json({
            success: true,
            summary: {
                total: allDrivers.length,
                withPhone: withPhone.length,
                withoutPhone: withoutPhone.length,
                topDashers: topDashers.length,
                active: active.length,
                duplicates: duplicates.length,
                suspiciousNew: suspiciousNew.length,
                original: original.length
            },
            duplicates: duplicates,
            suspiciousNewDrivers: suspiciousNew.map(d => ({
                name: d.name,
                status: d.status,
                created_date: d.created_date
            })),
            originalDrivers: original.map(d => ({
                name: d.name,
                phone: d.phone,
                status: d.status,
                is_top_dasher: d.is_top_dasher
            }))
        });

    } catch (error) {
        console.error("Analiz hatası:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});