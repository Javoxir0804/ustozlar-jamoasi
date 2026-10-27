import { Bot, InlineKeyboard, InputFile, Keyboard, session, type Context, type SessionFlavor } from "grammy";
import { api, type BotUser } from "./api.js";
import { missingChannels, subscribeKeyboard } from "./channels.js";
import { nextStep, PROMPTS, validate, type RegDraft } from "./registration.js";

type SessionData = { reg?: RegDraft; receiptPlanId?: string };
export type Ctx = Context & SessionFlavor<SessionData> & { dbUser?: BotUser | null };

// Cheklar shu chatga (admin yoki adminlar guruhi) tasdiqlash tugmalari bilan yuboriladi
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
let rawWeb = process.env.PUBLIC_WEB_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:5173";
if (rawWeb && !rawWeb.startsWith("http://") && !rawWeb.startsWith("https://")) {
  rawWeb = `https://${rawWeb}`;
}
const WEB = rawWeb;
// Telegram Web App faqat HTTPS manzilda ochiladi; lokal ishlab chiqishda oddiy havola beriladi
const isHttps = WEB.startsWith("https://");

export const MENU = {
  tests: "📝 Testlar",
  lessons: "🎬 Video darslar",
  cabinet: "👤 Shaxsiy kabinet",
  top: "🏆 Top 10",
  subscribe: "💳 Obuna",
  contacts: "📞 Bog'lanish",
  about: "🏫 Litsey haqida",
} as const;

const mainMenu = () =>
  new Keyboard()
    .text(MENU.tests).text(MENU.lessons).row()
    .text(MENU.cabinet).text(MENU.top).row()
    .text(MENU.subscribe).row()
    .text(MENU.contacts).text(MENU.about)
    .resized();

const webButton = (text: string, path: string) =>
  isHttps ? new InlineKeyboard().webApp(text, `${WEB}${path}`) : new InlineKeyboard().url(text, `${WEB}${path}`);

