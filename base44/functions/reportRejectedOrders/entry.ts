import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    // Yesterday's date in EST (UTC-5)
    const nowUTC = new Date();
    const estOffset = 5 * 60 * 60 * 1000;
    const nowEST = new Date(nowUTC.getTime() - estOffset);
    const yesterday = new Date(nowEST);
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0];

    console.log(`📅 Reddedilen siparişler raporu: ${targetDate}`);

    const rejectedOrders = await base44.asServiceRole.entities.DailyOrder.filter({
        order_date: targetDate,
        status: 'Sürücü Reddetti'
    }, '-created_date', 500);

    console.log(`❌ Reddedilen sipariş sayısı: ${rejectedOrders.length}`);

    if (rejectedOrders.length === 0) {
        return Response.json({
            success: true,
            message: `${targetDate} tarihinde reddedilen sipariş yok.`,
            sent: 0
        });
    }

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
        if (hours >= 0 && hours < 12) return 'sabah';
        if (hours >= 12 && hours < 18) return 'oglen';
        return 'aksam';
    };

    const canvasUrl = Deno.env.get('CANVAS_URL') || 'https://order-assignment-system.vercel.app';
    const canvasSecret = Deno.env.get('CANVAS_API_SECRET');

    let sentCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const order of rejectedOrders) {
        const payload = {
            orderId: order.ezcater_order_id,
            driverId: order.driver_id,
            driverName: order.driver_name,
            date: targetDate,
            timeSlot: getTimeSlot(order.pickup_time),
            pickupAddress: order.pickup_address,
            dropoffAddress: order.dropoff_address,
            pickupTime: order.pickup_time,
            dropoffTime: order.dropoff_time,
            driverResponse: order.driver_response,
            rejectedAt: order.driver_response_at
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
                console.log(`✅ Gönderildi: ${order.ezcater_order_id}`);
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