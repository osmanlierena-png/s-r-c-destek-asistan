import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const AGENT_APP_ID = "69b35a4842c50e200a1fe0db";
const API_KEY = "47aadaf67ea94f1f9021c59986b2d158";
const AGENT_API = `https://api${AGENT_APP_ID}.base44.app/api/apps/${AGENT_APP_ID}`;
const MAIN_APP_ID = "687922c274a70a2de1788cbe";
const MAIN_API = `https://api${AGENT_APP_ID}.base44.app/api/apps/${MAIN_APP_ID}`;
const APP_URL = "https://surucu-destek-asistan-e1788cbe.base44.app";

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function sendWhatsApp(message) {
  try {
    await fetch(`${AGENT_API}/messaging/whatsapp/send`, {
      method: "POST",
      headers: { "api_key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
  } catch(e) {}
}

async function getTelegramDriver(userId) {
  const r = await fetch(`${AGENT_API}/entities/TelegramDriver?telegram_user_id=${userId}`, {
    headers: { "api_key": API_KEY }
  });
  const data = await r.json();
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function getPending(userId) {
  const r = await fetch(`${AGENT_API}/entities/SystemState?key=pending_${userId}`, {
    headers: { "api_key": API_KEY }
  });
  const data = await r.json();
  if (Array.isArray(data) && data.length) {
    try { return JSON.parse(data[0].value); } catch(e) {}
  }
  return null;
}

async function setPending(userId, stateObj) {
  const r = await fetch(`${AGENT_API}/entities/SystemState?key=pending_${userId}`, {
    headers: { "api_key": API_KEY }
  });
  const data = await r.json();
  const val = JSON.stringify(stateObj);
  if (Array.isArray(data) && data.length) {
    await fetch(`${AGENT_API}/entities/SystemState/${data[0].id}`, {
      method: "PUT",
      headers: { "api_key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ value: val })
    });
  } else {
    await fetch(`${AGENT_API}/entities/SystemState`, {
      method: "POST",
      headers: { "api_key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ key: `pending_${userId}`, value: val })
    });
  }
}

async function clearPending(userId) {
  const r = await fetch(`${AGENT_API}/entities/SystemState?key=pending_${userId}`, {
    headers: { "api_key": API_KEY }
  });
  const data = await r.json();
  if (Array.isArray(data) && data.length) {
    await fetch(`${AGENT_API}/entities/SystemState/${data[0].id}`, {
      method: "DELETE",
      headers: { "api_key": API_KEY }
    });
  }
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

async function findDriver(name, phone) {
  const r = await fetch(`${MAIN_API}/entities/Driver?limit=300`, {
    headers: { "api_key": API_KEY }
  });
  const drivers = await r.json();
  const nameLower = name.trim().toLowerCase();
  const phoneNorm = normalizePhone(phone);

  let nameMatch = null;
  for (const d of drivers) {
    const dn = (d.name || "").toLowerCase();
    const dp = normalizePhone(d.phone || "");
    const nameOk = dn === nameLower || nameLower.split(" ").filter(p => p.length > 2).every(p => dn.includes(p));
    const phoneOk = dp === phoneNorm;
    if (nameOk && phoneOk) return { type: "full", driver: d };
    if (nameOk && !nameMatch) nameMatch = d;
  }
  if (nameMatch) return { type: "name_only", driver: nameMatch };
  return { type: "not_found", driver: null };
}

async function addNewDriver(name, phone) {
  const r = await fetch(`${MAIN_API}/entities/Driver`, {
    method: "POST",
    headers: { "api_key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      name, phone, status: "Aktif", language: "en", address: "",
      assignment_preferences: { working_days: ["Monday","Tuesday","Wednesday","Thursday","Friday"], max_orders_per_day: 5, avg_orders_per_week: 0 },
      special_notes: { is_owner: false, is_friend: false, must_get_orders_when_working: false, avoid_dc: false, avoid_long_distance: false, priority_level: 0, custom_note: "", primary_region: null, top_zip_codes: [], top_states: [], region_distribution: null, total_orders_analyzed: null },
      chain_history: [], preferred_areas: [], early_morning_eligible: false,
      is_joker_driver: false, is_top_dasher: false, assignment_priority: "None", preferred_shift: "all_day"
    })
  });
  return r.ok ? await r.json() : null;
}

async function saveTelegramDriver(userId, username, firstName, driverId, driverName, driverPhone) {
  await fetch(`${AGENT_API}/entities/TelegramDriver`, {
    method: "POST",
    headers: { "api_key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      telegram_user_id: String(userId),
      telegram_username: username || "",
      telegram_first_name: firstName || "",
      driver_id: driverId || "",
      driver_name: driverName,
      driver_phone: driverPhone,
      is_verified: true,
      joined_at: new Date().toISOString()
    })
  });
}

async function completeRegistration(userId, username, firstName, driverId, driverName, driverPhone, chatId) {
  await saveTelegramDriver(userId, username, firstName, driverId, driverName, driverPhone);
  await clearPending(userId);
  if (chatId) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `✅ You're registered as <b>${driverName}</b>!\n\nJoin the group and tap 🚗 when orders arrive:\n👉 @heredriver`,
      parse_mode: "HTML"
    });
  }
}

async function handleStart(user, chatId) {
  const userId = user.id;
  const existing = await getTelegramDriver(userId);
  if (existing) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `✅ You're already registered as <b>${existing.driver_name}</b>!\n\nJoin the group: 👉 @heredriver`,
      parse_mode: "HTML"
    });
    return;
  }
  await setPending(userId, { step: "awaiting_name", username: user.username || "", firstName: user.first_name || "" });
  await tg("sendMessage", {
    chat_id: chatId,
    text: "👋 Welcome to Here Drivers!\n\nTo register, please type your <b>full name</b>:\n\nExample: <i>Safak Ozturk</i>",
    parse_mode: "HTML"
  });
}

