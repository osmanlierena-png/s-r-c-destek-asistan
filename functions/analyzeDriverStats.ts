
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { format, getWeek } from 'npm:date-fns@3.6.0';
import { tr } from 'npm:date-fns@3.6.0/locale';

// Helper to get city from address
const getCityFromAddress = (address) => {
  if (!address) return null;
  const parts = address.split(',');
  if (parts.length > 1) {
    // 'Bethesda, MD 20814' -> 'Bethesda'
    return parts[0].trim();
  }
  return address.split(' ')[0] || null;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;

    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const drivers = await serviceRole.entities.Driver.list();
        const allOrders = await serviceRole.entities.DailyOrder.filter({ driver_name: { $ne: null } });

        const driverStats = {};
        
        // Initialize stats object for all drivers
        for (const driver of drivers) {
            driverStats[driver.name] = {
                ordersByDay: {},
                workingDays: new Set(),
                areas: [],
                weeklyOrders: new Set(), // To track unique weeks
                totalOrders: 0,
            };
        }

        // Populate stats from orders
        for (const order of allOrders) {
            const driverName = order.driver_name;
            if (driverStats[driverName]) {
                const orderDate = new Date(order.order_date);
                const dayName = format(orderDate, 'EEEE', { locale: tr });
                const weekIdentifier = `${orderDate.getFullYear()}-${getWeek(orderDate, { locale: tr })}`;

                // Orders per day
                driverStats[driverName].ordersByDay[order.order_date] = (driverStats[driverName].ordersByDay[order.order_date] || 0) + 1;
                
                // Working days
                driverStats[driverName].workingDays.add(dayName);
                
                // Areas
                const city = getCityFromAddress(order.dropoff_address);
                if (city) {
                    driverStats[driverName].areas.push(city);
                }

                // Weekly stats
                driverStats[driverName].weeklyOrders.add(weekIdentifier);
                driverStats[driverName].totalOrders += 1;
            }
        }
        
        let updatedCount = 0;
        // Calculate and prepare updates
        for (const driver of drivers) {
            const stats = driverStats[driver.name];
            if (!stats) continue;

            // Max orders per day
            const dailyCounts = Object.values(stats.ordersByDay);
            const maxOrders = dailyCounts.length > 0 ? Math.max(...dailyCounts) : 0;

            // Average orders per week
            const activeWeeks = stats.weeklyOrders.size;
            const avgOrdersPerWeek = activeWeeks > 0 ? Math.round(stats.totalOrders / activeWeeks) : 0;

            // Top 3 preferred areas
            const areaCounts = stats.areas.reduce((acc, area) => {
                acc[area] = (acc[area] || 0) + 1;
                return acc;
            }, {});
            const topAreas = Object.entries(areaCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([area]) => area);

            const updatePayload = {
                assignment_preferences: {
                    ...driver.assignment_preferences,
                    max_orders_per_day: maxOrders > 0 ? maxOrders : (driver.assignment_preferences?.max_orders_per_day || 5),
                    working_days: [...stats.workingDays],
                    avg_orders_per_week: avgOrdersPerWeek,
                },
                preferred_areas: topAreas
            };
            
            await serviceRole.entities.Driver.update(driver.id, updatePayload);
            updatedCount++;
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `${updatedCount} sürücünün istatistikleri ve tercihleri güncellendi.` 
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error("Sürücü analizi hatası:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
