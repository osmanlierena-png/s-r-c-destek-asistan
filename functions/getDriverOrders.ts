import { createBase44Client } from 'npm:@base44/sdk@0.8.4';

// Driver orders with approve/reject functionality
Deno.serve(async (req) => {
    try {
        // URL parametrelerini al
        const url = new URL(req.url);
        const driverId = url.searchParams.get('d');
        const orderDate = url.searchParams.get('t');
        
        console.log('📱 YENİ SİSTEM ÇALIŞIYOR - APPROVE/REJECT BUTONLARI AKTİF! v4');
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
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${text.todayOrders}</title>
        <style>
        * { 
            box-sizing: border-box; 
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            line-height: 1.6;
        }
        .container {
            max-width: 680px;
            margin: 0 auto;
        }
        @media (max-width: 768px) {
            body { padding: 12px; }
            .container { padding: 0; }
        }
        </style>
        </head>
        <body>
    <div class="container">
        <!-- Header -->
        <div style="background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 32px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 20px;">
                <div style="width: 72px; height: 72px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px; font-weight: 700; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                    ${driver.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style="flex: 1;">
                    <h1 style="margin: 0 0 4px 0; font-size: 28px; font-weight: 700; color: #1a202c; letter-spacing: -0.5px;">
                        ${text.greeting} ${driver.name || 'Driver'}!
                    </h1>
                    <p style="margin: 0; color: #718096; font-size: 16px; font-weight: 500;">
                        📅 ${text.todayOrders} <span style="display: inline-block; background: #667eea; color: white; padding: 2px 10px; border-radius: 12px; font-size: 14px; font-weight: 600; margin-left: 8px;">${orders.length}</span>
                    </p>
                </div>
            </div>
        </div>
        
        ${orders.length === 0 ? `
            <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 48px; text-align: center;">
                <p style="color: #64748b; margin: 0;">${text.noOrders}</p>
            </div>
        ` : ordersHTML}
        
        <!-- Footer -->
        <div style="background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 32px; text-align: center; margin-top: 32px;">
            <p style="margin: 0 0 4px 0; font-size: 22px; font-weight: 800; color: #1a202c; letter-spacing: -0.5px;">
                ${text.totalOrders} ${orders.length} ${text.orders}
            </p>
            <p style="margin: 0 0 28px 0; color: #718096; font-size: 16px; font-weight: 500;">
                ${text.goodWork} 🚚
            </p>

            <!-- Onay Butonları -->
            <div style="display: flex; gap: 16px; margin-top: 24px;">
                <button 
                    onclick="handleResponse('approve')" 
                    style="flex: 1; padding: 18px 28px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35); transition: transform 0.2s, box-shadow 0.2s; letter-spacing: 0.5px;"
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 32px rgba(16, 185, 129, 0.45)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 24px rgba(16, 185, 129, 0.35)';"
                >
                    ${text.approveAll}
                </button>
                <button 
                    onclick="handleResponse('reject')" 
                    style="flex: 1; padding: 18px 28px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.35); transition: transform 0.2s, box-shadow 0.2s; letter-spacing: 0.5px;"
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 32px rgba(239, 68, 68, 0.45)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 24px rgba(239, 68, 68, 0.35)';"
                >
                    ${text.rejectAll}
                </button>
            </div>

            <div id="responseMessage" style="margin-top: 20px; padding: 16px; border-radius: 12px; display: none; font-weight: 600; font-size: 15px;"></div>
        </div>
    </div>
    
    <script>
        async function handleResponse(response) {
            const btn = event.target;
            const t = {
                processing: '${text.processing}',
                approved: '${text.approved}',
                rejected: '${text.rejected}',
                error: '${text.error}',
                connectionError: '${text.connectionError}',
                orders: '${text.orders}'
            };

            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.innerHTML = t.processing;

            try {
                const res = await fetch(window.location.href, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ response })
                });

                const data = await res.json();

                const messageDiv = document.getElementById('responseMessage');
                messageDiv.style.display = 'block';

                if (data.success) {
                    messageDiv.style.background = '#dcfce7';
                    messageDiv.style.color = '#166534';
                    messageDiv.style.border = '2px solid #86efac';
                    const msg = response === 'approve' ? t.approved : t.rejected;
                    messageDiv.innerHTML = msg + ' (' + data.updatedCount + ' ' + t.orders + ')';

                    // Butonları gizle
                    document.querySelectorAll('button').forEach(b => b.style.display = 'none');
                } else {
                    messageDiv.style.background = '#fee2e2';
                    messageDiv.style.color = '#991b1b';
                    messageDiv.style.border = '2px solid #fca5a5';
                    messageDiv.innerHTML = t.error + ': ' + data.message;
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.innerHTML = originalText;
                }
            } catch (error) {
                const messageDiv = document.getElementById('responseMessage');
                messageDiv.style.display = 'block';
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.innerHTML = t.connectionError + ': ' + error.message;
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.innerHTML = originalText;
            }
        }
    </script>
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