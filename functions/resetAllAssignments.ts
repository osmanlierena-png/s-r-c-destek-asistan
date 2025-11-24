import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        const { targetDate } = await req.json();
        
        console.log(`🔄 ${targetDate} tarihindeki atamalar sıfırlanıyor...`);

        // Bu tarihteki atanmış siparişleri bul
        const assignedOrders = await base44.entities.DailyOrder.filter({ 
            order_date: targetDate,
            status: 'Atandı'
        }, 'pickup_time', 1000);

        console.log(`📊 ${assignedOrders.length} atanmış sipariş bulundu`);

        if (assignedOrders.length === 0) {
            return Response.json({
                success: true,
                message: 'Sıfırlanacak atama bulunamadı',
                resetCount: 0
            });
        }

        let resetCount = 0;
        let errorCount = 0;

        for (let i = 0; i < assignedOrders.length; i++) {
            try {
                await base44.entities.DailyOrder.update(assignedOrders[i].id, {
                    driver_id: null,
                    driver_name: null,
                    status: 'Çekildi'
                });
                resetCount++;

                if ((i + 1) % 10 === 0) {
                    console.log(`🔄 ${i + 1}/${assignedOrders.length} sıfırlandı`);
                    await new Promise(r => setTimeout(r, 200));
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ Sıfırlama hatası:`, error.message);
            }
        }

        return Response.json({
            success: true,
            message: `${resetCount} atama sıfırlandı`,
            resetCount,
            errorCount,
            totalFound: assignedOrders.length
        });

    } catch (error) {
        console.error("Sıfırlama hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});