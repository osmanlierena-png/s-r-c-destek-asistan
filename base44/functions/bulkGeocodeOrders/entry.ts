import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const geocodeAddress = async (address) => {
    if (!address) return null;
    try {
        const clean = address
            .replace(/\\n/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean + ', USA')}&limit=1&countrycodes=us`,
            { headers: { 'User-Agent': 'BulkGeocode/1.0' } }
        );
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    return null;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        console.log(`\n🔄 ${targetDate} - TOPLU GEOCODİNG\n`);
        
        const allOrders = await base44.entities.DailyOrder.filter({ 
            order_date: targetDate 
        }, 'pickup_time', 500);
        
        const needsGeocode = allOrders.filter(o => 
            !o.pickup_coords || !o.dropoff_coords
        );
        
        if (needsGeocode.length === 0) {
            return Response.json({
                success: true,
                message: 'Tüm siparişler zaten koordinatlı!',
                processed: 0,
                successful: 0,
                failed: 0
            });
        }
        
        console.log(`📦 ${needsGeocode.length} sipariş işlenecek`);
        
        let successful = 0;
        let failed = 0;
        
        for (let i = 0; i < needsGeocode.length; i++) {
            const order = needsGeocode[i];
            
            console.log(`\n[${i+1}/${needsGeocode.length}] ${order.ezcater_order_id}`);
            
            let pickupCoords = order.pickup_coords;
            let dropoffCoords = order.dropoff_coords;
            
            // PICKUP GEOCODING
            if (!pickupCoords) {
                console.log(`  🔍 Pickup: ${order.pickup_address}`);
                pickupCoords = await geocodeAddress(order.pickup_address);
                
                if (pickupCoords) {
                    console.log(`  ✅ Pickup: ${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}`);
                } else {
                    console.log(`  ❌ Pickup geocoding başarısız`);
                }
                
                await new Promise(r => setTimeout(r, 1000));
            }
            
            // DROPOFF GEOCODING
            if (!dropoffCoords) {
                console.log(`  🔍 Dropoff: ${order.dropoff_address}`);
                dropoffCoords = await geocodeAddress(order.dropoff_address);
                
                if (dropoffCoords) {
                    console.log(`  ✅ Dropoff: ${dropoffCoords.lat.toFixed(4)}, ${dropoffCoords.lng.toFixed(4)}`);
                } else {
                    console.log(`  ❌ Dropoff geocoding başarısız`);
                }
                
                await new Promise(r => setTimeout(r, 1000));
            }
            
            // UPDATE DATABASE
            if (pickupCoords || dropoffCoords) {
                try {
                    const updateData = {};
                    if (pickupCoords) updateData.pickup_coords = pickupCoords;
                    if (dropoffCoords) updateData.dropoff_coords = dropoffCoords;
                    
                    await base44.entities.DailyOrder.update(order.id, updateData);
                    successful++;
                    console.log(`  💾 Database güncellendi`);
                } catch (error) {
                    failed++;
                    console.error(`  ⚠️ Database hatası: ${error.message}`);
                }
            } else {
                failed++;
            }
            
            // Rate limit (her 5 sipariş)
            if ((i + 1) % 5 === 0 && i < needsGeocode.length - 1) {
                console.log(`  ⏳ Kısa bekleme...`);
                await new Promise(r => setTimeout(r, 500));
            }
        }
        
        console.log(`\n📊 SONUÇ:`);
        console.log(`  ✅ Başarılı: ${successful}`);
        console.log(`  ❌ Başarısız: ${failed}`);
        
        return Response.json({
            success: true,
            message: `${successful} sipariş geocoding yapıldı`,
            processed: needsGeocode.length,
            successful,
            failed
        });
        
    } catch (error) {
        console.error('Toplu geocoding hatası:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});