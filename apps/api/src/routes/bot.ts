// Bot -> API ichki endpointlari. Faqat X-Bot-Key sarlavhasi bilan.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@att/db";
import { requireBot } from "../auth/jwt.js";
import { h, notFound } from "../lib/errors.js";
import { activeSubscriptionEnd } from "../services/access.js";
import { renderCertificatePdf } from "../services/certificates.js";
import { profileSchema } from "./auth.js";
import { createManualPayment, reviewPayment } from "../services/payments.js";

export const botRouter = Router();
botRouter.use(requireBot);

const serializeUser = async (u: { id: string; telegramId: bigint | null; registered: boolean; firstName: string; lastName: string; phone: string | null; region: string | null; district: string | null; address: string | null; school: string | null; grade: string | null }) => ({
  ...u,
  telegramId: u.telegramId?.toString() ?? null,
  subscriptionEndsAt: await activeSubscriptionEnd(u.id),
});

botRouter.get(
  "/users/:tgId",
  h(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { telegramId: BigInt(req.params.tgId) } });
    if (!u) throw notFound("Foydalanuvchi topilmadi");
    res.json(await serializeUser(u));
  }),
);

// Ro'yxatdan o'tishni yakunlash (bot barcha maydonlarni yig'gandan keyin)
botRouter.post(
  "/users",
  h(async (req, res) => {
    const data = profileSchema.extend({ telegramId: z.coerce.bigint(), phone: z.string().min(7).max(20) }).parse(req.body);
    const phone = data.phone.replace(/[^\d+]/g, "");
    const u = await prisma.user.upsert({
      where: { telegramId: data.telegramId },
      create: { ...data, phone, registered: true },
      update: { ...data, phone, registered: true },
    });
    res.json(await serializeUser(u));
  }),
);

botRouter.get(
  "/channels",
  h(async (_req, res) => {
    res.json(await prisma.channel.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }));
  }),
);

botRouter.get(
  "/subjects",
  h(async (_req, res) => {
    res.json(await prisma.subject.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }));
  }),
);

botRouter.get(
  "/users/:tgId/attempts",
  h(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { telegramId: BigInt(req.params.tgId) } });
    if (!u) throw notFound();
    res.json(
      await prisma.attempt.findMany({
        where: { userId: u.id, status: { not: "IN_PROGRESS" } },
        orderBy: { finishedAt: "desc" },
        take: 10,
        select: { scorePct: true, finishedAt: true, test: { select: { title: true } }, certificate: { select: { number: true } } },
      }),
    );
  }),
);

botRouter.get(
  "/lessons/:subjectId",
  h(async (req, res) => {
    res.json(
      await prisma.lessonSection.findMany({
        where: { subjectId: req.params.subjectId },
        orderBy: { order: "asc" },
        select: { id: true, title: true, lessons: { where: { isPublished: true }, orderBy: { order: "asc" }, select: { id: true, title: true, isFree: true } } },
      }),
    );
  }),
);

botRouter.get(
  "/certificates/:number.pdf",
  h(async (req, res) => {
    res.type("application/pdf").send(await renderCertificatePdf(req.params.number));
  }),
);

// ---------- Qo'lda to'lov (chek orqali) ----------
botRouter.get(
  "/plans",
  h(async (_req, res) => {
    res.json(await prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceUzs: "asc" }, select: { id: true, name: true, priceUzs: true, days: true } }));
  }),
);

botRouter.post(
  "/payments",
  h(async (req, res) => {
    const { telegramId, planId, receiptFileId } = z.object({ telegramId: z.coerce.bigint(), planId: z.string(), receiptFileId: z.string() }).parse(req.body);
    const u = await prisma.user.findUnique({ where: { telegramId } });
    if (!u) throw notFound("Foydalanuvchi topilmadi");
    const p = await createManualPayment(u.id, planId, receiptFileId);
    res.json({ id: p.id, amountUzs: p.amountUzs, plan: p.plan.name, user: { fullName: `${p.user.lastName} ${p.user.firstName}`, phone: p.user.phone } });
  }),
);

// Admin botdagi tugmani bosganda; admin roli serverda Telegram ID bo'yicha tekshiriladi
botRouter.post(
  "/payments/:id/review",
  h(async (req, res) => {
    const { adminTelegramId, approve } = z.object({ adminTelegramId: z.coerce.bigint(), approve: z.boolean() }).parse(req.body);
    const admin = await prisma.user.findUnique({ where: { telegramId: adminTelegramId } });
    if (!admin) throw notFound("Admin topilmadi");
    const p = await reviewPayment(req.params.id, admin, approve);
    res.json({ status: p.status, userTelegramId: p.user.telegramId?.toString() ?? null, plan: p.plan.name, subscriptionEndsAt: p.subscriptionEndsAt });
  }),
);