async function handleDM(user, chatId, text) {
  const userId = user.id;
  const username = user.username || "";
  const firstName = user.first_name || "";
  const pending = await getPending(userId);

  if (!pending) {
    await tg("sendMessage", { chat_id: chatId, text: "Type /start to register." });
    return;
  }

  if (pending.step === "awaiting_name") {
    await setPending(userId, { ...pending, step: "awaiting_phone", name: text.trim() });
    await tg("sendMessage", {
      chat_id: chatId,
      text: `Got it, <b>${text.trim()}</b>!\n\nNow enter your <b>phone number</b>:\n\nExample: <i>6465551234</i>`,
      parse_mode: "HTML"
    });
    return;
  }

  if (pending.step === "awaiting_phone") {
    const enteredName = pending.name || "";
    const digits = normalizePhone(text.trim());
    if (digits.length < 10) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Please enter a valid 10-digit phone number.\n\nExample: <i>6465551234</i>",
        parse_mode: "HTML"
      });
      return;
    }

    const { type, driver } = await findDriver(enteredName, text.trim());

    if (type === "full") {
      await completeRegistration(userId, username, firstName, driver.id, driver.name, driver.phone || text.trim(), chatId);
      await sendWhatsApp(`✅ New driver registered: ${driver.name} | ${driver.phone} (Telegram: ${firstName} @${username})`);
    } else if (type === "name_only") {
      await completeRegistration(userId, username, firstName, driver.id, driver.name, text.trim(), chatId);
      await sendWhatsApp(`⚠️ Phone mismatch!\nDriver: ${driver.name}\nSystem: ${driver.phone}\nEntered: ${text.trim()}\nTelegram: ${firstName} @${username}\n\nRegistered anyway.`);
    } else {
      const newDriver = await addNewDriver(enteredName, text.trim());
      if (newDriver && newDriver.id) {
        await completeRegistration(userId, username, firstName, newDriver.id, enteredName, text.trim(), chatId);
        await sendWhatsApp(`🆕 New driver added!\nName: ${enteredName}\nPhone: ${text.trim()}\nTelegram: ${firstName} @${username}`);
      } else {
        await setPending(userId, { ...pending, step: "awaiting_admin", phone: text.trim() });
        await tg("sendMessage", { chat_id: chatId, text: "⏳ Sent to admin for approval. You'll be notified soon." });
        await sendWhatsApp(`⚠️ Could not auto-add driver!\nName: ${enteredName}\nPhone: ${text.trim()}\nTelegram: ${firstName} @${username} | ID: ${userId}`);
      }
    }
  }
}

