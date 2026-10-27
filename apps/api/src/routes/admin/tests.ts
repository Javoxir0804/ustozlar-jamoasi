// Testlar (admin): sozlamalar, savollar banki, matndan import, kirish kodlari, natijalar.
import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma, type Prisma } from "@edu/db";
import { audit, publicUser } from "../../auth/session.js";
import { badRequest, h, notFound } from "../../lib/errors.js";
import { parseQuestions } from "../../services/importQuestions.js";

export const testsRouter = Router();

const optDate = z.coerce.date().nullish().transform((v) => v ?? null);
const testSchema = z
  .object({
    subjectId: z.string().min(1, "Fanni tanlang"),
    courseId: z.string().nullish().transform((v) => v || null),
    title: z.string().trim().min(2, "Test nomini kiriting").max(200),
    description: z.string().trim().max(5000).nullish().transform((v) => v || null),
    durationMin: z.number().int().min(1, "Vaqt kamida 1 daqiqa").max(600),
    questionCount: z.number().int().min(1, "Savollar soni kamida 1").max(500),
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
    maxAttempts: z.number().int().min(1).nullish().transform((v) => v ?? null),
    opensAt: optDate,
    closesAt: optDate,
    requiresCode: z.boolean(),
    password: z.string().trim().max(100).nullish().transform((v) => v || null),
    showAnswers: z.boolean(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => !d.opensAt || !d.closesAt || d.opensAt < d.closesAt, { message: "Yopilish vaqti ochilishdan keyin bo'lsin" });

const DEFAULTS = { durationMin: 60, questionCount: 20, shuffleQuestions: true, shuffleOptions: true, showAnswers: true, requiresCode: false, isActive: false };

testsRouter.get(
  "/tests",
  h(async (req, res) => {
    const subjectId = typeof req.query.subjectId === "string" && req.query.subjectId ? req.query.subjectId : undefined;
    const tests = await prisma.test.findMany({
      where: subjectId ? { subjectId } : {},
      orderBy: { createdAt: "desc" },
      include: { subject: { select: { id: true, name: true } }, course: { select: { id: true, title: true } }, _count: { select: { questions: { where: { isActive: true } }, attempts: { where: { status: { not: "IN_PROGRESS" } } } } } },
    });
    res.json(tests.map(({ password: _p, ...t }) => t));
  }),
);

testsRouter.post(
  "/tests",
  h(async (req, res) => {
    const d = testSchema.parse(req.body);
    if (!d.subjectId || !d.title) throw badRequest("VALIDATION", "Fan va test nomini kiriting");
    const t = await prisma.test.create({ data: { ...DEFAULTS, ...d, subjectId: d.subjectId, title: d.title } });
    await audit(req.user!.id, "test.create", "Test", t.id);
    res.json(t);
  }),
);

testsRouter.get(
  "/tests/:id",
  h(async (req, res) => {
    const t = await prisma.test.findUnique({
      where: { id: req.params.id },
      include: {
        subject: { select: { id: true, name: true } },
        questions: { where: { isActive: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], include: { options: { orderBy: { order: "asc" } } } },
        _count: { select: { attempts: { where: { status: { not: "IN_PROGRESS" } } } } },
      },
    });
    if (!t) throw notFound("Test topilmadi");
    res.json(t);
  }),
);

testsRouter.patch(
  "/tests/:id",
  h(async (req, res) => {
    const t = await prisma.test.update({ where: { id: req.params.id }, data: testSchema.parse(req.body) });
    await audit(req.user!.id, "test.update", "Test", t.id);
    res.json(t);
  }),
);

testsRouter.delete(
  "/tests/:id",
  h(async (req, res) => {
    const used = await prisma.attempt.count({ where: { testId: req.params.id } });
    if (used) throw badRequest("HAS_ATTEMPTS", "Testni topshirganlar bor, natijalar yo'qolmasligi uchun o'chirib bo'lmaydi. Testni nofaol qiling.");
    await prisma.test.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, "test.delete", "Test", req.params.id);
    res.json({ ok: true });
  }),
);

// ---------- Savollar ----------
const optionSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().max(2000).default(""),
  imageUrl: z.string().trim().max(500).nullish().transform((v) => v || null),
  isCorrect: z.boolean(),
});
const questionSchema = z
  .object({
    text: z.string().trim().min(1, "Savol matnini kiriting").max(10_000),
    imageUrl: z.string().trim().max(500).nullish().transform((v) => v || null),
    explanation: z.string().trim().max(5000).nullish().transform((v) => v || null),
    options: z.array(optionSchema).min(2, "Kamida 2 ta variant kerak").max(8),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, { message: "Aynan bitta to'g'ri javobni belgilang" })
  .refine((q) => q.options.every((o) => o.text || o.imageUrl), { message: "Har bir variantda matn yoki rasm bo'lsin" });

const withOptions = { options: { orderBy: { order: "asc" as const } } };

testsRouter.post(
  "/tests/:id/questions",
  h(async (req, res) => {
    const d = questionSchema.parse(req.body);
    const order = await prisma.question.count({ where: { testId: req.params.id } });
    const q = await prisma.question.create({
      data: { testId: req.params.id, text: d.text, imageUrl: d.imageUrl, explanation: d.explanation, order, options: { create: d.options.map((o, i) => ({ text: o.text, imageUrl: o.imageUrl, isCorrect: o.isCorrect, order: i })) } },
      include: withOptions,
    });
    res.json(q);
  }),
);

testsRouter.patch(
  "/questions/:id",
  h(async (req, res) => {
    const d = questionSchema.parse(req.body);
    const q = await prisma.question.findUnique({ where: { id: req.params.id }, include: { options: { include: { _count: { select: { answers: true } } } } } });
    if (!q) throw notFound("Savol topilmadi");
    const keep = new Set(d.options.map((o) => o.id).filter(Boolean));
    const removed = q.options.filter((o) => !keep.has(o.id));
    if (removed.some((o) => o._count.answers)) throw badRequest("OPTION_USED", "Talabalar tanlagan variantni o'chirib bo'lmaydi. Matnini o'zgartiring.");
    const updated = await prisma.$transaction(async (tx) => {
      await tx.option.deleteMany({ where: { id: { in: removed.map((o) => o.id) } } });
      for (const [i, o] of d.options.entries()) {
        const data = { text: o.text, imageUrl: o.imageUrl, isCorrect: o.isCorrect, order: i };
        if (o.id && q.options.some((x) => x.id === o.id)) await tx.option.update({ where: { id: o.id }, data });
        else await tx.option.create({ data: { ...data, questionId: q.id } });
      }
      return tx.question.update({ where: { id: q.id }, data: { text: d.text, imageUrl: d.imageUrl, explanation: d.explanation }, include: withOptions });
    });
    res.json(updated);
  }),
);

// Javob berilgan savol natijalar buzilmasligi uchun o'chirilmaydi, yashiriladi
testsRouter.delete(
  "/questions/:id",
  h(async (req, res) => {
    const used = await prisma.attemptAnswer.count({ where: { questionId: req.params.id } });
    if (used) await prisma.question.update({ where: { id: req.params.id }, data: { isActive: false } });
    else await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

testsRouter.post(
  "/tests/:id/questions/reorder",
  h(async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);
    await prisma.$transaction(ids.map((id, order) => prisma.question.updateMany({ where: { id, testId: req.params.id }, data: { order } })));
    res.json({ ok: true });
  }),
);

// Matndan ommaviy import: avval tekshirish (dryRun), keyin saqlash
testsRouter.post(
  "/tests/:id/import",
  h(async (req, res) => {
    const { text, dryRun } = z.object({ text: z.string().min(1, "Matnni kiriting").max(500_000), dryRun: z.boolean().default(false) }).parse(req.body);
    const parsed = parseQuestions(text);
    if (dryRun || parsed.errors.length) return res.json({ ...parsed, created: 0 });
    let order = await prisma.question.count({ where: { testId: req.params.id } });
    await prisma.$transaction(
      parsed.questions.map((q) =>
        prisma.question.create({
          data: { testId: req.params.id, text: q.text, explanation: q.explanation ?? null, order: order++, options: { create: q.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: i })) } },
        }),
      ),
    );
    await audit(req.user!.id, "test.import", "Test", req.params.id, { count: parsed.questions.length });
    res.json({ ...parsed, created: parsed.questions.length });
  }),
);

