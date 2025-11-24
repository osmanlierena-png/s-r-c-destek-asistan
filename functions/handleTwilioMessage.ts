import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;

    try {
        let rawSenderPhone, messageBody, messageDirection;

        const contentType = req.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
            const jsonData = await req.json();
            rawSenderPhone = jsonData.from || jsonData.From;
            messageBody = jsonData.body || jsonData.Body;
            messageDirection = jsonData.direction || jsonData.Direction;
        } else {
            const formData = await req.formData();
            rawSenderPhone = formData.get('From');
            messageBody = formData.get('Body');
            messageDirection = formData.get('Direction');
        }

        if (messageDirection === 'outbound-api' || messageDirection === 'outbound') {
            console.log("Giden mesaj ignore edildi:", { from: rawSenderPhone, direction: messageDirection });
            return Response.json({ status: "ignored", reason: "outbound message" });
        }

        if (!rawSenderPhone || !messageBody) {
            console.error("❌ Eksik bilgi:", { rawSenderPhone, messageBody });
            return Response.json({ reply: "Hata: Eksik bilgi." });
        }

        const cleanSenderPhone = rawSenderPhone.replace('whatsapp:', '').replace('sms:', '').trim();
        
        console.log("📱 Gelen mesaj:", { 
            raw: rawSenderPhone,
            clean: cleanSenderPhone, 
            message: messageBody, 
            direction: messageDirection 
        });

        // 🆕 1️⃣ ÖNCELİKLE HATIRLATMA MESAJINA YANIT MI KONTROL ET
        const reminderResponseResult = await handleReminderResponse(cleanSenderPhone, messageBody, base44);
        if (reminderResponseResult.handled) {
            console.log("✅ Hatırlatma mesajına yanıt işlendi");
            await sendSMSReply(cleanSenderPhone, reminderResponseResult.reply);
            return new Response('', { status: 200 });
        }

        // 2️⃣ SİPARİŞ ONAY YANITI MI (EVET/HAYIR)
        const orderResponseResult = await handleOrderResponse(cleanSenderPhone, messageBody, base44);
        if (orderResponseResult.handled) {
            console.log("✅ Sipariş yanıtı işlendi");
            await sendSMSReply(cleanSenderPhone, orderResponseResult.reply);
            return new Response('', { status: 200 });
        }

        // 3️⃣ ESKİ CASE SİSTEMİ (genel konuşma)
        const allDrivers = await base44.entities.Driver.list();
        console.log(`📋 Sistemde ${allDrivers.length} sürücü var`);
        
        const normalizePhone = (phone) => {
            if (!phone) return '';
            return phone.replace(/\D/g, '');
        };
        
        const getLast10Digits = (phone) => {
            const normalized = normalizePhone(phone);
            return normalized.slice(-10);
        };
        
        const cleanPhoneNormalized = normalizePhone(cleanSenderPhone);
        const cleanPhoneLast10 = getLast10Digits(cleanSenderPhone);
        
        console.log(`🔍 Gelen numara:`);
        console.log(`   Raw: ${cleanSenderPhone}`);
        console.log(`   Normalized: ${cleanPhoneNormalized}`);
        console.log(`   Son 10 hane: ${cleanPhoneLast10}`);
        
        let driver = null;
        
        driver = allDrivers.find(d => {
            const driverPhoneNormalized = normalizePhone(d.phone);
            return driverPhoneNormalized === cleanPhoneNormalized;
        });
        
        if (driver) {
            console.log(`✅ TAM EŞLEŞME bulundu: ${driver.name} (${driver.phone})`);
        }
        
        if (!driver) {
            console.log(`⚠️ Tam eşleşme yok, son 10 haneye göre aranıyor...`);
            
            const matches = allDrivers.filter(d => {
                const driverLast10 = getLast10Digits(d.phone);
                const isMatch = driverLast10 === cleanPhoneLast10;
                
                console.log(`   ${d.name}: ${d.phone} → ${driverLast10} ${isMatch ? '✅' : '❌'}`);
                
                return isMatch;
            });
            
            if (matches.length === 1) {
                driver = matches[0];
                console.log(`✅ TEK EŞLEŞME bulundu: ${driver.name} (${driver.phone})`);
            } else if (matches.length > 1) {
                console.error(`❌ ÇOK FAZLA EŞLEŞME (${matches.length}):`, matches.map(d => `${d.name} - ${d.phone}`));
                const errorMsg = `Telefon numaranız birden fazla sürücüyle eşleşiyor. Lütfen yöneticinize bildirin. (${cleanSenderPhone})`;
                await sendSMSReply(cleanSenderPhone, errorMsg);
                return new Response('', { status: 200 });
            } else {
                console.error(`❌ HİÇ EŞLEŞME YOK`);
            }
        }
        
        if (!driver) {
            console.log(`⚠️ Sürücü bulunamadı: ${cleanSenderPhone}`);
            console.log(`   Kayıtlı numaralar:`, allDrivers.map(d => `${d.name}: ${d.phone}`).join(', '));
            
            const notFoundReply = `Merhaba! Sistemimizde kayıtlı telefon numaranızı bulamadık (${cleanSenderPhone}). Lütfen yöneticinizle iletişime geçin.`;
            
            await sendSMSReply(cleanSenderPhone, notFoundReply);
            return new Response('', { status: 200 });
        }
        
        console.log(`✅ Sürücü bulundu: ${driver.name} (${driver.phone})`);
        
        const driverName = driver.name;
        const driverLanguage = driver.language || 'tr';

        const recentCases = await base44.entities.Case.filter({
            driver_phone: cleanSenderPhone,
            durum: { $ne: "Çözüldü" }
        }, '-created_date', 1);

        let currentCase = null;
        let isNewConversation = true;
        
        if (recentCases && recentCases.length > 0) {
            currentCase = recentCases[0];
            const lastMessages = await base44.entities.ChatMessage.filter({ case_id: currentCase.id }, '-created_date', 5);
            const lastMessageTime = new Date(currentCase.updated_date);
            const now = new Date();
            const timeDiffMinutes = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60);
            
            if (timeDiffMinutes > 30) { 
                isNewConversation = true; 
            } else if (lastMessages.length > 0) {
                const ourLastMessage = lastMessages.find(m => m.sender === "bot");
                
                const completionMessages = [
                    "anlaşıldı", "bilgilendiriyorum", "kolay gelsin", "iyi çalışmalar",
                    "teşekkürler", "sağlıcakla", "dikkatli ol", "yolun açık olsun",
                    "problem çözüldü", "hallettik", "tamam", "notunu aldım"
                ];
                
                const newProblemKeywords = [
                    "yeni", "başka", "şimdi", "az önce", "bugün", "sorun", "problem", 
                    "arıza", "bozuk", "çalışmıyor", "gecikim", "geciktim", "trafik",
                    "müşteri", "adres", "bulamıyorum", "kayboldum", "acil", "yardım"
                ];
                
                const hasCompletionMessage = ourLastMessage && 
                    completionMessages.some(c => ourLastMessage.message.toLowerCase().includes(c.toLowerCase()));
                
                const indicatesNewProblem = newProblemKeywords.some(keyword => 
                    messageBody.toLowerCase().includes(keyword.toLowerCase()));
                
                if (hasCompletionMessage || indicatesNewProblem) {
                    isNewConversation = true;
                } else {
                    isNewConversation = false;
                }
            } else {
                isNewConversation = false;
            }
        }

        const messages = {
          tr: {
            greeting: `Merhaba ${driverName.split(' ')[0]}, yaşadığınız sorunu kısaca anlatır mısınız?`,
            masterPrompt: `
## SEN KİMSİN ##
Sen bir operasyon destek asistanısın. Türkçe konuşuyorsun. Amacın: Durumu tespit edip operasyon ekibine bildirmek.

## KONUŞMA GEÇMİŞİ ##
{formattedHistory}

## SON MESAJ ##
"{messageBody}"

## AKILLI DURUM TESPİTİ ##
**ARAÇ ARIZASI AKIŞI:**
1. İlk soru: "Kaç dakika gecikeceksin?"
2. Eğer "gidemiyorum/yapamam" → "Order üstünde mi?"
3. Eğer "evet/üstümde" → "Tamam, acil olarak not ediyorum. İletişimde olalım."
4. Eğer dakika verirse → "Anlaşıldı, bilgilendiriyorum. Kolay gelsin!"

**ÖNEMLİ:**
- Türkçe konuş
- Çözüm önerme
- Sadece durumu tespit et
- ${driverName.split(' ')[0]} ismini kullan

CEVABIN:`
          },
          en: {
            greeting: `Hello ${driverName.split(' ')[0]}, could you briefly tell me about the issue you're experiencing?`,
            masterPrompt: `
## WHO YOU ARE ##
You are an operations support assistant. You speak English. Your goal: Identify the situation and report it to the operations team.

## CONVERSATION HISTORY ##
{formattedHistory}

## LAST MESSAGE ##
"{messageBody}"

## SMART SITUATION DETECTION ##
**VEHICLE BREAKDOWN FLOW:**
1. First question: "How many minutes will you be delayed?"
2. If "can't go/impossible" → "Do you have an active order?"
3. If "yes/I have one" → "Understood, marking as urgent. We'll stay in touch."
4. If they give minutes → "Understood, I'll inform the team. Safe travels!"

**IMPORTANT:**
- Speak in English
- Don't suggest solutions
- Only identify the situation
- Use ${driverName.split(' ')[0]} name

YOUR ANSWER:`
          }
        };
        
        if (isNewConversation) {
            console.log("🆕 Yeni konuşma başlatılıyor");
            const reply = messages[driverLanguage].greeting;
            currentCase = await base44.entities.Case.create({
                sorun: `Yeni konuşma: ${messageBody}`,
                driver_phone: cleanSenderPhone,
                driver_name: driverName,
                durum: "Bildirildi",
                aciliyet: "Orta"
            });
            await base44.entities.ChatMessage.create({ case_id: currentCase.id, sender: "sürücü", message: messageBody });
            await base44.entities.ChatMessage.create({ case_id: currentCase.id, sender: "bot", message: reply });
            
            console.log(`💬 Bot cevabı: ${reply}`);
            await sendSMSReply(cleanSenderPhone, reply);
            return new Response('', { status: 200 });
        }
        
        console.log("🔄 Devam eden konuşma");
        await base44.entities.ChatMessage.create({ case_id: currentCase.id, sender: "sürücü", message: messageBody });
        const history = await base44.entities.ChatMessage.filter({ case_id: currentCase.id }, 'created_date', 10);
        const formattedHistory = history.map(m => `${m.sender}: ${m.message}`).join('\n');

        const masterPromptTemplate = messages[driverLanguage].masterPrompt;
        const masterPrompt = masterPromptTemplate
            .replace('{formattedHistory}', formattedHistory)
            .replace('{messageBody}', messageBody)
            .replace('${driverName.split(\' \')[0]}', driverName.split(' ')[0]);

        console.log("🤖 AI'ya sorgu gönderiliyor...");
        const aiDecisionResponse = await base44.integrations.Core.InvokeLLM({ 
            prompt: masterPrompt 
        });

        const reply = (typeof aiDecisionResponse === 'string') ? aiDecisionResponse : (aiDecisionResponse?.text || "Anlayamadım, tekrar eder misiniz?");
        
        console.log(`💬 AI cevabı: ${reply}`);
        await base44.entities.ChatMessage.create({ case_id: currentCase.id, sender: "bot", message: reply });

        if (reply.toLowerCase().includes("acil olarak not ediyorum") || 
            (messageBody.toLowerCase().includes("evet") && 
             history.some(m => m.message.toLowerCase().includes("order üstünde")))) {
            await base44.entities.Case.update(currentCase.id, { 
                aciliyet: "Acil",
                durum: "İşlemde"
            });
        }

        const allRules = await base44.entities.AIResponseRule.list();
        const isCompletionMessage = allRules.some(rule => rule.completion_message === reply);
        if (isCompletionMessage) {
            await base44.entities.Case.update(currentCase.id, { durum: "İşlemde" });
        }
        
        await sendSMSReply(cleanSenderPhone, reply);
        return new Response('', { status: 200 });

    } catch (error) {
        console.error("❌ Webhook işleme hatası:", error);
        return new Response('', { status: 200 });
    }
});

