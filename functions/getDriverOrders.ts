import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        console.log('📱 Link açılıyor...');
        console.log('URL:', req.url);
        
        // URL parametrelerini al
        const url = new URL(req.url);
        const driverId = url.searchParams.get('d');
        const orderDate = url.searchParams.get('t');
        
        console.log('Driver ID:', driverId);
        console.log('Date:', orderDate);
        
        if (!driverId || !orderDate) {
            return Response.json({ error: 'Geçersiz link' }, { status: 400 });
        }
        
        // Service role ile veri çek (auth olmadan)
        const drivers = await base44.asServiceRole.entities.Driver.filter({ id: driverId });
        const orders = await base44.asServiceRole.entities.DailyOrder.filter({
            driver_id: driverId,
            order_date: orderDate
        }, 'pickup_time');
        
        if (drivers.length === 0) {
            return Response.json({ error: 'Sürücü bulunamadı' }, { status: 404 });
        }
        
        // HTML response oluştur
        const driver = drivers[0];
        
        const ordersHTML = orders.map((order, index) => `
            <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 16px; overflow: hidden;">
                <div style="background: linear-gradient(to right, #2563eb, #1d4ed8); color: white; padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 18px; font-weight: 600;">📦 Sipariş #${order.ezcater_order_id}</span>
                        <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 14px;">${index + 1}. Sipariş</span>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 0;">
                    <!-- Pickup -->
                    <div style="padding: 16px; background: #f0fdf4; border-bottom: 1px solid #e5e7eb;">
                        <p style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; margin: 0 0 8px 0;">🟢 PICKUP ADDRESS</p>
                        <p style="font-size: 14px; color: #1f2937; margin: 0; font-weight: 500;">${order.pickup_address}</p>
                    </div>
                    
                    <!-- Delivery -->
                    <div style="padding: 16px; background: #fef2f2; border-bottom: 1px solid #e5e7eb;">
                        <p style="font-size: 11px; font-weight: 700; color: #b91c1c; text-transform: uppercase; margin: 0 0 8px 0;">🔴 DELIVERY ADDRESS</p>
                        <p style="font-size: 14px; color: #1f2937; margin: 0; font-weight: 500;">${order.dropoff_address}</p>
                    </div>
                    
                    <!-- Times -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #e5e7eb;">
                        <div style="padding: 16px; background: #eff6ff; border-right: 1px solid #e5e7eb;">
                            <p style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase; margin: 0 0 8px 0;">⏰ PICKUP TIME</p>
                            <p style="font-size: 28px; color: #1f2937; margin: 0; font-weight: 700;">${order.pickup_time}</p>
                        </div>
                        <div style="padding: 16px; background: #faf5ff;">
                            <p style="font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase; margin: 0 0 4px 0;">🎯 DELIVERY TIME</p>
                            <p style="font-size: 14px; color: #6b7280; margin: 0; font-weight: 600;">${order.order_date}</p>
                            <p style="font-size: 28px; color: #1f2937; margin: 0; font-weight: 700;">${order.dropoff_time}</p>
                        </div>
                    </div>
                </div>
                
                ${order.customer_name ? `
                    <div style="padding: 16px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;">
                        <p style="font-size: 14px; color: #475569; margin: 0;"><strong>Müşteri:</strong> ${order.customer_name}</p>
                    </div>
                ` : ''}
                
                ${order.ezcater_notes ? `
                    <div style="padding: 16px; background: #fefce8;">
                        <p style="font-size: 11px; font-weight: 700; color: #854d0e; text-transform: uppercase; margin: 0 0 4px 0;">📝 NOTLAR:</p>
                        <p style="font-size: 14px; color: #713f12; margin: 0;">${order.ezcater_notes}</p>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Siparişleriniz</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: linear-gradient(to bottom right, #eff6ff, #f1f5f9);
            min-height: 100vh;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        @media (max-width: 768px) {
            .container { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div style="background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 24px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 64px; height: 64px; background: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: 700;">
                    ${driver.name?.charAt(0) || '?'}
                </div>
                <div>
                    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #0f172a;">
                        Merhaba ${driver.name || 'Sürücü'}!
                    </h1>
                    <p style="margin: 0; color: #64748b; font-size: 16px;">
                        📅 Bugünkü Siparişleriniz (${orders.length})
                    </p>
                </div>
            </div>
        </div>
        
        ${orders.length === 0 ? `
            <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 48px; text-align: center;">
                <p style="color: #64748b; margin: 0;">Bugün için sipariş bulunamadı.</p>
            </div>
        ` : ordersHTML}
        
        <!-- Footer -->
        <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 24px; text-align: center; margin-top: 32px;">
            <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
                Toplam ${orders.length} Sipariş
            </p>
            <p style="margin: 0; color: #64748b;">
                İyi çalışmalar! 🚚
            </p>
        </div>
    </div>
</body>
</html>
        `;
        
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