export function createBot(token: string) {
  const bot = new Bot<Ctx>(token);
  // Eslatma: ishlab chiqarishda sessiyani Redis/PostgreSQL da saqlash kerak (server qayta ishga tushsa yo'qolmasligi uchun)
  bot.use(session({ initial: (): SessionData => ({}) }));

  // Admin chekni tasdiqlaydi/rad etadi. Guruhda ham ishlashi uchun kanal va ro'yxat tekshiruvlaridan oldin turadi;
  // admin roli serverda tekshiriladi.
  bot.callbackQuery(/^pay_(ok|no):(.+)$/, async (ctx) => {
    const approve = ctx.match[1] === "ok";
    try {
      const r = await api.reviewPayment(ctx.match[2], ctx.from.id, approve);
      await ctx.answerCallbackQuery({ text: approve ? "Tasdiqlandi" : "Rad etildi" });
      await ctx.editMessageCaption({ caption: `${ctx.callbackQuery.message?.caption ?? ""}\n\n${approve ? "✅ Tasdiqlandi" : "❌ Rad etildi"}: ${ctx.from.first_name}` }).catch(() => {});
      if (r.userTelegramId) {
        const text = approve
          ? `✅ To'lovingiz tasdiqlandi! «${r.plan}» obunasi ${r.subscriptionEndsAt?.slice(0, 10)} gacha faol.`
          : "❌ Chekingiz tasdiqlanmadi. Savollar bo'lsa «Bog'lanish» bo'limi orqali murojaat qiling.";
        await ctx.api.sendMessage(r.userTelegramId, text).catch(() => {});
      }
    } catch (e) {
      await ctx.answerCallbackQuery({ text: (e as Error).message, show_alert: true });
    }
  });

  // 1) Majburiy kanallarga a'zolik tekshiruvi — har bir xabardan oldin
  bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.chat?.type !== "private") return;
    const channels = await api.channels();
    const missing = await missingChannels(ctx.api, ctx.from.id, channels);
    if (missing.length === 0) return next();
    const text = "Botdan foydalanish uchun quyidagi kanallarga a'zo bo'ling, so'ng «Tekshirish» tugmasini bosing:";
    if (ctx.callbackQuery?.data === "check_subs") {
      await ctx.answerCallbackQuery({ text: "Hali barcha kanallarga a'zo bo'lmadingiz", show_alert: true });
      return;
    }
    await ctx.reply(text, { reply_markup: subscribeKeyboard(missing) });
  });

  bot.callbackQuery("check_subs", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Rahmat! ✅" });
    await ctx.deleteMessage().catch(() => {});
    await routeUser(ctx);
  });

  // 2) Ro'yxatdan o'tmagan foydalanuvchi faqat ro'yxat bosqichlarini ko'radi
  bot.use(async (ctx, next) => {
    ctx.dbUser = await api.getUser(ctx.from!.id);
    if (ctx.dbUser?.registered) return next();
    await handleRegistration(ctx);
  });

  bot.command("start", (ctx) => routeUser(ctx));

  bot.hears(MENU.tests, (ctx) =>
    ctx.reply("Testni tanlash va ishlash uchun tugmani bosing. Taymer, savollar navigatsiyasi va belgilash shu oynada.", { reply_markup: webButton("📝 Testlarni ochish", "/tests") }),
  );
  bot.hears(MENU.lessons, (ctx) => ctx.reply("Fanlar bo'yicha video darslar:", { reply_markup: webButton("🎬 Darslarni ochish", "/lessons") }));
  // Obuna: tarif tanlash -> kartaga o'tkazish -> chek rasmini yuborish -> admin tasdiqlaydi
  bot.hears(MENU.subscribe, async (ctx) => {
    const until = ctx.dbUser?.subscriptionEndsAt;
    const status = until ? `✅ Obunangiz ${until.slice(0, 10)} gacha faol.` : "Sizda faol obuna yo'q.";
    const plans = await api.plans();
    const kb = new InlineKeyboard();
    plans.forEach((p) => kb.text(`${p.name} — ${p.priceUzs.toLocaleString("ru-RU")} so'm`, `plan:${p.id}`).row());
    await ctx.reply(`${status}\nTarifni tanlang:`, { reply_markup: kb });
  });
  bot.callbackQuery(/^plan:(.+)$/, async (ctx) => {
    const plan = (await api.plans()).find((p) => p.id === ctx.match[1]);
    if (!plan) return ctx.answerCallbackQuery({ text: "Tarif topilmadi" });
    const pay = await api.setting<{ card?: string; holder?: string }>("payment");
    ctx.session.receiptPlanId = plan.id;
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `«${plan.name}» — ${plan.priceUzs.toLocaleString("ru-RU")} so'm\n\n1. Shu summani kartaga o'tkazing:\n💳 ${pay?.card ?? "-"}\n👤 ${pay?.holder ?? ""}\n\n2. To'lov chekining rasmini (skrinshot) shu yerga yuboring.\n\nAdmin tekshirgach obuna avtomatik yoqiladi.`,
    );
  });
  bot.on("message:photo", async (ctx, next) => {
    const planId = ctx.session.receiptPlanId;
    if (!planId) return next();
    const fileId = ctx.message.photo.at(-1)!.file_id;
    const p = await api.createPayment({ telegramId: String(ctx.from.id), planId, receiptFileId: fileId });
    ctx.session.receiptPlanId = undefined;
    await ctx.reply("✅ Chek qabul qilindi. Admin tekshirgach sizga xabar keladi.");
    if (ADMIN_CHAT_ID) {
      await ctx.api.sendPhoto(ADMIN_CHAT_ID, fileId, {
        caption: `💳 Yangi to'lov\n${p.user.fullName} (${p.user.phone ?? ""})\nTarif: ${p.plan}\nSumma: ${p.amountUzs.toLocaleString("ru-RU")} so'm`,
        reply_markup: new InlineKeyboard().text("✅ Tasdiqlash", `pay_ok:${p.id}`).text("❌ Rad etish", `pay_no:${p.id}`),
      });
    } else console.warn("ADMIN_CHAT_ID berilmagan: chek faqat admin panelda ko'rinadi");
  });

  bot.hears(MENU.cabinet, async (ctx) => {
    const u = ctx.dbUser!;
    const attempts = await api.attempts(ctx.from!.id);
    const history = attempts.length
      ? attempts.map((a, i) => `${i + 1}. ${a.test.title} — ${a.scorePct}% (${a.finishedAt.slice(0, 10)})${a.certificate ? ` · /cert_${a.certificate.number.replace(/-/g, "_")}` : ""}`).join("\n")
      : "Hali test ishlamagansiz.";
    await ctx.reply(`👤 ${u.lastName} ${u.firstName}\n📱 ${u.phone ?? ""}\n🏫 ${u.school ?? ""}, ${u.grade ?? ""}\n📍 ${u.region ?? ""}\n\n📊 Oxirgi natijalar:\n${history}`, {
      reply_markup: webButton("✏️ Ma'lumotlarni tahrirlash", "/cabinet"),
    });
  });

  // Sertifikat PDF ni fayl sifatida yuborish: /cert_ATT_2026_ABCD1234
  bot.hears(/^\/cert_(\w+)$/, async (ctx) => {
    const number = ctx.match[1].replace(/_/g, "-");
    const pdf = await api.certificatePdf(number);
    await ctx.replyWithDocument(new InputFile(new Uint8Array(pdf), `${number}.pdf`), { caption: `Sertifikat ${number}\nTekshirish: ${WEB}/verify/${number}` });
  });

  bot.hears(MENU.top, async (ctx) => {
    const subjects = await api.subjects();
    const kb = new InlineKeyboard();
    subjects.forEach((s) => kb.text(s.name, `top:${s.id}`).row());
    await ctx.reply("Qaysi fan bo'yicha?", { reply_markup: kb });
  });
  bot.callbackQuery(/^top:(.+)$/, async (ctx) => {
    const rows = await api.leaderboard(ctx.match[1]);
    const medals = ["🥇", "🥈", "🥉"];
    const text = rows.length ? rows.map((r, i) => `${medals[i] ?? `${i + 1}.`} ${r.fullName} — ${r.bestPct}%${r.region ? ` (${r.region})` : ""}`).join("\n") : "Hali natijalar yo'q.";
    await ctx.answerCallbackQuery();
    await ctx.reply(`🏆 Top 10\n\n${text}`);
  });

  bot.hears(MENU.contacts, async (ctx) => {
    const c = await api.setting<{ phone?: string; address?: string; telegram?: string }>("contacts");
    await ctx.reply(`📞 Bog'lanish\n\nTelefon: ${c?.phone ?? "-"}\nManzil: ${c?.address ?? "-"}\nTelegram: ${c?.telegram ?? "-"}`);
  });
  bot.hears(MENU.about, async (ctx) => {
    const a = await api.setting<{ text?: string }>("about");
    await ctx.reply(a?.text ?? "Ma'lumot tez orada qo'shiladi.");
  });

  bot.catch((err) => console.error("Bot xatosi:", err.error));
  return bot;
}

