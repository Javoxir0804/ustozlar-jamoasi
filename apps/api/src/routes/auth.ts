import { Router } from "express";
import { z } from "zod";
import { prisma } from "@att/db";
import { env } from "../env.js";
import { requireAuth, signToken } from "../auth/jwt.js";
import { verifyLoginWidget, verifyWebAppInitData, type TelegramUser } from "../auth/telegram.js";
import { ApiError, h } from "../lib/errors.js";
import { activeSubscriptionEnd } from "../services/access.js";

export const authRouter = Router();

// Ro'yxatdan faqat bot orqali o'tiladi; sayt mavjud foydalanuvchini Telegram ID bo'yicha topadi.
async function loginByTelegram(tg: TelegramUser | null) {
  if (!tg) throw new ApiError(401, "BAD_SIGNATURE", "Telegram imzosi noto'g'ri yoki eskirgan");
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tg.id) } });
  if (!user || !user.registered) throw new ApiError(403, "NOT_REGISTERED", "Avval botda ro'yxatdan o'ting");
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  return { token: signToken(user.id) };
}

authRouter.post(
  "/telegram/webapp",
  h(async (req, res) => {
    const { initData } = z.object({ initData: z.string() }).parse(req.body);
    res.json(await loginByTelegram(verifyWebAppInitData(initData, env.botToken)));
  }),
);

authRouter.post(
  "/telegram/widget",
  h(async (req, res) => {
    const data = z.record(z.string(), z.union([z.string(), z.number()])).parse(req.body);
    res.json(await loginByTelegram(verifyLoginWidget(data, env.botToken)));
  }),
);

export const profileSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  region: z.string().max(80).nullish(),
  district: z.string().max(80).nullish(),
  address: z.string().max(200).nullish(),
  school: z.string().max(120).nullish(),
  grade: z.string().max(40).nullish(),
});

authRouter.get(
  "/me",
  requireAuth,
  h(async (req, res) => {
    const u = req.user!;
    res.json({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      region: u.region,
      district: u.district,
      address: u.address,
      school: u.school,
      grade: u.grade,
      role: u.role,
      subscriptionEndsAt: await activeSubscriptionEnd(u.id),
    });
  }),
);

// Shaxsiy kabinetdan ma'lumotlarni tahrirlash (telefon va Telegram ID o'zgarmaydi)
authRouter.patch(
  "/me",
  requireAuth,
  h(async (req, res) => {
    const data = profileSchema.partial().parse(req.body);
    await prisma.user.update({ where: { id: req.user!.id }, data });
    res.json({ ok: true });
  }),
);
