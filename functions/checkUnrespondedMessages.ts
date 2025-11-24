import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('🔍 Yanıt verilmemiş mesajlar kontrol ediliyor...');
    
    // Yanıt verilmemiş mesajları getir
    const unrespondedMessages = await base44.asServiceRole.entities.CheckMessage.filter({
      response_received: false
    }, '-sent_time', 100);
    
    console.log(`📊 ${unrespondedMessages.length} yanıtsız mesaj bulundu`);
    
    if (unrespondedMessages.length === 0) {
      return Response.json({
        success: true,
        message: 'Yanıt verilmemiş mesaj yok',
        reminders_sent: 0,
        escalations: 0
      });
    }
    
    const now = new Date();
    let remindersSent = 0;
    let escalations = 0;
    let errors = 0;
    
    // Grupları takip et - aynı message_group_id'ye sahip mesajları bir kez işle
    const processedGroups = new Set();
    
    for (const message of unrespondedMessages) {
      const sentTime = new Date(message.sent_time);
      const minutesSinceSent = (now - sentTime) / 1000 / 60;
      
      // 🔥 FIX: Gruplandırılmış mesaj mı kontrol et (null değilse gruplandırılmış)
      const isGrouped = message.message_group_id && message.message_group_id !== null;
      
      if (isGrouped) {
        // Gruplandırılmış mesaj - bir kez işle
        if (processedGroups.has(message.message_group_id)) {
          console.log(`⏭️ Grup ${message.message_group_id} zaten işlendi, atlanıyor`);
          continue;
        }
        
        processedGroups.add(message.message_group_id);
        
        // 🔥 FIX: Gruptaki tüm mesajları getir (response_received: false olanlar)
        const groupMessages = await base44.asServiceRole.entities.CheckMessage.filter({
          message_group_id: message.message_group_id,
          response_received: false
        });
        
        // Eğer gruptaki bazı mesajlara yanıt verildiyse bu grubu atla
        if (groupMessages.length === 0) {
          console.log(`⏭️ Grup ${message.message_group_id} için tüm mesajlar yanıtlanmış, atlanıyor`);
          continue;
        }
        
        console.log(`\n📦 Grup ${message.message_group_id} (${groupMessages.length} sipariş) işleniyor...`);
        console.log(`⏱️ Gönderimden beri: ${Math.floor(minutesSinceSent)} dakika`);
        
        // 20+ dakika - İkinci hatırlatma gönder
        if (minutesSinceSent >= 20 && !message.second_reminder_sent) {
          console.log('⚠️ 20+ dakika yanıt yok - İkinci hatırlatma gönderiliyor...');
          
          try {
            // 🔥 DİLİ CheckMessage'dan al - Driver kaydından DEĞİL!
            const reminderLanguage = message.driver_language || 'tr';
            console.log(`🔥 İkinci hatırlatma dili: ${reminderLanguage} (CheckMessage'dan alındı)`);
            
            const reminderMessage = reminderLanguage === 'en'
              ? `⚠️ REMINDER: You haven't responded to your pickup notification sent ${Math.floor(minutesSinceSent)} minutes ago. Please reply YES or NO immediately.`
              : `⚠️ HATIRLATMA: ${Math.floor(minutesSinceSent)} dakika önce gönderilen pickup bildiriminize yanıt vermediniz. Lütfen hemen EVET veya HAYIR yazın.`;
            
            const smsSent = await sendSMS(message.driver_phone, reminderMessage);
            
            if (smsSent) {
              // Gruptaki TÜM mesajları güncelle
              for (const groupMsg of groupMessages) {
                await base44.asServiceRole.entities.CheckMessage.update(groupMsg.id, {
                  second_reminder_sent: true,
                  second_reminder_sent_at: new Date().toISOString(),
                  alert_level: 'Uyarı'
                });
              }
              
              remindersSent++;
              console.log(`✅ İkinci hatırlatma gönderildi (${groupMessages.length} sipariş)`);
              
              await new Promise(resolve => setTimeout(resolve, 1100));
            }
          } catch (error) {
            console.error('❌ İkinci hatırlatma gönderim hatası:', error.message);
            errors++;
          }
        }
        
        // 30+ dakika - Kritik escalation
        if (minutesSinceSent >= 30 && !message.escalated_to_case) {
          console.log('🚨 30+ dakika yanıt yok - ESCALATION yapılıyor!');
          
          try {
            // Case oluştur
            const caseData = {
              driver_name: groupMessages[0].driver_phone, // Phone number as identifier
              driver_phone: groupMessages[0].driver_phone,
              sorun: `Sürücü ${groupMessages.length} sipariş için ${Math.floor(minutesSinceSent)} dakikadır yanıt vermiyor`,
              aciliyet: 'Acil',
              durum: 'Bildirildi',
              kategori: 'Kurye Kaynaklı',
              ekstra_bilgi: `Grup mesajı (${groupMessages.length} sipariş) için 30+ dakika boyunca yanıt alınamadı. Siparişler: ${groupMessages.map(m => m.order_id).join(', ')}`
            };
            
            const newCase = await base44.asServiceRole.entities.Case.create(caseData);
            console.log(`✅ Case oluşturuldu: ${newCase.id}`);
            
            // 🔥 YENİ: İlk mesajı ChatMessage olarak ekle
            await base44.asServiceRole.entities.ChatMessage.create({
              case_id: newCase.id,
              sender: 'bot',
              message: message.message_content,
              timestamp: message.sent_time
            });
            
            // 🔥 YENİ: Escalation bildirimi
            await base44.asServiceRole.entities.ChatMessage.create({
              case_id: newCase.id,
              sender: 'bot',
              message: `⚠️ UYARI: ${groupMessages.length} sipariş için 30+ dakika yanıt verilmedi. Case otomatik oluşturuldu.`,
              timestamp: new Date().toISOString()
            });
            
            // Gruptaki tüm siparişleri Problem durumuna al
            for (const groupMsg of groupMessages) {
              await base44.asServiceRole.entities.DailyOrder.update(groupMsg.order_id, {
                status: 'Problem'
              });
              
              await base44.asServiceRole.entities.CheckMessage.update(groupMsg.id, {
                escalated_to_case: true,
                alert_level: 'Acil'
              });
            }
            
            escalations++;
            console.log(`✅ ${groupMessages.length} sipariş "Problem" durumuna alındı`);
            
            // 🔥 DİLİ CheckMessage'dan al
            const finalLanguage = message.driver_language || 'tr';
            console.log(`🔥 Final uyarı dili: ${finalLanguage} (CheckMessage'dan alındı)`);
            
            // Son uyarı SMS'i gönder
            const finalWarning = finalLanguage === 'en'
              ? `🚨 URGENT: You have ${groupMessages.length} pending pickups with NO RESPONSE for ${Math.floor(minutesSinceSent)} minutes. This has been escalated to management. Contact immediately!`
              : `🚨 ACİL: ${groupMessages.length} pickup için ${Math.floor(minutesSinceSent)} dakikadır yanıt vermiyorsunuz. Bu durum yönetime bildirildi. Hemen iletişime geçin!`;
            
            await sendSMS(message.driver_phone, finalWarning);
            console.log('✅ Final uyarı SMS gönderildi');
            
            await new Promise(resolve => setTimeout(resolve, 1100));
            
          } catch (error) {
            console.error('❌ Escalation hatası:', error.message);
            errors++;
          }
        }
        
      } else {
        // Tekil mesaj - eski mantık aynı şekilde çalışır
        console.log(`\n📦 Tekil sipariş ${message.order_id} işleniyor...`);
        console.log(`⏱️ Gönderimden beri: ${Math.floor(minutesSinceSent)} dakika`);
        
        // 20+ dakika - İkinci hatırlatma
        if (minutesSinceSent >= 20 && !message.second_reminder_sent) {
          console.log('⚠️ 20+ dakika yanıt yok - İkinci hatırlatma gönderiliyor...');
          
          try {
            // 🔥 DİLİ CheckMessage'dan al
            const reminderLanguage = message.driver_language || 'tr';
            console.log(`🔥 İkinci hatırlatma dili: ${reminderLanguage} (CheckMessage'dan alındı)`);
            
            const reminderMessage = reminderLanguage === 'en'
              ? `⚠️ REMINDER: You haven't responded to your pickup notification sent ${Math.floor(minutesSinceSent)} minutes ago. Please reply YES or NO immediately.`
              : `⚠️ HATIRLATMA: ${Math.floor(minutesSinceSent)} dakika önce gönderilen pickup bildiriminize yanıt vermediniz. Lütfen hemen EVET veya HAYIR yazın.`;
            
            const smsSent = await sendSMS(message.driver_phone, reminderMessage);
            
            if (smsSent) {
              await base44.asServiceRole.entities.CheckMessage.update(message.id, {
                second_reminder_sent: true,
                second_reminder_sent_at: new Date().toISOString(),
                alert_level: 'Uyarı'
              });
              
              remindersSent++;
              console.log('✅ İkinci hatırlatma gönderildi');
              
              await new Promise(resolve => setTimeout(resolve, 1100));
            }
          } catch (error) {
            console.error('❌ İkinci hatırlatma gönderim hatası:', error.message);
            errors++;
          }
        }
        
        // 30+ dakika - Kritik escalation
        if (minutesSinceSent >= 30 && !message.escalated_to_case) {
          console.log('🚨 30+ dakika yanıt yok - ESCALATION yapılıyor!');
          
          try {
            const caseData = {
              driver_name: message.driver_phone,
              driver_phone: message.driver_phone,
              sorun: `Sürücü ${Math.floor(minutesSinceSent)} dakikadır yanıt vermiyor`,
              aciliyet: 'Acil',
              durum: 'Bildirildi',
              kategori: 'Kurye Kaynaklı',
              ekstra_bilgi: `Sipariş ${message.order_id} için 30+ dakika boyunca yanıt alınamadı`
            };
            
            const newCase = await base44.asServiceRole.entities.Case.create(caseData);
            console.log(`✅ Case oluşturuldu: ${newCase.id}`);
            
            // 🔥 YENİ: İlk mesajı ChatMessage olarak ekle
            await base44.asServiceRole.entities.ChatMessage.create({
              case_id: newCase.id,
              sender: 'bot',
              message: message.message_content,
              timestamp: message.sent_time
            });
            
            // 🔥 YENİ: Escalation bildirimi
            await base44.asServiceRole.entities.ChatMessage.create({
              case_id: newCase.id,
              sender: 'bot',
              message: `⚠️ UYARI: 30+ dakika yanıt verilmedi. Case otomatik oluşturuldu.`,
              timestamp: new Date().toISOString()
            });
            
            await base44.asServiceRole.entities.DailyOrder.update(message.order_id, {
              status: 'Problem'
            });
            
            await base44.asServiceRole.entities.CheckMessage.update(message.id, {
              escalated_to_case: true,
              alert_level: 'Acil'
            });
            
            escalations++;
            console.log('✅ Sipariş "Problem" durumuna alındı');
            
            // 🔥 DİLİ CheckMessage'dan al
            const finalLanguage = message.driver_language || 'tr';
            console.log(`🔥 Final uyarı dili: ${finalLanguage} (CheckMessage'dan alındı)`);
            
            const finalWarning = finalLanguage === 'en'
              ? `🚨 URGENT: No response for ${Math.floor(minutesSinceSent)} minutes. This has been escalated to management. Contact immediately!`
              : `🚨 ACİL: ${Math.floor(minutesSinceSent)} dakikadır yanıt vermiyorsunuz. Bu durum yönetime bildirildi. Hemen iletişime geçin!`;
            
            await sendSMS(message.driver_phone, finalWarning);
            console.log('✅ Final uyarı SMS gönderildi');
            
            await new Promise(resolve => setTimeout(resolve, 1100));
            
          } catch (error) {
            console.error('❌ Escalation hatası:', error.message);
            errors++;
          }
        }
      }
    }
    
    console.log('\n📊 ÖZET:');
    console.log(`📤 Hatırlatma gönderilen: ${remindersSent}`);
    console.log(`🚨 Escalation yapılan: ${escalations}`);
    console.log(`❌ Hata: ${errors}`);
    
    return Response.json({
      success: true,
      message: 'Yanıtsız mesajlar kontrol edildi',
      reminders_sent: remindersSent,
      escalations: escalations,
      errors: errors
    });
    
  } catch (error) {
    console.error('❌ Beklenmeyen hata:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

// SMS gönderme helper fonksiyonu
async function sendSMS(toPhone, messageBody) {
  try {
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('❌ Twilio credentials eksik');
      return false;
    }
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: toPhone,
          From: twilioPhoneNumber,
          Body: messageBody
        })
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SMS gönderildi: ${data.sid}`);
      return true;
    } else {
      const errorData = await response.text();
      console.error(`❌ Twilio hatası: ${response.status} - ${errorData}`);
      return false;
    }
  } catch (error) {
    console.error('❌ SMS gönderim hatası:', error.message);
    return false;
  }
}