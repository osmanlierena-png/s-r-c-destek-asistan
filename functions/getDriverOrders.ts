import { createBase44Client } from 'npm:@base44/sdk@0.8.4';

// Driver orders with approve/reject functionality
Deno.serve(async (req) => {
    try {
        // URL parametrelerini al
        const url = new URL(req.url);
        const driverId = url.searchParams.get('d');
        const orderDate = url.searchParams.get('t');
        
        console.log('📱 YENİ SİSTEM v5 - BUTONLAR EKLENECEK!');
        console.log('📍 Full URL:', req.url);
        console.log('🔍 Parsed params - Driver ID:', driverId, '| Date:', orderDate);
        
        if (!driverId || !orderDate) {
            return new Response(`
                <html>
                <body style="font-family: sans-serif; text-align: center; padding: 40px;">
                    <h1 style="color: #dc2626;">⚠️ Geçersiz Link</h1>
                    <p>Lütfen doğru linki kullanın.</p>
                </body>
                </html>
            `, {
                status: 400,
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        // Public access için service role kullan
        const appId = Deno.env.get('BASE44_APP_ID');
        const base44 = createBase44Client({
            appId,
            useServiceRole: true
        });
        
        // POST request - Onay/Red
        if (req.method === 'POST') {
            const body = await req.json();
            const { response } = body; // "approve" veya "reject"
            
            console.log(`📝 Response alındı: ${response} (Driver: ${driverId}, Date: ${orderDate})`);
            
            // Siparişleri bul ve güncelle
            const orders = await base44.entities.DailyOrder.filter({
                driver_id: driverId,
                order_date: orderDate
            });
            
            const newStatus = response === 'approve' ? 'Sürücü Onayladı' : 'Sürücü Reddetti';
            const responseText = response === 'approve' ? 'Evet' : 'Hayır';
            
            let updatedCount = 0;
            for (const order of orders) {
                await base44.entities.DailyOrder.update(order.id, {
                    status: newStatus,
                    driver_response: responseText,
                    driver_response_at: new Date().toISOString()
                });
                updatedCount++;
                
                // Canvas'a bildirim gönder
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
                        console.log(`📡 Canvas'a bildirim gönderildi: ${order.ezcater_order_id}`);
                    } catch (err) {
                        console.error('⚠️ Canvas bildirimi başarısız:', err);
                    }
                }
            }
            
            console.log(`✅ ${updatedCount} sipariş güncellendi: ${newStatus}`);
            
            return Response.json({ 
                success: true, 
                message: response === 'approve' ? 'Siparişler onaylandı!' : 'Siparişler reddedildi!',
                updatedCount 
            });
        }
        
        // GET request - Siparişleri göster
        const drivers = await base44.entities.Driver.filter({ id: driverId });
        const orders = await base44.entities.DailyOrder.filter({
            driver_id: driverId,
            order_date: orderDate
        }, 'pickup_time');

        if (drivers.length === 0) {
            return Response.json({ error: 'Sürücü bulunamadı' }, { status: 404 });
        }

        // HTML response oluştur
        const driver = drivers[0];
        const lang = driver.language || 'tr';

        // Çeviri metinleri
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
                totalOrders: 'Toplam',
                orders: 'Sipariş',
                goodWork: 'İyi çalışmalar!',
                approveAll: '✅ HEPSİNİ ONAYLA',
                rejectAll: '❌ HEPSİNİ REDDET',
                processing: '⏳ İşleniyor...',
                approved: '✅ Siparişler onaylandı!',
                rejected: '✅ Siparişler reddedildi!',
                error: '❌ Hata',
                connectionError: '❌ Bağlantı hatası',
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
                totalOrders: 'Total',
                orders: 'Orders',
                goodWork: 'Good luck!',
                approveAll: '✅ APPROVE ALL',
                rejectAll: '❌ REJECT ALL',
                processing: '⏳ Processing...',
                approved: '✅ Orders approved!',
                rejected: '✅ Orders rejected!',
                error: '❌ Error',
                connectionError: '❌ Connection error',
                noOrders: 'No orders found for today.'
            }
        };

        const text = t[lang];
        
        const ordersHTML = orders.map((order, index) => `
            <div style="background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">📦 ${text.order.toUpperCase()} #${order.ezcater_order_id}</span>
                        <span style="background: rgba(255,255,255,0.25); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; backdrop-filter: blur(10px);">#${index + 1}</span>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 0;">
                    <!-- Pickup -->
                    <div style="padding: 20px; background: #f0fdf4; border-bottom: 1px solid #d1fae5;">
                        <p style="font-size: 10px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">🟢 ${text.pickupAddress}</p>
                        <p style="font-size: 15px; color: #1a202c; margin: 0; font-weight: 600; line-height: 1.5;">${order.pickup_address}</p>
                    </div>

                    <!-- Delivery -->
                    <div style="padding: 20px; background: #fef2f2; border-bottom: 1px solid #fecaca;">
                        <p style="font-size: 10px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">🔴 ${text.deliveryAddress}</p>
                        <p style="font-size: 15px; color: #1a202c; margin: 0; font-weight: 600; line-height: 1.5;">${order.dropoff_address}</p>
                    </div>

                    <!-- Times -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #e2e8f0;">
                        <div style="padding: 20px; background: #eff6ff; border-right: 1px solid #bfdbfe;">
                            <p style="font-size: 10px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">⏰ ${text.pickupTime}</p>
                            <p style="font-size: 32px; color: #1a202c; margin: 0; font-weight: 800; letter-spacing: -1px;">${order.pickup_time}</p>
                        </div>
                        <div style="padding: 20px; background: #faf5ff;">
                            <p style="font-size: 10px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">🎯 ${text.deliveryTime}</p>
                            <p style="font-size: 13px; color: #718096; margin: 0 0 4px 0; font-weight: 600;">${order.order_date}</p>
                            <p style="font-size: 32px; color: #1a202c; margin: 0; font-weight: 800; letter-spacing: -1px;">${order.dropoff_time}</p>
                        </div>
                    </div>
                </div>
                
                ${order.customer_name ? `
                    <div style="padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <p style="font-size: 15px; color: #4a5568; margin: 0; font-weight: 600;"><strong style="color: #2d3748;">${text.customer}:</strong> ${order.customer_name}</p>
                    </div>
                ` : ''}

                ${order.ezcater_notes ? `
                    <div style="padding: 20px; background: #fffbeb; border-left: 4px solid #f59e0b;">
                        <p style="font-size: 10px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">📝 ${text.notes}</p>
                        <p style="font-size: 15px; color: #78350f; margin: 0; line-height: 1.6; font-weight: 500;">${order.ezcater_notes}</p>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TEST v99</title>
</head>
<body style="margin: 0; padding: 40px; background: #ff0000; font-family: sans-serif;">
<div style="background: white; padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
<h1 style="color: #ff0000; margin: 0 0 20px 0;">🔴 TEST v99 - DEPLOY TEST</h1>
<p style="font-size: 18px; margin: 0 0 20px 0;">Driver: ${driver.name}</p>
<p style="font-size: 18px; margin: 0 0 20px 0;">Orders: ${orders.length}</p>

<button onclick="alert('BUTTON WORKS!')" style="width: 100%; padding: 20px; background: #10b981; color: white; border: none; border-radius: 14px; font-size: 18px; font-weight: 700; cursor: pointer; margin-bottom: 16px;">
✅ TEST ONAYLA BUTTON
</button>

<button onclick="alert('REJECT WORKS!')" style="width: 100%; padding: 20px; background: #ef4444; color: white; border: none; border-radius: 14px; font-size: 18px; font-weight: 700; cursor: pointer;">
❌ TEST REDDET BUTTON
</button>
</div>
</body>
</html>`;
        
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
        
    } catch (error) {
        console.error('Hata:', error);
        return new Response(`
            <html>
            <body style="font-family: sans-serif; text-align: center; padding: 40px;">
                <h1 style="color: #dc2626;">⚠️ Hata</h1>
                <p>${error.message}</p>
            </body>
            </html>
        `, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
});