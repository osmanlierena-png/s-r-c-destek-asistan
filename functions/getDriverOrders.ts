import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const driverId = url.searchParams.get('d');
        const orderDate = url.searchParams.get('t');
        
        console.log('🚀 NEW DEPLOY v100 - SIMPLE TEST');
        
        if (!driverId || !orderDate) {
            return new Response('<html><body><h1>Invalid Link</h1></body></html>', {
                status: 400,
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        const base44 = createClientFromRequest(req);
        
        // POST - Handle approve/reject
        if (req.method === 'POST') {
            const body = await req.json();
            const { response } = body;
            
            const orders = await base44.entities.DailyOrder.filter({
                driver_id: driverId,
                order_date: orderDate
            });
            
            const newStatus = response === 'approve' ? 'Sürücü Onayladı' : 'Sürücü Reddetti';
            const responseText = response === 'approve' ? 'Evet' : 'Hayır';
            
            for (const order of orders) {
                await base44.entities.DailyOrder.update(order.id, {
                    status: newStatus,
                    driver_response: responseText,
                    driver_response_at: new Date().toISOString()
                });
            }
            
            return Response.json({ 
                success: true, 
                message: response === 'approve' ? 'Onaylandı!' : 'Reddedildi!',
                updatedCount: orders.length
            });
        }
        
        // GET - Show orders
        const drivers = await base44.entities.Driver.filter({ id: driverId });
        const orders = await base44.entities.DailyOrder.filter({
            driver_id: driverId,
            order_date: orderDate
        }, 'pickup_time');

        if (drivers.length === 0) {
            return Response.json({ error: 'Driver not found' }, { status: 404 });
        }

        const driver = drivers[0];
        const lang = driver.language || 'tr';

        const t = {
            tr: {
                greeting: 'Merhaba',
                todayOrders: 'Bugünkü Siparişleriniz',
                order: 'Sipariş',
                pickupAddress: 'PICKUP ADDRESS',
                deliveryAddress: 'DELIVERY ADDRESS',
                pickupTime: 'PICKUP TIME',
                deliveryTime: 'DELIVERY TIME',
                customer: 'Müşteri',
                notes: 'NOTLAR',
                approveAll: '✅ HEPSİNİ ONAYLA',
                rejectAll: '❌ HEPSİNİ REDDET',
                approved: '✅ Siparişler onaylandı!',
                rejected: '✅ Siparişler reddedildi!',
                noOrders: 'Bugün için sipariş bulunamadı.'
            },
            en: {
                greeting: 'Hello',
                todayOrders: 'Today\'s Orders',
                order: 'Order',
                pickupAddress: 'PICKUP ADDRESS',
                deliveryAddress: 'DELIVERY ADDRESS',
                pickupTime: 'PICKUP TIME',
                deliveryTime: 'DELIVERY TIME',
                customer: 'Customer',
                notes: 'NOTES',
                approveAll: '✅ APPROVE ALL',
                rejectAll: '❌ REJECT ALL',
                approved: '✅ Orders approved!',
                rejected: '✅ Orders rejected!',
                noOrders: 'No orders found for today.'
            }
        };

        const text = t[lang];
        
        const ordersHTML = orders.map((order, index) => `
            <div style="background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 16px; font-weight: 700;">📦 ${text.order.toUpperCase()} #${order.ezcater_order_id}</span>
                        <span style="background: rgba(255,255,255,0.25); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;">#${index + 1}</span>
                    </div>
                </div>
                <div style="padding: 20px; background: #f0fdf4; border-bottom: 1px solid #d1fae5;">
                    <p style="font-size: 10px; font-weight: 800; color: #065f46; text-transform: uppercase; margin: 0 0 10px 0;">🟢 ${text.pickupAddress}</p>
                    <p style="font-size: 15px; color: #1a202c; margin: 0; font-weight: 600;">${order.pickup_address}</p>
                </div>
                <div style="padding: 20px; background: #fef2f2; border-bottom: 1px solid #fecaca;">
                    <p style="font-size: 10px; font-weight: 800; color: #991b1b; text-transform: uppercase; margin: 0 0 10px 0;">🔴 ${text.deliveryAddress}</p>
                    <p style="font-size: 15px; color: #1a202c; margin: 0; font-weight: 600;">${order.dropoff_address}</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0;">
                    <div style="padding: 20px; background: #eff6ff; border-right: 1px solid #bfdbfe;">
                        <p style="font-size: 10px; font-weight: 800; color: #1e40af; text-transform: uppercase; margin: 0 0 10px 0;">⏰ ${text.pickupTime}</p>
                        <p style="font-size: 32px; color: #1a202c; margin: 0; font-weight: 800;">${order.pickup_time}</p>
                    </div>
                    <div style="padding: 20px; background: #faf5ff;">
                        <p style="font-size: 10px; font-weight: 800; color: #7c3aed; text-transform: uppercase; margin: 0 0 6px 0;">🎯 ${text.deliveryTime}</p>
                        <p style="font-size: 32px; color: #1a202c; margin: 0; font-weight: 800;">${order.dropoff_time}</p>
                    </div>
                </div>
                ${order.customer_name ? `<div style="padding: 20px; background: #f8fafc;"><p style="font-size: 15px; margin: 0;"><strong>${text.customer}:</strong> ${order.customer_name}</p></div>` : ''}
                ${order.ezcater_notes ? `<div style="padding: 20px; background: #fffbeb; border-left: 4px solid #f59e0b;"><p style="font-size: 10px; font-weight: 800; color: #92400e; text-transform: uppercase; margin: 0 0 8px 0;">📝 ${text.notes}</p><p style="font-size: 15px; color: #78350f; margin: 0;">${order.ezcater_notes}</p></div>` : ''}
            </div>
        `).join('');
        
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${text.todayOrders}</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
.container { max-width: 680px; margin: 0 auto; }
</style>
</head>
<body>
<div class="container">
<div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 32px; margin-bottom: 24px;">
<h1 style="margin: 0; font-size: 28px; font-weight: 700; color: white;">${text.greeting} ${driver.name}!</h1>
<p style="margin: 8px 0 0 0; color: white; font-size: 16px;">📅 ${text.todayOrders} (${orders.length})</p>
</div>
${orders.length === 0 ? '<div style="background: white; border-radius: 12px; padding: 48px; text-align: center;"><p style="color: #64748b; margin: 0;">' + text.noOrders + '</p></div>' : ordersHTML}
<div style="background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 32px; text-align: center; margin-top: 32px;">
<button onclick="handleClick('approve')" style="width: 100%; padding: 20px; background: #10b981; color: white; border: none; border-radius: 14px; font-size: 18px; font-weight: 700; cursor: pointer; margin-bottom: 16px;">${text.approveAll}</button>
<button onclick="handleClick('reject')" style="width: 100%; padding: 20px; background: #ef4444; color: white; border: none; border-radius: 14px; font-size: 18px; font-weight: 700; cursor: pointer;">${text.rejectAll}</button>
<div id="msg" style="margin-top: 20px; padding: 16px; border-radius: 12px; display: none; font-weight: 600;"></div>
</div>
</div>
<script>
async function handleClick(response) {
    const msg = document.getElementById('msg');
    msg.style.display = 'block';
    msg.textContent = '⏳ İşleniyor...';
    try {
        const res = await fetch(window.location.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response }) });
        const data = await res.json();
        if (data.success) {
            msg.style.background = '#dcfce7';
            msg.style.color = '#166534';
            msg.textContent = (response === 'approve' ? '${text.approved}' : '${text.rejected}') + ' (' + data.updatedCount + ' sipariş)';
            document.querySelectorAll('button').forEach(b => b.style.display = 'none');
        } else {
            msg.style.background = '#fee2e2';
            msg.style.color = '#991b1b';
            msg.textContent = '❌ Hata: ' + data.message;
        }
    } catch (error) {
        msg.style.background = '#fee2e2';
        msg.style.color = '#991b1b';
        msg.textContent = '❌ Hata: ' + error.message;
    }
}
</script>
</body>
</html>`;
        
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
        
    } catch (error) {
        console.error('Error:', error);
        return new Response(`<html><body><h1>Error: ${error.message}</h1></body></html>`, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
});