import { InlineKeyboard, type Api } from "grammy";
import type { Channel } from "./api.js";

const OK_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

/** Foydalanuvchi a'zo bo'lmagan majburiy kanallar ro'yxati. Bot har bir kanalda admin bo'lishi kerak. */
export async function missingChannels(api: Api, userId: number, channels: Channel[]): Promise<Channel[]> {
  const missing: Channel[] = [];
  for (const ch of channels) {
    try {
      const m = await api.getChatMember(ch.chatId, userId);
      if (!OK_STATUSES.has(m.status) || (m.status === "restricted" && !m.is_member)) missing.push(ch);
    } catch (e) {
      // Bot kanalga admin qilinmagan bo'lsa tekshirib bo'lmaydi: foydalanuvchini to'smaymiz, logga yozamiz
      console.error(`Kanal tekshiruvi xato (${ch.chatId}):`, (e as Error).message);
    }
  }
  return missing;
}

export function subscribeKeyboard(missing: Channel[]) {
  const kb = new InlineKeyboard();
  for (const ch of missing) kb.url(`➕ ${ch.title}`, ch.inviteUrl).row();
  return kb.text("✅ Tekshirish", "check_subs");
}
