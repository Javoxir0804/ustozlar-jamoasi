import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@att/db";
import { requireAuth, requireRole } from "../auth/jwt.js";
import { badRequest, h } from "../lib/errors.js";
import { toCsv } from "../lib/csv.js";
import { grantSubscription, reviewPayment } from "../services/payments.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

const audit = (actorId: string, action: string, entity?: string, entityId?: string, meta?: object) =>
  prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta } });

// ---------- Fanlar ----------
const subjectSchema = z.object({ name: z.string().min(1), slug: z.string().regex(/^[a-z0-9-]+$/), order: z.number().int().default(0), isActive: z.boolean().default(true) });

adminRouter.get("/subjects", h(async (_req, res) => res.json(await prisma.subject.findMany({ orderBy: { order: "asc" } }))));
adminRouter.post("/subjects", h(async (req, res) => res.json(await prisma.subject.create({ data: subjectSchema.parse(req.body) }))));
adminRouter.patch("/subjects/:id", h(async (req, res) => res.json(await prisma.subject.update({ where: { id: req.params.id }, data: subjectSchema.partial().parse(req.body) }))));

// ---------- Testlar ----------
const testSchema = z.object({
  subjectId: z.string(),
  title: z.string().min(1),
  description: z.string().nullish(),
  durationMin: z.number().int().min(1).max(600).default(60),
  questionCount: z.number().int().min(1).max(200).default(20),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  maxAttempts: z.number().int().min(1).nullish(),
  requiresCode: z.boolean().default(false),
  password: z.string().nullish(),
  requiresSubscription: z.boolean().default(true),
  opensAt: z.coerce.date().nullish(),
  closesAt: z.coerce.date().nullish(),
  isActive: z.boolean().default(false),
});

adminRouter.get(
  "/tests",
  h(async (req, res) => {
    const subjectId = typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
    res.json(await prisma.test.findMany({ where: { subjectId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { questions: true, attempts: true } } } }));
  }),
);
adminRouter.post("/tests", h(async (req, res) => res.json(await prisma.test.create({ data: testSchema.parse(req.body) }))));
adminRouter.patch("/tests/:id", h(async (req, res) => res.json(await prisma.test.update({ where: { id: req.params.id }, data: testSchema.partial().parse(req.body) }))));

// ---------- Savollar ----------
const questionSchema = z.object({
  text: z.string().min(1),
  imageUrl: z.string().url().nullish(),
  order: z.number().int().default(0),
  options: z
    .array(z.object({ text: z.string().min(1), imageUrl: z.string().url().nullish(), isCorrect: z.boolean().default(false) }))
    .min(2)
    .refine((opts) => opts.filter((o) => o.isCorrect).length === 1, "Aynan bitta to'g'ri javob belgilanishi kerak"),
});

adminRouter.get(
  "/tests/:id/questions",
  h(async (req, res) => {
    res.json(await prisma.question.findMany({ where: { testId: req.params.id }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } }));
  }),
);

adminRouter.post(
  "/tests/:id/questions",
  h(async (req, res) => {
    const { options, ...q } = questionSchema.parse(req.body);
    res.json(
      await prisma.question.create({
        data: { ...q, testId: req.params.id, options: { create: options.map((o, i) => ({ ...o, order: i })) } },
        include: { options: true },
      }),
    );
  }),
);

// Tahrirlashda variantlar to'liq almashtiriladi; eski urinishlar buzilmasligi uchun javob berilgan savol o'chirilmaydi, faqat nofaol qilinadi
adminRouter.put(
  "/questions/:id",
  h(async (req, res) => {
    const { options, ...q } = questionSchema.parse(req.body);
    const used = await prisma.attemptAnswer.count({ where: { questionId: req.params.id } });
    if (used > 0) throw badRequest("QUESTION_USED", "Bu savolga javob berilgan: yangisini yarating va eskisini nofaol qiling");
    res.json(
      await prisma.$transaction(async (tx) => {
        await tx.option.deleteMany({ where: { questionId: req.params.id } });
        return tx.question.update({
          where: { id: req.params.id },
          data: { ...q, options: { create: options.map((o, i) => ({ ...o, order: i })) } },
          include: { options: true },
        });
      }),
    );
  }),
);

