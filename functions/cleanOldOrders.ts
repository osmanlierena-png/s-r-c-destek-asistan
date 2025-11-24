import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

        console.log(`🗑️ ${cutoffDate} öncesi siparişler siliniyor...`);

        // Eski siparişleri çek
        const oldOrders = await base44.entities.DailyOrder.filter({
            order_date: { $lt: cutoffDate }
        }, 'order_date', 2000);

        console.log(`📊 ${oldOrders.length} eski sipariş bulundu`);

        if (oldOrders.length === 0) {
            return Response.json({
                success: true,
                message: 'Silinecek eski sipariş bulunamadı',
                deletedCount: 0
            });
        }

        let deletedCount = 0;
        let errorCount = 0;

        // Batch'ler halinde sil
        for (let i = 0; i < oldOrders.length; i++) {
            try {
                await base44.entities.DailyOrder.delete(oldOrders[i].id);
                deletedCount++;

                // Her 20 kayıtta bir log
                if ((i + 1) % 20 === 0) {
                    console.log(`🔄 ${i + 1}/${oldOrders.length} silindi`);
                    await new Promise(r => setTimeout(r, 200));
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ Silme hatası:`, error.message);
            }
        }

        return Response.json({
            success: true,
            message: `${deletedCount} eski sipariş silindi`,
            deletedCount,
            errorCount,
            totalFound: oldOrders.length
        });

    } catch (error) {
        console.error("Temizlik hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});