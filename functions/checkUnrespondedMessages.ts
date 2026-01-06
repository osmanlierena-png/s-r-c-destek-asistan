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
    
    console.log('🔍 Yanıtsız mesajlar kontrol ediliyor...');
    
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
    
    const checkMessages = await base44.asServiceRole.entities.CheckMessage.filter({
      response_received: false,
      sent_time: { $gte: cutoffTime.toISOString() }
    }, '-sent_time', 100);
    
    console.log(`📦 ${checkMessages.length} yanıtsız mesaj bulundu`);
    
    const remindersSent = [];
    const escalations = [];
    const errors = [];
    
    for (const msg of checkMessages) {
      try {
        console.log(`\n📦 ${msg.message_group_id ? `Grup ${msg.message_group_id}` : `Tekil sipariş ${msg.order_id}`} işleniyor...`);
        
        const timeSinceSent = (now - new Date(msg.sent_time)) / (1000 * 60);
        console.log(`⏱️ Gönderimden beri: ${Math.round(timeSinceSent)} dakika`);
        
        if (timeSinceSent > 30) {
          console.log('🚨 30+ dakika yanıt yok - ESCALATION yapılıyor!');
          
          const order = await base44.asServiceRole.entities.DailyOrder.filter({ id: msg.order_id });
          if (order && order[0]) {
            await base44.asServiceRole.entities.DailyOrder.update(order[0].id, {
              status: 'Problem'
            });
            
            let caseData = {
              sorun: `Sürücü ${Math.round(timeSinceSent)} dakikadır yanıt vermiyor`,
              driver_name: order[0].driver_name,
              driver_phone: order[0].driver_phone,
              aciliyet: 'Acil',
              kategori: 'Lojistik & Ulaşım',
              durum: 'Bildirildi',
              konum: order[0].pickup_address
            };
            
            if (msg.message_group_id) {
              const groupOrders = await base44.asServiceRole.entities.CheckMessage.filter({
                message_group_id: msg.message_group_id
              });
              caseData.sorun = `Sürücü ${groupOrders.length} sipariş için ${Math.round(timeSinceSent)} dakikadır yanıt vermiyor`;
            }
            
            await base44.asServiceRole.entities.Case.create(caseData);
            
            await base44.asServiceRole.entities.CheckMessage.update(msg.id, {
              escalated_to_case: true,
              alert_level: 'Acil'
            });
            
            escalations.push(msg.order_id);
            console.log('🚨 Escalation yapıldı');
          }
          
        } else if (timeSinceSent > 20 && !msg.second_reminder_sent) {
          console.log('⚠️ 20+ dakika yanıt yok - İkinci hatırlatma gönderiliyor...');
          
          // 🚫 VALİDASYON KONTROLÜ
          if (!isValidUSPhone(msg.driver_phone)) {
            console.log(`🚫 BLOCKED - Geçersiz numara: ${msg.driver_phone}`);
            errors.push({
              orderId: msg.order_id,
              reason: 'Invalid phone blocked',
              phone: msg.driver_phone
            });
            continue;
          }
          
          const reminderLanguage = msg.driver_language || 'tr';
          console.log(`🔥 İkinci hatırlatma dili: ${reminderLanguage} (CheckMessage'dan alındı)`);
          
          const reminderMessages = {
            tr: '⏰ HATIRLATMA: Hala yanıt bekliyoruz. Pickup\'a hazır mısınız?\n\n✅ EVET\n❌ HAYIR',
            en: '⏰ REMINDER: Still waiting for your response. Are you ready for pickup?\n\n✅ YES\n❌ NO'
          };
          
          const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
          const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
          const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
          
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                To: msg.driver_phone,
                From: twilioPhoneNumber,
                Body: reminderMessages[reminderLanguage]
              })
            }
          );
          
          if (response.ok) {
            await base44.asServiceRole.entities.CheckMessage.update(msg.id, {
              second_reminder_sent: true,
              second_reminder_sent_at: new Date().toISOString(),
              alert_level: 'Uyarı'
            });
            
            remindersSent.push(msg.order_id);
            console.log('✅ İkinci hatırlatma gönderildi');
          } else {
            const errorData = await response.json();
            console.error(`❌ Twilio hatası: ${response.status} - ${JSON.stringify(errorData)}`);
            errors.push({
              orderId: msg.order_id,
              reason: errorData.message
            });
          }
        }
        
      } catch (error) {
        console.error(`❌ Hata (${msg.order_id}):`, error);
        errors.push({
          orderId: msg.order_id,
          reason: error.message
        });
      }
    }
    
    console.log('\n📊 ÖZET:');
    console.log(`📤 Hatırlatma gönderilen: ${remindersSent.length}`);
    console.log(`🚨 Escalation yapılan: ${escalations.length}`);
    console.log(`❌ Hata: ${errors.length}`);
    
    return Response.json({
      success: true,
      message: 'Yanıtsız mesajlar kontrol edildi',
      reminders_sent: remindersSent.length,
      escalations: escalations.length,
      errors: errors.length
    });
    
  } catch (error) {
    console.error('❌ Genel hata:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});