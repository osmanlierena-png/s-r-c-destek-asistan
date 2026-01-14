import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * OCR Parse Test Fonksiyonu
 * 
 * Bu fonksiyon parseOrderScreenshot'ın doğru çalıştığını kontrol eder.
 * Herhangi bir değişiklik sonrası bu testi çalıştırarak tüm kritik alanların
 * (Order No, Price, Tip vb.) hala çekildiğini doğrulayın.
 * 
 * Kullanım:
 * POST /testOCRParsing
 * Body: { "file_url": "test_screenshot_url" }
 */

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    try {
        const { file_url } = await req.json();
        
        if (!file_url) {
            return Response.json({ 
                success: false,
                error: 'file_url parametresi gerekli' 
            });
        }

        console.log("🧪 OCR Parse Testi başlatılıyor...");
        
        // parseOrderScreenshot fonksiyonunu çağır
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
                                price: { type: ["number", "null"] },
                                tip: { type: ["number", "null"] }
                            },
                            required: ["pickup_address", "delivery_address", "pickup_time", "delivery_datetime"]
                        }
                    }
                }
            }
        });

        // Test sonuçlarını analiz et
        const testResults = {
            success: true,
            totalOrders: parseResult.orders?.length || 0,
            checks: {
                ordersFound: parseResult.orders && parseResult.orders.length > 0,
                hasOrderNo: false,
                hasPickupAddress: false,
                hasDeliveryAddress: false,
                hasPickupTime: false,
                hasDeliveryTime: false,
                hasPrice: false,
                hasTip: false
            },
            sampleOrder: null,
            missingFields: [],
            warnings: []
        };

        if (parseResult.orders && parseResult.orders.length > 0) {
            const sampleOrder = parseResult.orders[0];
            testResults.sampleOrder = sampleOrder;

            // Her kritik alanı kontrol et
            testResults.checks.hasOrderNo = !!sampleOrder.order_no;
            testResults.checks.hasPickupAddress = !!sampleOrder.pickup_address;
            testResults.checks.hasDeliveryAddress = !!sampleOrder.delivery_address;
            testResults.checks.hasPickupTime = !!sampleOrder.pickup_time;
            testResults.checks.hasDeliveryTime = !!sampleOrder.delivery_datetime;
            testResults.checks.hasPrice = sampleOrder.price !== undefined;
            testResults.checks.hasTip = sampleOrder.tip !== undefined;

            // Eksik alanları belirle
            if (!testResults.checks.hasOrderNo) testResults.missingFields.push("order_no");
            if (!testResults.checks.hasPickupAddress) testResults.missingFields.push("pickup_address");
            if (!testResults.checks.hasDeliveryAddress) testResults.missingFields.push("delivery_address");
            if (!testResults.checks.hasPickupTime) testResults.missingFields.push("pickup_time");
            if (!testResults.checks.hasDeliveryTime) testResults.missingFields.push("delivery_datetime");
            
            // ⚠️ KRİTİK: Price ve Tip kontrolleri
            if (!testResults.checks.hasPrice) {
                testResults.missingFields.push("price ⚠️ KRİTİK");
                testResults.success = false;
            }
            if (!testResults.checks.hasTip) {
                testResults.missingFields.push("tip ⚠️ KRİTİK");
                testResults.success = false;
            }

            // Uyarılar
            if (sampleOrder.price === null) {
                testResults.warnings.push("Price null - ekran görüntüsünde bu alan görünmüyor olabilir");
            }
            if (sampleOrder.tip === null) {
                testResults.warnings.push("Tip null - ekran görüntüsünde bu alan görünmüyor olabilir");
            }
        } else {
            testResults.success = false;
            testResults.missingFields.push("Hiç sipariş bulunamadı");
        }

        // Test sonucunu logla
        if (testResults.success) {
            console.log("✅ OCR Parse Testi BAŞARILI - Tüm kritik alanlar mevcut");
        } else {
            console.error("❌ OCR Parse Testi BAŞARISIZ - Eksik alanlar:", testResults.missingFields);
        }

        return Response.json({
            success: testResults.success,
            message: testResults.success 
                ? "✅ Test başarılı - OCR düzgün çalışıyor" 
                : "❌ Test başarısız - Bazı kritik alanlar eksik",
            testResults
        });

    } catch (error) {
        console.error('❌ Test hatası:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});