import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ===== MERKEZİ TELEFON VALİDASYONU =====
function isValidUSPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\(\)\-]/g, '');
  if (cleaned.toUpperCase().includes('MISSING')) return false;
  if (!cleaned.startsWith('+1')) return false;
  if (cleaned.length !== 12) return false;
  const digits = cleaned.substring(2);
  return /^\d{10}$/.test(digits);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { orderIds, messageType } = await req.json();
    
    if (!orderIds || orderIds.length === 0) {
      return Response.json({
        success: false,
        error: 'Sipariş ID\'leri gerekli'
      });
    }
    
    console.log(`📤 ${orderIds.length} sipariş için ${messageType} mesajı gönderiliyor...`);
    
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return Response.json({
        success: false,
        error: 'Twilio credentials eksik'
      });
    }
    
    const messageTemplates = {
      '60dk_Kontrol': {
        tr: '⏰ Merhaba! 60 dakika sonra pickup\'ınız var. Hazır mısınız?\n\n✅ EVET\n❌ HAYIR',
        en: '⏰ Hello! You have a pickup in 60 minutes. Are you ready?\n\n✅ YES\n❌ NO'
      },
      '30dk_Kontrol': {
        tr: '⏰ UYARI: 30 dakika sonra pickup! Yola çıktınız mı?\n\n✅ EVET\n❌ HAYIR',
        en: '⏰ WARNING: Pickup in 30 minutes! Are you on your way?\n\n✅ YES\n❌ NO'
      },
      '15dk_Kontrol': {
        tr: '🚨 ACİL: 15 dakika kaldı! Pickup adresine yaklaştınız mı?\n\n✅ EVET\n❌ HAYIR',
        en: '🚨 URGENT: 15 minutes left! Are you approaching the pickup?\n\n✅ YES\n❌ NO'
      }
    };
    
    const sent = [];
    const failed = [];
    
    for (const orderId of orderIds) {
      try {
        const orders = await base44.asServiceRole.entities.DailyOrder.filter({ id: orderId });
        const order = orders[0];
        
        if (!order) {
          failed.push({
            orderId,
            reason: 'Sipariş bulunamadı'
          });
          continue;
        }
        
        // 🚫 VALİDASYON KONTROLÜ
        if (!isValidUSPhone(order.driver_phone)) {
          console.log(`🚫 BLOCKED - Geçersiz numara: ${order.driver_phone}`);
          failed.push({
            orderId: order.ezcater_order_id,
            reason: 'Invalid phone number',
            phone: order.driver_phone
          });
          
          await base44.asServiceRole.entities.CheckMessage.create({
            order_id: order.id,
            driver_phone: order.driver_phone || 'MISSING',
            driver_language: 'tr',
            message_type: messageType,
            message_content: 'BLOCKED: Invalid phone',
            message_status: 'failed',
            failure_reason: 'Invalid phone number',
            sent_time: new Date().toISOString()
          });
          
          continue;
        }
        
        const drivers = await base44.asServiceRole.entities.Driver.filter({ id: order.driver_id });
        const driver = drivers[0];
        const driverLanguage = driver?.language || 'tr';
        
        const messageContent = messageTemplates[messageType][driverLanguage];
        
        console.log(`📤 SMS gönderiliyor: ${order.driver_name} (${order.driver_phone})`);
        
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              To: order.driver_phone,
              From: twilioPhoneNumber,
              Body: messageContent
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          await base44.asServiceRole.entities.CheckMessage.create({
            order_id: order.id,
            driver_phone: order.driver_phone,
            driver_language: driverLanguage,
            message_type: messageType,
            message_content: messageContent,
            message_status: 'sent',
            twilio_sid: data.sid,
            sent_time: new Date().toISOString()
          });
          
          sent.push({
            orderId: order.ezcater_order_id,
            driverName: order.driver_name,
            driverPhone: order.driver_phone,
            sid: data.sid
          });
          
          console.log(`✅ ${order.ezcater_order_id} → ${order.driver_name}`);
          
        } else {
          const errorData = await response.json();
          
          failed.push({
            orderId: order.ezcater_order_id,
            reason: errorData.message
          });
          
          await base44.asServiceRole.entities.CheckMessage.create({
            order_id: order.id,
            driver_phone: order.driver_phone,
            driver_language: driverLanguage,
            message_type: messageType,
            message_content: messageContent,
            message_status: 'failed',
            failure_reason: errorData.message,
            sent_time: new Date().toISOString()
          });
          
          console.error(`❌ ${order.ezcater_order_id} → Hata: ${errorData.message}`);
        }
        
        await new Promise(r => setTimeout(r, 1100));
        
      } catch (error) {
        failed.push({
          orderId,
          reason: error.message
        });
        console.error(`❌ Sipariş işleme hatası (${orderId}):`, error);
      }
    }
    
    console.log(`\n📊 Sonuç:`);
    console.log(`   ✅ Gönderilen: ${sent.length}`);
    console.log(`   ❌ Başarısız: ${failed.length}`);
    
    return Response.json({
      success: true,
      message: `${sent.length} mesaj gönderildi`,
      sent,
      failed
    });
    
  } catch (error) {
    console.error('❌ Hata:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});