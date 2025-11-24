import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { targetDate } = await req.json();
        
        // API anahtarları environment'tan al
        const clientId = Deno.env.get("EZCATER_CLIENT_ID");
        const clientSecret = Deno.env.get("EZCATER_CLIENT_SECRET");
        
        if (!clientId || !clientSecret) {
            return Response.json({ 
                error: 'EzCater API anahtarları ayarlanmamış. Lütfen ayarlardan API bilgilerinizi girin.' 
            }, { status: 400 });
        }

        console.log("EzCater API'sine bağlanıyor...", { targetDate });

        // EzCater OAuth token al
        const tokenResponse = await fetch('https://api.ezcater.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': clientId,
                'client_secret': clientSecret,
            }),
        });

        if (!tokenResponse.ok) {
            const tokenError = await tokenResponse.text();
            console.error("OAuth token alınamadı:", tokenError);
            return Response.json({ 
                error: 'EzCater API bağlantısı başarısız. API anahtarlarınızı kontrol edin.' 
            }, { status: 401 });
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Bugünün tarihini kullan (targetDate verilmemişse)
        const today = targetDate || new Date().toISOString().split('T')[0];

        // Siparişleri çek
        const ordersResponse = await fetch(`https://api.ezcater.com/api/v2/orders?delivery_date=${today}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!ordersResponse.ok) {
            const ordersError = await ordersResponse.text();
            console.error("Siparişler çekilemedi:", ordersError);
            return Response.json({ 
                error: 'Siparişler çekilemedi. EzCater API yanıt vermedi.' 
            }, { status: 500 });
        }

        const ordersData = await ordersResponse.json();
        console.log("EzCater'dan çekilen sipariş sayısı:", ordersData.orders?.length || 0);

        // Mevcut siparişleri kontrol et (tekrar çekmeyi önle)
        const existingOrders = await base44.entities.DailyOrder.filter({ 
            order_date: today 
        });
        
        const existingOrderIds = existingOrders.map(order => order.ezcater_order_id);
        const newOrders = [];

        // Yeni siparişleri hazırla
        for (const order of ordersData.orders || []) {
            if (!existingOrderIds.includes(order.id)) {
                newOrders.push({
                    ezcater_order_id: order.id,
                    order_date: today,
                    pickup_address: order.restaurant?.address || 'Adres belirtilmemiş',
                    pickup_time: order.pickup_time || '12:00',
                    dropoff_address: order.delivery_address,
                    dropoff_time: order.delivery_time,
                    customer_name: order.customer_name || 'Müşteri adı yok',
                    ezcater_notes: order.special_instructions || '',
                    status: "Çekildi"
                });
            }
        }

        // Yeni siparişleri veritabanına kaydet
        if (newOrders.length > 0) {
            await base44.entities.DailyOrder.bulkCreate(newOrders);
        }

        return Response.json({
            success: true,
            message: `${newOrders.length} yeni sipariş eklendi. Toplam: ${ordersData.orders?.length || 0}`,
            newOrders: newOrders.length,
            totalOrders: ordersData.orders?.length || 0,
            date: today
        });

    } catch (error) {
        console.error("EzCater API fonksiyon hatası:", error);
        return Response.json({ 
            error: `API hatası: ${error.message}` 
        }, { status: 500 });
    }
});