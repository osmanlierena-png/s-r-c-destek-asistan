import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    let weekStart, weekEnd;

    if (body.week_start && body.week_end) {
        weekStart = body.week_start;
        weekEnd = body.week_end;
    } else {
        // Bir önceki haftayı hesapla (Pazartesi - Pazar)
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
    const allOrdersRaw = await base44.asServiceRole.entities.DailyOrder.list('-order_date', 2000);
    const allOrders = allOrdersRaw.filter(o => completedStatuses.includes(o.status));

    // Hafta filtresi + canvas_price > 0 — HER ZAMAN tüm siparişleri işle
    // (weekly_summary_id atlaması yok — her çalıştırmada sıfırdan hesapla)
    const weekOrders = allOrders.filter(order => {
        if (!order.canvas_price || order.canvas_price <= 0) {
            return false;
        }
        const orderDate = order.order_date;
        if (!orderDate) return false;
        return orderDate >= weekStart && orderDate <= weekEnd;
    });

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
    const deletedSummaries = [];

    for (const driverId of Object.keys(driverGroups)) {
        const group = driverGroups[driverId];
        const totalCanvasPrice = group.orders.reduce((sum, o) => sum + (o.canvas_price || 0), 0);
        const orderCount = group.orders.length;

        try {
            // Bu sürücünün TÜM özetlerini çek
            const allDriverSummaries = await base44.asServiceRole.entities.DriverWeeklySummary.filter({
                driver_id: driverId
            });

            // Bu haftanın siparişlerinin işaret ettiği özet ID'leri
            const weekSummaryIds = new Set(
                group.orders.map(o => o.weekly_summary_id).filter(Boolean)
            );

            // Doğru week_start_date'e sahip özet var mı?
            const correctSummary = allDriverSummaries.find(s => s.week_start_date === weekStart);

            let summaryId;
            let summaryToKeep;

            if (correctSummary) {
                summaryToKeep = correctSummary;
                summaryId = correctSummary.id;
            } else if (weekSummaryIds.size > 0) {
                // Yanlış week_start_date'li özet var — onu düzelt
                const oldSummary = allDriverSummaries.find(s => weekSummaryIds.has(s.id));
                if (oldSummary) {
                    summaryToKeep = oldSummary;
                    summaryId = oldSummary.id;
                }
            }

            // Diğer çift özetleri sil (bunların siparişleri yeniden işaretlenecek)
            const summariesToDelete = allDriverSummaries.filter(
                s => weekSummaryIds.has(s.id) && s.id !== summaryId
            );
            for (const s of summariesToDelete) {
                await base44.asServiceRole.entities.DriverWeeklySummary.delete(s.id);
                deletedSummaries.push({
                    driver: group.driver_name,
                    deleted_id: s.id,
                    old_week: s.week_start_date,
                    old_total: s.total_canvas_price
                });
            }

            if (summaryId) {
                // Mevcut özeti güncelle — HER ZAMAN sıfırdan yaz (birikmeli değil)
                await base44.asServiceRole.entities.DriverWeeklySummary.update(summaryId, {
                    week_start_date: weekStart,
                    week_end_date: weekEnd,
                    total_canvas_price: totalCanvasPrice,
                    order_count: orderCount
                });
                console.log(`🔄 Güncellendi: ${group.driver_name} - $${totalCanvasPrice} (${orderCount} sipariş)`);
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
                console.log(`✅ Oluşturuldu: ${group.driver_name} - $${totalCanvasPrice} (${orderCount} sipariş)`);
            }

            // Siparişleri doğru özete işaretle
            for (const order of group.orders) {
                if (order.weekly_summary_id !== summaryId) {
                    await base44.asServiceRole.entities.DailyOrder.update(order.id, {
                        weekly_summary_id: summaryId
                    });
                }
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
        deleted_duplicate_summaries: deletedSummaries.length,
        results,
        deleted_summaries: deletedSummaries,
        errors
    });
});