import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

async function tgPost(method, body) {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return r.json();
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { orderDbId, telegramUserId, callbackQueryId, messageId, chatId, originalText } = await req.json();

        // 1. Driver'ı bul (TelegramDriver entity)
        const drivers = await base44.asServiceRole.entities.TelegramDriver.filter({ telegram_user_id: telegramUserId });
        const tgDriver = drivers && drivers[0];

        if (!tgDriver || tgDriver.driver_id === "ADMIN") {
            await tgPost("answerCallbackQuery", {
                callback_query_id: callbackQueryId,
                text: "⚠️ You're not registered! Type your full name in the group.",
                show_alert: true
            });
            return Response.json({ success: false, reason: "not_registered" });
        }

        // 2. Order'ı kontrol et
        const orders = await base44.asServiceRole.entities.DailyOrder.filter({ id: orderDbId });
        const order = orders && orders[0];

        if (!order) {
            await tgPost("answerCallbackQuery", {
                callback_query_id: callbackQueryId,
                text: "❌ Order not found.",
                show_alert: true
            });
            return Response.json({ success: false, reason: "not_found" });
        }

        const takenStatuses = ["Atandı", "Sürücü Onayı Bekleniyor", "Sürücü Onayladı"];
        if (takenStatuses.includes(order.status) && order.driver_name) {
            await tgPost("answerCallbackQuery", {
                callback_query_id: callbackQueryId,
                text: `⚠️ Already taken by ${order.driver_name}!`,
                show_alert: true
            });
            return Response.json({ success: false, reason: "already_taken" });
        }

        // 3. Order'ı ata
        await base44.asServiceRole.entities.DailyOrder.update(orderDbId, {
            driver_id: tgDriver.driver_id,
            driver_name: tgDriver.driver_name,
            driver_phone: tgDriver.driver_phone,
            status: "Atandı",
            driver_response: null,
            driver_response_at: null,
            sms_sent_at: null,
            message_group_id: null
        });

        // 4. Telegram mesajını güncelle (butonu kaldır)
        await tgPost("editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: originalText + `\n\n✅ <b>${tgDriver.driver_name}</b> took this order!`,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [] }
        });

        // 5. Driver'a bildir
        await tgPost("answerCallbackQuery", {
            callback_query_id: callbackQueryId,
            text: `✅ Order is yours! SMS incoming...`,
            show_alert: false
        });

        // 6. SMS gönder
        await base44.asServiceRole.functions.invoke('sendOrderAssignmentSMS', {
            orderIds: [orderDbId]
        });

        return Response.json({ success: true, driver: tgDriver.driver_name, order: order.ezcater_order_id });

    } catch (error) {
        console.error('takeOrder error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});