import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    // Yesterday's date in YYYY-MM-DD format
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0];

    console.log(`📅 Reddedilen siparişler raporu: ${targetDate}`);

    // Fetch rejected orders for yesterday
    const rejectedOrders = await base44.asServiceRole.entities.DailyOrder.filter({
        order_date: targetDate,
        status: 'Sürücü Reddetti'
    });

    console.log(`❌ Reddedilen sipariş sayısı: ${rejectedOrders.length}`);

    if (rejectedOrders.length === 0) {
        return Response.json({
            success: true,
            message: `${targetDate} tarihinde reddedilen sipariş yok.`,
            sent: 0
        });
    }

    // Determine time slot from pickup_time
    const getTimeSlot = (pickupTime) => {
        if (!pickupTime) return 'sabah';

        const cleanTime = pickupTime.trim();
        const isPM = cleanTime.toLowerCase().includes('pm');
        const isAM = cleanTime.toLowerCase().includes('am');
        const timePart = cleanTime.replace(/\s*(am|pm)/gi, '').trim();
        const [hourStr] = timePart.split(':');
        let hours = parseInt(hourStr, 10);

        if (isPM && hours !== 12) hours += 12;
        else if (isAM && hours === 12) hours = 0;

        // 00:00 - 11:59 → sabah (includes 2 AM)
        if (hours >= 0 && hours < 12) return 'sabah';
        // 12:00 - 17:59 → oglen
        if (hours >= 12 && hours < 18) return 'oglen';
        // 18:00 - 23:59 → aksam
        return 'aksam';
    };

    const canvasUrl = Deno.env.get('CANVAS_URL') || 'https://order-assignment-system.vercel.app';
    const canvasSecret = Deno.env.get('CANVAS_API_SECRET');

    let sentCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const order of rejectedOrders) {
        const timeSlot = getTimeSlot(order.pickup_time);

        const payload = {
            order_id: order.ezcater_order_id,
            driver_id: order.driver_id,
            driver_name: order.driver_name,
            date: targetDate,
            time_slot: timeSlot,
            pickup_address: order.pickup_address,
            dropoff_address: order.dropoff_address,
            pickup_time: order.pickup_time,
            dropoff_time: order.dropoff_time,
            driver_response: order.driver_response,
            rejected_at: order.driver_response_at
        };

        try {
            const response = await fetch(`${canvasUrl}/api/drivers/learn`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(canvasSecret ? { 'x-api-secret': canvasSecret } : {})
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                sentCount++;
                console.log(`✅ Gönderildi: ${order.ezcater_order_id} (${timeSlot})`);
            } else {
                const text = await response.text();
                errorCount++;
                errors.push({ order_id: order.ezcater_order_id, status: response.status, error: text });
                console.error(`❌ Hata: ${order.ezcater_order_id} - ${response.status} - ${text}`);
            }
        } catch (err) {
            errorCount++;
            errors.push({ order_id: order.ezcater_order_id, error: err.message });
            console.error(`❌ Fetch hatası: ${order.ezcater_order_id} - ${err.message}`);
        }
    }

    return Response.json({
        success: true,
        date: targetDate,
        total: rejectedOrders.length,
        sent: sentCount,
        errors: errorCount,
        error_details: errors
    });
});