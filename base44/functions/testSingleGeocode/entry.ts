import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { orderId } = await req.json();
        
        console.log(`\n🔍 TEK SİPARİŞ TEST: ${orderId}\n`);
        
        // Siparişi bul
        const orders = await base44.entities.DailyOrder.list();
        const order = orders.find(o => o.ezcater_order_id === orderId);
        
        if (!order) {
            return Response.json({
                success: false,
                error: 'Sipariş bulunamadı'
            });
        }
        
        console.log('📦 Mevcut Sipariş:');
        console.log(`   Pickup Address: ${order.pickup_address}`);
        console.log(`   Dropoff Address: ${order.dropoff_address}`);
        console.log(`   Pickup Coords: ${order.pickup_coords ? 'VAR' : 'YOK'}`);
        console.log(`   Dropoff Coords: ${order.dropoff_coords ? 'VAR' : 'YOK'}`);
        
        // PICKUP GEOCODING
        console.log('\n🔍 Pickup geocoding...');
        const pickupResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(order.pickup_address + ', USA')}&limit=1&countrycodes=us`,
            { headers: { 'User-Agent': 'TestGeocode/1.0' } }
        );
        
        const pickupData = await pickupResponse.json();
        console.log(`   Response: ${pickupData.length} sonuç`);
        
        let pickupCoords = null;
        if (pickupData && pickupData.length > 0) {
            pickupCoords = {
                lat: parseFloat(pickupData[0].lat),
                lng: parseFloat(pickupData[0].lon)
            };
            console.log(`   ✅ ${pickupCoords.lat}, ${pickupCoords.lng}`);
        } else {
            console.log(`   ❌ Bulunamadı`);
        }
        
        await new Promise(r => setTimeout(r, 1100));
        
        // DROPOFF GEOCODING
        console.log('\n🔍 Dropoff geocoding...');
        const dropoffResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(order.dropoff_address + ', USA')}&limit=1&countrycodes=us`,
            { headers: { 'User-Agent': 'TestGeocode/1.0' } }
        );
        
        const dropoffData = await dropoffResponse.json();
        console.log(`   Response: ${dropoffData.length} sonuç`);
        
        let dropoffCoords = null;
        if (dropoffData && dropoffData.length > 0) {
            dropoffCoords = {
                lat: parseFloat(dropoffData[0].lat),
                lng: parseFloat(dropoffData[0].lon)
            };
            console.log(`   ✅ ${dropoffCoords.lat}, ${dropoffCoords.lng}`);
        } else {
            console.log(`   ❌ Bulunamadı`);
        }
        
        // DATABASE UPDATE
        console.log('\n💾 Database güncelleniyor...');
        try {
            const updateData = {};
            if (pickupCoords) updateData.pickup_coords = pickupCoords;
            if (dropoffCoords) updateData.dropoff_coords = dropoffCoords;
            
            if (Object.keys(updateData).length > 0) {
                await base44.entities.DailyOrder.update(order.id, updateData);
                console.log(`   ✅ Güncellendi!`);
                
                // Verify
                const updated = await base44.entities.DailyOrder.get(order.id);
                console.log(`\n🔍 DOĞRULAMA:`);
                console.log(`   Pickup Coords: ${updated.pickup_coords ? '✅ VAR' : '❌ YOK'}`);
                console.log(`   Dropoff Coords: ${updated.dropoff_coords ? '✅ VAR' : '❌ YOK'}`);
                
                return Response.json({
                    success: true,
                    message: 'Test başarılı',
                    before: {
                        pickup_coords: order.pickup_coords,
                        dropoff_coords: order.dropoff_coords
                    },
                    after: {
                        pickup_coords: updated.pickup_coords,
                        dropoff_coords: updated.dropoff_coords
                    }
                });
            } else {
                return Response.json({
                    success: false,
                    error: 'Hiçbir koordinat bulunamadı'
                });
            }
        } catch (error) {
            console.error(`   ❌ Database hatası: ${error.message}`);
            return Response.json({
                success: false,
                error: `Database hatası: ${error.message}`
            });
        }
        
    } catch (error) {
        console.error('Test hatası:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});