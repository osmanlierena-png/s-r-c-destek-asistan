import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const VALID_PHONE_REGEX = /^\+1\d{10}$/;

        // Boşluk vs. temizleyip geçerli formata getirmeye çalış, olmazsa null yap
        const normalizePhone = (phone) => {
            if (!phone) return null;
            // \u202a (LTR embed), \u202c (PDF), \u200b (zero-width), \ufeff (BOM) + boşluk/parantez/tire
            const cleaned = phone.replace(/[\u202a\u202b\u202c\u202d\u202e\u200b\u200c\u200d\ufeff\s\(\)\-]/g, '').trim();
            if (VALID_PHONE_REGEX.test(cleaned)) return cleaned;
            return null;
        };

        // ===== 1. DRIVER ENTITY =====
        console.log('👥 Driver\'lar kontrol ediliyor...');
        const allDrivers = await base44.asServiceRole.entities.Driver.list('', 500);
        
        const driverResults = { trimmed: [], invalid: [], alreadyOk: 0 };

        for (const driver of allDrivers) {
            if (!driver.phone) continue;

            const normalized = normalizePhone(driver.phone);
            
            if (normalized === null) {
                // Kurtarılamaz — uyar ama silme (sürücü kaydı kritik)
                driverResults.invalid.push({ id: driver.id, name: driver.name, phone: driver.phone });
                console.warn(`🚨 Driver geçersiz numara (manuel düzeltme gerekli): ${driver.name} → "${driver.phone}"`);
            } else if (normalized !== driver.phone) {
                // Trim ile kurtarıldı — güncelle
                await base44.asServiceRole.entities.Driver.update(driver.id, { phone: normalized });
                driverResults.trimmed.push({ id: driver.id, name: driver.name, before: driver.phone, after: normalized });
                console.log(`✅ Driver trim edildi: ${driver.name} → "${driver.phone}" → "${normalized}"`);
            } else {
                driverResults.alreadyOk++;
            }
        }

        // ===== 2. DAILYORDER ENTITY =====
        console.log('\n📦 DailyOrder\'lar kontrol ediliyor...');
        const allOrders = await base44.asServiceRole.entities.DailyOrder.filter({
            driver_phone: { $ne: null }
        }, '', 1000);

        const orderResults = { trimmed: [], nulled: [], alreadyOk: 0 };

        for (const order of allOrders) {
            if (!order.driver_phone) continue;
            
            const normalized = normalizePhone(order.driver_phone);

            if (normalized === null) {
                await base44.asServiceRole.entities.DailyOrder.update(order.id, { driver_phone: null });
                orderResults.nulled.push({ id: order.id, ezcater_id: order.ezcater_order_id, driver: order.driver_name, phone: order.driver_phone });
                console.log(`🗑️ Order geçersiz numara silindi: ${order.ezcater_order_id} → "${order.driver_phone}"`);
            } else if (normalized !== order.driver_phone) {
                await base44.asServiceRole.entities.DailyOrder.update(order.id, { driver_phone: normalized });
                orderResults.trimmed.push({ id: order.id, ezcater_id: order.ezcater_order_id, before: order.driver_phone, after: normalized });
                console.log(`✅ Order trim edildi: ${order.ezcater_order_id} → "${order.driver_phone}" → "${normalized}"`);
            } else {
                orderResults.alreadyOk++;
            }
        }

        console.log('\n📊 ÖZET:');
        console.log(`Drivers: ${driverResults.trimmed.length} trim edildi, ${driverResults.invalid.length} manuel düzeltme gerekli, ${driverResults.alreadyOk} zaten temiz`);
        console.log(`Orders:  ${orderResults.trimmed.length} trim edildi, ${orderResults.nulled.length} silindi, ${orderResults.alreadyOk} zaten temiz`);

        return Response.json({
            success: true,
            drivers: {
                trimmed: driverResults.trimmed,
                needsManualFix: driverResults.invalid,
                alreadyOk: driverResults.alreadyOk
            },
            orders: {
                trimmed: orderResults.trimmed,
                nulled: orderResults.nulled,
                alreadyOk: orderResults.alreadyOk
            },
            summary: `Drivers: ${driverResults.trimmed.length} düzeltildi, ${driverResults.invalid.length} manuel gerekli | Orders: ${orderResults.trimmed.length} düzeltildi, ${orderResults.nulled.length} silindi`
        });

    } catch (error) {
        console.error('❌ Temizlik hatası:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});