// Talaba uchun testlar: ro'yxat, test haqida, boshlash, javob berish, yakunlash, natijalar tarixi.
import { Router } from "express";
import { z } from "zod";
import { prisma, type User } from "@edu/db";
import { optionalAuth, requireAuth, requireProfile } from "../auth/session.js";
import { h, notFound } from "../lib/errors.js";
import { accessibleCourseIds } from "../services/access.js";
import { finishAttempt, getAttemptView, saveAnswer, startAttempt } from "../services/attempts.js";

export const testsRouter = Router();

const testInclude = {
  subject: { select: { id: true, name: true } },
  course: { select: { id: true, title: true, isPaid: true } },
  _count: { select: { questions: { where: { isActive: true } } } },
} as const;

type Row = Awaited<ReturnType<typeof loadTests>>[number];
const loadTests = (where: object) => prisma.test.findMany({ where: { isActive: true, subject: { isActive: true }, ...where }, orderBy: { createdAt: "desc" }, include: testInclude });

async function present(rows: Row[], user: User | undefined) {
  const ids = rows.map((t) => t.id);
  const userId = user?.id;
  const courseIds = await accessibleCourseIds(user);
  const stats = userId
    ? await prisma.attempt.groupBy({ by: ["testId"], where: { userId, testId: { in: ids } }, _count: { _all: true }, _max: { scorePct: true } })
    : [];
  const open = userId ? await prisma.attempt.findMany({ where: { userId, testId: { in: ids }, status: "IN_PROGRESS", deadlineAt: { gt: new Date() } }, select: { id: true, testId: true } }) : [];
  const now = Date.now();
  return rows.map((t) => {
    const s = stats.find((x) => x.testId === t.id);
    const used = s?._count._all ?? 0;
    const locked = !user ? true : user.role === "ADMIN" ? false : !user.profileCompleted || (t.course ? t.course.isPaid && !courseIds.has(t.course.id) : false);
    const state = t.opensAt && +t.opensAt > now ? "UPCOMING" : t.closesAt && +t.closesAt < now ? "CLOSED" : "OPEN";
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      subject: t.subject,
      course: t.course ? { id: t.course.id, title: t.course.title } : null,
      durationMin: t.durationMin,
      questionCount: Math.min(t.questionCount, t._count.questions),
      maxAttempts: t.maxAttempts,
      attemptsUsed: used,
      bestScore: s?._max.scorePct ?? null,
      opensAt: t.opensAt,
      closesAt: t.closesAt,
      requiresCode: t.requiresCode,
      locked,
      state,
      openAttemptId: open.find((o) => o.testId === t.id)?.id ?? null,
    };
  });
}

testsRouter.get(
  "/tests",
  optionalAuth,
  h(async (req, res) => {
    res.json(await present(await loadTests({}), req.user));
  }),
);

testsRouter.get(
  "/tests/:id",
  optionalAuth,
  h(async (req, res) => {
    const rows = await loadTests({ id: req.params.id });
    if (!rows.length) throw notFound("Test topilmadi");
    res.json((await present(rows, req.user))[0]);
  }),
);

testsRouter.post(
  "/tests/:id/start",
  requireAuth,
  requireProfile,
  h(async (req, res) => {
    const opts = z.object({ code: z.string().max(100).optional(), password: z.string().max(100).optional() }).parse(req.body ?? {});
    const a = await startAttempt(req.user!, req.params.id, opts);
    res.json({ attemptId: a.id });
  }),
);

testsRouter.get("/attempts/:id", requireAuth, h(async (req, res) => res.json(await getAttemptView(req.params.id, req.user!))));

testsRouter.put(
  "/attempts/:id/answers/:questionId",
  requireAuth,
  h(async (req, res) => {
    const d = z.object({ optionId: z.string().nullable().optional(), flagged: z.boolean().optional() }).parse(req.body);
    res.json(await saveAnswer(req.params.id, req.user!, req.params.questionId, d));
  }),
);

testsRouter.post(
  "/attempts/:id/finish",
  requireAuth,
  h(async (req, res) => {
    const a = await finishAttempt(req.params.id, req.user!);
    res.json({ status: a.status, scorePct: a.scorePct });
  }),
);

// Kabinet: topshirilgan testlar tarixi
testsRouter.get(
  "/me/attempts",
  requireAuth,
  h(async (req, res) => {
    const rows = await prisma.attempt.findMany({
      where: { userId: req.user!.id },
      orderBy: { startedAt: "desc" },
      take: 100,
      include: { test: { select: { id: true, title: true, subject: { select: { name: true } } } } },
    });
    res.json(rows.map((a) => ({ id: a.id, status: a.status, startedAt: a.startedAt, finishedAt: a.finishedAt, deadlineAt: a.deadlineAt, correctCount: a.correctCount, totalCount: a.totalCount, scorePct: a.scorePct, test: a.test })));
  }),
);
