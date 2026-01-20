import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        // Bugünün tarihini belirle
        const now = new Date();
        const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const todayEST = targetDate || estDate.toISOString().split('T')[0];
        
        console.log(`🔍 ${todayEST} tarihindeki siparişler analiz ediliyor...`);
        
        // TÜM siparişleri çek (status filtresi YOK!)
        const allOrders = await base44.asServiceRole.entities.DailyOrder.filter({
            order_date: todayEST
        }, '-created_date', 500);
        
        console.log(`📦 Toplam ${allOrders.length} sipariş bulundu`);
        
        // Status bazında grupla
        const statusCounts = {};
        const statusOrders = {};
        
        for (const order of allOrders) {
            const status = order.status || 'Bilinmiyor';
            
            if (!statusCounts[status]) {
                statusCounts[status] = 0;
                statusOrders[status] = [];
            }
            
            statusCounts[status]++;
            statusOrders[status].push({
                id: order.ezcater_order_id,
                driver: order.driver_name || 'Yok',
                phone: order.driver_phone || 'Yok',
                pickup_time: order.pickup_time,
                created: order.created_date,
                sms_sent: order.sms_sent_at || 'Yok',
                driver_response: order.driver_response || 'Yok'
            });
        }
        
        // CheckMessage analizi
        const checkMessages = await base44.asServiceRole.entities.CheckMessage.filter({
            sent_time: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
        });
        
        const escalatedOrders = checkMessages.filter(m => m.escalated_to_case === true);
        
        console.log(`📊 Status Dağılımı:`);
        for (const [status, count] of Object.entries(statusCounts)) {
            console.log(`   ${status}: ${count}`);
        }
        
        console.log(`\n🚨 Escalation yapılan: ${escalatedOrders.length}`);
        
        return Response.json({
            success: true,
            date: todayEST,
            totalOrders: allOrders.length,
            statusCounts,
            statusOrders,
            escalatedCount: escalatedOrders.length,
            escalatedOrders: escalatedOrders.map(m => m.order_id),
            checkMessagesLast24h: checkMessages.length
        });
        
    } catch (error) {
        console.error('❌ Debug hatası:', error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});