adminRouter.delete(
  "/questions/:id",
  h(async (req, res) => {
    const used = await prisma.attemptAnswer.count({ where: { questionId: req.params.id } });
    if (used > 0) await prisma.question.update({ where: { id: req.params.id }, data: { isActive: false } });
    else await prisma.question.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, "question.delete", "Question", req.params.id);
    res.json({ ok: true, deactivated: used > 0 });
  }),
);

// ---------- Kirish kodlari ----------
adminRouter.post(
  "/tests/:id/codes",
  h(async (req, res) => {
    const { count, maxUses, expiresAt } = z.object({ count: z.number().int().min(1).max(1000), maxUses: z.number().int().min(1).default(1), expiresAt: z.coerce.date().nullish() }).parse(req.body);
    const codes = Array.from({ length: count }, () => crypto.randomBytes(4).toString("hex").toUpperCase());
    await prisma.accessCode.createMany({ data: codes.map((code) => ({ code, testId: req.params.id, maxUses, expiresAt })) });
    await audit(req.user!.id, "codes.create", "Test", req.params.id, { count });
    res.json({ codes });
  }),
);
adminRouter.get("/tests/:id/codes", h(async (req, res) => res.json(await prisma.accessCode.findMany({ where: { testId: req.params.id }, orderBy: { createdAt: "desc" } }))));
// Bitta kodni yoki testning barcha ishlatilgan/eskirgan kodlarini bekor qilish
adminRouter.post(
  "/codes/revoke",
  h(async (req, res) => {
    const { ids, testId, usedOnly } = z.object({ ids: z.array(z.string()).optional(), testId: z.string().optional(), usedOnly: z.boolean().default(false) }).parse(req.body);
    const where = ids ? { id: { in: ids } } : { testId, ...(usedOnly ? { usedCount: { gt: 0 } } : {}) };
    const r = await prisma.accessCode.updateMany({ where: { ...where, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req.user!.id, "codes.revoke", "Test", testId, { count: r.count });
    res.json({ revoked: r.count });
  }),
);

// ---------- Majburiy kanallar ----------
const channelSchema = z.object({ chatId: z.string(), title: z.string(), inviteUrl: z.string().url(), isActive: z.boolean().default(true), order: z.number().int().default(0) });
adminRouter.get("/channels", h(async (_req, res) => res.json(await prisma.channel.findMany({ orderBy: { order: "asc" } }))));
adminRouter.post("/channels", h(async (req, res) => res.json(await prisma.channel.create({ data: channelSchema.parse(req.body) }))));
adminRouter.patch("/channels/:id", h(async (req, res) => res.json(await prisma.channel.update({ where: { id: req.params.id }, data: channelSchema.partial().parse(req.body) }))));
adminRouter.delete("/channels/:id", h(async (req, res) => res.json(await prisma.channel.delete({ where: { id: req.params.id } }))));

// ---------- Ishtirokchilar va natijalar ----------
adminRouter.get(
  "/users",
  h(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const where: any = {};
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { username: { contains: q, mode: "insensitive" } },
      ];
    }
    if (role && ["ADMIN", "TEACHER", "STUDENT"].includes(role)) {
      where.role = role;
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, skip: (page - 1) * 50, take: 50, orderBy: { createdAt: "desc" } }),
      prisma.user.count({ where }),
    ]);
    res.json({ items: items.map((u) => ({ ...u, telegramId: u.telegramId?.toString() ?? null })), total });
  }),
);

adminRouter.patch(
  "/users/:id",
  h(async (req, res) => {
    const updateSchema = z.object({
      role: z.enum(["ADMIN", "TEACHER", "STUDENT"]).optional(),
      status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().nullish(),
      school: z.string().nullish(),
    });
    const data = updateSchema.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });
    await audit(req.user!.id, "user.update", "User", req.params.id, data);
    res.json({ ...updated, telegramId: updated.telegramId?.toString() ?? null });
  }),
);

async function testResults(testId: string) {
  return prisma.attempt.findMany({
    where: { testId, status: { not: "IN_PROGRESS" } },
    orderBy: [{ scorePct: "desc" }, { finishedAt: "asc" }],
    include: { user: true, certificate: { select: { number: true } } },
  });
}

adminRouter.get("/tests/:id/results", h(async (req, res) => res.json(await testResults(req.params.id))));

