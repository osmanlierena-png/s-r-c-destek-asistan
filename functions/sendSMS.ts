import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { to, message } = await req.json();

        if (!to || !message) {
            return Response.json({ 
                error: 'Telefon numarası ve mesaj gerekli' 
            }, { status: 400 });
        }

        // Twilio bilgilerini al
        const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!accountSid || !authToken || !fromNumber) {
            return Response.json({ 
                error: 'Twilio bilgileri eksik. Lütfen ayarlardan Twilio bilgilerinizi ve telefon numaranızı girin.' 
            }, { status: 400 });
        }

        console.log("SMS gönderiliyor:", { to, from: fromNumber });

        // Twilio API'ye istek at
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        
        const formData = new URLSearchParams();
        formData.append('To', to);
        formData.append('From', fromNumber);
        formData.append('Body', message);

        const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Twilio API Hatası:", data);
            return Response.json({ 
                error: 'SMS gönderilemedi', 
                details: data.message || data 
            }, { status: response.status });
        }

        console.log("SMS başarıyla gönderildi:", data.sid);

        return Response.json({
            success: true,
            message: 'SMS başarıyla gönderildi',
            sid: data.sid,
            status: data.status
        });

    } catch (error) {
        console.error("SMS gönderim hatası:", error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});