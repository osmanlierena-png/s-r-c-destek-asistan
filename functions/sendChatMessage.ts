import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

const CHATBOT_ID = "8529393183";
const API_KEY = "X3W9Lj1t2T27PH9JgZyP3g1Mm1yvvSXusUyyygcwlCV7hW1Wsjl52pJTvZnMX8SE";
const CHATLING_API_URL = `https://api.chatling.ai/v2/chatbots/${CHATBOT_ID}`;

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const { conversationId, message, caseId } = await req.json();

        console.log("Gelen veri:", { conversationId, message, caseId });

        if (!conversationId || !message) {
            return new Response(JSON.stringify({ error: 'conversationId ve message gerekli' }), { status: 400 });
        }

        // V2 API kullanarak mesaj gönder
        const response = await fetch(`${CHATLING_API_URL}/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                text: message,
                type: "text"
            })
        });

        const data = await response.json();

        console.log("Chatling API Yanıtı:", {
            status: response.status,
            data: data
        });

        if (!response.ok) {
            console.error("Chatling API Hatası:", data);
            return new Response(JSON.stringify({ 
                error: 'Mesaj gönderilemedi', 
                details: data 
            }), { status: response.status });
        }

        // Başarılı olursa mesajı veritabanımıza kaydet
        if (caseId) {
            await base44.entities.ChatMessage.create({
                case_id: caseId,
                sender: "bot",
                message: message
            });
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Mesaj başarıyla gönderildi',
            data: data 
        }), { status: 200 });

    } catch (error) {
        console.error("Fonksiyon Hatası:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});