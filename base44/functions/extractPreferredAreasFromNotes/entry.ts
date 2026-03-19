import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log("📝 Notes'lardan tercih edilen bölgeler çıkarılıyor (GPT ile)...\n");
        
        const allDrivers = await base44.entities.Driver.list();
        const topDashers = allDrivers.filter(d => d.is_top_dasher);
        
        let updatedCount = 0;
        const updates = [];
        
        for (const driver of topDashers) {
            const notes = driver.notes || '';
            
            if (!notes.trim()) continue;
            
            console.log(`\n🔍 ${driver.name}:`);
            console.log(`   Not: "${notes.substring(0, 100)}..."`);
            
            // 🤖 GPT'ye notes'u parse ettir
            try {
                const gptResponse = await base44.integrations.Core.InvokeLLM({
                    prompt: `Bu sürücü notunu analiz et ve bilgileri çıkar:

"${notes}"

Şunları bul:
1. Tercih ettiği bölgeler (şehir, ilçe isimleri)
2. Mesafe kısıtlamaları var mı? (örn: "20 minutes away or less", "short distance only")
3. DC'den kaçınıyor mu?

Bilinen bölgeler: Reston, Herndon, Sterling, Leesburg, Alexandria, Arlington, Annandale, Fairfax, McLean, Vienna, Falls Church, Manassas, Tysons, Ashburn, Chantilly, Centreville, Springfield, Burke, Woodbridge, Dale City, Lorton, Fort Belvoir, Silver Spring, Bethesda, Rockville, Gaithersburg, College Park, Hyattsville, Takoma Park, Wheaton, Kensington, Potomac, Chevy Chase, Washington DC, Capitol Hill, Georgetown, Dupont Circle, Adams Morgan, Columbia Heights, Shaw, Navy Yard, Anacostia

Çıktı sadece JSON olsun:`,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            preferred_areas: {
                                type: "array",
                                items: { type: "string" },
                                description: "Tercih edilen bölge isimleri"
                            },
                            avoid_long_distance: {
                                type: "boolean",
                                description: "Uzun mesafe istemiyorsa true"
                            },
                            avoid_dc: {
                                type: "boolean",
                                description: "DC'ye girmek istemiyorsa true"
                            },
                            distance_constraint: {
                                type: "string",
                                description: "Mesafe kısıtlaması varsa (örn: '20 minutes away')"
                            }
                        }
                    }
                });
                
                const parsed = gptResponse;
                console.log(`   🤖 GPT Parse:`, parsed);
                
                // Mevcut verilerle birleştir
                const existingAreas = driver.preferred_areas || [];
                const newAreas = parsed.preferred_areas || [];
                const combinedAreas = [...new Set([...existingAreas, ...newAreas])];
                
                const updateData = {
                    preferred_areas: combinedAreas
                };
                
                // Özel notları güncelle
                const specialNotes = driver.special_notes || {};
                
                if (parsed.avoid_long_distance && !specialNotes.avoid_long_distance) {
                    updateData.special_notes = {
                        ...specialNotes,
                        avoid_long_distance: true
                    };
                }
                
                if (parsed.avoid_dc && !specialNotes.avoid_dc) {
                    updateData.special_notes = {
                        ...specialNotes,
                        avoid_dc: true
                    };
                }
                
                if (parsed.distance_constraint) {
                    updateData.special_notes = {
                        ...specialNotes,
                        custom_note: (specialNotes.custom_note || '') + `\n${parsed.distance_constraint}`
                    };
                }
                
                await base44.entities.Driver.update(driver.id, updateData);
                
                updatedCount++;
                updates.push({
                    name: driver.name,
                    extracted_areas: newAreas,
                    final_areas: combinedAreas,
                    constraints: {
                        avoid_long_distance: parsed.avoid_long_distance,
                        avoid_dc: parsed.avoid_dc,
                        distance_constraint: parsed.distance_constraint
                    }
                });
                
                console.log(`   ✅ Güncellendi:`);
                console.log(`      Bölgeler: ${combinedAreas.join(', ')}`);
                if (parsed.avoid_long_distance) console.log(`      ⛔ Uzun mesafe istemez`);
                if (parsed.avoid_dc) console.log(`      🚫 DC'ye girmez`);
                if (parsed.distance_constraint) console.log(`      📏 Kısıt: ${parsed.distance_constraint}`);
                
                // Rate limit (GPT call)
                await new Promise(r => setTimeout(r, 1000));
                
            } catch (error) {
                console.error(`   ❌ GPT Parse hatası:`, error.message);
            }
        }
        
        return Response.json({
            success: true,
            message: `${updatedCount} sürücünün notları GPT ile analiz edildi`,
            updatedCount,
            totalTopDashers: topDashers.length,
            updates
        });

    } catch (error) {
        console.error("Hata:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});