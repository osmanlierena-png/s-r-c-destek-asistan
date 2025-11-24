import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('\n🚀 BÖLGE ÖNCELİKLERİ TOPLU GÜNCELLEME\n');
        
        // 🎯 MANUEL BÖLGE ÖNCELİK VERİLERİ (Ersad kaldırıldı - DC çok geniş)
        const driverPriorities = [
            {
                name: 'Akram Khan',
                priorities: {
                    'fredericksburg': 1,
                    'stafford': 1
                }
            },
            {
                name: 'Giyaseddin Dayi',
                priorities: {
                    'fredericksburg': 2,
                    'stafford': 2
                }
            },
            {
                name: 'Kamran Ejaz',
                priorities: {
                    'fredericksburg': 3
                }
            },
            {
                name: 'Jose Beltrain',
                priorities: {
                    'frederick': 1  // Not: Frederick, MD (farklı şehir)
                }
            },
            {
                name: 'Victor Nunes',
                priorities: {
                    'bethesda': 1,
                    'rockville': 1,
                    'silver spring': 1,
                    'gaithersburg': 1
                }
            }
            // Ersad Alp kaldırıldı - DC çok geniş tanım, sabah 1. öncelik yeterli
        ];
        
        let successCount = 0;
        let failCount = 0;
        const results = [];
        
        for (const driverData of driverPriorities) {
            console.log(`\n👤 İşleniyor: ${driverData.name}`);
            
            try {
                // Sürücüyü bul (isim eşleşmesi - case insensitive)
                const allDrivers = await base44.asServiceRole.entities.Driver.list();
                const driver = allDrivers.find(d => 
                    d.name.toLowerCase().includes(driverData.name.toLowerCase()) ||
                    driverData.name.toLowerCase().includes(d.name.toLowerCase())
                );
                
                if (!driver) {
                    console.log(`❌ Sürücü bulunamadı: ${driverData.name}`);
                    failCount++;
                    results.push({
                        name: driverData.name,
                        status: 'not_found',
                        message: 'Sürücü database\'de bulunamadı'
                    });
                    continue;
                }
                
                console.log(`✅ Sürücü bulundu: ${driver.name} (ID: ${driver.id})`);
                
                // Mevcut special_notes'u al
                const existingNotes = driver.special_notes || {};
                
                // region_priorities'i güncelle
                const updatedNotes = {
                    ...existingNotes,
                    region_priorities: driverData.priorities
                };
                
                console.log(`📍 Eklenen öncelikler:`);
                Object.entries(driverData.priorities).forEach(([region, priority]) => {
                    console.log(`   • ${region}: ${priority}. öncelik`);
                });
                
                // Database'e kaydet
                await base44.asServiceRole.entities.Driver.update(driver.id, {
                    special_notes: updatedNotes
                });
                
                console.log(`✅ Kaydedildi!`);
                
                successCount++;
                results.push({
                    name: driver.name,
                    status: 'success',
                    priorities: driverData.priorities,
                    priorityCount: Object.keys(driverData.priorities).length
                });
                
            } catch (error) {
                console.error(`❌ ${driverData.name} için hata:`, error.message);
                failCount++;
                results.push({
                    name: driverData.name,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        console.log(`\n\n✅ GÜNCELLEME TAMAMLANDI!`);
        console.log(`   Başarılı: ${successCount}`);
        console.log(`   Başarısız: ${failCount}`);
        console.log(`   Toplam: ${driverPriorities.length}`);
        
        return Response.json({
            success: true,
            message: `${successCount}/${driverPriorities.length} sürücü güncellendi`,
            successCount,
            failCount,
            total: driverPriorities.length,
            results
        });

    } catch (error) {
        console.error("❌ TOPLU GÜNCELLEME HATASI:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});