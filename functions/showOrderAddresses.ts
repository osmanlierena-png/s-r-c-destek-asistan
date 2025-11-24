import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        const orders = await base44.entities.DailyOrder.filter({ 
            order_date: targetDate 
        }, 'pickup_time', 5);
        
        const samples = orders.map(o => ({
            order_id: o.ezcater_order_id,
            pickup_address: o.pickup_address,
            dropoff_address: o.dropoff_address,
            pickup_coords: o.pickup_coords,
            dropoff_coords: o.dropoff_coords
        }));
        
        console.log('\n📍 İLK 5 SİPARİŞ ADRESLERİ:\n');
        
        for (const s of samples) {
            console.log(`\n${s.order_id}:`);
            console.log(`  Pickup: "${s.pickup_address}"`);
            console.log(`  Dropoff: "${s.dropoff_address}"`);
            console.log(`  Pickup Coords: ${s.pickup_coords ? '✅ VAR' : '❌ YOK'}`);
            console.log(`  Dropoff Coords: ${s.dropoff_coords ? '✅ VAR' : '❌ YOK'}`);
        }
        
        return Response.json({
            success: true,
            samples
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});