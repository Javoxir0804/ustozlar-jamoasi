import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { hashPassword, prisma, verifyPassword } from "@edu/db";
import { env } from "../env.js";
import { publicUser, requireAuth, signToken, audit } from "../auth/session.js";
import { verifyLoginWidget, verifyWebAppInitData, type TelegramUser } from "../auth/telegram.js";
import { ApiError, badRequest, h } from "../lib/errors.js";
import { profileSchema } from "../services/profile.js";
import { loginField } from "./admin/admins.js";
import { notifyNewStudent, sendMainMenu } from "../bot/notify.js";

export const authRouter = Router();

/** Telegram orqali kirish: birinchi marta bo'lsa talaba yaratiladi (anketa keyin to'ldiriladi). */
async function loginWithTelegram(tg: TelegramUser | null) {
  if (!tg) throw new ApiError(401, "BAD_SIGNATURE", "Telegram ma'lumoti tasdiqlanmadi. Qaytadan urinib ko'ring.");
  const telegramId = BigInt(tg.id);
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing?.status === "BLOCKED") throw new ApiError(403, "BLOCKED", "Hisobingiz bloklangan. Admin bilan bog'laning.");
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { lastActiveAt: new Date(), telegramUsername: tg.username ?? existing.telegramUsername } })
    : await prisma.user.create({
        data: { telegramId, telegramUsername: tg.username, firstName: tg.first_name ?? "", lastName: tg.last_name ?? "", lastActiveAt: new Date() },
      });
  return { token: signToken(user.id), user: publicUser(user) };
}

authRouter.post(
  "/telegram/widget",
  h(async (req, res) => {
    const data = z.record(z.string(), z.union([z.string(), z.number()])).parse(req.body);
    res.json(await loginWithTelegram(verifyLoginWidget(data, env.botToken)));
  }),
);

authRouter.post(
  "/telegram/webapp",
  h(async (req, res) => {
    const { initData } = z.object({ initData: z.string().min(1) }).parse(req.body);
    res.json(await loginWithTelegram(verifyWebAppInitData(initData, env.botToken)));
  }),
);

// ---------- Admin: login va parol ----------
const MAX_FAILS = 5;
const LOCK_MIN = 15;

authRouter.post(
  "/admin/login",
  rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: { code: "TOO_MANY", message: "Juda ko'p urinish. Keyinroq qayta urinib ko'ring." } } }),
  h(async (req, res) => {
    const { login, password } = z.object({ login: z.string().trim().min(1, "Loginni kiriting"), password: z.string().min(1, "Parolni kiriting") }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { login: login.toLowerCase() } });
    const invalid = new ApiError(401, "INVALID_CREDENTIALS", "Login yoki parol noto'g'ri");
    if (!user || user.role !== "ADMIN") throw invalid;
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const min = Math.ceil((+user.lockedUntil - Date.now()) / 60_000);
      throw new ApiError(423, "LOCKED", `Ko'p marta xato kiritildi. ${min} daqiqadan keyin urinib ko'ring.`);
    }
    if (user.status === "BLOCKED") throw new ApiError(403, "BLOCKED", "Hisob bloklangan");
    if (!verifyPassword(password, user.passwordHash)) {
      const fails = user.failedLogins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MIN * 60_000) } : { failedLogins: fails },
      });
      if (fails >= MAX_FAILS) {
        await audit(user.id, "admin.locked");
        throw new ApiError(423, "LOCKED", `Ko'p marta xato kiritildi. ${LOCK_MIN} daqiqadan keyin urinib ko'ring.`);
      }
      throw invalid;
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastActiveAt: new Date() } });
    res.json({ token: signToken(user.id), user: publicUser(updated) });
  }),
);

// ---------- Joriy foydalanuvchi ----------
authRouter.get("/me", requireAuth, h(async (req, res) => res.json(publicUser(req.user!))));

// Anketani to'ldirish (birinchi kirish) va keyin tahrirlash. Telegram ID o'zgarmaydi.
authRouter.put(
  "/me/profile",
  requireAuth,
  h(async (req, res) => {
    const data = profileSchema.parse(req.body);
    const taken = await prisma.user.findFirst({ where: { phone: data.phone, NOT: { id: req.user!.id } }, select: { id: true } });
    if (taken) throw badRequest("PHONE_TAKEN", "Bu telefon raqami boshqa hisobga biriktirilgan");
    const first = !req.user!.profileCompleted;
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { ...data, profileCompleted: true } });
    if (first && user.role === "STUDENT") {
      void notifyNewStudent(user);
      void sendMainMenu(user);
    }
    res.json(publicUser(user));
  }),
);

// Admin o'z profilini tahrirlaydi: ism, familiya va login. Login o'zgarsa joriy parol so'raladi.
authRouter.patch(
  "/me/account",
  requireAuth,
  h(async (req, res) => {
    const me = req.user!;
    if (me.role !== "ADMIN") throw badRequest("NOT_ADMIN", "Faqat admin uchun");
    const d = z
      .object({
        firstName: z.string().trim().min(1, "Ismni kiriting").max(60),
        lastName: z.string().trim().max(60).default(""),
        login: loginField,
        current: z.string().optional(),
      })
      .parse(req.body);
    if (d.login !== me.login) {
      if (!d.current || !verifyPassword(d.current, me.passwordHash)) throw badRequest("BAD_PASSWORD", "Loginni o'zgartirish uchun joriy parolni to'g'ri kiriting");
      const taken = await prisma.user.findUnique({ where: { login: d.login } });
      if (taken && taken.id !== me.id) throw badRequest("LOGIN_TAKEN", "Bu login band");
    }
    const u = await prisma.user.update({ where: { id: me.id }, data: { firstName: d.firstName, lastName: d.lastName, login: d.login } });
    await audit(me.id, "admin.profile", "User", me.id, { login: d.login !== me.login ? d.login : undefined });
    res.json(publicUser(u));
  }),
);

authRouter.post(
  "/me/password",
  requireAuth,
  h(async (req, res) => {
    const { current, next } = z
      .object({ current: z.string().min(1, "Joriy parolni kiriting"), next: z.string().min(8, "Yangi parol kamida 8 belgi").max(100) })
      .parse(req.body);
    if (req.user!.role !== "ADMIN") throw badRequest("NOT_ADMIN", "Parol faqat admin uchun");
    if (!verifyPassword(current, req.user!.passwordHash)) throw badRequest("BAD_PASSWORD", "Joriy parol noto'g'ri");
    await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash: hashPassword(next) } });
    await audit(req.user!.id, "admin.password");
    res.json({ ok: true });
  }),
);
