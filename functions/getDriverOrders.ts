import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    console.log('🔴 FONKSIYON BAŞLADI - getDriverOrders');
    try {
        const url = new URL(req.url);
        const driverId = url.searchParams.get('d');
        const orderDate = url.searchParams.get('t');
        const messageGroupId = url.searchParams.get('mg');

        console.log('🚀 DEPLOY v102 - SCRIPT FIX');
        console.log('📧 Message Group ID: ' + (messageGroupId || 'NONE (old link)'));

        if (!driverId || !orderDate) {
            return new Response('<html><body><h1>Invalid Link</h1></body></html>', {
                status: 400,
                headers: { 'Content-Type': 'text/html' }
            });
        }

        const base44 = createClientFromRequest(req);
        
        // GET - Handle confirmation via query parameters
        const action = url.searchParams.get('action');
        if (action === 'confirm') {
            try {
                const selectedStr = url.searchParams.get('selected') || '';
                const selectedOrderIds = selectedStr ? selectedStr.split(',').filter(function(id) { return id; }) : [];

                const filterQuery = {
                    driver_id: driverId,
                    order_date: orderDate
                };

                if (messageGroupId) {
                    filterQuery.message_group_id = messageGroupId;
                }

                const orders = await base44.asServiceRole.entities.DailyOrder.filter(filterQuery);

                console.log('📝 Yanıt işleniyor: ' + orders.length + ' sipariş');
                console.log('✅ Seçilen: ' + selectedOrderIds.length);

                const approvedOrderNumbers = [];
                const rejectedOrderNumbers = [];

                for (const order of orders) {
                    const isApproved = selectedOrderIds.includes(order.id);
                    const newStatus = isApproved ? 'Sürücü Onayladı' : 'Sürücü Reddetti';
                    const responseText = isApproved ? 'Evet' : 'Hayır';

                    await base44.asServiceRole.entities.DailyOrder.update(order.id, {
                        status: newStatus,
                        driver_response: responseText,
                        driver_response_at: new Date().toISOString()
                    });

                    if (isApproved) approvedOrderNumbers.push(order.ezcater_order_id);
                    else rejectedOrderNumbers.push(order.ezcater_order_id);

                    const CANVAS_URL = Deno.env.get("CANVAS_URL");
                    if (CANVAS_URL) {
                        try {
                            await fetch(CANVAS_URL + '/api/base44/webhook', {
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
                        } catch (err) {
                            console.error('⚠️ Canvas bildirimi başarısız:', err);
                        }
                    }
                }

                return Response.json({ 
                    success: true, 
                    approvedOrderNumbers,
                    rejectedOrderNumbers
                });
            } catch (err) {
                console.error('💥 Onay işleme hatası:', err.message);
                return Response.json({ success: false, message: err.message }, { status: 200 });
            }
        }
        
        // GET - Show orders HTML
        const drivers = await base44.entities.Driver.filter({ id: driverId });

        const filterQuery = {
            driver_id: driverId,
            order_date: orderDate
        };

        if (messageGroupId) {
            filterQuery.message_group_id = messageGroupId;
        }

        const orders = await base44.entities.DailyOrder.filter(filterQuery, 'pickup_time');

        if (drivers.length === 0) {
            return Response.json({ error: 'Driver not found' }, { status: 404 });
        }

        const driver = drivers[0];

        // Grup siparişleri
        const groupMap = new Map();
        orders.forEach(function(order) {
            const groupId = order.canvas_group_id || ('single_' + order.id);
            if (!groupMap.has(groupId)) {
                groupMap.set(groupId, {
                    orders: [],
                    totalPrice: 0,
                    groupId: order.canvas_group_id,
                    hasCanvasPrice: false
                });
            }
            const group = groupMap.get(groupId);
            group.orders.push(order);

            if (order.canvas_price) {
                const price = parseFloat(order.canvas_price);
                if (!isNaN(price) && price > 0) {
                    group.totalPrice += price;
                    group.hasCanvasPrice = true;
                }
            }
        });

        // HTML oluştur - order card'ları
        let orderIndex = 0;
        const ordersHTML = Array.from(groupMap.values()).map(function(group) {
            let groupHeader = '';
            if (group.groupId && group.orders.length > 1) {
                groupHeader = '<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">' +
                    '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                    '<span style="color: white; font-size: 14px; font-weight: 600;">💰 Group Payment (' + group.orders.length + ' orders)</span>' +
                    '<span style="background: rgba(255,255,255,0.25); color: white; padding: 6px 14px; border-radius: 6px; font-size: 16px; font-weight: 700;">$' + group.totalPrice.toFixed(2) + (group.hasCanvasPrice ? '' : ' ⚠️') + '</span>' +
                    '</div></div>';
            }

            const ordersInGroup = group.orders.map(function(order) {
                orderIndex++;
                const showPrice = !group.groupId || group.orders.length === 1;
                let priceHTML = '';
                if (showPrice) {
                    priceHTML = '<span style="background: #10b981; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">$' + group.totalPrice.toFixed(2) + (group.hasCanvasPrice ? '' : ' ⚠️') + '</span>';
                }

                let notesHTML = '';
                if (order.ezcater_notes) {
                    notesHTML = '<div style="padding: 16px; background: #fffbeb; border-left: 3px solid #f59e0b;">' +
                        '<p style="font-size: 10px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Notes</p>' +
                        '<p style="font-size: 13px; color: #78350f; margin: 0; line-height: 1.5; font-weight: 400;">' + order.ezcater_notes + '</p></div>';
                }

                return '<div class="order-card" style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; overflow: hidden; border: 1px solid #e2e8f0;">' +
                    '<label style="display: block; cursor: pointer;">' +
                    '<div style="background: #f8fafc; padding: 16px; border-bottom: 1px solid #e2e8f0;">' +
                    '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                    '<div style="display: flex; align-items: center; gap: 12px;">' +
                    '<input type="checkbox" name="selected" value="' + order.id + '" checked style="width: 20px; height: 20px; cursor: pointer; accent-color: #10b981;">' +
                    '<span style="font-size: 13px; font-weight: 600; color: #1e293b; letter-spacing: 0.3px;">ORDER #' + order.ezcater_order_id + '</span>' +
                    '</div>' +
                    '<div style="display: flex; gap: 8px; align-items: center;">' +
                    priceHTML +
                    '<span style="background: #3b82f6; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;">#' + orderIndex + '</span>' +
                    '</div></div></div>' +
                    '<div style="padding: 16px; background: #f0fdf4; border-bottom: 1px solid #e2e8f0;">' +
                    '<p style="font-size: 10px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Pickup</p>' +
                    '<p style="font-size: 14px; color: #334155; margin: 0; font-weight: 400; line-height: 1.5;">' + order.pickup_address + '</p></div>' +
                    '<div style="padding: 16px; background: #fef2f2; border-bottom: 1px solid #e2e8f0;">' +
                    '<p style="font-size: 10px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Delivery</p>' +
                    '<p style="font-size: 14px; color: #334155; margin: 0; font-weight: 400; line-height: 1.5;">' + order.dropoff_address + '</p></div>' +
                    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #e2e8f0;">' +
                    '<div style="padding: 16px; background: #f8fafc; border-right: 1px solid #e2e8f0;">' +
                    '<p style="font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Pickup Time</p>' +
                    '<p style="font-size: 24px; color: #1e293b; margin: 0; font-weight: 600; letter-spacing: -0.5px;">' + order.pickup_time + '</p></div>' +
                    '<div style="padding: 16px; background: #f8fafc;">' +
                    '<p style="font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Delivery Time</p>' +
                    '<p style="font-size: 24px; color: #1e293b; margin: 0; font-weight: 600; letter-spacing: -0.5px;">' + order.dropoff_time + '</p></div></div>' +
                    notesHTML +
                    '</div>';
            }).join('');

            return groupHeader + ordersInGroup;
        }).join('');

        // Buton bölümü - HTML form ile
        let buttonsHTML = '';
        if (orders.length > 0 && orders.some(function(o) { return o.status !== 'Sürücü Onayladı' && o.status !== 'Sürücü Reddetti'; })) {
            buttonsHTML = '<form method="GET" style="margin-top: 20px;">' +
                '<input type="hidden" name="d" value="' + driverId + '">' +
                '<input type="hidden" name="t" value="' + orderDate + '">' +
                '<input type="hidden" name="mg" value="' + (messageGroupId || '') + '">' +
                '<input type="hidden" name="action" value="confirm">' +
                '<div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; text-align: center; border: 1px solid #e2e8f0;">' +
                '<button type="submit" style="width: 100%; padding: 18px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">✅ CONFIRM SELECTION</button>' +
                '<p style="margin-top: 12px; font-size: 13px; color: #64748b;">Selected orders will be approved, unselected will be rejected</p>' +
                '</div>' +
                '</form>';
        }

        // No orders mesajı
        let ordersContent = ordersHTML;
        if (orders.length === 0) {
            ordersContent = '<div style="background: white; border-radius: 12px; padding: 48px; text-align: center;"><p style="color: #64748b; margin: 0;">No orders found for today.</p></div>';
        }

        // Client-side script - TAMAMEN string concatenation ile, template literal YOK
        const clientScript = '<script>\n' +
            'function selectAll() {\n' +
            '  document.querySelectorAll(".order-checkbox").forEach(function(cb) { cb.checked = true; });\n' +
            '}\n' +
            'function deselectAll() {\n' +
            '  document.querySelectorAll(".order-checkbox").forEach(function(cb) { cb.checked = false; });\n' +
            '}\n' +
            'async function handleConfirm() {\n' +
            '  var msg = document.getElementById("msg");\n' +
            '  var checkboxes = document.querySelectorAll(".order-checkbox");\n' +
            '  var selectedOrderIds = Array.from(checkboxes)\n' +
            '    .filter(function(cb) { return cb.checked; })\n' +
            '    .map(function(cb) { return cb.getAttribute("data-order-id"); });\n' +
            '  if (selectedOrderIds.length === 0 && !confirm("No orders selected. This will reject ALL orders. Continue?")) { return; }\n' +
            '  document.querySelectorAll("button").forEach(function(btn) { btn.disabled = true; });\n' +
            '  document.querySelectorAll(".order-checkbox").forEach(function(cb) { cb.disabled = true; });\n' +
            '  msg.style.display = "block";\n' +
            '  msg.textContent = "Processing...";\n' +
            '  try {\n' +
            '    var currentUrl = new URL(window.location.href);\n' +
            '    currentUrl.searchParams.set("action", "confirm");\n' +
            '    currentUrl.searchParams.set("selected", selectedOrderIds.join(","));\n' +
            '    var res = await fetch(currentUrl.toString());\n' +
            '    var data = await res.json();\n' +
            '    if (data.success) {\n' +
            '      msg.style.background = "#dcfce7";\n' +
            '      msg.style.color = "#166534";\n' +
            '      var message = "Response Recorded!<br><br>";\n' +
            '      if (data.approvedOrderNumbers && data.approvedOrderNumbers.length > 0) {\n' +
            '        message += "<strong>Approved:</strong> " + data.approvedOrderNumbers.join(", ");\n' +
            '      }\n' +
            '      if (data.rejectedOrderNumbers && data.rejectedOrderNumbers.length > 0) {\n' +
            '        if (data.approvedOrderNumbers && data.approvedOrderNumbers.length > 0) { message += "<br><br>"; }\n' +
            '        message += "<strong>Rejected:</strong> " + data.rejectedOrderNumbers.join(", ");\n' +
            '      }\n' +
            '      msg.innerHTML = message;\n' +
            '      document.querySelectorAll("button").forEach(function(btn) { btn.style.display = "none"; });\n' +
            '    } else {\n' +
            '      msg.style.background = "#fee2e2";\n' +
            '      msg.style.color = "#991b1b";\n' +
            '      msg.textContent = "Error: " + (data.message || "Unknown error");\n' +
            '      document.querySelectorAll("button").forEach(function(btn) { btn.disabled = false; });\n' +
            '      document.querySelectorAll(".order-checkbox").forEach(function(cb) { cb.disabled = false; });\n' +
            '    }\n' +
            '  } catch (error) {\n' +
            '    msg.style.background = "#fee2e2";\n' +
            '    msg.style.color = "#991b1b";\n' +
            '    msg.textContent = "Error: " + error.message;\n' +
            '    document.querySelectorAll("button").forEach(function(btn) { btn.disabled = false; });\n' +
            '    document.querySelectorAll(".order-checkbox").forEach(function(cb) { cb.disabled = false; });\n' +
            '  }\n' +
            '}\n' +
            '<\/script>';

        // Final HTML - TAMAMEN string concatenation
        const html = '<!DOCTYPE html>' +
            '<html><head>' +
            '<meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
            '<title>Orders</title>' +
            '<style>' +
            '* { box-sizing: border-box; }' +
            'body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; min-height: 100vh; }' +
            '.container { max-width: 640px; margin: 0 auto; }' +
            '.order-card { transition: all 0.2s; }' +
            '.order-card:has(.order-checkbox:not(:checked)) { border-color: #fca5a5 !important; background: #fef2f2 !important; }' +
            '</style>' +
            '</head><body>' +
            '<div class="container">' +
            '<div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 28px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">' +
            '<h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #1e293b;">Hello ' + driver.name + '</h1>' +
            '<p style="margin: 6px 0 0 0; color: #64748b; font-size: 14px;">' + orderDate + ' · ' + orders.length + ' orders</p>' +
            '</div>' +
            ordersContent +
            buttonsHTML +
            '</div>' +
            clientScript +
            '</body></html>';
        
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
        
    } catch (error) {
        console.error('Error:', error);
        return new Response('<html><body><h1>Error: ' + error.message + '</h1></body></html>', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
});