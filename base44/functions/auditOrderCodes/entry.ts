import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Order Code Denetim Fonksiyonu
 * Tüm DailyOrder kayıtlarını tarar ve ezcater_order_id anomalilerini raporlar:
 * 1. Boş/null order ID
 * 2. Sahte SS-prefixed ID (parseOrderScreenshot fallback'inden)
 * 3. Duplicate (tekrarlı) order ID
 * 4. Malformed (EzCater formatına uymayan) order ID
 */

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('🔍 Order kod denetimi başlıyor...');

        const allOrders = await base44.asServiceRole.entities.DailyOrder.list('', 2000);
        console.log(`📊 Toplam ${allOrders.length} sipariş taranıyor`);

        const empty = [];        // Boş/null ID
        const fakeSS = [];       // Sahte SS-prefixed ID
        const duplicates = [];   // Tekrarlı ID
        const malformed = [];    // Format dışı ID

        const idCountMap = {};   // duplicate tespiti için

        // EzCater order ID: "Ez" veya "RH" prefix + alfanumerik (örn: EzX4550V, RHTJ4A2Z)
        // Sahte SS fallback: SS<timestamp>_<index>
        // Bariz bozuk: 3 karakterden kısa veya özel karakter içeren
        const SS_FAKE_PATTERN = /^SS\d+_\d+$/;
        const VALID_ID_PATTERN = /^[A-Za-z0-9]{4,15}$/;

        for (const order of allOrders) {
            const id = order.ezcater_order_id;

            // 1. Boş/null
            if (!id || String(id).trim() === '') {
                empty.push({
                    id: order.id,
                    order_date: order.order_date,
                    customer_name: order.customer_name,
                    pickup_address: order.pickup_address
                });
                continue;
            }

            const trimmedId = String(id).trim();

            // 2. Sahte SS-prefixed (parseOrderScreenshot fallback)
            if (SS_FAKE_PATTERN.test(trimmedId)) {
                fakeSS.push({
                    id: order.id,
                    ezcater_order_id: trimmedId,
                    order_date: order.order_date,
                    customer_name: order.customer_name,
                    pickup_address: order.pickup_address,
                    dropoff_address: order.dropoff_address
                });
            }

            // 3. Duplicate sayımı
            idCountMap[trimmedId] = (idCountMap[trimmedId] || 0) + 1;

            // 4. Malformed (bariz bozuk: çok kısa, özel karakter içeren)
            if (!VALID_ID_PATTERN.test(trimmedId) && !SS_FAKE_PATTERN.test(trimmedId)) {
                malformed.push({
                    id: order.id,
                    ezcater_order_id: trimmedId,
                    order_date: order.order_date,
                    customer_name: order.customer_name
                });
            }
        }

        // Duplicate'leri çıkar (2+ kez geçen ID'ler)
        for (const [orderId, count] of Object.entries(idCountMap)) {
            if (count > 1) {
                const matchingOrders = allOrders.filter(o => String(o.ezcater_order_id || '').trim() === orderId);
                duplicates.push({
                    ezcater_order_id: orderId,
                    count: count,
                    order_ids: matchingOrders.map(o => ({
                        id: o.id,
                        order_date: o.order_date,
                        status: o.status,
                        driver_name: o.driver_name
                    }))
                });
            }
        }

        const totalIssues = empty.length + fakeSS.length + duplicates.length + malformed.length;

        console.log('\n📊 DENETİM RAPORU:');
        console.log(`  🔴 Boş/null ID:        ${empty.length}`);
        console.log(`  🟠 Sahte SS ID:        ${fakeSS.length}`);
        console.log(`  🟡 Tekrarlı ID:        ${duplicates.length} (${duplicates.reduce((s, d) => s + d.count, 0)} kayıt)`);
        console.log(`  🟣 Format dışı ID:     ${malformed.length}`);
        console.log(`  ─────────────────────────────`);
        console.log(`  Toplam sorunlu kayıt: ${totalIssues}`);

        return Response.json({
            success: true,
            total_scanned: allOrders.length,
            issues: {
                empty,
                fakeSS,
                duplicates,
                malformed
            },
            summary: {
                empty_count: empty.length,
                fakeSS_count: fakeSS.length,
                duplicate_count: duplicates.length,
                malformed_count: malformed.length,
                total_issues: totalIssues
            },
            root_cause: fakeSS.length > 0
                ? 'parseOrderScreenshot fonksiyonu order_no boş gelirse SS<timestamp>_<index> sahte ID üretiyor. order_no şemada required değil.'
                : null
        });

    } catch (error) {
        console.error('❌ Denetim hatası:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});