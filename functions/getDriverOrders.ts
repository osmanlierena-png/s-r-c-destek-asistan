import { createBase44Client } from 'npm:@base44/sdk@0.8.4';

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
        
        const appId = Deno.env.get('BASE44_APP_ID');
        const base44 = createBase44Client({
            appId,
            useServiceRole: true
        });
        
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
        
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>v100 NEW DEPLOY</title>
</head>
<body style="margin: 0; padding: 20px; background: #00ff00; font-family: sans-serif;">
<div style="background: white; padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
<h1 style="color: #00ff00; margin: 0 0 20px 0;">🟢 v100 - YENİ DEPLOY ÇALIŞTI!</h1>
<p style="font-size: 18px; margin: 0 0 20px 0;">Driver: ${driver.name}</p>
<p style="font-size: 18px; margin: 0 0 20px 0;">Orders: ${orders.length}</p>

<button onclick="handleClick('approve')" style="width: 100%; padding: 20px; background: #10b981; color: white; border: none; border-radius: 14px; font-size: 18px; font-weight: 700; cursor: pointer; margin-bottom: 16px;">
✅ ONAYLA
</button>

<button onclick="handleClick('reject')" style="width: 100%; padding: 20px; background: #ef4444; color: white; border: none; border-radius: 14px; font-size: 18px; font-weight: 700; cursor: pointer;">
❌ REDDET
</button>

<div id="msg" style="margin-top: 20px; padding: 16px; border-radius: 12px; display: none;"></div>
</div>

<script>
console.log('✅ Script loaded v100');

async function handleClick(response) {
    console.log('Button clicked:', response);
    const msg = document.getElementById('msg');
    msg.style.display = 'block';
    msg.textContent = 'Loading...';
    
    try {
        const res = await fetch(window.location.href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response })
        });
        
        const data = await res.json();
        
        if (data.success) {
            msg.style.background = '#dcfce7';
            msg.style.color = '#166534';
            msg.textContent = data.message + ' (' + data.updatedCount + ' sipariş)';
            document.querySelectorAll('button').forEach(b => b.style.display = 'none');
        } else {
            msg.style.background = '#fee2e2';
            msg.style.color = '#991b1b';
            msg.textContent = 'Hata: ' + data.message;
        }
    } catch (error) {
        msg.style.background = '#fee2e2';
        msg.style.color = '#991b1b';
        msg.textContent = 'Hata: ' + error.message;
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