// 🆕 HATIRLATMA MESAJINA YANIT (EVET/HAYIR)
async function handleReminderResponse(phone, message, base44) {
    console.log("\n🔔 Hatırlatma mesajı yanıtı kontrol ediliyor...");
    
    const messageLower = message.toLowerCase().trim();
    
    // EVET mi? (TR: evet, hazırım, tamam / EN: yes, ready, ok)
    const isYes = ['evet', 'yes', 'hazırım', 'hazir', 'ready', 'tamam', 'ok', 'okay'].some(w => messageLower === w || messageLower.startsWith(w));
    
    // HAYIR mi? (TR: hayır, değilim, gidemem / EN: no, not ready, can't)
    const isNo = ['hayir', 'hayır', 'no', 'değilim', 'degilim', 'gidemem', 'gitmem', "can't", 'cannot', 'not ready'].some(w => messageLower.includes(w));
    
    if (!isYes && !isNo) {
        console.log("❌ EVET/HAYIR değil → Normal konuşma");
        return { handled: false };
    }
    
    console.log(`✅ ${isYes ? 'EVET (Hazır)' : 'HAYIR (Hazır değil)'} yanıtı tespit edildi`);
    
    // Son gönderilen hatırlatma mesajını bul
    const normalizePhone = (phone) => phone?.replace(/\D/g, '').slice(-10) || '';
    const normalizedPhone = normalizePhone(phone);
    
    const recentReminders = await base44.entities.CheckMessage.filter({
        response_received: false
    }, '-sent_time', 20);
    
    const myReminder = recentReminders.find(r => {
        const reminderPhone = normalizePhone(r.driver_phone);
        return reminderPhone === normalizedPhone;
    });
    
    if (!myReminder) {
        console.log("❌ Bekleyen hatırlatma mesajı bulunamadı");
        return { handled: false };
    }
    
    console.log(`✅ Hatırlatma mesajı bulundu: ${myReminder.order_id}`);
    console.log(`🌍 İlk mesajdaki dil: ${myReminder.driver_language}`);
    
    // 🔥 YENİ: Gruplandırılmış mesaj mı kontrol et
    const isGrouped = myReminder.message_group_id && myReminder.message_group_id !== null;
    
    if (isGrouped) {
        console.log(`🔗 GRUPLANDIRILMIŞ MESAJ tespit edildi: ${myReminder.message_group_id}`);
        
        // Gruptaki TÜM yanıt bekleyen mesajları getir
        const groupMessages = await base44.entities.CheckMessage.filter({
            message_group_id: myReminder.message_group_id,
            response_received: false
        });
        
        console.log(`📦 Grupta ${groupMessages.length} yanıt bekleyen sipariş var`);
        
        // 🔥 DİLİ CheckMessage'DAN AL
        const responseLanguage = myReminder.driver_language || 'tr';
        console.log(`🔥 Yanıt dili: ${responseLanguage} (CheckMessage'dan alındı)`);
        
        const now = new Date().toISOString();
        
        if (isYes) {
            // ✅ HAZIR - Gruptaki TÜM mesajları güncelle
            for (const msg of groupMessages) {
                await base44.entities.CheckMessage.update(msg.id, {
                    response_received: true,
                    response_time: now,
                    alert_level: "Normal"
                });
                console.log(`✅ CheckMessage güncellendi: ${msg.order_id}`);
            }
            
            // Tüm siparişlerin pickup bilgilerini al
            const orderDetails = [];
            for (const msg of groupMessages) {
                const orders = await base44.entities.DailyOrder.filter({ id: msg.order_id });
                if (orders[0]) {
                    orderDetails.push(orders[0]);
                }
            }
            
            const orderList = orderDetails.map((o, idx) => 
                `${idx + 1}. ⏰ ${o.pickup_time}\n   📍 ${o.pickup_address}`
            ).join('\n\n');
            
            const reply = responseLanguage === 'en' 
                ? `✅ Great! You're ready for ${groupMessages.length} pickups:\n\n${orderList}\n\nGood luck! 🚗`
                : `✅ Harika! ${groupMessages.length} pickup'ın için hazırsın:\n\n${orderList}\n\nKolay gelsin! 🚗`;
            
            return { handled: true, reply };
            
        } else {
            // ❌ HAZIR DEĞİL - Gruptaki TÜM mesajları güncelle ve case oluştur
            for (const msg of groupMessages) {
                await base44.entities.CheckMessage.update(msg.id, {
                    response_received: true,
                    response_time: now,
                    alert_level: "Uyarı"
                });
            }
            
            // Sürücüyü bul
            const drivers = await base44.entities.Driver.filter({ phone: { $regex: normalizedPhone } });
            const driver = drivers[0];
            
            // Sipariş detaylarını al
            const orderDetails = [];
            for (const msg of groupMessages) {
                const orders = await base44.entities.DailyOrder.filter({ id: msg.order_id });
                if (orders[0]) {
                    orderDetails.push(orders[0]);
                }
            }
            
            const orderList = orderDetails.map(o => 
                `${o.pickup_time} - ${o.pickup_address}`
            ).join('\n');
            
            // Case oluştur
            await base44.entities.Case.create({
                sorun: `❌ Sürücü ${groupMessages.length} pickup için hazır değil (HAYIR yanıtı)\n\n${orderList}`,
                driver_phone: phone,
                driver_name: driver?.name || 'Bilinmiyor',
                durum: "Bildirildi",
                aciliyet: "Yüksek"
            });
            
            const reply = responseLanguage === 'en' 
                ? `Understood. We've noted that you're not ready for ${groupMessages.length} pickups. The operations team will contact you.`
                : `Anlaşıldı. ${groupMessages.length} pickup için hazır olmadığını not ettik. Operasyon ekibi seninle iletişime geçecek.`;
            
            return { handled: true, reply };
        }
        
    } else {
        // TEKİL MESAJ - ESKİ MANTIK
        console.log("📄 Tekil mesaj");
        
        // Order'ı bul
        const orders = await base44.entities.DailyOrder.filter({ id: myReminder.order_id });
        const order = orders[0];
        
        if (!order) {
            console.log("❌ Sipariş bulunamadı");
            return { handled: false };
        }
        
        // 🔥 DİLİ CheckMessage'DAN AL
        const responseLanguage = myReminder.driver_language || 'tr';
        console.log(`🔥 Yanıt dili: ${responseLanguage} (CheckMessage'dan alındı)`);
        
        const now = new Date().toISOString();
        
        if (isYes) {
            // ✅ HAZIR - CheckMessage'ı güncelle
            await base44.entities.CheckMessage.update(myReminder.id, {
                response_received: true,
                response_time: now,
                alert_level: "Normal"
            });
            
            const reply = responseLanguage === 'en' 
                ? `✅ Great! You're ready for your ${order.pickup_time} pickup.\n\n📍 ${order.pickup_address}\n\nGood luck! 🚗`
                : `✅ Harika! ${order.pickup_time} pickup'ın için hazırsın.\n\n📍 ${order.pickup_address}\n\nKolay gelsin! 🚗`;
            
            return { handled: true, reply };
        
        } else {
            // ❌ HAZIR DEĞİL - Alert/Case oluştur
            await base44.entities.CheckMessage.update(myReminder.id, {
                response_received: true,
                response_time: now,
                alert_level: "Uyarı"
            });
            
            // Sürücüyü bul (sadece case için)
            const drivers = await base44.entities.Driver.filter({ phone: { $regex: normalizedPhone } });
            const driver = drivers[0];
            
            // Case oluştur
            await base44.entities.Case.create({
                sorun: `❌ Sürücü ${order.pickup_time} pickup için hazır değil (HAYIR yanıtı)\n\n📍 Pickup: ${order.pickup_address}`,
                driver_phone: phone,
                driver_name: driver?.name || 'Bilinmiyor',
                durum: "Bildirildi",
                aciliyet: "Yüksek"
            });
            
            const reply = responseLanguage === 'en' 
                ? `Understood. We've noted that you're not ready for your ${order.pickup_time} pickup. The operations team will contact you.`
                : `Anlaşıldı. ${order.pickup_time} pickup için hazır olmadığını not ettik. Operasyon ekibi seninle iletişime geçecek.`;
            
            return { handled: true, reply };
        }
    }
}