async function routeUser(ctx: Ctx): Promise<unknown> {
  const user = ctx.dbUser ?? (await api.getUser(ctx.from!.id));
  if (!user?.registered) return handleRegistration(ctx);
  await ctx.reply(`Xush kelibsiz, ${user.firstName}! Bo'limni tanlang:`, { reply_markup: mainMenu() });
}

async function handleRegistration(ctx: Ctx): Promise<unknown> {
  if (!ctx.session.reg) {
    ctx.session.reg = {};
    await ctx.reply("Assalomu alaykum! Platformadan foydalanish uchun bir marta ro'yxatdan o'ting.");
    return askNext(ctx);
  }
  const step = nextStep(ctx.session.reg);
  if (!step) return;
  const value = step === "phone" ? ctx.message?.contact?.phone_number ?? ctx.message?.text : ctx.message?.text;
  // Boshqa birovning kontaktini yuborishni rad etamiz
  if (step === "phone" && ctx.message?.contact && ctx.message.contact.user_id !== ctx.from!.id) {
    return ctx.reply("Iltimos, o'zingizning raqamingizni yuboring.");
  }
  const error = value === undefined ? "Iltimos, javobni matn ko'rinishida yuboring." : validate(step, value);
  if (error) return ctx.reply(error);
  ctx.session.reg[step] = value!.trim();
  return askNext(ctx);
}

async function askNext(ctx: Ctx): Promise<unknown> {
  const step = nextStep(ctx.session.reg!);
  if (step) {
    const p = PROMPTS[step];
    return ctx.reply(p.text, { reply_markup: p.keyboard ? p.keyboard() : { remove_keyboard: true } });
  }
  const user = await api.register({ telegramId: String(ctx.from!.id), ...ctx.session.reg });
  ctx.session.reg = undefined;
  ctx.dbUser = user;
  await ctx.reply("✅ Ro'yxatdan o'tdingiz! Endi qayta ro'yxatdan o'tish shart emas.");
  return routeUser(ctx);
}
