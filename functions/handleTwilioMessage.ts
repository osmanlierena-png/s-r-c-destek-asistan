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
    const formData = await req.formData();
    
    const from = formData.get('From');
    const body = formData.get('Body')?.trim().toUpperCase();
    
    console.log(`📱 Gelen mesaj: ${from} → "${body}"`);
    
    // 🚫 VALİDASYON KONTROLÜ
    if (!isValidUSPhone(from)) {
      console.log(`🚫 BLOCKED - Geçersiz numara: ${from}`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }
    
    const recentMessages = await base44.asServiceRole.entities.CheckMessage.filter({
      driver_phone: from,
      response_received: false
    }, '-sent_time', 50);
    
    console.log(`📦 ${recentMessages.length} yanıtsız mesaj bulundu`);
    
    if (recentMessages.length === 0) {
      console.log('⚠️ Bekleyen mesaj yok');
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }
    
    const uniqueOrderIds = [...new Set(recentMessages.map(m => m.order_id))];
    
    let responseType = null;
    if (body.includes('YES') || body.includes('EVET')) {
      responseType = 'Onay';
    } else if (body.includes('NO') || body.includes('HAYIR')) {
      responseType = 'Red';
    }
    
    if (responseType) {
      console.log(`✅ Yanıt tipi: ${responseType}`);
      
      for (const orderId of uniqueOrderIds) {
        try {
          const order = await base44.asServiceRole.entities.DailyOrder.filter({ id: orderId });
          
          if (order && order[0]) {
            await base44.asServiceRole.entities.DailyOrder.update(order[0].id, {
              status: responseType === 'Onay' ? 'Sürücü Onayladı' : 'Sürücü Reddetti',
              driver_response: responseType,
              driver_response_at: new Date().toISOString()
            });
            console.log(`✅ Sipariş ${order[0].ezcater_order_id} güncellendi`);
          }
        } catch (error) {
          console.error(`❌ Sipariş update hatası (${orderId}):`, error);
        }
      }
      
      for (const msg of recentMessages) {
        try {
          await base44.asServiceRole.entities.CheckMessage.update(msg.id, {
            response_received: true,
            response_time: new Date().toISOString()
          });
        } catch (error) {
          console.error(`❌ CheckMessage update hatası:`, error);
        }
      }
      
      const driver = await base44.asServiceRole.entities.Driver.filter({ phone: from });
      const driverLanguage = driver && driver[0] ? driver[0].language : 'tr';
      
      // Canvas'a sürücü yanıtını bildir
      const CANVAS_URL = Deno.env.get("CANVAS_URL");
      if (CANVAS_URL) {
        for (const orderId of uniqueOrderIds) {
          try {
            const order = await base44.asServiceRole.entities.DailyOrder.filter({ id: orderId });
            if (order && order[0]) {
              await fetch(`${CANVAS_URL}/api/base44/webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'DRIVER_RESPONSE',
                  orderId: order[0].id,
                  orderNumber: order[0].ezcater_order_id,
                  driverResponse: responseType === 'Onay' ? 'Evet' : 'Hayır',
                  driverName: order[0].driver_name,
                  responseTime: new Date().toISOString(),
                  date: order[0].order_date,
                  groupId: order[0].group_id || null
                })
              });
              console.log(`[WEBHOOK] Canvas'a bildirim gönderildi: ${order[0].ezcater_order_id} - ${responseType === 'Onay' ? 'Evet' : 'Hayır'}`);
            }
          } catch (err) {
            console.error('[WEBHOOK] Canvas bildirimi başarısız:', err);
          }
        }
      }
      
      const confirmationMessages = {
        tr: responseType === 'Onay' 
          ? '✅ Teşekkürler! Siparişleriniz onaylandı. Pickup adresine ulaştığınızda Arrive\'a basmayı unutmayın!'
          : '❌ Anlaşıldı. Siparişleriniz iptal edildi. Teşekkürler.',
        en: responseType === 'Onay'
          ? '✅ Thank you! Your orders are confirmed. Don\'t forget to press Arrive when you reach the pickup location!'
          : '❌ Understood. Your orders have been cancelled. Thank you.'
      };
      
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${confirmationMessages[driverLanguage]}</Message></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }
    
    console.log('⚠️ Anlaşılmayan yanıt');
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    });
    
  } catch (error) {
    console.error('❌ Hata:', error);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});