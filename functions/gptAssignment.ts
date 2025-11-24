
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const MANUAL_ASSIGNMENTS_HTML_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/687922c274a70a2de1788cbe/6fae2d2eb_dataReport_2025-09-09_to_2025-09-10.html';

const getDayNameInEnglish = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(date).getDay()];
};

const parseManualAssignmentsHTML = (html) => {
    const assignments = [];
    
    try {
        const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (!tbodyMatch) return assignments;
        
        const tbodyContent = tbodyMatch[1];
        const rows = tbodyContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
        
        let headerPassed = false;
        
        for (const row of rows) {
            const cells = [];
            const cellMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
            
            for (const cellHtml of cellMatches) {
                let cellText = cellHtml
                    .replace(/<td[^>]*>/, '')
                    .replace(/<\/td>/, '')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\n/g, ' ')
                    .trim();
                cells.push(cellText);
            }
            
            if (!headerPassed && (cells[0] === '#' || cells[1] === 'Order No' || cells[0].includes('Creation Date'))) {
                headerPassed = true;
                continue;
            }
            
            if (!headerPassed) continue;
            if (cells.length < 6) continue;
            
            const orderNo = cells[1];
            const deliveryDateTime = cells[2];
            const deliveryAddress = cells[3];
            const pickupLocation = cells[4];
            const driverName = cells[5];
            
            if (!orderNo || !driverName) continue;
            
            assignments.push({
                order_id: orderNo,
                driver_name: driverName,
                delivery_datetime: deliveryDateTime,
                delivery_address: deliveryAddress,
                pickup_location: pickupLocation
            });
        }
        
        console.log(`✅ ${assignments.length} manuel atama parse edildi`);
    } catch (error) {
        console.error("❌ HTML parse hatası:", error);
    }
    
    return assignments;
};

const extractRegion = (address) => {
    if (!address) return 'Unknown';
    
    // State kodlarını bul (MD, VA, DC)
    const stateMatch = address.match(/,\s*(MD|VA|DC)\s*\d{5}/);
    if (stateMatch) return stateMatch[1];
    
    // Şehir isimlerini kullan
    if (address.includes('Washington, DC') || address.includes('DC 20')) return 'DC';
    if (address.includes('MD 20')) return 'MD';
    if (address.includes('VA 2')) return 'VA';
    
    return 'Unknown';
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        if (!(await base44.auth.isAuthenticated())) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { targetDate } = await req.json();
        const day = getDayNameInEnglish(targetDate);
        
        console.log(`\n🤖 GPT-4 ATAMA (İYİLEŞTİRİLMİŞ) - ${targetDate} (${day})\n`);
        
        // 1️⃣ Manuel atama örneklerini çek
        console.log("📥 Manuel atama örnekleri indiriliyor...");
        const htmlResponse = await fetch(MANUAL_ASSIGNMENTS_HTML_URL);
        const htmlContent = await htmlResponse.text();
        const manualAssignments = parseManualAssignmentsHTML(htmlContent);
        
        console.log(`✅ ${manualAssignments.length} manuel atama örneği hazır\n`);
        
        // 2️⃣ Verileri çek
        const [unassignedOrders, assignedOrders, allDrivers] = await Promise.all([
            base44.entities.DailyOrder.filter({ order_date: targetDate, status: "Çekildi" }, 'pickup_time'),
            base44.entities.DailyOrder.filter({ order_date: targetDate, status: "Atandı" }, 'pickup_time'), // 🆕 Zaten atanmışları da al
            base44.entities.Driver.filter({ status: "Aktif" })
        ]);
        
        // 🔥 Sadece bugün çalışan TOP DASHER'ları filtrele
        const drivers = allDrivers.filter(d => {
            const workingDays = d.assignment_preferences?.working_days || [];
            const isTopDasher = d.is_top_dasher === true;
            return workingDays.includes(day) && isTopDasher; // ⭐ Top Dasher filtresi
        });
        
        if (drivers.length === 0) {
            return Response.json({ success: false, error: `${day} günü çalışan TOP DASHER sürücü yok!` });
        }
        
        if (unassignedOrders.length === 0) {
            return Response.json({ success: false, error: 'Atanacak sipariş yok!' });
        }
        
        console.log(`📦 ${unassignedOrders.length} atanmamış, ${assignedOrders.length} atanmış sipariş, ⭐ ${drivers.length} TOP DASHER\n`);
        
        // 🔥 Mapping objeleri
        const orderMap = new Map();
        unassignedOrders.forEach(o => orderMap.set(o.ezcater_order_id, o));
        
        const driverMap = new Map();
        drivers.forEach(d => driverMap.set(d.name, d));
        
        // 3️⃣ GPT-4 için gelişmiş prompt
        const prompt = `Sen bir lojistik uzmanısın ve yemek teslimat şirketi için sipariş ataması yapıyorsun. 

📊 MANUEL ATAMA ÖRNEKLERİ (Gerçek veriler - bunları öğren):
${manualAssignments.slice(0, 80).map(a => 
    `- Sipariş: ${a.order_id}, Sürücü: ${a.driver_name}, Pickup: ${a.pickup_location}, Dropoff: ${a.delivery_address}`
).join('\n')}

👥 SÜRÜCÜ PROFİLLERİ (${drivers.length} aktif sürücü):
${drivers.map(d => {
    const special = d.special_notes || {};
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚗 ${d.name}
   • Çalışma Günleri: ${(d.assignment_preferences?.working_days || []).join(', ')}
   • Günlük Max: ${d.assignment_preferences?.max_orders_per_day || 5} sipariş
   • Tercih Ettiği Bölgeler: ${(d.preferred_areas || []).slice(0, 5).join(', ') || 'Yok'}
   • Erken Sabah: ${d.early_morning_eligible ? `✅ Alabilir (Güvenilirlik: ${d.early_morning_reliability || 0}/4)` : '❌ Almaz'}
   • Öncelik: ${d.assignment_priority || 'Normal'}
   
   🚫 KISITLAMALAR:
   ${special.avoid_dc ? '   ⛔ DC\'YE GİRMEZ (Kesinlikle DC siparişi verme!)' : ''}
   ${special.avoid_long_distance ? '   ⛔ Uzun mesafe istemez' : ''}
   ${special.must_get_orders_when_working ? '   ⚡ Çalıştığında MUTLAKA sipariş almalı' : ''}
   
   ✨ AVANTAJLAR:
   ${special.is_owner ? '   👑 Şirket sahibi (öncelik ver)' : ''}
   ${special.is_friend ? '   🤝 Yakın arkadaş (öncelik ver)' : ''}
   ${special.priority_level > 0 ? `   ⭐ Öncelik Seviyesi: ${special.priority_level}/10` : ''}
   
   📍 Zincir Rota Geçmişi (Son 3):
   ${(d.chain_history || []).slice(0, 3).map(c => 
       `      ${c.date}: ${c.stops} durak (${c.regions.join(' → ')})`
   ).join('\n   ') || '   Yok'}
   
   ${special.custom_note ? `📝 Not: ${special.custom_note}` : ''}`;
}).join('\n')}

