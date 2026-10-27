// Telegram bot: kirish nuqtasi. Ro'yxat va barcha bo'limlar saytda (Web App), bot ularni ochib beradi.
import { Bot, InlineKeyboard, Keyboard, type Context } from "grammy";
import { prisma, type User } from "@edu/db";
import { env } from "../env.js";
import { normalizePhone } from "../services/profile.js";
import { esc } from "./notify.js";

type Ctx = Context & { dbUser?: User };

const MENU = { open: "📚 Platformani ochish", cabinet: "👤 Kabinet", contacts: "📞 Bog'lanish" } as const;
const OK_MEMBER = new Set(["creator", "administrator", "member", "restricted"]);

const webUrl = (path = "/") => `${env.publicWebUrl}${path}`;
const isHttps = () => env.publicWebUrl.startsWith("https://");

/** Saytni Telegram ichida ochadigan tugma (https bo'lmasa oddiy havola). */
const openButton = (text: string, path: string) =>
  isHttps() ? new InlineKeyboard().webApp(text, webUrl(path)) : new InlineKeyboard().url(text, webUrl(path));

const mainMenu = () => {
  const kb = new Keyboard();
  if (isHttps()) kb.webApp(MENU.open, webUrl("/"));
  else kb.text(MENU.open);
  return kb.row().text(MENU.cabinet).text(MENU.contacts).resized().persistent();
};

export function createBot(token: string) {
  const bot = new Bot<Ctx>(token);

  // Faqat shaxsiy chat; foydalanuvchi bazada bo'lmasa yaratiladi (saytdagi Telegram kirishi bilan bir xil yozuv)
  bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.chat?.type !== "private") return;
    const telegramId = BigInt(ctx.from.id);
    let user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      user = await prisma.user.create({
        data: { telegramId, telegramUsername: ctx.from.username, firstName: ctx.from.first_name ?? "", lastName: ctx.from.last_name ?? "", lastActiveAt: new Date() },
      });
    } else {
      user = await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date(), telegramUsername: ctx.from.username ?? user.telegramUsername } });
    }
    if (user.status === "BLOCKED") return void (await ctx.reply("⛔ Hisobingiz bloklangan. Admin bilan bog'laning."));
    ctx.dbUser = user;
    await next();
  });

  // Majburiy kanallar (ro'yxat bo'sh bo'lsa tekshirilmaydi)
  bot.use(async (ctx, next) => {
    const channels = await prisma.channel.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
    const missing = [];
    for (const ch of channels) {
      try {
        const m = await ctx.api.getChatMember(ch.chatId, ctx.from!.id);
        if (!OK_MEMBER.has(m.status) || (m.status === "restricted" && !m.is_member)) missing.push(ch);
      } catch (e) {
        // Bot kanalga admin qilinmagan: foydalanuvchini to'smaymiz
        console.error(`Kanal tekshiruvi xato (${ch.chatId}):`, (e as Error).message);
      }
    }
    if (missing.length === 0) return next();
    if (ctx.callbackQuery?.data === "check_subs") return void (await ctx.answerCallbackQuery({ text: "Hali barcha kanallarga a'zo bo'lmadingiz", show_alert: true }));
    const kb = new InlineKeyboard();
    missing.forEach((ch) => kb.url(`➕ ${ch.title}`, ch.inviteUrl).row());
    await ctx.reply("Botdan foydalanish uchun quyidagi kanallarga a'zo bo'ling, so'ng «Tekshirish» tugmasini bosing:", { reply_markup: kb.text("✅ Tekshirish", "check_subs") });
  });

  bot.callbackQuery("check_subs", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Rahmat! ✅" });
    await ctx.deleteMessage().catch(() => {});
    await welcome(ctx);
  });

  bot.command("start", (ctx) => welcome(ctx));

  // Telefon raqami: "Raqamni yuborish" tugmasi orqali
  bot.on("message:contact", async (ctx) => {
    const c = ctx.message.contact;
    if (c.user_id !== ctx.from.id) return void (await ctx.reply("Iltimos, pastdagi tugma orqali o'zingizning raqamingizni yuboring."));
    const phone = normalizePhone(c.phone_number);
    if (!phone) return void (await ctx.reply("Raqamni o'qib bo'lmadi, qayta yuboring."));
    const taken = await prisma.user.findFirst({ where: { phone, NOT: { id: ctx.dbUser!.id } } });
    if (taken) return void (await ctx.reply("Bu raqam boshqa hisobga biriktirilgan. Admin bilan bog'laning."));
    ctx.dbUser = await prisma.user.update({ where: { id: ctx.dbUser!.id }, data: { phone } });
    await ctx.reply("✅ Raqam qabul qilindi.", { reply_markup: { remove_keyboard: true } });
    await welcome(ctx);
  });

  bot.hears(MENU.open, (ctx) => ctx.reply("Platformani ochish:", { reply_markup: openButton("📚 Ochish", "/") }));

  bot.hears(MENU.cabinet, async (ctx) => {
    const u = ctx.dbUser!;
    if (!u.profileCompleted) return welcome(ctx);
    await ctx.reply(
      `👤 <b>${esc(u.lastName)} ${esc(u.firstName)}</b>\n📱 ${esc(u.phone ?? "-")}\n📍 ${esc(u.region ?? "")}, ${esc(u.district ?? "")}\n🏫 ${esc(u.institution ?? "")}, ${esc(u.grade ?? "")}`,
      { parse_mode: "HTML", reply_markup: openButton("✏️ Kabinetni ochish", "/cabinet") },
    );
  });

  bot.hears(MENU.contacts, async (ctx) => {
    const s = await prisma.setting.findUnique({ where: { key: "contacts" } });
    const c = (s?.value ?? {}) as Record<string, string>;
    const lines = [c.phone && `📞 ${c.phone}`, c.telegram && `✈️ ${c.telegram}`, c.address && `📍 ${c.address}`, c.email && `✉️ ${c.email}`].filter(Boolean);
    await ctx.reply(lines.length ? `<b>Bog'lanish</b>\n\n${lines.map((l) => esc(l as string)).join("\n")}` : "Aloqa ma'lumotlari hali kiritilmagan.", { parse_mode: "HTML" });
  });

  bot.on("message", (ctx) => welcome(ctx));

  bot.catch((err) => console.error("Bot xatosi:", err.error));
  return bot;
}

/** Foydalanuvchi holatiga qarab keyingi qadam: raqam -> anketa -> asosiy menyu. */
async function welcome(ctx: Ctx) {
  const u = ctx.dbUser!;
  if (!u.phone) {
    return void (await ctx.reply(
      `Assalomu alaykum, ${esc(u.firstName || "ustoz")}! 👋\n\nPlatformadan foydalanish uchun bir marta ro'yxatdan o'ting. Avval telefon raqamingizni yuboring:`,
      { parse_mode: "HTML", reply_markup: new Keyboard().requestContact("📱 Raqamni yuborish").resized().oneTime() },
    ));
  }
  if (!u.profileCompleted) {
    return void (await ctx.reply("Endi qisqa anketani to'ldiring (1 daqiqa):", { reply_markup: openButton("📝 Anketani to'ldirish", "/onboarding") }));
  }
  await ctx.reply(`Xush kelibsiz, ${esc(u.firstName)}! Bo'limni tanlang:`, { parse_mode: "HTML", reply_markup: mainMenu() });
}
