import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        // Tüm sürücüleri getir
        const allDrivers = await base44.entities.Driver.list();
        
        console.log(`${allDrivers.length} sürücü siliniyor...`);

        let deletedCount = 0;
        
        // Teker teker sil
        for (const driver of allDrivers) {
            try {
                await base44.entities.Driver.delete(driver.id);
                deletedCount++;
                console.log(`✅ Silindi: ${driver.name}`);
            } catch (error) {
                console.error(`❌ Silinemedi: ${driver.name}`, error);
            }
        }

        return Response.json({
            success: true,
            message: `${deletedCount} sürücü başarıyla silindi.`,
            deletedCount: deletedCount,
            totalDrivers: allDrivers.length
        });

    } catch (error) {
        console.error("Toplu silme hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});