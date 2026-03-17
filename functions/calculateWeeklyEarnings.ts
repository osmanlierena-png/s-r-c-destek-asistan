import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const forceRecalculate = body.force_recalculate === true;

    let weekStart, weekEnd;

    if (body.week_start && body.week_end) {
        weekStart = body.week_start;
        weekEnd = body.week_end;
    } else {
        // Bir önceki haftayı hesapla (Pazartesi - Pazar, EST)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
        const diffToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - diffToLastMonday);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);

        weekStart = lastMonday.toISOString().split('T')[0];
        weekEnd = lastSunday.toISOString().split('T')[0];
    }

    console.log(`📅 Hafta hesaplanıyor: ${weekStart} - ${weekEnd}`);

    // Tamamlanmış sayılacak statüslerdeki tüm siparişleri çek
    const completedStatuses = ['Tamamlandı', 'Sürücü Onayladı', 'Yolda'];
    const allOrdersRaw = await base44.asServiceRole.entities.DailyOrder.list();
    const allOrders = allOrdersRaw.filter(o => completedStatuses.includes(o.status));

    // Hafta filtresi + canvas_price > 0
    // force_recalculate modunda weekly_summary_id dolu olanları da dahil et
    const weekOrders = allOrders.filter(order => {
        if (!forceRecalculate && order.weekly_summary_id) return false; // zaten özetlenmiş

        if (!order.canvas_price || order.canvas_price <= 0) {
            console.warn(`⚠️ canvas_price eksik/sıfır: ${order.ezcater_order_id}`);
            return false;
        }

        const orderDate = order.order_date;
        if (!orderDate) return false;

        return orderDate >= weekStart && orderDate <= weekEnd;
    });

    console.log(`🔁 Force recalculate: ${forceRecalculate}`);

    console.log(`📦 Uygun sipariş sayısı: ${weekOrders.length}`);

    if (weekOrders.length === 0) {
        return Response.json({
            success: true,
            message: 'Bu hafta için özetlenecek sipariş bulunamadı.',
            week: { weekStart, weekEnd },
            summaries_created: 0
        });
    }

    // Sürücülere göre grupla
    const driverGroups = {};
    for (const order of weekOrders) {
        const driverId = order.driver_id;
        if (!driverId) continue;

        if (!driverGroups[driverId]) {
            driverGroups[driverId] = {
                driver_id: driverId,
                driver_name: order.driver_name || 'Bilinmiyor',
                orders: []
            };
        }
        driverGroups[driverId].orders.push(order);
    }

    const results = [];
    const errors = [];

    for (const driverId of Object.keys(driverGroups)) {
        const group = driverGroups[driverId];
        const totalCanvasPrice = group.orders.reduce((sum, o) => sum + (o.canvas_price || 0), 0);
        const orderCount = group.orders.length;

        try {
            // Bu sürücü + bu hafta için mevcut özet var mı?
            const existing = await base44.asServiceRole.entities.DriverWeeklySummary.filter({
                driver_id: driverId,
                week_start_date: weekStart
            });

            let summaryId;

            if (existing.length > 0) {
                // Mevcut özeti güncelle (force modunda sıfırdan yaz)
                await base44.asServiceRole.entities.DriverWeeklySummary.update(existing[0].id, {
                    total_canvas_price: forceRecalculate ? totalCanvasPrice : (existing[0].total_canvas_price || 0) + totalCanvasPrice,
                    order_count: forceRecalculate ? orderCount : (existing[0].order_count || 0) + orderCount
                });
                summaryId = existing[0].id;
                console.log(`🔄 Güncellendi: ${group.driver_name} - $${totalCanvasPrice}`);
            } else {
                // Yeni özet oluştur
                const created = await base44.asServiceRole.entities.DriverWeeklySummary.create({
                    driver_id: driverId,
                    driver_name: group.driver_name,
                    week_start_date: weekStart,
                    week_end_date: weekEnd,
                    total_canvas_price: totalCanvasPrice,
                    order_count: orderCount,
                    status: 'Hesaplandı'
                });
                summaryId = created.id;
                console.log(`✅ Oluşturuldu: ${group.driver_name} - $${totalCanvasPrice}`);
            }

            // Siparişleri weekly_summary_id ile işaretle (çift sayım önleme)
            for (const order of group.orders) {
                await base44.asServiceRole.entities.DailyOrder.update(order.id, {
                    weekly_summary_id: summaryId
                });
            }

            results.push({
                driver_name: group.driver_name,
                order_count: orderCount,
                total_canvas_price: totalCanvasPrice,
                summary_id: summaryId
            });

        } catch (err) {
            console.error(`❌ Hata: ${group.driver_name} - ${err.message}`);
            errors.push({ driver_name: group.driver_name, error: err.message });
        }
    }

    return Response.json({
        success: true,
        week: { weekStart, weekEnd },
        summaries_created: results.length,
        total_orders_processed: weekOrders.length,
        results,
        errors
    });
});