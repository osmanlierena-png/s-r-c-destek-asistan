import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // EzCater API araştırması
        const ezcaterResearch = await base44.integrations.Core.InvokeLLM({
            prompt: `EzCater API hakkında detaylı araştırma yap. Şunları öğrenmek istiyorum:

1. EzCater Partner API'si var mı?
2. Hangi endpoints'ler mevcut?
3. Nasıl erişim sağlanır?
4. Hangi verileri çekebiliriz? (orders, restaurants, delivery info)
5. Driver assignment yapabilir miyiz?
6. Real-time tracking mümkün mü?
7. API key nasıl alınır?
8. Rate limits neler?

Ayrıca şu alternatif yemek delivery platformlarının API durumlarını da araştır:
- DoorDash Drive API
- Uber Eats Partner API  
- Grubhub Partners API
- Postmates API
- ChowNow API
- Toast API

Her platform için API kalitesi, özellikleri ve erişim kolaylığını karşılaştır.`,
            add_context_from_internet: true
        });

        return Response.json({
            success: true,
            research: ezcaterResearch
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});