📦 BUGÜN ZATEN ATANMIŞ SİPARİŞLER (Zincirleme için önemli):
${assignedOrders.length > 0 ? assignedOrders.map(o => `
   • ${o.driver_name}: ${o.pickup_time} (${extractRegion(o.pickup_address)}) → ${o.dropoff_time} (${extractRegion(o.dropoff_address)})
     Pickup: ${o.pickup_address}
     Dropoff: ${o.dropoff_address}`).join('\n') : 'Henüz atanmış sipariş yok'}

📦 ATANACAK SİPARİŞLER (${targetDate}):
${unassignedOrders.map(o => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Order: ${o.ezcater_order_id}
   🕐 Pickup: ${o.pickup_time} 
   📍 Pickup Adres: ${o.pickup_address}
   🕐 Dropoff: ${o.dropoff_time}
   📍 Dropoff Adres: ${o.dropoff_address}
   🏷️ Bölge: Pickup=${extractRegion(o.pickup_address)}, Dropoff=${extractRegion(o.dropoff_address)}`).join('\n')}

🎯 ATAMA KURALLARI (ÇOK ÖNEMLİ - TAKİP ET!):

1. 🚫 KISITLAMALARA UYGUNLUK:
   - "avoid_dc: true" olan sürücüye ASLA DC siparişi verme!
   - "avoid_long_distance: true" olanlara uzak mesafe verme
   - "must_get_orders_when_working: true" olanlara mutlaka sipariş ver

2. ⏰ ZAMAN ÇAKIŞMASI YASAK:
   - Aynı sürücüye aynı saate 2 sipariş atama!
   - Bir siparişin dropoff time'ı ile bir sonraki pickup time'ı arasında en az 30 dakika olmalı
   - Örnek: 11:00-11:30 siparişten sonra 12:00'dan önce yeni sipariş verme

3. 🗺️ BÖLGE MANTĞI:
   - Aynı eyalette kalmayı tercih et (MD→MD, VA→VA, DC→DC)
   - Zincirleme yaparken son dropoff'a yakın pickup'lar seç
   - MD → VA → MD gibi ileri-geri rotalar YAPMA

4. 🔗 ZİNCİRLEME:
   - Zaten atanmış siparişlerin son dropoff noktasını kullan
   - Aynı sürücüye arka arkaya verilebilecek siparişleri zincirlemeye çalış
   - chain_history'deki başarılı rota kalıplarını taklit et

5. ⏰ ERKEN SABAH (09:00 öncesi):
   - Sadece early_morning_eligible=true olanları seç
   - Güvenilirlik skoru yüksek olanları (1-2) tercih et

6. ⭐ ÖNCELİKLER:
   - is_owner=true → En yüksek öncelik
   - is_friend=true → Yüksek öncelik
   - must_get_orders_when_working=true → Mutlaka sipariş ver
   - priority_level > 5 → Öncelikli ata

7. 📍 MANUEL ÖRNEKLERİ KULLAN:
   - Benzer rotalarda daha önce hangi sürücü kullanıldı?
   - Benzer bölge kombinasyonlarını taklit et

📋 ÇIKTI FORMATI (SADECE JSON, AÇIKLAMA EKLEME):
{
  "assignments": [
    {
      "order_no": "EzCater_Order_ID",
      "driver_name": "Sürücü İsmi (tam olarak yukarıdaki listeden)",
      "confidence": 0.95,
      "reasoning": "Kısa açıklama: Neden bu sürücü? Hangi kural/örnek kullanıldı?"
    }
  ],
  "unassigned": [
    {
      "order_no": "EzCater_Order_ID",
      "reason": "Neden atanamadı? (örn: Zaman çakışması, kısıtlama, uygun sürücü yok)"
    }
  ]
}

⚠️ ÖNEMLİ HATIRLATMALAR:
- ASLA aynı sürücüye aynı saate 2 sipariş atama!
- avoid_dc=true olanları DC'ye sokma!
- Sürücü isimlerini tam olarak yaz (yukarıdaki listeden)
- Her atamayı mantıklı bir gerekçeyle yap`;

        console.log("🤖 GPT-4'e gönderiliyor...\n");
        
        // 4️⃣ GPT-4'e gönder
        const gptResponse = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    assignments: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                order_no: { type: "string" },
                                driver_name: { type: "string" },
                                confidence: { type: "number" },
                                reasoning: { type: "string" }
                            },
                            required: ["order_no", "driver_name"]
                        }
                    },
                    unassigned: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                order_no: { type: "string" },
                                reason: { type: "string" }
                            }
                        }
                    }
                },
                required: ["assignments"]
            }
        });
        
        console.log("✅ GPT-4 cevabı alındı\n");
        
        const assignments = gptResponse.assignments || [];
        const unassigned = gptResponse.unassigned || [];
        
        console.log(`📊 GPT ${assignments.length} atama, ${unassigned.length} atanamayan sipariş önerdi`);
        
        // 5️⃣ Atamaları uygula
        let successCount = 0;
        let errorCount = 0;
        const results = [];
        const errors = [];
        
        for (const assignment of assignments) {
            try {
                const order = orderMap.get(assignment.order_no);
                if (!order) {
                    console.error(`❌ Sipariş bulunamadı: ${assignment.order_no}`);
                    errorCount++;
                    errors.push({ order_no: assignment.order_no, driver_name: assignment.driver_name, error: 'Sipariş bulunamadı' });
                    continue;
                }
                
                const driver = driverMap.get(assignment.driver_name);
                if (!driver) {
                    console.error(`❌ Sürücü bulunamadı: ${assignment.driver_name}`);
                    errorCount++;
                    errors.push({ order_no: assignment.order_no, driver_name: assignment.driver_name, error: `Sürücü bulunamadı: ${assignment.driver_name}` });
                    continue;
                }
                
                // 🔥 Ekstra validasyon: avoid_dc kontrolü
                if (driver.special_notes?.avoid_dc && (extractRegion(order.pickup_address) === 'DC' || extractRegion(order.dropoff_address) === 'DC')) {
                    console.error(`❌ ${driver.name} DC'ye giremez ama GPT DC siparişi verdi: ${assignment.order_no}`);
                    errorCount++;
                    errors.push({ order_no: assignment.order_no, driver_name: assignment.driver_name, error: 'DC kısıtlaması ihlal edildi' });
                    continue;
                }
                
                await base44.entities.DailyOrder.update(order.id, {
                    driver_id: driver.id,
                    driver_name: driver.name,
                    status: "Atandı"
                });
                
                successCount++;
                results.push({
                    order_no: assignment.order_no,
                    driver_name: assignment.driver_name,
                    confidence: assignment.confidence,
                    reasoning: assignment.reasoning
                });
                
                console.log(`✅ ${successCount}/${assignments.length}: ${assignment.order_no} → ${assignment.driver_name} (${assignment.confidence || 'N/A'})`);
                
                if (successCount % 5 === 0) {
                    await new Promise(r => setTimeout(r, 100));
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ Atama hatası (${assignment.order_no}):`, error.message);
                errors.push({ order_no: assignment.order_no, driver_name: assignment.driver_name, error: error.message });
            }
        }
        
        console.log(`\n✅ ${successCount}/${unassignedOrders.length} sipariş atandı`);
        if (errorCount > 0) {
            console.log(`❌ ${errorCount} hata oluştu`);
        }
        if (unassigned.length > 0) {
            console.log(`⚠️ ${unassigned.length} sipariş GPT tarafından atanamadı`);
        }
        
        return Response.json({
            success: true,
            message: `GPT-4 ile ${successCount} sipariş atandı`,
            assignedCount: successCount,
            totalOrders: unassignedOrders.length,
            errorCount: errorCount,
            assignments: results,
            errors: errors.length > 0 ? errors : undefined,
            unassigned: unassigned.length > 0 ? unassigned : undefined,
            manualExamplesUsed: manualAssignments.length
        });

    } catch (error) {
        console.error("❌ GPT Atama Hatası:", error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});
