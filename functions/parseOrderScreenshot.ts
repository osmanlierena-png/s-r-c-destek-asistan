import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { file_url, target_date } = await req.json();
        
        console.log("📸 Screenshot parse ediliyor...");
        
        // GPT ile tablo parse et
        const parseResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Bu görsel bir sipariş tablosu. Her satırda şu bilgiler var:
- Pickup Address (sol kolon)
- Delivery Address (2. kolon)
- Pickup Time (3. kolon)
- Delivery Time (4. kolon - tarih + saat)

ÖRNEKLER:
Pickup: "1212 4th St SE, Washington, DC 20003"
Delivery: "2050 M St NW, Washington, DC 20036"
Pickup Time: "10:15 AM"
Delivery Time: "10/8/2025 11:00:00 AM"

ÇIKAR: Tüm satırları JSON array olarak döndür.`,
            file_urls: [file_url],
            response_json_schema: {
                type: "object",
                properties: {
                    orders: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                pickup_address: { type: "string" },
                                delivery_address: { type: "string" },
                                pickup_time: { type: "string" },
                                delivery_datetime: { type: "string" }
                            },
                            required: ["pickup_address", "delivery_address", "pickup_time", "delivery_datetime"]
                        }
                    }
                }
            }
        });
        
        if (!parseResult.orders || parseResult.orders.length === 0) {
            return Response.json({ 
                success: false, 
                error: 'Hiçbir sipariş bulunamadı' 
            });
        }
        
        console.log(`✅ ${parseResult.orders.length} sipariş parse edildi`);
        
        // Order_date çıkar (delivery_datetime'dan)
        const orderDate = target_date || parseResult.orders[0].delivery_datetime.split(' ')[0];
        
        // Database'e kaydet
        const createdOrders = [];
        
        for (let i = 0; i < parseResult.orders.length; i++) {
            const order = parseResult.orders[i];
            
            // Delivery time'ı parse et
            const deliveryMatch = order.delivery_datetime.match(/(\d{1,2}:\d{2}:\d{2}\s*[AP]M)/i);
            const deliveryTime = deliveryMatch ? deliveryMatch[1] : order.delivery_datetime;
            
            const newOrder = await base44.entities.DailyOrder.create({
                ezcater_order_id: `SS${Date.now()}_${i}`,
                order_date: orderDate,
                pickup_address: order.pickup_address,
                pickup_time: order.pickup_time,
                dropoff_address: order.delivery_address,
                dropoff_time: deliveryTime,
                customer_name: 'Screenshot Upload',
                status: 'Çekildi'
            });
            
            createdOrders.push(newOrder);
            
            await new Promise(r => setTimeout(r, 200));
        }
        
        return Response.json({
            success: true,
            message: `${createdOrders.length} sipariş eklendi`,
            orders: createdOrders,
            orderDate: orderDate
        });

    } catch (error) {
        console.error("Parse hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});