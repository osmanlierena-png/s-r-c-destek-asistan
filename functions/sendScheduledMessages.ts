import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('🚀 Zamanlanmış mesaj gönderimi başlatılıyor...');
    
    // 1. Settings'i al
    const settings = await base44.asServiceRole.entities.AutoMessageSettings.list();
    
    if (!settings || settings.length === 0) {
      console.log('⚠️ AutoMessageSettings bulunamadı');
      return Response.json({
        success: false,
        error: 'AutoMessageSettings bulunamadı'
      });
    }
    
    const config = settings[0];
    
    if (!config.is_active) {
      console.log('❌ Otomatik mesaj sistemi AKTİF DEĞİL');
      return Response.json({
        success: false,
        error: 'Otomatik mesaj sistemi aktif değil',
        isActive: false
      });
    }
    
    console.log(`✅ Settings yüklendi - ${config.minutes_before} dakika önce mesaj gönderilecek`);
    
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayEST = estDate.toISOString().split('T')[0];
    
    console.log(`📅 Bugünün tarihi (EST): ${todayEST}`);
    console.log(`🕐 EST Şu an: ${estDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}`);
    
    const orders = await base44.asServiceRole.entities.DailyOrder.filter({
      order_date: todayEST,
      status: 'Sürücü Onayladı'
    }, '-created_date', 200);
    
    console.log(`📦 ${orders.length} onaylanmış sipariş bulundu`);
    
    if (orders.length === 0) {
      return Response.json({
        success: true,
        message: 'Gönderilecek sipariş yok',
        sent: [],
        failed: [],
        skipped: []
      });
    }
    
    const sentMessages = [];
    const failedMessages = [];
    const skippedOrders = [];
    const twilioErrors = [];
    
    const existingMessages = await base44.asServiceRole.entities.CheckMessage.filter({
      sent_time: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    });
    
    const sentOrderIds = new Set(existingMessages.map(m => m.order_id));
    console.log(`📋 Son 24 saatte ${sentOrderIds.size} siparişe mesaj gönderilmiş`);
    
    // 🔥 YENİ: AM/PM parse fonksiyonu
    const parseTime = (timeString) => {
      if (!timeString) return { hours: 0, minutes: 0 };
      
      const cleanTime = timeString.trim();
      const isPM = cleanTime.toLowerCase().includes('pm');
      const isAM = cleanTime.toLowerCase().includes('am');
      const timePart = cleanTime.replace(/\s*(am|pm)/gi, '').trim();
      const [hourStr, minStr] = timePart.split(':');
      
      let hours = parseInt(hourStr, 10);
      const minutes = parseInt(minStr, 10) || 0;
      
      if (isPM && hours !== 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }
      
      return { hours, minutes };
    };
    
    // Sürücü bazında siparişleri grupla
    const ordersByDriver = {};
    
    for (const order of orders) {
      if (sentOrderIds.has(order.id)) {
        console.log(`⏭️ ${order.ezcater_order_id}: Daha önce mesaj gönderilmiş`);
        skippedOrders.push({
          orderId: order.ezcater_order_id,
          reason: 'Daha önce mesaj gönderilmiş (24 saat içinde)'
        });
        continue;
      }
      
      if (!order.driver_id) {
        console.log(`⚠️ ${order.ezcater_order_id}: Sürücü atanmamış`);
        skippedOrders.push({
          orderId: order.ezcater_order_id,
          reason: 'Sürücü atanmamış'
        });
        continue;
      }
      
      if (!order.driver_phone || order.driver_phone.trim() === '') {
        console.log(`❌ ${order.ezcater_order_id}: Telefon numarası eksik`);
        failedMessages.push({
          orderId: order.ezcater_order_id,
          reason: 'Telefon numarası eksik'
        });
        
        await base44.asServiceRole.entities.CheckMessage.create({
          order_id: order.id,
          driver_phone: 'MISSING',
          driver_language: 'tr',
          message_type: '60dk_Kontrol',
          message_content: 'FAILED: Telefon numarası eksik',
          message_status: 'failed',
          failure_reason: 'Telefon numarası eksik',
          sent_time: new Date().toISOString()
        }).catch(err => console.error('CheckMessage oluşturulamadı:', err));
        
        continue;
      }
      
      if (!order.driver_phone.startsWith('+1')) {
        console.log(`🚫 ${order.ezcater_order_id}: Geçersiz numara (${order.driver_phone})`);
        failedMessages.push({
          orderId: order.ezcater_order_id,
          reason: `Geçersiz numara: ${order.driver_phone}`
        });
        
        await base44.asServiceRole.entities.CheckMessage.create({
          order_id: order.id,
          driver_phone: order.driver_phone,
          driver_language: 'tr',
          message_type: '60dk_Kontrol',
          message_content: 'BLOCKED: Geçersiz numara formatı',
          message_status: 'failed',
          failure_reason: `Sadece +1 numaralarına izin var`,
          sent_time: new Date().toISOString()
        }).catch(err => console.error('CheckMessage oluşturulamadı:', err));
        
        continue;
      }
      
      if (!ordersByDriver[order.driver_id]) {
        ordersByDriver[order.driver_id] = [];
      }
      ordersByDriver[order.driver_id].push(order);
    }
    
    console.log(`👥 ${Object.keys(ordersByDriver).length} farklı sürücü`);
    
    for (const [driverId, driverOrders] of Object.entries(ordersByDriver)) {
      console.log(`\n👤 Sürücü ${driverId} - ${driverOrders.length} sipariş`);
      
      const driver = await base44.asServiceRole.entities.Driver.filter({ id: driverId });
      const driverData = driver && driver.length > 0 ? driver[0] : null;
      const driverLanguage = driverData?.language || 'tr';
      
      // 🔥 YENİ: AM/PM destekli sıralama
      const sortedOrders = driverOrders.sort((a, b) => {
        const timeA = parseTime(a.pickup_time || '00:00');
        const timeB = parseTime(b.pickup_time || '00:00');
        const totalA = timeA.hours * 60 + timeA.minutes;
        const totalB = timeB.hours * 60 + timeB.minutes;
        return totalA - totalB;
      });
      
      // 2.5 saatlik gruplandırma
      const orderGroups = [];
      let currentGroup = [];
      
      for (let i = 0; i < sortedOrders.length; i++) {
        const order = sortedOrders[i];
        
        if (!order.pickup_time) {
          console.log(`⚠️ ${order.ezcater_order_id}: Pickup time yok`);
          skippedOrders.push({
            orderId: order.ezcater_order_id,
            reason: 'Pickup time eksik'
          });
          continue;
        }
        
        if (currentGroup.length === 0) {
          currentGroup.push(order);
        } else {
          const lastOrder = currentGroup[currentGroup.length - 1];
          
          // 🔥 YENİ: AM/PM parse ile karşılaştır
          const lastTime = parseTime(lastOrder.pickup_time);
          const currTime = parseTime(order.pickup_time);
          
          const lastTimeInMinutes = lastTime.hours * 60 + lastTime.minutes;
          const currTimeInMinutes = currTime.hours * 60 + currTime.minutes;
          const diffInMinutes = currTimeInMinutes - lastTimeInMinutes;
          
          console.log(`⏰ ${lastOrder.pickup_time} → ${order.pickup_time} = ${diffInMinutes} dk`);
          
          if (diffInMinutes <= 150) {
            currentGroup.push(order);
            console.log(`✅ Gruba eklendi`);
          } else {
            orderGroups.push([...currentGroup]);
            currentGroup = [order];
            console.log(`❌ Yeni grup`);
          }
        }
      }
      
      if (currentGroup.length > 0) {
        orderGroups.push(currentGroup);
      }
      
      console.log(`📊 ${orderGroups.length} grup oluşturuldu`);
      
      // Her grup için mesaj gönder
      for (const group of orderGroups) {
        const isGrouped = group.length > 1;
        const firstOrder = group[0];
        
        // 🚨 KRİTİK KONTROL 1: GÜN KONTROLÜ
        if (firstOrder.order_date !== todayEST) {
          console.log(`🚫 MESAJ ENGELLENDİ - Sipariş tarihi uyuşmuyor: ${firstOrder.order_date} !== ${todayEST}`);
          group.forEach(order => {
            skippedOrders.push({
              orderId: order.ezcater_order_id,
              reason: `Sipariş tarihi bugün değil (${order.order_date})`
            });
          });
          continue;
        }
        
        // 🔥 YENİ: AM/PM parse ile zaman kontrolü
        const firstTime = parseTime(firstOrder.pickup_time);
        const pickupTimeInMinutes = firstTime.hours * 60 + firstTime.minutes;
        
        // 🚨 KRİTİK KONTROL 2: PICKUP SAATİ MANTIKLI MI?
        if (pickupTimeInMinutes < 300 || pickupTimeInMinutes > 1380) { // 05:00 - 23:00
          console.log(`🚫 MESAJ ENGELLENDİ - Geçersiz pickup saati: ${firstOrder.pickup_time} (${firstTime.hours}:${firstTime.minutes})`);
          group.forEach(order => {
            skippedOrders.push({
              orderId: order.ezcater_order_id,
              reason: `Pickup saati mantıksız (${order.pickup_time})`
            });
          });
          continue;
        }
        
        const estHour = estDate.getHours();
        const estMin = estDate.getMinutes();
        const currentTimeInMinutes = estHour * 60 + estMin;
        
        // 🚨 KRİTİK KONTROL 3: ŞU ANKİ SAAT UYGUN MU?
        const MIN_HOUR = 5;  // Sabah 05:00'dan önce mesaj yok
        const MAX_HOUR = 21; // Gece 21:00'dan sonra mesaj yok
        
        if (estHour < MIN_HOUR || estHour >= MAX_HOUR) {
          console.log(`🚫 MESAJ ENGELLENDİ - Şu anki saat mesaj gönderimine uygun değil: ${estHour}:${estMin.toString().padStart(2, '0')} EST (İzin: ${MIN_HOUR}:00-${MAX_HOUR}:00)`);
          group.forEach(order => {
            skippedOrders.push({
              orderId: order.ezcater_order_id,
              reason: `Mesaj gönderim saati dışında (${estHour}:${estMin.toString().padStart(2, '0')} EST)`
            });
          });
          continue;
        }
        
        const minutesUntilPickup = pickupTimeInMinutes - currentTimeInMinutes;
        
        const minThreshold = config.minutes_before - 5;
        const maxThreshold = config.minutes_before + 5;
        const shouldSendNow = minutesUntilPickup >= minThreshold && minutesUntilPickup <= maxThreshold;
        
        if (!shouldSendNow) {
          console.log(`⏳ Zaman uygun değil: ${minutesUntilPickup} dk (${minThreshold}-${maxThreshold})`);
          group.forEach(order => {
            skippedOrders.push({
              orderId: order.ezcater_order_id,
              reason: `Zaman uygun değil (${minutesUntilPickup} dk kaldı)`
            });
          });
          continue;
        }
        
        console.log(`✅ Zaman uygun: ${minutesUntilPickup} dk`);
        
        // Mesaj içeriğini oluştur
        let messageContent;
        
        if (isGrouped) {
          const template = driverLanguage === 'en' 
            ? config.grouped_message_template_en 
            : config.grouped_message_template_tr;
          
          const orderList = group.map((order, idx) => {
            return `${idx + 1}. ⏰ ${order.pickup_time}\n   📍 ${order.pickup_address}`;
          }).join('\n\n');
          
          messageContent = template
            .replace('{driver_name}', firstOrder.driver_name || 'Sürücü')
            .replace('{order_count}', group.length.toString())
            .replace('{order_list}', orderList);
        } else {
          const template = driverLanguage === 'en' 
            ? config.message_template_en 
            : config.message_template_tr;
          
          messageContent = template
            .replace('{driver_name}', firstOrder.driver_name || 'Sürücü')
            .replace('{minutes}', Math.round(minutesUntilPickup).toString())
            .replace('{pickup_time}', firstOrder.pickup_time)
            .replace('{pickup_address}', firstOrder.pickup_address || 'Adres yok');
        }
        
        console.log(`📤 Mesaj gönderiliyor: ${firstOrder.driver_phone}`);
        
        const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
        
        if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
          console.error('❌ Twilio credentials eksik');
          group.forEach(order => {
            failedMessages.push({
              orderId: order.ezcater_order_id,
              reason: 'Twilio credentials eksik'
            });
          });
          continue;
        }
        
        try {
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                To: firstOrder.driver_phone,
                From: twilioPhoneNumber,
                Body: messageContent
              })
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            const twilioSid = data.sid;
            
            console.log(`✅ SMS gönderildi: ${twilioSid}`);
            
            const messageGroupId = isGrouped ? `group_${Date.now()}_${firstOrder.driver_id}` : null;
            
            // 🔥 YENİ: Her sürücü için case oluştur (yoksa)
            let caseId = null;
            try {
              const existingCase = await base44.asServiceRole.entities.Case.filter({
                driver_phone: firstOrder.driver_phone,
                created_date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
              });

              if (existingCase && existingCase.length > 0) {
                caseId = existingCase[0].id;
                console.log(`📋 Mevcut case kullanılıyor: ${caseId}`);
              } else {
                // Case oluştururken created_date'i otomatik olarak şu anki zamana ayarla
                // Base44 SDK otomatik olarak created_date ekler, bu yüzden manuel ayar gereksiz
                const newCase = await base44.asServiceRole.entities.Case.create({
                  driver_name: firstOrder.driver_name,
                  driver_phone: firstOrder.driver_phone,
                  sorun: `Pickup hatırlatma mesajı - ${firstOrder.pickup_time}`,
                  konum: firstOrder.pickup_address,
                  aciliyet: 'Orta',
                  kategori: 'Lojistik & Ulaşım',
                  durum: 'Bildirildi'
                });
                caseId = newCase.id;
                console.log(`📋 Yeni case oluşturuldu: ${caseId} (${new Date().toISOString()} / EST: ${estDate.toLocaleString('en-US', { timeZone: 'America/New_York' })})`);
              }
            } catch (error) {
              console.error(`⚠️ Case oluşturulamadı: ${error.message}`);
            }
            
            for (const order of group) {
              try {
                await base44.asServiceRole.entities.CheckMessage.create({
                  order_id: order.id,
                  driver_phone: order.driver_phone,
                  driver_language: driverLanguage,
                  message_type: '60dk_Kontrol',
                  message_content: messageContent,
                  message_status: 'sent',
                  twilio_sid: twilioSid,
                  sent_time: new Date().toISOString(),
                  message_group_id: messageGroupId
                });
                
                sentMessages.push({
                  orderId: order.ezcater_order_id,
                  driverName: order.driver_name,
                  driverPhone: order.driver_phone,
                  pickupTime: order.pickup_time,
                  sentAt: new Date().toISOString(),
                  isGrouped: isGrouped,
                  groupSize: group.length
                });
                
                console.log(`✅ CheckMessage: ${order.ezcater_order_id}`);
              } catch (error) {
                console.error(`❌ CheckMessage hatası: ${error.message}`);
              }
            }
            
            // 🔥 YENİ: ChatMessage oluştur (Konuşma Paneli için)
            if (caseId) {
              try {
                // ChatMessage oluştururken timestamp otomatik olarak şu anki zamana ayarlanır
                await base44.asServiceRole.entities.ChatMessage.create({
                  case_id: caseId,
                  sender: 'bot',
                  message: messageContent,
                  timestamp: new Date().toISOString()
                });
                console.log(`💬 ChatMessage oluşturuldu (case: ${caseId}, timestamp: ${new Date().toISOString()})`);
              } catch (error) {
                console.error(`⚠️ ChatMessage hatası: ${error.message}`);
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1100));
            
          } else {
            const errorData = await response.text();
            console.error(`❌ Twilio hatası: ${response.status}`);
            
            twilioErrors.push({
              driverPhone: firstOrder.driver_phone,
              error: errorData,
              orders: group.map(o => o.ezcater_order_id)
            });
            
            for (const order of group) {
              failedMessages.push({
                orderId: order.ezcater_order_id,
                reason: `Twilio hatası: ${response.status}`
              });
              
              await base44.asServiceRole.entities.CheckMessage.create({
                order_id: order.id,
                driver_phone: order.driver_phone,
                driver_language: driverLanguage,
                message_type: '60dk_Kontrol',
                message_content: messageContent,
                message_status: 'failed',
                failure_reason: `Twilio Error: ${response.status}`,
                sent_time: new Date().toISOString()
              }).catch(err => console.error('CheckMessage hatası:', err));
            }
          }
        } catch (error) {
          console.error(`❌ SMS hatası: ${error.message}`);
          
          twilioErrors.push({
            driverPhone: firstOrder.driver_phone,
            error: error.message,
            orders: group.map(o => o.ezcater_order_id)
          });
          
          for (const order of group) {
            failedMessages.push({
              orderId: order.ezcater_order_id,
              reason: `Bağlantı hatası: ${error.message}`
            });
            
            await base44.asServiceRole.entities.CheckMessage.create({
              order_id: order.id,
              driver_phone: order.driver_phone,
              driver_language: driverLanguage,
              message_type: '60dk_Kontrol',
              message_content: messageContent,
              message_status: 'failed',
              failure_reason: `Connection Error: ${error.message}`,
              sent_time: new Date().toISOString()
            }).catch(err => console.error('CheckMessage hatası:', err));
          }
        }
      }
    }
    
    const summary = {
      success: true,
      totalOrders: orders.length,
      sentCount: sentMessages.length,
      failedCount: failedMessages.length,
      skippedCount: skippedOrders.length,
      groupedMessages: sentMessages.filter(m => m.isGrouped).length,
      singleMessages: sentMessages.filter(m => !m.isGrouped).length,
      sent: sentMessages,
      failed: failedMessages,
      skipped: skippedOrders,
      twilioErrors: twilioErrors
    };
    
    console.log('\n📊 ÖZET:');
    console.log(`✅ Gönderilen: ${summary.sentCount}`);
    console.log(`   🔗 Grup: ${summary.groupedMessages}`);
    console.log(`   📄 Tekil: ${summary.singleMessages}`);
    console.log(`❌ Başarısız: ${summary.failedCount}`);
    console.log(`⏭️ Atlanan: ${summary.skippedCount}`);
    
    return Response.json(summary);
    
  } catch (error) {
    console.error('❌ Hata:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});