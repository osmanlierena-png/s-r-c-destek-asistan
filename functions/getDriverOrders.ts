import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const driverId = url.searchParams.get('d');
        const orderDate = url.searchParams.get('t');
        const messageGroupId = url.searchParams.get('mg'); // Unique message group ID

        console.log('🚀 DEPLOY v101 - UNIQUE MESSAGE GROUPS');
        console.log(`📧 Message Group ID: ${messageGroupId || 'NONE (old link)'}`);

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

            // GÜVENLIK: Sadece bu mesaj grubundaki siparişleri al
            const filterQuery = {
                driver_id: driverId,
                order_date: orderDate
            };

            // Eğer message_group_id varsa sadece o gruptaki siparişleri al
            if (messageGroupId) {
                filterQuery.message_group_id = messageGroupId;
            }

            const orders = await base44.entities.DailyOrder.filter(filterQuery);

            console.log(`📝 Yanıt işleniyor: ${orders.length} sipariş (Message Group: ${messageGroupId || 'NONE'})`);

            const newStatus = response === 'approve' ? 'Sürücü Onayladı' : 'Sürücü Reddetti';
            const responseText = response === 'approve' ? 'Evet' : 'Hayır';

            for (const order of orders) {
                await base44.entities.DailyOrder.update(order.id, {
                    status: newStatus,
                    driver_response: responseText,
                    driver_response_at: new Date().toISOString()
                });

                // Canvas'a bildir
                const CANVAS_URL = Deno.env.get("CANVAS_URL");
                if (CANVAS_URL) {
                    try {
                        await fetch(`${CANVAS_URL}/api/base44/webhook`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-Secret': Deno.env.get("CANVAS_API_SECRET") || ''
                            },
                            body: JSON.stringify({
                                type: 'DRIVER_RESPONSE',
                                orderId: order.id,
                                orderNumber: order.ezcater_order_id,
                                driverResponse: responseText,
                                driverName: order.driver_name,
                                responseTime: new Date().toISOString(),
                                date: order.order_date,
                                groupId: order.canvas_group_id || null
                            })
                        });
                        console.log(`📡 Canvas'a bildirim gönderildi: ${order.ezcater_order_id} - ${responseText}`);
                    } catch (err) {
                        console.error('⚠️ Canvas bildirimi başarısız:', err);
                    }
                }
            }

            return Response.json({ 
                success: true, 
                message: response === 'approve' ? 'Approved!' : 'Rejected!',
                updatedCount: orders.length
            });
        }
        
        // GET - Show orders
        const drivers = await base44.entities.Driver.filter({ id: driverId });

        // GÜVENLIK: Sadece bu mesaj grubundaki siparişleri al
        const filterQuery = {
            driver_id: driverId,
            order_date: orderDate
        };

        // Eğer message_group_id varsa sadece o gruptaki siparişleri al
        // Böylece aynı gün içinde gönderilen farklı SMS'ler karışmaz
        if (messageGroupId) {
            filterQuery.message_group_id = messageGroupId;
        }

        const orders = await base44.entities.DailyOrder.filter(filterQuery, 'pickup_time');

        console.log(`📦 ${orders.length} sipariş gösteriliyor (Message Group: ${messageGroupId || 'NONE (old link)'})`);
        console.log(`📋 Order IDs: ${orders.map(o => o.ezcater_order_id).join(', ')}`);

        if (drivers.length === 0) {
            return Response.json({ error: 'Driver not found' }, { status: 404 });
        }

        const driver = drivers[0];

        // Grup siparişleri ayır ve toplam fiyatları hesapla
        const groupMap = new Map();
        orders.forEach(order => {
            const groupId = order.canvas_group_id || `single_${order.id}`;
            if (!groupMap.has(groupId)) {
                // Canvas'tan gelen fiyat - yoksa $0
                let safePrice = 0;
                let hasCanvasPrice = false;

                if (order.canvas_price && order.canvas_price !== null && order.canvas_price !== undefined) {
                    safePrice = parseFloat(order.canvas_price);
                    if (isNaN(safePrice) || safePrice < 0) {
                        console.warn(`⚠️ ${order.ezcater_order_id} için geçersiz canvas_price: ${order.canvas_price}`);
                        safePrice = 0;
                    } else {
                        hasCanvasPrice = true;
                    }
                } else {
                    console.warn(`⚠️ ${order.ezcater_order_id} için canvas_price yok`);
                }

                groupMap.set(groupId, {
                    orders: [],
                    totalPrice: safePrice,
                    groupId: order.canvas_group_id,
                    firstOrderPrice: safePrice,
                    hasCanvasPrice: hasCanvasPrice
                });
            }
            const group = groupMap.get(groupId);

            // Tutarlılık kontrolü
            if (group.hasCanvasPrice && order.canvas_price) {
                const currentPrice = parseFloat(order.canvas_price) || 0;
                if (group.groupId && currentPrice !== group.firstOrderPrice && currentPrice > 0) {
                    console.warn(`⚠️ Grup ${group.groupId} içinde fiyat tutarsızlığı: ${group.firstOrderPrice} vs ${currentPrice}`);
                }
            }

            group.orders.push(order);
        });

        const text = {
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
        };
        
        // HTML oluştur - grup bazında
        let orderIndex = 0;
        const ordersHTML = Array.from(groupMap.values()).map(group => {
            const groupHeader = group.groupId && group.orders.length > 1 ? `
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: white; font-size: 14px; font-weight: 600;">💰 Group Payment (${group.orders.length} orders)</span>
                            <span style="background: rgba(255,255,255,0.25); color: white; padding: 6px 14px; border-radius: 6px; font-size: 16px; font-weight: 700;">$${group.totalPrice.toFixed(2)}${!group.hasCanvasPrice ? ' ⚠️' : ''}</span>
                        </div>
                    </div>
                    ` : '';

            const ordersInGroup = group.orders.map(order => {
                orderIndex++;
                // GÜVENLIK: Tekli sipariş ise fiyat göster, grup siparişte gösterme (grup başlığında zaten var)
                const showPrice = !group.groupId || group.orders.length === 1;
                // KRITIK: Fiyat kontrolü
                let priceHTML = '';
                if (group.priceError) {
                    priceHTML = `<span style="background: #dc2626; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;">❌ FİYAT YOK</span>`;
                } else if (showPrice && group.totalPrice > 0) {
                    priceHTML = `<span style="background: #10b981; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">$${group.totalPrice.toFixed(2)}</span>`;
                }

                return `
                <div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; overflow: hidden; border: 1px solid ${group.priceError ? '#dc2626' : '#e2e8f0'};">
                    <div style="background: ${group.priceError ? '#fee2e2' : '#f8fafc'}; padding: 16px; border-bottom: 1px solid ${group.priceError ? '#fca5a5' : '#e2e8f0'};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 13px; font-weight: 600; color: #1e293b; letter-spacing: 0.3px;">${text.order.toUpperCase()} #${order.ezcater_order_id}</span>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                ${priceHTML}
                                <span style="background: #3b82f6; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;">#${orderIndex}</span>
                            </div>
                        </div>
                    </div>
                <div style="padding: 16px; background: #f0fdf4; border-bottom: 1px solid #e2e8f0;">
                    <p style="font-size: 10px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Pickup</p>
                    <p style="font-size: 14px; color: #334155; margin: 0; font-weight: 400; line-height: 1.5;">${order.pickup_address}</p>
                </div>
                <div style="padding: 16px; background: #fef2f2; border-bottom: 1px solid #e2e8f0;">
                    <p style="font-size: 10px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Delivery</p>
                    <p style="font-size: 14px; color: #334155; margin: 0; font-weight: 400; line-height: 1.5;">${order.dropoff_address}</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #e2e8f0;">
                    <div style="padding: 16px; background: #f8fafc; border-right: 1px solid #e2e8f0;">
                        <p style="font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Pickup Time</p>
                        <p style="font-size: 24px; color: #1e293b; margin: 0; font-weight: 600; letter-spacing: -0.5px;">${order.pickup_time}</p>
                    </div>
                    <div style="padding: 16px; background: #f8fafc;">
                        <p style="font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Delivery Time</p>
                        <p style="font-size: 24px; color: #1e293b; margin: 0; font-weight: 600; letter-spacing: -0.5px;">${order.dropoff_time}</p>
                    </div>
                </div>
                    ${order.ezcater_notes ? `<div style="padding: 16px; background: #fffbeb; border-left: 3px solid #f59e0b;"><p style="font-size: 10px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Notes</p><p style="font-size: 13px; color: #78350f; margin: 0; line-height: 1.5; font-weight: 400;">${order.ezcater_notes}</p></div>` : ''}
                </div>
            `;
            }).join('');

            return groupHeader + ordersInGroup;
        }).join('');
        
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${text.todayOrders}</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f8fafc; min-height: 100vh; }
.container { max-width: 640px; margin: 0 auto; }
</style>
</head>
<body>
<div class="container">
<div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 28px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
<h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #1e293b; letter-spacing: -0.3px;">${text.greeting} ${driver.name}</h1>
<p style="margin: 6px 0 0 0; color: #64748b; font-size: 14px; font-weight: 400;">${orderDate} · ${orders.length} orders</p>
</div>
${orders.length === 0 ? '<div style="background: white; border-radius: 12px; padding: 48px; text-align: center;"><p style="color: #64748b; margin: 0;">' + text.noOrders + '</p></div>' : ordersHTML}
${orders.length > 0 && (orders[0].status === 'Sürücü Onayladı' || orders[0].status === 'Sürücü Reddetti') ? `
<div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; text-align: center; margin-top: 20px; border: 1px solid ${orders[0].status === 'Sürücü Onayladı' ? '#10b981' : '#ef4444'};">
<p style="margin: 0; font-size: 15px; font-weight: 600; color: ${orders[0].status === 'Sürücü Onayladı' ? '#16a34a' : '#dc2626'};">
${orders[0].status === 'Sürücü Onayladı' ? text.approved : text.rejected} (${orders.length} orders)
</p>
</div>
` : `
<div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; text-align: center; margin-top: 20px; border: 1px solid #e2e8f0;">
<button onclick="handleClick('approve')" style="width: 100%; padding: 16px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 12px; letter-spacing: 0.3px;">${text.approveAll}</button>
<button onclick="handleClick('reject')" style="width: 100%; padding: 16px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; letter-spacing: 0.3px;">${text.rejectAll}</button>
<div id="msg" style="margin-top: 16px; padding: 14px; border-radius: 6px; display: none; font-weight: 500; font-size: 14px;"></div>
</div>
`}
</div>
<script>
async function handleClick(response) {
    const msg = document.getElementById('msg');
    msg.style.display = 'block';
    msg.textContent = '⏳ Processing...';
    try {
        const res = await fetch(window.location.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response }) });
        const data = await res.json();
        if (data.success) {
            msg.style.background = '#dcfce7';
            msg.style.color = '#166534';
            msg.textContent = (response === 'approve' ? '${text.approved}' : '${text.rejected}') + ' (' + data.updatedCount + ' orders)';
            document.querySelectorAll('button').forEach(b => b.style.display = 'none');
        } else {
            msg.style.background = '#fee2e2';
            msg.style.color = '#991b1b';
            msg.textContent = '❌ Error: ' + data.message;
        }
    } catch (error) {
        msg.style.background = '#fee2e2';
        msg.style.color = '#991b1b';
        msg.textContent = '❌ Error: ' + error.message;
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