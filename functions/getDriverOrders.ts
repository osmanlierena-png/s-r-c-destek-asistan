import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const url = new URL(req.url);
    const driverId = url.searchParams.get('d');
    const orderDate = url.searchParams.get('t');
    const messageGroupId = url.searchParams.get('mg');

    console.log('🚀 DEPLOY v112');

    if (!driverId || !orderDate) {
        return new Response('<html><body><h1>Invalid Link</h1><p>Missing d or t param</p></body></html>', {
            status: 400, headers: { 'Content-Type': 'text/html' }
        });
    }

    let base44;
    try {
        base44 = createClientFromRequest(req);
        console.log('✅ Base44 client initialized:', typeof base44);
    } catch (e) {
        console.error('❌ Auth error:', e.message);
        base44 = null;
    }
    
    if (!base44) {
        console.error('❌ Base44 client is null/undefined - cannot proceed');
    }

    if (req.method === 'POST') {
        if (!base44) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required for POST' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        const body = await req.json();
        const { selectedOrderIds } = body;

        const filterQuery = { driver_id: driverId, order_date: orderDate };
        if (messageGroupId) filterQuery.message_group_id = messageGroupId;

        const orders = await base44.asServiceRole.entities.DailyOrder.filter(filterQuery);

        let approvedCount = 0, rejectedCount = 0;
        const approvedOrderNumbers = [], rejectedOrderNumbers = [];

        for (const order of orders) {
            const isApproved = selectedOrderIds.includes(order.id);
            if (isApproved) { approvedCount++; approvedOrderNumbers.push(order.ezcater_order_id); }
            else { rejectedCount++; rejectedOrderNumbers.push(order.ezcater_order_id); }

            await base44.asServiceRole.entities.DailyOrder.update(order.id, {
                status: isApproved ? 'Sürücü Onayladı' : 'Sürücü Reddetti',
                driver_response: isApproved ? 'Evet' : 'Hayır',
                driver_response_at: new Date().toISOString()
            });

            const CANVAS_URL = Deno.env.get("CANVAS_URL");
            if (CANVAS_URL) {
                try {
                    await fetch(`${CANVAS_URL}/api/base44/webhook`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-API-Secret': Deno.env.get("CANVAS_API_SECRET") || '' },
                        body: JSON.stringify({ type: 'DRIVER_RESPONSE', orderId: order.id, orderNumber: order.ezcater_order_id, driverResponse: isApproved ? 'Evet' : 'Hayır', driverName: order.driver_name, responseTime: new Date().toISOString(), date: order.order_date, groupId: order.canvas_group_id || null })
                    });
                } catch (err) { console.error('Canvas error:', err); }
            }
        }

        return Response.json({ success: true, approvedCount, rejectedCount, totalCount: orders.length, approvedOrderNumbers, rejectedOrderNumbers });
    }



    // GET - Service role ile fetch et (auth gerekli değil)
    let drivers = [], orders = [];
    try {
        if (!base44) throw new Error('Service client not initialized');
        const results = await Promise.all([
            base44.asServiceRole.entities.Driver.filter({ id: driverId }),
            base44.asServiceRole.entities.DailyOrder.filter(
                messageGroupId ? { driver_id: driverId, order_date: orderDate, message_group_id: messageGroupId } : { driver_id: driverId, order_date: orderDate },
                'pickup_time'
            )
        ]);
        drivers = results[0];
        orders = results[1];
    } catch (err) {
        console.error('❌ Data fetch error:', err.message, err.stack);
        return new Response(`<html><body><h1>Error loading orders</h1><p>${err.message || 'Unknown error'}</p></body></html>`, { status: 500, headers: { 'Content-Type': 'text/html' } });
    }

    if (drivers.length === 0) {
        return new Response('<html><body><h1>Driver not found</h1></body></html>', { status: 404, headers: { 'Content-Type': 'text/html' } });
    }

    const driver = drivers[0];
    console.log(`📦 ${orders.length} orders`);

    const groupMap = new Map();
    orders.forEach(order => {
        const gId = order.canvas_group_id || `single_${order.id}`;
        if (!groupMap.has(gId)) groupMap.set(gId, { orders: [], totalPrice: 0, hasCanvasPrice: false, groupId: order.canvas_group_id });
        const g = groupMap.get(gId);
        g.orders.push(order);
        if (order.canvas_price) { const p = parseFloat(order.canvas_price); if (!isNaN(p) && p > 0) { g.totalPrice += p; g.hasCanvasPrice = true; } }
    });

    let orderIndex = 0;
    const ordersHTML = Array.from(groupMap.values()).map(group => {
        const groupHeader = group.groupId && group.orders.length > 1 ? `<div style="background:linear-gradient(135deg,#10b981,#059669);border-radius:8px;padding:16px;margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:white;font-size:14px;font-weight:600;">Group Payment (${group.orders.length} orders)</span><span style="background:rgba(255,255,255,0.25);color:white;padding:6px 14px;border-radius:6px;font-size:16px;font-weight:700;">$${group.totalPrice.toFixed(2)}</span></div></div>` : '';
        const ordersInGroup = group.orders.map(order => {
            orderIndex++;
            const showPrice = !group.groupId || group.orders.length === 1;
            const priceHTML = showPrice ? `<span style="background:#10b981;color:white;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;">$${group.totalPrice.toFixed(2)}</span>` : '';
            return `<div style="background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);margin-bottom:16px;overflow:hidden;border:1px solid #e2e8f0;">
<div style="background:#f8fafc;padding:16px;border-bottom:1px solid #e2e8f0;"><div style="display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:12px;"><input type="checkbox" class="order-checkbox" data-order-id="${order.id}" checked style="width:20px;height:20px;cursor:pointer;accent-color:#10b981;"><span style="font-size:13px;font-weight:600;color:#1e293b;">ORDER #${order.ezcater_order_id}</span></div><div style="display:flex;gap:8px;align-items:center;">${priceHTML}<span style="background:#3b82f6;color:white;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">#${orderIndex}</span></div></div></div>
<div style="padding:16px;background:#f0fdf4;border-bottom:1px solid #e2e8f0;"><p style="font-size:10px;font-weight:600;color:#10b981;text-transform:uppercase;margin:0 0 6px 0;">Pickup</p><p style="font-size:14px;color:#334155;margin:0;">${order.pickup_address}</p></div>
<div style="padding:16px;background:#fef2f2;border-bottom:1px solid #e2e8f0;"><p style="font-size:10px;font-weight:600;color:#ef4444;text-transform:uppercase;margin:0 0 6px 0;">Delivery</p><p style="font-size:14px;color:#334155;margin:0;">${order.dropoff_address}</p></div>
<div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e2e8f0;">
<div style="padding:16px;background:#f8fafc;border-right:1px solid #e2e8f0;"><p style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;margin:0 0 6px 0;">Pickup Time</p><p style="font-size:24px;color:#1e293b;margin:0;font-weight:600;">${order.pickup_time}</p></div>
<div style="padding:16px;background:#f8fafc;"><p style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;margin:0 0 6px 0;">Delivery Time</p><p style="font-size:24px;color:#1e293b;margin:0;font-weight:600;">${order.dropoff_time}</p></div>
</div>
${order.ezcater_notes ? `<div style="padding:16px;background:#fffbeb;border-left:3px solid #f59e0b;"><p style="font-size:10px;font-weight:600;color:#92400e;text-transform:uppercase;margin:0 0 6px 0;">Notes</p><p style="font-size:13px;color:#78350f;margin:0;">${order.ezcater_notes}</p></div>` : ''}
</div>`;
        }).join('');
        return groupHeader + ordersInGroup;
    }).join('');

    const hasUnresponded = orders.some(o => o.status !== 'Sürücü Onayladı' && o.status !== 'Sürücü Reddetti');

    const actionButtons = hasUnresponded ? `
<form method="POST" style="background:white;border-radius:8px;padding:20px;margin-top:12px;border:1px solid #e2e8f0;">
<p style="font-size:13px;color:#64748b;font-weight:500;margin-bottom:12px;">Onaylamak istediğiniz siparişleri seçin:</p>
<div style="display:flex;gap:10px;flex-direction:column;margin-bottom:16px;">
${orders.map(o => `
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;display:flex;align-items:start;gap:10px;">
  <input type="checkbox" name="selectedOrderIds" value="${o.id}" checked style="margin-top:4px;cursor:pointer;width:18px;height:18px;accent-color:#10b981;">
  <div style="flex:1;">
    <p style="font-size:12px;font-weight:600;color:#1e293b;margin:0 0 4px 0;">ORDER #${o.ezcater_order_id}</p>
    <p style="font-size:11px;color:#64748b;margin:0;"><strong>${o.pickup_time}</strong> → ${o.dropoff_time}</p>
    <p style="font-size:11px;color:#64748b;margin:4px 0 0 0;">${o.pickup_address}</p>
  </div>
