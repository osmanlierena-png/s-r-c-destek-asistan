import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    const apiKey = req.headers.get('api_key');
if (apiKey !== '47aadaf67ea94f1f9021c59986b2d158' && !(await base44.auth.isAuthenticated())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

    try {
        const { orderIds } = await req.json();
        
        if (!orderIds || orderIds.length === 0) {
            return Response.json({ 
                success: false,
                message: 'Sipariş ID\'leri gerekli' 
            });
        }

        console.log(`\n📦 ${orderIds.length} sipariş için SMS gönderiliyor...`);
        console.log(`📋 Order IDs:`, orderIds);
        
        // Twilio bilgilerini kontrol et
        const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        let twilioFromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
            return Response.json({ 
                success: false,
                message: 'Twilio bilgileri eksik' 
            });
        }

        // Telefon numarasını temizle
        twilioFromNumber = twilioFromNumber.replace(/[^\d+]/g, '');

        console.log(`\n🚀 PRODUCTION MODU - Sürücülere gruplu SMS gönderilecek`);

        const results = {
            sent: [],
            failed: [],
            skipped: []
        };

        // Tüm siparişleri al ve sürücü+tarih bazında grupla
        const ordersByDriverAndDate = {};

        for (const orderId of orderIds) {
            try {
                console.log(`\n🔍 Sipariş kontrol ediliyor: ${orderId}`);
                const orders = await base44.asServiceRole.entities.DailyOrder.filter({ id: orderId });
                const order = orders[0];

                if (!order) {
                    console.log(`❌ Sipariş bulunamadı: ${orderId}`);
                    results.failed.push({
                        orderId,
                        reason: 'Sipariş bulunamadı'
                    });
                    continue;
                }

                console.log(`✅ Sipariş bulundu: ${order.ezcater_order_id}`);
                console.log(`   📊 Status: ${order.status}`);
                console.log(`   👤 Driver: ${order.driver_name || 'YOK'} (ID: ${order.driver_id || 'YOK'})`);
                console.log(`   📞 Phone: ${order.driver_phone || 'YOK'}`);
                console.log(`   💬 Response: ${order.driver_response || 'YOK'}`);

                if (!order.driver_id || !order.driver_phone || order.driver_phone.trim() === '') {
                    console.log(`❌ ATLANMA SEBEBİ: Sürücü bilgisi eksik`);
                    console.log(`   - driver_id: ${order.driver_id || 'EKSIK'}`);
                    console.log(`   - driver_phone: ${order.driver_phone || 'EKSIK'}`);
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: 'Sürücü atanmamış veya telefon numarası eksik'
                    });
                    continue;
                }

                // ⚠️ YENİ KONTROL: Sürücü zaten yanıt verdiyse veya SMS gönderildiyse atla
                if (order.status === 'Sürücü Onayladı' || order.status === 'Sürücü Reddetti' || order.status === 'Sürücü Onayı Bekleniyor') {
                    console.log(`⏩ ATLANMA SEBEBİ: SMS zaten gönderilmiş veya yanıtlanmış`);
                    console.log(`   - status: "${order.status}"`);
                    console.log(`   - driver_response: "${order.driver_response || 'YOK'}"`);
                    console.log(`   - sms_sent_at: ${order.sms_sent_at || 'YOK'}`);
                    console.log(`   💡 NOT: Bu sipariş zaten SMS aşamasında veya sonrasında`);
                    results.skipped.push({
                        orderId: order.ezcater_order_id,
                        reason: `SMS zaten gönderilmiş/yanıtlanmış (${order.status})`
                    });
                    continue;
                }

                console.log(`✅ Sipariş SMS için uygun, gruplama işlemine alınıyor...`);

                // Sürücü+tarih bazında grupla
                const groupKey = `${order.driver_id}_${order.order_date}`;
                
                if (!ordersByDriverAndDate[groupKey]) {
                    ordersByDriverAndDate[groupKey] = {
                        driver_id: order.driver_id,
                        driver_name: order.driver_name,
                        driver_phone: order.driver_phone,
                        order_date: order.order_date,
                        orders: []
                    };
                }

                ordersByDriverAndDate[groupKey].orders.push(order);

            } catch (error) {
                results.failed.push({
                    orderId,
                    reason: error.message
                });
                console.error(`❌ Sipariş getirme hatası (${orderId}):`, error);
            }
        }

        console.log(`\n👥 ${Object.keys(ordersByDriverAndDate).length} farklı sürücü+tarih kombinasyonu bulundu`);

        if (Object.keys(ordersByDriverAndDate).length === 0) {
            console.log(`\n⚠️ UYARI: Hiçbir sipariş gruplandırılamadı!`);
            console.log(`📊 Özet:`);
            console.log(`   - Toplam gönderilmek istenen: ${orderIds.length}`);
            console.log(`   - Başarısız: ${results.failed.length}`);
            console.log(`   - Atlanan: ${results.skipped.length}`);
            console.log(`\n💡 Muhtemel sebepler:`);
            console.log(`   1. Tüm siparişlerde driver_response dolu (önceden yanıtlanmış)`);
            console.log(`   2. Sürücü bilgileri eksik (driver_id, driver_phone)`);
            console.log(`   3. Telefon numaraları geçersiz`);
        }

        // Her sürücü+tarih grubu için tek bir SMS gönder
        for (const [groupKey, group] of Object.entries(ordersByDriverAndDate)) {
            try {
                const { driver_id, driver_name, driver_phone, order_date, orders } = group;

                console.log(`\n📤 ${driver_name} için SMS hazırlanıyor (${orders.length} sipariş, ${order_date})`);

                // Telefon numarası validasyonu
                const phone = driver_phone;
                
                if (phone.toUpperCase().includes('MISSING')) {
                    orders.forEach(order => {
                        results.failed.push({
                            orderId: order.ezcater_order_id,
                            reason: 'Telefon numarası "MISSING" olarak işaretli'
                        });
                    });
                    console.log(`⚠️ ${driver_name} atlandı - MISSING: ${phone}`);
                    continue;
                }

                if (phone.includes(' ') || phone.includes('(') || phone.includes(')')) {
                    orders.forEach(order => {
                        results.failed.push({
                            orderId: order.ezcater_order_id,
                            reason: 'Telefon numarası geçersiz karakterler içeriyor'
                        });
                    });
                    console.log(`⚠️ ${driver_name} atlandı - Geçersiz format: ${phone}`);
                    continue;
                }

                let toPhoneNumber = phone.trim();
                if (!toPhoneNumber.startsWith('+')) {
                    toPhoneNumber = '+' + toPhoneNumber.replace(/[^\d]/g, '');
                }

                if (!toPhoneNumber.startsWith('+1')) {
                    orders.forEach(order => {
                        results.failed.push({
                            orderId: order.ezcater_order_id,
                            reason: `ABD dışı numara: ${toPhoneNumber.substring(0, 4)}...`
                        });
                    });
                    console.log(`⚠️ ${driver_name} atlandı - ABD dışı numara: ${toPhoneNumber}`);
                    continue;
                }

                if (toPhoneNumber.length !== 12) {
                    orders.forEach(order => {
                        results.failed.push({
                            orderId: order.ezcater_order_id,
                            reason: `Geçersiz numara uzunluğu: ${toPhoneNumber.length} karakter`
                        });
                    });
                    console.log(`⚠️ ${driver_name} atlandı - Yanlış uzunluk: ${toPhoneNumber}`);
                    continue;
                }

                const digitsOnly = toPhoneNumber.substring(2);
                if (!/^\d{10}$/.test(digitsOnly)) {
                    orders.forEach(order => {
                        results.failed.push({
                            orderId: order.ezcater_order_id,
                            reason: 'Telefon numarası sadece rakam içermeli'
                        });
                    });
                    console.log(`⚠️ ${driver_name} atlandı - Geçersiz karakter: ${toPhoneNumber}`);
                    continue;
                }

                // Backend function URL'ini oluştur
                const baseUrl = Deno.env.get('DRIVER_ORDERS_FUNCTION_URL');
                if (!baseUrl) {
                    orders.forEach(order => {
                        results.failed.push({
                            orderId: order.ezcater_order_id,
                            reason: 'DRIVER_ORDERS_FUNCTION_URL environment variable tanımlı değil'
                        });
                    });
                    console.log(`⚠️ ${driver_name} atlandı - Function URL eksik`);
                    continue;
                }
                
                // UNIQUE MESSAGE GROUP ID - Her SMS için benzersiz bir ID oluştur
                const messageGroupId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const functionUrl = `${baseUrl}?d=${encodeURIComponent(driver_id)}&t=${encodeURIComponent(order_date)}&mg=${encodeURIComponent(messageGroupId)}`;

                // SMS mesajı oluştur - grup ve tekli siparişleri doğru hesapla
                // Canvas_price kullan - tek kaynak
                const groupedByCanvasId = {};
                orders.forEach(o => {
                    const groupId = o.canvas_group_id || `single_${o.id}`;
                    if (!groupedByCanvasId[groupId]) {
                        groupedByCanvasId[groupId] = {
                            ids: [],
                            price: 0  // Başlangıçta 0, her siparişin fiyatı toplanacak
                        };
                    }

                    // Canvas_price'ı topla - SADECE 0'dan büyük olanları
                    if (o.canvas_price && o.canvas_price !== null && o.canvas_price !== undefined) {
                        const price = parseFloat(o.canvas_price);
                        if (!isNaN(price) && price > 0) {
                            groupedByCanvasId[groupId].price += price;
                            console.log(`💵 ${o.ezcater_order_id}: +$${price} → Grup Total: $${groupedByCanvasId[groupId].price}`);
                        }
                    }

                    groupedByCanvasId[groupId].ids.push(o.ezcater_order_id);
                });
                
                // Total fiyat hesaplama - her grup için sadece bir kez fiyat
                const totalPrice = Object.values(groupedByCanvasId).reduce((sum, g) => sum + g.price, 0);

                console.log(`💵 ${driver_name} → Total: $${totalPrice.toFixed(2)} (Canvas fiyat)`);
                if (totalPrice === 0) {
                    console.warn(`⚠️ ${driver_name} için toplam fiyat $0 - Canvas'ta fiyat girilmemiş olabilir`);
                }

                const ordersSummary = Object.entries(groupedByCanvasId).slice(0, 3)
                    .map(([_, g]) => `${g.ids.join('/')} ($${g.price.toFixed(2)})`)
                    .join(', ');
                const ordersTail = Object.keys(groupedByCanvasId).length > 3 ? ` +${Object.keys(groupedByCanvasId).length - 3} more` : '';
                
                const message = `🚚 New Orders! (${orders.length})
${ordersSummary}${ordersTail}
Total: $${totalPrice.toFixed(2)}

Click to view order details:
${functionUrl}`;

                console.log(`📤 SMS gönderiliyor: ${driver_name} (${toPhoneNumber}) - ${orders.length} sipariş`);

                // SMS gönder
                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
                
                const formData = new URLSearchParams();
                formData.append('To', toPhoneNumber);
                formData.append('From', twilioFromNumber);
                formData.append('Body', message);

                const response = await fetch(twilioUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
                    },
                    body: formData.toString()
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Bu gruptaki TÜM siparişlerin durumunu güncelle
                    for (const order of orders) {
                        await base44.asServiceRole.entities.DailyOrder.update(order.id, {
                            status: "Sürücü Onayı Bekleniyor",
                            sms_sent_at: new Date().toISOString(),
                            message_group_id: messageGroupId // Bu SMS'in unique ID'si
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
                                        type: 'SMS_SENT',
                                        orderId: order.id,
                                        orderNumber: order.ezcater_order_id,
                                        driverName: order.driver_name,
                                        sentTime: new Date().toISOString(),
                                        date: order.order_date,
                                        groupId: order.canvas_group_id || null
                                    })
                                });
                            } catch (err) {
                                console.error('⚠️ Canvas bildirimi başarısız:', err);
                            }
                        }

                        results.sent.push({
                            orderId: order.ezcater_order_id,
                            driver: order.driver_name,
                            phone: order.driver_phone,
                            sid: data.sid
                        });
                    }

                    console.log(`✅ ${orders.length} sipariş için SMS gönderildi → ${driver_name} (${driver_phone})`);
                } else {
                    const errorData = await response.json();
                    
                    orders.forEach(order => {
                        results.failed.push({
                            orderId: order.ezcater_order_id,
                            reason: errorData.message || 'SMS gönderilemedi'
                        });
                    });
                    
                    console.error(`❌ ${driver_name} → Hata: ${errorData.message}`);
                }

                // Rate limiting
                await new Promise(r => setTimeout(r, 1000));

            } catch (error) {
                const group = ordersByDriverAndDate[groupKey];
                group.orders.forEach(order => {
                    results.failed.push({
                        orderId: order.ezcater_order_id,
                        reason: error.message
                    });
                });
                console.error(`❌ Grup işleme hatası (${groupKey}):`, error);
            }
        }

        console.log(`\n📊 Sonuç:`);
        console.log(`   ✅ Gönderilen: ${results.sent.length}`);
        console.log(`   ❌ Başarısız: ${results.failed.length}`);
        console.log(`   ⏩ Atlanan: ${results.skipped.length}`);

        return Response.json({
            success: true,
            message: `${Object.keys(ordersByDriverAndDate).length} sürücüye SMS gönderildi (toplam ${results.sent.length} sipariş)`,
            sent: results.sent,
            failed: results.failed,
            skipped: results.skipped
        });

    } catch (error) {
        console.error("❌ SMS gönderme hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});