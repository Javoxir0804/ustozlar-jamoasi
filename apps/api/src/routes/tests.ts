import { Router } from "express";
import { z } from "zod";
import { prisma } from "@att/db";
import { requireAuth } from "../auth/jwt.js";
import { h } from "../lib/errors.js";
import { finishAttempt, getAttemptView, saveAnswer, startAttempt } from "../services/attempts.js";
import { renderCertificatePdf } from "../services/certificates.js";

export const testsRouter = Router();
testsRouter.use(requireAuth);

testsRouter.get(
  "/subjects",
  h(async (_req, res) => {
    res.json(await prisma.subject.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }));
  }),
);

testsRouter.get(
  "/tests",
  h(async (req, res) => {
    const subjectId = typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
    const now = new Date();
    const tests = await prisma.test.findMany({
      where: { isActive: true, subjectId, OR: [{ closesAt: null }, { closesAt: { gt: now } }] },
      select: { id: true, title: true, description: true, durationMin: true, questionCount: true, requiresCode: true, requiresSubscription: true, opensAt: true, closesAt: true, maxAttempts: true, subjectId: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(tests);
  }),
);

testsRouter.post(
  "/tests/:id/start",
  h(async (req, res) => {
    const body = z.object({ code: z.string().optional(), password: z.string().optional() }).parse(req.body ?? {});
    const attempt = await startAttempt(req.user!, req.params.id, body);
    res.json({ attemptId: attempt.id });
  }),
);

testsRouter.get(
  "/attempts/:id",
  h(async (req, res) => {
    res.json(await getAttemptView(req.params.id, req.user!));
  }),
);

testsRouter.put(
  "/attempts/:id/answers/:questionId",
  h(async (req, res) => {
    const body = z.object({ optionId: z.string().nullable().optional(), flagged: z.boolean().optional() }).parse(req.body);
    res.json(await saveAnswer(req.params.id, req.user!, req.params.questionId, body));
  }),
);

testsRouter.post(
  "/attempts/:id/finish",
  h(async (req, res) => {
    await finishAttempt(req.params.id, req.user!);
    res.json(await getAttemptView(req.params.id, req.user!));
  }),
);

// Shaxsiy kabinet: natijalar tarixi
testsRouter.get(
  "/me/attempts",
  h(async (req, res) => {
    const rows = await prisma.attempt.findMany({
      where: { userId: req.user!.id, status: { not: "IN_PROGRESS" } },
      orderBy: { finishedAt: "desc" },
      select: { id: true, scorePct: true, correctCount: true, totalCount: true, finishedAt: true, test: { select: { title: true, subject: { select: { name: true } } } }, certificate: { select: { number: true } } },
    });
    res.json(rows);
  }),
);

testsRouter.get(
  "/me/certificates/:number.pdf",
  h(async (req, res) => {
    const cert = await prisma.certificate.findUnique({ where: { number: req.params.number } });
    if (!cert || (cert.userId !== req.user!.id && req.user!.role !== "ADMIN")) return res.status(404).end();
    res.type("application/pdf").send(await renderCertificatePdf(cert.number));
  }),
);
