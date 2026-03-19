import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { coordinates } = await req.json();
        
        // coordinates format: [{ order_id, pickup_coords?, dropoff_coords? }]
        
        let successCount = 0;
        let failCount = 0;
        
        for (const coord of coordinates) {
            try {
                const orders = await base44.entities.DailyOrder.list();
                const order = orders.find(o => o.ezcater_order_id === coord.order_id);
                
                if (!order) {
                    console.log(`❌ ${coord.order_id} bulunamadı`);
                    failCount++;
                    continue;
                }
                
                const updateData = {};
                if (coord.pickup_coords) updateData.pickup_coords = coord.pickup_coords;
                if (coord.dropoff_coords) updateData.dropoff_coords = coord.dropoff_coords;
                
                await base44.entities.DailyOrder.update(order.id, updateData);
                console.log(`✅ ${coord.order_id} güncellendi`);
                successCount++;
                
            } catch (error) {
                console.error(`❌ ${coord.order_id} hatası:`, error.message);
                failCount++;
            }
        }
        
        return Response.json({
            success: true,
            message: `${successCount} sipariş güncellendi`,
            successful: successCount,
            failed: failCount
        });
        
    } catch (error) {
        console.error('Manuel koordinat ekleme hatası:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});