adminRouter.get(
  "/tests/:id/results.csv",
  h(async (req, res) => {
    const rows = await testResults(req.params.id);
    const csv = toCsv(
      ["Familiya", "Ism", "Telefon", "Viloyat", "Tuman", "Maktab", "Sinf", "To'g'ri", "Jami", "Foiz", "Tugatgan vaqt", "Sertifikat"],
      rows.map((a) => [a.user.lastName, a.user.firstName, a.user.phone, a.user.region, a.user.district, a.user.school, a.user.grade, a.correctCount, a.totalCount, a.scorePct, a.finishedAt?.toISOString(), a.certificate?.number]),
    );
    res.type("text/csv; charset=utf-8").attachment(`natijalar-${req.params.id}.csv`).send("﻿" + csv);
  }),
);

// Test statistikasi: o'rtacha/maksimal ball, qatnashchilar, savollar bo'yicha to'g'ri javob foizi
adminRouter.get(
  "/tests/:id/stats",
  h(async (req, res) => {
    const agg = await prisma.attempt.aggregate({
      where: { testId: req.params.id, status: { not: "IN_PROGRESS" } },
      _avg: { scorePct: true },
      _max: { scorePct: true },
      _count: { _all: true },
    });
    const participants = await prisma.attempt.groupBy({ by: ["userId"], where: { testId: req.params.id, status: { not: "IN_PROGRESS" } } });
    const perQuestion = await prisma.$queryRaw<{ questionId: string; text: string; answered: bigint; correct: bigint; raschB: number | null }[]>`
      SELECT q.id AS "questionId", q.text, q."raschB",
        COUNT(aa.id)::bigint AS answered,
        COUNT(*) FILTER (WHERE aa."isCorrect")::bigint AS correct
      FROM "Question" q
      LEFT JOIN "AttemptAnswer" aa ON aa."questionId" = q.id
      WHERE q."testId" = ${req.params.id}
      GROUP BY q.id
      ORDER BY (COUNT(*) FILTER (WHERE aa."isCorrect"))::float / NULLIF(COUNT(aa.id), 0) ASC NULLS LAST`;
    res.json({
      attempts: agg._count._all,
      participants: participants.length,
      avgPct: agg._avg.scorePct,
      maxPct: agg._max.scorePct,
      questions: perQuestion.map((q) => ({
        ...q,
        answered: Number(q.answered),
        correct: Number(q.correct),
        correctPct: Number(q.answered) ? Math.round((Number(q.correct) / Number(q.answered)) * 1000) / 10 : null,
      })),
    });
  }),
);

// ---------- Obuna va qo'lda to'lovlar ----------
adminRouter.post(
  "/users/:id/subscription",
  h(async (req, res) => {
    const { days } = z.object({ days: z.number().int().min(1).max(3650) }).parse(req.body);
    const sub = await grantSubscription(req.params.id, days, "manual");
    await audit(req.user!.id, "subscription.grant", "User", req.params.id, { days });
    res.json(sub);
  }),
);

adminRouter.get(
  "/payments",
  h(async (req, res) => {
    const status = z.enum(["PENDING", "PAID", "CANCELLED", "FAILED"]).optional().parse(req.query.status);
    res.json(await prisma.payment.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 100, include: { plan: true, user: { select: { firstName: true, lastName: true, phone: true } } } }));
  }),
);

adminRouter.post(
  "/payments/:id/review",
  h(async (req, res) => {
    const { approve, note } = z.object({ approve: z.boolean(), note: z.string().max(300).optional() }).parse(req.body);
    res.json(await reviewPayment(req.params.id, req.user!, approve, note));
  }),
);

// Tariflar
const planSchema = z.object({ name: z.string().min(1), priceUzs: z.number().int().min(0), days: z.number().int().min(1), isActive: z.boolean().default(true) });
adminRouter.get("/plans", h(async (_req, res) => res.json(await prisma.plan.findMany({ orderBy: { priceUzs: "asc" } }))));
adminRouter.post("/plans", h(async (req, res) => res.json(await prisma.plan.create({ data: planSchema.parse(req.body) }))));
adminRouter.patch("/plans/:id", h(async (req, res) => res.json(await prisma.plan.update({ where: { id: req.params.id }, data: planSchema.partial().parse(req.body) }))));

// ---------- Sozlamalar (aloqa, litsey haqida) ----------
adminRouter.put(
  "/settings/:key",
  h(async (req, res) => {
    res.json(await prisma.setting.upsert({ where: { key: req.params.key }, create: { key: req.params.key, value: req.body }, update: { value: req.body } }));
  }),
);
