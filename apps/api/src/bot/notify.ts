// Bot orqali xabar yuborish (server ichidan, masalan yangi talaba haqida adminga).
import type { User } from "@edu/db";
import { env } from "../env.js";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendMessage(chatId: string, text: string, reply_markup?: object) {
  if (!env.botToken || !chatId) return;
  const res = await fetch(`https://api.telegram.org/bot${env.botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup }),
  });
  if (!res.ok) throw new Error(`Telegram: ${res.status} ${await res.text()}`);
}

export async function notifyNewStudent(u: User) {
  if (!env.adminChatId) return;
  const text =
    `🆕 <b>Yangi talaba</b>\n${esc(u.lastName)} ${esc(u.firstName)}\n📱 ${esc(u.phone ?? "-")}\n` +
    `📍 ${esc(u.region ?? "")}, ${esc(u.district ?? "")}\n🏫 ${esc(u.institution ?? "")}, ${esc(u.grade ?? "")}` +
    (u.telegramUsername ? `\n✈️ @${esc(u.telegramUsername)}` : "");
  await sendMessage(env.adminChatId, text).catch((e) => console.error("Adminga xabar yuborilmadi:", e.message));
}

/** Saytda anketa to'ldirilgach botda asosiy menyuni yuboradi. */
export async function sendMainMenu(u: User) {
  if (!u.telegramId) return;
  const https = env.publicWebUrl.startsWith("https://");
  const keyboard = {
    keyboard: [[https ? { text: "📚 Platformani ochish", web_app: { url: `${env.publicWebUrl}/` } } : { text: "📚 Platformani ochish" }], [{ text: "👤 Kabinet" }, { text: "📞 Bog'lanish" }]],
    resize_keyboard: true,
    is_persistent: true,
  };
  await sendMessage(u.telegramId.toString(), `✅ Ro'yxatdan o'tdingiz, ${esc(u.firstName)}! Endi platformadan foydalanishingiz mumkin.`, keyboard).catch((e) =>
    console.error("Talabaga menyu yuborilmadi:", e.message),
  );
}

export async function notifyAccessGranted(u: User, course: { id: string; title: string }, expiresAt: Date | null) {
  if (!u.telegramId) return;
  const https = env.publicWebUrl.startsWith("https://");
  const until = expiresAt ? `\n⏳ Muddati: ${expiresAt.toLocaleDateString("ru-RU")} gacha` : "";
  const markup = https ? { inline_keyboard: [[{ text: "▶️ Kursni ochish", web_app: { url: `${env.publicWebUrl}/courses/${course.id}` } }]] } : undefined;
  await sendMessage(u.telegramId.toString(), `🎉 Sizga <b>${esc(course.title)}</b> kursi ochildi!${until}`, markup).catch((e) => console.error("Ruxsat xabari yuborilmadi:", e.message));
}
