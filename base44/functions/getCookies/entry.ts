import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return Response.json({
        success: true,
        message: "Cookie'leri manuel olarak almak için:",
        instructions: [
            "1. Chrome'da https://admin.here-app.com/login adresine gidin ve login yapın",
            "2. F12 tuşuna basın → Console sekmesine gidin",
            "3. Aşağıdaki kodu yapıştırıp Enter'a basın:",
            "",
            "copy(JSON.stringify(document.cookie.split('; ').map(c => { const [name, ...value] = c.split('='); return { name, value: value.join('='), domain: '.here-app.com', path: '/', secure: true, httpOnly: false }; })));",
            "",
            "4. Cookie'ler clipboard'a kopyalanacak",
            "5. Dashboard → Code → Environment Variables",
            "6. Yeni secret: HERE_APP_COOKIES",
            "7. Değer: Kopyaladığınız JSON'u yapıştırın",
            "8. Kaydet",
            "9. Artık scrapEzCaterOrders fonksiyonu çalışacak!"
        ]
    });
});