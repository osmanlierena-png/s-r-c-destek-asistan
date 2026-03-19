import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        const allDrivers = await base44.entities.Driver.list();
        
        // Telefonu olmayan Top Dasher'ları bul (muhtemelen parse sırasında yanlış oluşanlar)
        const toDelete = allDrivers.filter(d => 
            d.is_top_dasher && (!d.phone || d.phone.trim() === '' || d.phone === '+1')
        );
        
        console.log(`🗑️ ${toDelete.length} telefonsuz Top Dasher silinecek...`);
        
        let deletedCount = 0;
        
        for (const driver of toDelete) {
            try {
                await base44.entities.Driver.delete(driver.id);
                deletedCount++;
                console.log(`✅ Silindi: ${driver.name}`);
            } catch (error) {
                console.error(`❌ ${driver.name} silinemedi:`, error.message);
            }
        }
        
        const remaining = await base44.entities.Driver.list();
        
        return Response.json({
            success: true,
            message: `${deletedCount} şüpheli kayıt silindi!`,
            deletedCount,
            remaining: remaining.length,
            remainingWithPhone: remaining.filter(d => d.phone && d.phone.trim() !== '').length
        });

    } catch (error) {
        console.error("Silme hatası:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});