</div>`).join('')}
</div>
<div style="display:flex;gap:8px;">
  <button type="submit" style="flex:1;padding:12px;background:#10b981;color:white;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">✅ GÖNDER</button>
</div>
</form>` : `<div style="background:#dcfce7;border-radius:8px;padding:16px;margin-top:12px;text-align:center;"><p style="color:#166534;font-weight:600;">✅ Tüm siparişlere yanıt verdiniz!</p></div>`;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Today's Orders</title>
<style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; padding: 16px; } .container { max-width: 640px; margin: 0 auto; }</style>
</head>
<body>
<div class="container">
<div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #3b82f6;">
<h1 style="font-size:20px;font-weight:600;color:#1e293b;">Hello ${driver.name}</h1>
<p style="color:#64748b;font-size:13px;margin-top:6px;">${orderDate} &middot; ${orders.length} orders</p>
</div>
${ordersHTML}
${actionButtons}
</div>
<script>
document.querySelector('form')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const checked = Array.from(document.querySelectorAll('input[name="selectedOrderIds"]:checked')).map(el => el.value);
  fetch(window.location.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedOrderIds: checked })
  }).then(r => r.json()).then(data => {
    alert('✅ ' + data.approvedCount + ' onaylandı, ' + data.rejectedCount + ' reddedildi!');
    location.reload();
  }).catch(e => alert('❌ Hata: ' + e.message));
});
</script>
</body>
</html>`;

    return new Response(html, { 
        headers: { 
            'Content-Type': 'text/html; charset=utf-8'
        } 
    });
});