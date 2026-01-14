import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ⚠️ KRİTİK: Bu fonksiyon EzCater sipariş ekran görüntülerinden veri çeker
 * 
 * ÇEKİLMESİ ZORUNLU ALANLAR (Bu alanlar silinmemeli/unutulmamalı):
 * - order_no (Order No/EzCater Order ID)
 * - pickup_address (Pickup Address)
 * - delivery_address (Delivery Address)
 * - pickup_time (Pickup Time)
 * - delivery_datetime (Delivery Date + Time)
 * - price ($ işareti ile, örn: $276.00) ⚠️ ZORUNLU
 * - tip ($ işareti ile, örn: $15.00) ⚠️ ZORUNLU
 * 
 * Bu fonksiyonda yapılacak değişiklikler test edilmelidir!
 * Test için: testOCRParsing fonksiyonunu kullanın
 */

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { file_url, target_date } = await req.json();
        
        console.log("📸 Screenshot parse ediliyor...");
        
        // ⚠️ KRİTİK: Bu prompt ve JSON şeması değiştirilirse MUTLAKA test edilmeli
        // Price ve Tip alanları ZORUNLU olarak çekilmelidir
        const parseResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Bu görsel bir EzCater sipariş tablosu. Her satırda şu bilgiler var:
- Order No (sipariş numarası)
- Pickup Address (pickup adresi)
- Delivery Address (teslimat adresi)  
- Pickup Time (alış saati)
- Delivery Time (teslimat tarihi + saati)
- Price (fiyat - $ işareti ile, örn: $276.00) ⚠️ ZORUNLU ALAN
- Tip (bahşiş - $ işareti ile, örn: $15.00) ⚠️ ZORUNLU ALAN

ÖRNEKLER:
Order No: "EzJ8EC02"
Pickup: "1100 1st St NE Floor 12 Ste 12 Ste 12 SUITE 12, Washington, DC 20002"
Delivery: "3301 Georgia Ave NW, Washington, DC 20010"
Pickup Time: "07:46 AM"
Delivery Time: "08/16 AM → 08:30"
Price: "$276.00"
Tip: "$15.00"

ÖNEMLİ: 
- Price ve Tip'ten $ işaretini kaldırıp sadece sayı olarak döndür
- Eğer bir alan boş/okunamazsa null döndür
- ⚠️ PRICE VE TIP ALANLARI MUTLAKA ÇEKİLMELİ

ÇIKAR: Tüm satırları JSON array olarak döndür.`,
            file_urls: [file_url],
            // ⚠️ KRİTİK: Bu şema değiştirilirse price ve tip alanlarının korunduğundan emin olun
            response_json_schema: {
                type: "object",
                properties: {
                    orders: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                order_no: { type: "string" },
                                pickup_address: { type: "string" },
                                delivery_address: { type: "string" },
                                pickup_time: { type: "string" },
                                delivery_datetime: { type: "string" },
                                price: { type: ["number", "null"] },  // ⚠️ ZORUNLU - Silinmemeli
                                tip: { type: ["number", "null"] }      // ⚠️ ZORUNLU - Silinmemeli
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
                ezcater_order_id: order.order_no || `SS${Date.now()}_${i}`,
                order_date: orderDate,
                pickup_address: order.pickup_address,
                pickup_time: order.pickup_time,
                dropoff_address: order.delivery_address,
                dropoff_time: deliveryTime,
                customer_name: 'Screenshot Upload',
                price: order.price || null,
                tip: order.tip || null,
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