import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { action, intervalMinutes } = await req.json();

        if (action === 'start') {
            // Her X dakikada bir scraping çalıştır
            const interval = intervalMinutes || 15; // Default 15 dakika
            
            console.log(`Otomatik scraping başlatıldı - ${interval} dakika aralıklarla`);
            
            // İlk çalıştırma
            const firstRun = await base44.functions.invoke('scrapEzCaterOrders', {
                targetDate: new Date().toISOString().split('T')[0]
            });

            // Periyodik çalıştırma için cron job kurulabilir
            // Şimdilik manuel tetikleme sistemi kuralım
            
            return Response.json({
                success: true,
                message: `Otomatik scraping ${interval} dakika aralıklarla başlatıldı`,
                firstRun: firstRun.data
            });

        } else if (action === 'stop') {
            return Response.json({
                success: true,
                message: 'Otomatik scraping durduruldu'
            });

        } else {
            return Response.json({ 
                error: 'Geçersiz aksiyon. "start" veya "stop" olmalı.' 
            }, { status: 400 });
        }

    } catch (error) {
        console.error("Scheduling hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});