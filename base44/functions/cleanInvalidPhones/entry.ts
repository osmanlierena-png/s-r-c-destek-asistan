import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Tüm siparişleri çek
        const allOrders = await base44.asServiceRole.entities.DailyOrder.filter({
            driver_phone: { $ne: null }
        }, '', 1000);

        console.log(`📊 Toplam ${allOrders.length} sipariş telefon numarasıyla bulundu`);

        const invalidOrders = [];

        // Geçersiz numaraları filtrele
        for (const order of allOrders) {
            const phone = order.driver_phone;
            
            if (!phone) continue;

            const isInvalid = 
                phone.toUpperCase().includes('MISSING') ||         // MISSING içerenler
                (!phone.startsWith('+1') && phone.startsWith('+')) ||  // ABD dışı (+57, +20, etc.)
                phone.includes(' ') ||                              // Boşluk içerenler (+1 (571) 429-1009)
                phone.includes('(') ||                              // Parantez içerenler
                phone.match(/^\+1[^0-9]/) ||                        // +1'den sonra rakam olmayanlar
                (phone.startsWith('+1') && phone.length < 12);      // Çok kısa ABD numaraları

            if (isInvalid) {
                invalidOrders.push({
                    id: order.id,
                    ezcater_order_id: order.ezcater_order_id,
                    driver_name: order.driver_name,
                    phone: phone
                });
            }
        }

        console.log(`🚨 ${invalidOrders.length} geçersiz telefon numarası bulundu:`);
        invalidOrders.forEach(o => console.log(`   - ${o.ezcater_order_id}: ${o.driver_name} → ${o.phone}`));

        if (invalidOrders.length === 0) {
            return Response.json({
                success: true,
                message: '✅ Tüm telefon numaraları geçerli!',
                cleaned: 0,
                invalid: []
            });
        }

        // Geçersizleri temizle
        let cleanedCount = 0;
        for (const order of invalidOrders) {
            try {
                await base44.asServiceRole.entities.DailyOrder.update(order.id, {
                    driver_phone: null
                });
                cleanedCount++;
            } catch (error) {
                console.error(`❌ ${order.ezcater_order_id} temizlenemedi:`, error.message);
            }
        }

        console.log(`✅ ${cleanedCount}/${invalidOrders.length} geçersiz numara temizlendi`);

        return Response.json({
            success: true,
            message: `${cleanedCount} geçersiz telefon numarası temizlendi`,
            cleaned: cleanedCount,
            invalid: invalidOrders
        });

    } catch (error) {
        console.error('❌ Temizlik hatası:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});