import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { batchStart = 0, batchSize = 1 } = await req.json();
        
        console.log(`\n🚀 BATCH ${Math.floor(batchStart / batchSize) + 1} BAŞLIYOR (index: ${batchStart}, size: ${batchSize})`);
        
        // 🔥 DOĞRU HTML URL
        const htmlUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/687922c274a70a2de1788cbe/2e8753107_surucu_bolgeleri_full.html';
        const htmlResponse = await fetch(htmlUrl);
        const htmlContent = await htmlResponse.text();
        
        // Tüm sürücü bölümlerini parse et
        const driverSections = [];
        const sectionMatches = htmlContent.matchAll(/<div class="driver-section"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="driver-section"|<\/body>)/g);
        
        for (const match of sectionMatches) {
            const sectionHtml = match[0];
            const nameMatch = sectionHtml.match(/<h2>(.*?)<\/h2>/);
            const notesMatch = sectionHtml.match(/<div class="notes">([\s\S]*?)<\/div>/);
            
            if (nameMatch && notesMatch) {
                const driverName = nameMatch[1].trim();
                const notesHtml = notesMatch[1]
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .trim();
                
                driverSections.push({ name: driverName, notes: notesHtml });
            }
        }
        
        console.log(`📊 Toplam ${driverSections.length} sürücü bulundu HTML'de`);
        
        // Batch'i al
        const batch = driverSections.slice(batchStart, batchStart + batchSize);
        
        if (batch.length === 0) {
            return Response.json({
                success: true,
                batchComplete: true,
                message: 'Tüm sürücüler işlendi',
                processedSoFar: batchStart,
                totalDrivers: driverSections.length,
                updatedCount: 0,
                createdCount: 0
            });
        }
        
        console.log(`📦 Bu batch'te ${batch.length} sürücü işlenecek`);
        
        let updatedCount = 0;
        let createdCount = 0;
        
        for (const { name, notes } of batch) {
            console.log(`\n👤 İşleniyor: ${name}`);
            console.log(`📝 Notes (ilk 200 karakter): ${notes.substring(0, 200)}...`);
            
            // 🔥 GÜÇLENDİRİLMİŞ LLM PROMPT - BÖLGE ÖNCELİKLERİ EKLENDİ
            const enhancedPrompt = `Sen bir sürücü kural analizcisisin. Sana bir sürücünün HTML notlarından çıkarılmış metin verildi. 
Bu metni analiz edip aşağıdaki JSON yapısını tam ve eksiksiz doldurman gerekiyor.

🎯 ÖNEMLİ KURALLAR:

**ÇALIŞMA GÜNLERİ:**
- "Every day" veya "Tüm günler" → ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
- "Mon-Fri" → ["Monday","Tuesday","Wednesday","Thursday","Friday"]
- "Weekend" → ["Saturday","Sunday"]
- Eksik gün yazılmışsa (örn: "Mon, Wed, Fri") → sadece o günleri ekle
- Hiçbir gün belirtilmemişse → [] (boş array)

**ÇALIŞMA SAATLERİ/VARDİYA:**
- "Morning" / "Sabah" / "10-5" / "early shift" → preferred_shift: "morning"
- "Evening" / "Akşam" / "after 2pm" / "late shift" → preferred_shift: "evening"
- "All day" / "Tüm gün" / hiçbir şey yazılmamışsa → preferred_shift: "all_day"

**ERKEN SABAH (05:00-09:00):**
- "Early morning" / "Erken sabah" / "6am start" → early_morning_eligible: true
- Aksi halde → early_morning_eligible: false

**🆕 BÖLGE ÖNCELİKLERİ:**
ÇOOK ÖNEMLİ! Metinde şu ifadeler varsa region_priorities objesine ekle:

FORMAT ÖRNEKLERİ:
- "Bethesda: 1. öncelikli" → { "bethesda": 1 }
- "Arlington: 2. öncelikli" → { "arlington": 2 }
- "Fredericksburg: öncelikli" → { "fredericksburg": 1 } (belirtilmemişse 1 kabul et)
- "DC: tercih eder" → { "dc": 2 } (tercih = 2)
- "22202: 1. sıra" → { "22202": 1 }
- "VA: 3. öncelik" → { "va": 3 }
- "Springfield, Fairfax: 1. öncelik" → { "springfield": 1, "fairfax": 1 }

ÖNCELIK SEVİYELERİ:
- "1. öncelikli" / "primary" / "first choice" → 1
- "2. öncelikli" / "secondary" / "second choice" / "tercih eder" → 2
- "3. öncelikli" / "third choice" → 3

BÖLGE İSİMLERİ (küçük harfe çevir):
- Şehirler: bethesda, arlington, alexandria, tysons, mclean, reston, fairfax, springfield, annandale, falls church, vienna, oakton, herndon, chantilly, centreville, manassas, leesburg, ashburn, sterling, rockville, gaithersburg, silver spring, frederick, waldorf, college park, germantown, potomac, chevy chase, kensington, hyattsville, beltsville, laurel, bowie, annapolis, baltimore, stafford, fredericksburg, woodbridge
- Eyaletler: va, md, dc, wv
- Zip kodlar: 22202, 20001, 22101 vs.

⚠️ ÖNEMLİ: 
- Bölge isimlerini MUTLAKA KÜÇÜK HARFLE yaz
- Öncelik yoksa region_priorities = {} (boş obje)
- Virgülle ayrılmış bölgeler varsa hepsini ayrı ayrı ekle

**BÖLGE KISITLAMALARI:**
- "No DC" / "DC'ye girmez" / "Avoid DC" / "doesn't go to DC" → avoid_dc: true
- DC ile ilgili kısıt yoksa → avoid_dc: false

**MESAFE KISITLAMALARI:**
- "No long distance" / "Uzak mesafe istemez" / "short routes only" → avoid_long_distance: true
- Aksi halde → avoid_long_distance: false

**JOKER SÜRÜCÜ:**
- "Joker" / "can take anything" / "flexible" / "her şeyi alır" → is_joker_driver: true
- Normal sürücü ise → is_joker_driver: false

**TERCİH EDİLEN BÖLGELER:**
- Açıkça yazılan bölge isimleri: "Alexandria", "Arlington", "Bethesda", "Reston", "Tysons", "McLean", "Fairfax", "Springfield", "Annandale", "Falls Church", "Vienna", "Oakton", "Herndon", "Chantilly", "Centreville", "Manassas", "Leesburg", "Ashburn", "Sterling", "Rockville", "Gaithersburg", "Silver Spring", "Wheaton", "College Park", "Greenbelt", "Laurel", "Bowie", "Annapolis", "Baltimore", "Frederick", "Georgetown", "Capitol Hill", "Dupont Circle", "Adams Morgan", "Navy Yard", "H Street", "Shaw", "Columbia Heights", "Petworth", "Brookland", "Takoma", "Stafford", "Fredericksburg", "Woodbridge"
- Eyalet kısaltmaları: "VA", "MD", "DC"
- Zip code'lar: "22202", "20001" gibi
- Hepsini preferred_areas array'ine ekle

**MAX SİPARİŞ:**
- "1-2 orders" → max_orders_per_day: 2
- "3 orders" → max_orders_per_day: 3
- "up to 5" → max_orders_per_day: 5
- Belirtilmemişse → max_orders_per_day: 3 (default)

**ÖNCELİK SEVİYESİ:**
- "High priority" / "Öncelikli" / "Must give orders" → priority_level: 8-10
- "Medium priority" / "Normal" → priority_level: 4-7
- "Low priority" / "Yedek" → priority_level: 1-3
- "Owner" / "Friend" → priority_level: 10
- Belirtilmemişse → priority_level: 5

**ÖZEL NOTLAR:**
- "Owner" / "Ben" / "Sahibi" → is_owner: true
- "Friend" / "Arkadaş" / "Close friend" → is_friend: true
- "Must get orders" / "Mutlaka sipariş almalı" → must_get_orders_when_working: true

🔥 SÜRÜCÜ METNİ:
"""
${notes}
"""

📋 DOLDURULMASI GEREKEN JSON YAPISI:
{
  "working_days": ["Monday", "Tuesday", ...],
  "preferred_shift": "all_day" | "morning" | "evening",
  "early_morning_eligible": true/false,
  "max_orders_per_day": NUMBER (1-10 arası),
  "avoid_dc": true/false,
  "avoid_long_distance": true/false,
  "is_joker_driver": true/false,
  "preferred_areas": ["Alexandria", "22202", ...],
  "region_priorities": {
    "bethesda": 1,
    "arlington": 2,
    "22202": 1
  },
  "priority_level": NUMBER (0-10 arası),
  "is_owner": true/false,
  "is_friend": true/false,
  "must_get_orders_when_working": true/false,
  "custom_note": "Diğer önemli notlar"
}

⚠️ ÇOK ÖNEMLİ:
- Tüm boolean alanlar true VEYA false olmalı (null olmamalı)
- working_days MUTLAKA array olmalı, string olmamalı
- region_priorities MUTLAKA obje olmalı {} (boş olsa bile)
- region_priorities key'leri MUTLAKA KÜÇÜK HARF
- Belirsiz durumda mantıklı default değer kullan
- Metinde geçmeyen bilgiler için boş/false/default değer ver
- JSON formatı TAM ve GEÇERLİ olmalı`;

            // 🔥 GÜÇLENDİRİLMİŞ JSON SCHEMA
            const enhancedSchema = {
                type: "object",
                properties: {
                    working_days: {
                        type: "array",
                        items: {
                            type: "string",
                            enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                        },
                        description: "Sürücünün çalıştığı günler - MUTLAKA ARRAY!"
                    },
                    preferred_shift: {
                        type: "string",
                        enum: ["all_day", "morning", "evening"],
                        default: "all_day",
                        description: "Tercih edilen vardiya"
                    },
                    early_morning_eligible: {
                        type: "boolean",
                        description: "05:00-09:00 arası erken sabah siparişleri alabilir mi"
                    },
                    max_orders_per_day: {
                        type: "number",
                        minimum: 1,
                        maximum: 10,
                        description: "Günde alabileceği maksimum sipariş sayısı"
                    },
                    avoid_dc: {
                        type: "boolean",
                        description: "DC bölgesine girmek istemiyor mu"
                    },
                    avoid_long_distance: {
                        type: "boolean",
                        description: "Uzak mesafe siparişlerden kaçınıyor mu"
                    },
                    is_joker_driver: {
                        type: "boolean",
                        description: "Joker sürücü mü - her şeyi alabilir"
                    },
                    preferred_areas: {
                        type: "array",
                        items: { type: "string" },
                        description: "Tercih edilen bölgeler, eyaletler veya zip kodlar"
                    },
                    region_priorities: {
                        type: "object",
                        additionalProperties: {
                            type: "number",
                            minimum: 1,
                            maximum: 3
                        },
                        description: "Bölge öncelikleri: { 'bethesda': 1, 'arlington': 2 } formatında"
                    },
                    priority_level: {
                        type: "number",
                        minimum: 0,
                        maximum: 10,
                        description: "Atama öncelik seviyesi (0=en düşük, 10=en yüksek)"
                    },
                    is_owner: {
                        type: "boolean",
                        description: "Şirket sahibi mi"
                    },
                    is_friend: {
                        type: "boolean",
                        description: "Yakın arkadaş mı"
                    },
                    must_get_orders_when_working: {
                        type: "boolean",
                        description: "Çalıştığı gün mutlaka sipariş almalı mı"
                    },
                    custom_note: {
                        type: "string",
                        description: "Diğer önemli notlar"
                    }
                },
                required: ["working_days", "preferred_shift", "early_morning_eligible", "max_orders_per_day", 
                          "avoid_dc", "avoid_long_distance", "is_joker_driver", "preferred_areas", 
                          "region_priorities", "priority_level", "is_owner", "is_friend", "must_get_orders_when_working"]
            };
            
            // LLM'e gönder
            console.log(`🤖 LLM'e gönderiliyor...`);
            const llmResponse = await base44.integrations.Core.InvokeLLM({
                prompt: enhancedPrompt,
                response_json_schema: enhancedSchema
            });
            
            console.log(`✅ LLM yanıtı alındı:`, JSON.stringify(llmResponse, null, 2));
            
            // region_priorities key'lerini lowercase yap (güvenlik için)
            const regionPriorities = {};
            if (llmResponse.region_priorities) {
                for (const [key, value] of Object.entries(llmResponse.region_priorities)) {
                    regionPriorities[key.toLowerCase().trim()] = value;
                }
            }
            
            console.log(`📍 Bölge öncelikleri:`, regionPriorities);
            
            // Database'e kaydet veya güncelle
            const existingDrivers = await base44.asServiceRole.entities.Driver.filter({ name });
            
            const updateData = {
                assignment_preferences: {
                    working_days: llmResponse.working_days || [],
                    max_orders_per_day: llmResponse.max_orders_per_day || 3
                },
                preferred_shift: llmResponse.preferred_shift || "all_day",
                early_morning_eligible: llmResponse.early_morning_eligible || false,
                is_joker_driver: llmResponse.is_joker_driver || false,
                preferred_areas: llmResponse.preferred_areas || [],
                special_notes: {
                    avoid_dc: llmResponse.avoid_dc || false,
                    avoid_long_distance: llmResponse.avoid_long_distance || false,
                    region_priorities: regionPriorities,  // 🆕 BÖLGE ÖNCELİKLERİ
                    priority_level: llmResponse.priority_level || 5,
                    is_owner: llmResponse.is_owner || false,
                    is_friend: llmResponse.is_friend || false,
                    must_get_orders_when_working: llmResponse.must_get_orders_when_working || false,
                    custom_note: llmResponse.custom_note || ""
                },
                notes: notes  // Orijinal HTML notlarını da sakla
            };
            
            if (existingDrivers.length > 0) {
                // Güncelle - SADECE KURALLARI, STATUS'Ü KORU
                const existingDriver = existingDrivers[0];
                console.log(`📝 Güncelleniyor (ID: ${existingDriver.id})`);
                
                await base44.asServiceRole.entities.Driver.update(existingDriver.id, updateData);
                updatedCount++;
                console.log(`✅ Güncellendi`);
            } else {
                // Yeni oluştur
                console.log(`🆕 Yeni sürücü oluşturuluyor`);
                
                await base44.asServiceRole.entities.Driver.create({
                    name,
                    phone: "",  // Sonra manuel doldurulacak
                    address: "",
                    status: "Aktif",  // Default aktif
                    is_top_dasher: true,  // HTML'dekiler Top Dasher
                    ...updateData
                });
                createdCount++;
                console.log(`✅ Oluşturuldu`);
            }
            
            // Rate limiting (LLM için)
            await new Promise(r => setTimeout(r, 2000));
        }
        
        const nextBatchStart = batchStart + batchSize;
        const batchComplete = nextBatchStart >= driverSections.length;
        
        console.log(`\n📊 BATCH ${Math.floor(batchStart / batchSize) + 1} TAMAMLANDI`);
        console.log(`   Güncellenen: ${updatedCount}`);
        console.log(`   Yeni: ${createdCount}`);
        console.log(`   İlerleme: ${Math.min(nextBatchStart, driverSections.length)}/${driverSections.length}`);
        
        return Response.json({
            success: true,
            batchComplete,
            nextBatchStart,
            processedSoFar: Math.min(nextBatchStart, driverSections.length),
            totalDrivers: driverSections.length,
            updatedCount,
            createdCount
        });

    } catch (error) {
        console.error("❌ PARSE HATASI:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});