// SİPARİŞ ONAY YANITI (EVET/HAYIR)
async function handleOrderResponse(phone, message, base44) {
    console.log("\n🔍 Sipariş yanıtı kontrol ediliyor...");
    
    const messageLower = message.toLowerCase().trim();
    
    const isYes = messageLower === 'evet' || messageLower === 'yes';
    const isNo = messageLower === 'hayir' || messageLower === 'hayır' || messageLower === 'no';
    
    if (!isYes && !isNo) {
        console.log("❌ EVET/HAYIR değil → Normal konuşma olarak Case'e yönlendirilecek");
        return { handled: false };
    }
    
    console.log(`✅ ${isYes ? 'EVET' : 'HAYIR'} yanıtı tespit edildi`);
    
    const normalizePhone = (phone) => phone?.replace(/\D/g, '').slice(-10) || '';
    const normalizedPhone = normalizePhone(phone);
    
    console.log(`📞 Normalized phone: ${normalizedPhone}`);
    
    const recentOrders = await base44.entities.DailyOrder.filter({
        status: "Sürücü Onayı Bekleniyor"
    }, '-sms_sent_at', 10);
    
    console.log(`📋 ${recentOrders.length} bekleyen sipariş bulundu`);
    
    const myOrder = recentOrders.find(o => {
        const orderPhone = normalizePhone(o.driver_phone);
        console.log(`   Kontrol: ${o.ezcater_order_id} → ${o.driver_phone} (${orderPhone}) ${orderPhone === normalizedPhone ? '✅' : '❌'}`);
        return orderPhone === normalizedPhone;
    });
    
    if (!myOrder) {
        console.log("❌ Bu telefon numarasına ait bekleyen sipariş bulunamadı");
        return {
            handled: true,
            reply: "Bekleyen bir siparişiniz bulunamadı. Lütfen destek ekibiyle iletişime geçin."
        };
    }
    
    console.log(`✅ Sipariş bulundu: ${myOrder.ezcater_order_id}`);
    
    const now = new Date().toISOString();
    
    if (isYes) {
        await base44.entities.DailyOrder.update(myOrder.id, {
            status: "Sürücü Onayladı",
            driver_response: "Evet",
            driver_response_at: now
        });
        
        return {
            handled: true,
            reply: `✅ Harika! ${myOrder.pickup_time} pickup'ını onayladınız.\n\n📍 Pickup: ${myOrder.pickup_address}\n📍 Dropoff: ${myOrder.dropoff_address}\n\nİyi çalışmalar! 🚗`
        };
    } else {
        await base44.entities.DailyOrder.update(myOrder.id, {
            status: "Sürücü Reddetti",
            driver_response: "Hayır",
            driver_response_at: now
        });
        
        return {
            handled: true,
            reply: `Anlaşıldı. ${myOrder.pickup_time} pickup'ını reddettiniz. Başka bir sürücüye atayacağız. Teşekkürler!`
        };
    }
}

