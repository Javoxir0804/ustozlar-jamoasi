import { Router } from "express";
import { z } from "zod";
import { prisma } from "@att/db";
import { env } from "../env.js";
import { requireAuth, signToken } from "../auth/jwt.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
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
  return {
    token: signToken(user.id),
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  };
}

// 1. Login & Parol orqali kirish (Admin, Ustoz, Talaba)
const loginSchema = z.object({
  login: z.string().min(1, "Login kiritilishi shart"),
  password: z.string().min(1, "Parol kiritilishi shart"),
});

authRouter.post(
  "/login",
  h(async (req, res) => {
    const { login, password } = loginSchema.parse(req.body);
    const trimmed = login.trim();

    // Login bo'yicha yoki telefon raqami bo'yicha qidirish
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: trimmed },
          { phone: trimmed },
        ],
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Login yoki parol noto'g'ri");
    }

    if (user.status === "BLOCKED") {
      throw new ApiError(403, "BLOCKED", "Hisobingiz ma'muriyat tomonidan bloklangan");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    res.json({
      token: signToken(user.id),
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
      },
    });
  }),
);

// 2. Yangi foydalanuvchini saytdan ro'yxatdan o'tkazish
const registerSchema = z.object({
  username: z.string().min(3, "Login kamida 3 ta belgidan iborat bo'lsin").max(30).regex(/^[a-zA-Z0-9_.-]+$/, "Loginda faqat lotin harflari va raqamlar bo'lishi mumkin"),
  password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lsin"),
  firstName: z.string().min(2, "Ism kamida 2 ta harfdan iborat bo'lsin"),
  lastName: z.string().min(2, "Familiya kamida 2 ta harfdan iborat bo'lsin"),
  role: z.enum(["TEACHER", "STUDENT"]).default("TEACHER"),
  phone: z.string().nullish(),
  school: z.string().nullish(),
  grade: z.string().nullish(),
  region: z.string().nullish(),
  district: z.string().nullish(),
});

authRouter.post(
  "/register",
  h(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existingUsername = await prisma.user.findUnique({ where: { username: data.username } });
    if (existingUsername) {
      throw new ApiError(400, "EXISTS", "Ushbu login band. Boshqa login tanlang.");
    }

    if (data.phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existingPhone) {
        throw new ApiError(400, "EXISTS", "Ushbu telefon raqam allaqachon ro'yxatdan o'tgan.");
      }
    }

    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash: hashPassword(data.password),
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        phone: data.phone ?? null,
        school: data.school ?? null,
        grade: data.grade ?? null,
        region: data.region ?? null,
        district: data.district ?? null,
        registered: true,
      },
    });

    res.json({
      token: signToken(user.id),
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  }),
);

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
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      region: u.region,
      district: u.district,
      address: u.address,
      school: u.school,
      grade: u.grade,
      role: u.role,
      status: u.status,
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