// ---------- Kirish kodlari ----------
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () => Array.from(crypto.randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");

testsRouter.get("/tests/:id/codes", h(async (req, res) => res.json(await prisma.accessCode.findMany({ where: { testId: req.params.id }, orderBy: { createdAt: "desc" } }))));

testsRouter.post(
  "/tests/:id/codes",
  h(async (req, res) => {
    const d = z.object({ count: z.number().int().min(1).max(500), maxUses: z.number().int().min(1).max(10_000).default(1), expiresAt: optDate }).parse(req.body);
    const rows = Array.from({ length: d.count }, () => ({ testId: req.params.id, code: genCode(), maxUses: d.maxUses, expiresAt: d.expiresAt }));
    await prisma.accessCode.createMany({ data: rows, skipDuplicates: true });
    await audit(req.user!.id, "test.codes", "Test", req.params.id, { count: d.count });
    res.json({ codes: rows.map((r) => r.code) });
  }),
);

testsRouter.delete(
  "/codes/:id",
  h(async (req, res) => {
    await prisma.accessCode.update({ where: { id: req.params.id }, data: { revokedAt: new Date() } });
    res.json({ ok: true });
  }),
);

// ---------- Natijalar ----------
testsRouter.get(
  "/tests/:id/attempts",
  h(async (req, res) => {
    const where: Prisma.AttemptWhereInput = { testId: req.params.id, status: { not: "IN_PROGRESS" } };
    const rows = await prisma.attempt.findMany({ where, orderBy: [{ scorePct: "desc" }, { finishedAt: "asc" }], include: { user: true }, take: 1000 });
    res.json(
      rows.map((a) => ({
        id: a.id,
        status: a.status,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
        correctCount: a.correctCount,
        totalCount: a.totalCount,
        scorePct: a.scorePct,
        durationSec: a.finishedAt ? Math.round((+a.finishedAt - +a.startedAt) / 1000) : null,
        user: publicUser(a.user),
      })),
    );
  }),
);