async function sendSMSReply(to, message) {
    try {
        const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        let fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (fromNumber) {
            fromNumber = fromNumber.replace(/[^\d+]/g, '');
            console.log(`📞 Temizlenmiş FROM numarası: ${fromNumber}`);
        }

        console.log("📤 SMS gönderiliyor:", {
            to,
            from: fromNumber,
            hasAccountSid: !!accountSid,
            hasAuthToken: !!authToken,
            hasFromNumber: !!fromNumber
        });

        if (!accountSid || !authToken || !fromNumber) {
            console.error("❌ Twilio bilgileri eksik, SMS gönderilemedi");
            return;
        }

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        
        const formData = new URLSearchParams();
        formData.append('To', to);
        formData.append('From', fromNumber);
        formData.append('Body', message);
        formData.append('StatusCallback', '');

        const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
            },
            body: formData.toString()
        });

        if (response.ok) {
            const data = await response.json();
            console.log("✅ SMS başarıyla gönderildi:", { 
                to, 
                sid: data.sid,
                status: data.status 
            });
        } else {
            const errorText = await response.text();
            console.error("❌ SMS gönderilemedi:", { 
                status: response.status,
                error: errorText 
            });
        }
    } catch (error) {
        console.error("❌ SMS gönderme hatası:", error);
    }
}