async function handleButton(cb) {
  const cbId = cb.id;
  const data = cb.data || "";
  const user = cb.from;
  const msg = cb.message || {};
  const chatId = msg.chat?.id;
  const msgId = msg.message_id;
  const origText = msg.text || "";
  const userId = user.id;
  const firstName = user.first_name || "";

  if (!data.startsWith("take_")) return;

  const orderDbId = data.replace("take_", "");

  const tgDriver = await getTelegramDriver(userId);
  if (!tgDriver) {
    await tg("answerCallbackQuery", { callback_query_id: cbId, text: "⚠️ You're not registered!\nMessage @Heredriverbot and type /start", show_alert: true });
    await sendWhatsApp(`⚠️ Unregistered user tapped Take Order: ${firstName} (ID: ${userId})`);
    return;
  }

  const orderR = await fetch(`${MAIN_API}/entities/DailyOrder/${orderDbId}`, {
    headers: { "api_key": API_KEY }
  });
  const order = await orderR.json();
  const orderNum = order.ezcater_order_id || orderDbId;

  const takenStatuses = ["Atandı", "Sürücü Onayı Bekleniyor", "Sürücü Onayladı"];
  if (takenStatuses.includes(order.status) && order.driver_name) {
    await tg("answerCallbackQuery", { callback_query_id: cbId, text: `⚠️ Already taken by ${order.driver_name}!`, show_alert: true });
    return;
  }

  const driverName = tgDriver.driver_name;
  const driverId = tgDriver.driver_id;
  const driverPhone = tgDriver.driver_phone;

  await fetch(`${MAIN_API}/entities/DailyOrder/${orderDbId}`, {
    method: "PUT",
    headers: { "api_key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      driver_id: driverId, driver_name: driverName, driver_phone: driverPhone,
      status: "Atandı", driver_response: null, driver_response_at: null,
      sms_sent_at: null, message_group_id: null
    })
  });

  const verifyR = await fetch(`${MAIN_API}/entities/DailyOrder/${orderDbId}`, {
    headers: { "api_key": API_KEY }
  });
  const verified = await verifyR.json();

  if (verified.driver_name !== driverName) {
    await tg("answerCallbackQuery", { callback_query_id: cbId, text: `⚠️ Someone else just took it!`, show_alert: true });
    return;
  }

  await tg("answerCallbackQuery", { callback_query_id: cbId, text: `✅ Order #${orderNum} is yours! SMS incoming...` });

  await tg("editMessageText", {
    chat_id: chatId, message_id: msgId,
    text: origText + `\n\n✅ <b>${driverName}</b> took this order!`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] }
  });

  await fetch(`${APP_URL}/api/functions/sendOrderAssignmentSMS`, {
    method: "POST",
    headers: { "api_key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ orderIds: [orderDbId] })
  });
}

async function handleNewMember(member, chatId) {
  if (member.is_bot) return;
  const existing = await getTelegramDriver(member.id);
  if (existing) {
    await tg("sendMessage", { chat_id: chatId, text: `👋 Welcome back <b>${existing.driver_name}</b>!`, parse_mode: "HTML" });
    return;
  }
  await tg("sendMessage", {
    chat_id: chatId,
    text: `👋 Welcome ${member.first_name}!\n\n📌 To take orders, register first:\n👉 Message @Heredriverbot and type /start`
  });
}

Deno.serve(async (req) => {
  try {
    const update = await req.json();

    if (update.callback_query) {
      await handleButton(update.callback_query);
    } else if (update.message) {
      const msg = update.message;
      const user = msg.from || {};
      const chatId = msg.chat?.id;
      const chatType = msg.chat?.type;
      const text = msg.text || "";

      const newMembers = msg.new_chat_members || [];
      for (const m of newMembers) await handleNewMember(m, chatId);

      if (chatType === "private") {
        if (text === "/start") {
          await handleStart(user, chatId);
        } else {
          await handleDM(user, chatId, text);
        }
      }
    }
  } catch(e) {
    console.error("Webhook error:", e);
  }

  return Response.json({ ok: true });
});