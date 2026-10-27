import { prisma, type Attempt, type User } from "@att/db";
import { ApiError, badRequest, forbidden, notFound } from "../lib/errors.js";
import { hasActiveSubscription } from "./access.js";
import { buildLayout, score, type LayoutItem } from "./scoring.js";
import { issueCertificateIfEligible } from "./certificates.js";

export async function startAttempt(user: User, testId: string, opts: { code?: string; password?: string }) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { questions: { where: { isActive: true }, include: { options: true } } },
  });
  if (!test || !test.isActive) throw notFound("Test topilmadi yoki faol emas");
  const now = new Date();
  if (test.opensAt && now < test.opensAt) throw badRequest("TEST_NOT_OPEN", "Test hali ochilmagan");
  if (test.closesAt && now > test.closesAt) throw badRequest("TEST_CLOSED", "Test yopilgan");
  if (test.requiresSubscription && !(await hasActiveSubscription(user))) {
    throw new ApiError(402, "SUBSCRIPTION_REQUIRED", "Bu test uchun obuna kerak");
  }

  // Tugallanmagan urinish bo'lsa, o'shani davom ettiramiz
  const open = await prisma.attempt.findFirst({ where: { userId: user.id, testId, status: "IN_PROGRESS" } });
  if (open) {
    if (open.deadlineAt > now) return open;
    await finishAttempt(open.id, user, true);
  }

  if (test.maxAttempts != null) {
    const used = await prisma.attempt.count({ where: { userId: user.id, testId } });
    if (used >= test.maxAttempts) throw badRequest("ATTEMPTS_EXCEEDED", "Urinishlar soni tugagan");
  }

  return prisma.$transaction(async (tx) => {
    let accessCodeId: string | undefined;
    if (test.requiresCode && user.role !== "ADMIN") {
      const passwordOk = !!test.password && opts.password === test.password;
      if (!passwordOk) {
        if (!opts.code) throw forbidden("Kirish kodi yoki parol kerak");
        const code = await tx.accessCode.findUnique({ where: { code: opts.code.trim().toUpperCase() } });
        if (!code || code.testId !== test.id || code.revokedAt || (code.expiresAt && code.expiresAt < now)) {
          throw forbidden("Kod noto'g'ri yoki bekor qilingan");
        }
        // Atomar: kod ishlatish limitidan oshib ketmasligi uchun shartli yangilash
        const upd = await tx.accessCode.updateMany({
          where: { id: code.id, usedCount: { lt: code.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (upd.count === 0) throw forbidden("Kod allaqachon ishlatilgan");
        accessCodeId = code.id;
      }
    }

    const layout = buildLayout(test.questions, {
      count: test.questionCount,
      shuffleQuestions: test.shuffleQuestions,
      shuffleOptions: test.shuffleOptions,
    });
    if (layout.length === 0) throw badRequest("NO_QUESTIONS", "Testda savollar yo'q");

    return tx.attempt.create({
      data: {
        userId: user.id,
        testId,
        deadlineAt: new Date(now.getTime() + test.durationMin * 60_000),
        layout,
        accessCodeId,
      },
    });
  });
}

async function loadOwnAttempt(attemptId: string, user: User) {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw notFound("Urinish topilmadi");
  if (attempt.userId !== user.id && user.role !== "ADMIN") throw forbidden();
  return attempt;
}

/** Test oynasi uchun ma'lumot. To'g'ri javoblar faqat yakunlangandan keyin qaytariladi. */
export async function getAttemptView(attemptId: string, user: User) {
  let attempt = await loadOwnAttempt(attemptId, user);
  if (attempt.status === "IN_PROGRESS" && attempt.deadlineAt <= new Date()) {
    attempt = await finishAttempt(attempt.id, user, true);
  }
  const layout = attempt.layout as LayoutItem[];
  const finished = attempt.status !== "IN_PROGRESS";
  const [questions, answers, test, cert] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: layout.map((l) => l.q) } }, include: { options: true } }),
    prisma.attemptAnswer.findMany({ where: { attemptId } }),
    prisma.test.findUniqueOrThrow({ where: { id: attempt.testId }, select: { title: true, durationMin: true } }),
    finished ? prisma.certificate.findUnique({ where: { attemptId } }) : null,
  ]);
  const qById = new Map(questions.map((q) => [q.id, q]));
  const aByQ = new Map(answers.map((a) => [a.questionId, a]));

  return {
    id: attempt.id,
    test,
    status: attempt.status,
    serverNow: new Date().toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    result: finished
      ? { correctCount: attempt.correctCount, totalCount: attempt.totalCount, scorePct: attempt.scorePct, rank: await rankOf(attempt), certificate: cert?.number ?? null }
      : null,
    questions: layout.map((item, idx) => {
      const q = qById.get(item.q)!;
      const optById = new Map(q.options.map((o) => [o.id, o]));
      const ans = aByQ.get(item.q);
      return {
        n: idx + 1,
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl,
        options: item.o.map((oid) => {
          const o = optById.get(oid)!;
          return { id: o.id, text: o.text, imageUrl: o.imageUrl, ...(finished ? { isCorrect: o.isCorrect } : {}) };
        }),
        selected: ans?.optionId ?? null,
        flagged: ans?.flagged ?? false,
      };
    }),
  };
}

export async function saveAnswer(attemptId: string, user: User, questionId: string, data: { optionId?: string | null; flagged?: boolean }) {
  const attempt = await loadOwnAttempt(attemptId, user);
  if (attempt.status !== "IN_PROGRESS") throw badRequest("ATTEMPT_FINISHED", "Test yakunlangan");
  if (attempt.deadlineAt <= new Date()) {
    await finishAttempt(attempt.id, user, true);
    throw badRequest("TIME_UP", "Vaqt tugadi");
  }
  const item = (attempt.layout as LayoutItem[]).find((l) => l.q === questionId);
  if (!item) throw badRequest("BAD_QUESTION", "Savol bu urinishga tegishli emas");
  if (data.optionId && !item.o.includes(data.optionId)) throw badRequest("BAD_OPTION", "Variant noto'g'ri");

  return prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, optionId: data.optionId ?? null, flagged: data.flagged ?? false },
    update: {
      ...(data.optionId !== undefined ? { optionId: data.optionId } : {}),
      ...(data.flagged !== undefined ? { flagged: data.flagged } : {}),
    },
    select: { questionId: true, optionId: true, flagged: true },
  });
}

export async function finishAttempt(attemptId: string, user: User, expired = false): Promise<Attempt> {
  const attempt = await loadOwnAttempt(attemptId, user);
  if (attempt.status !== "IN_PROGRESS") return attempt;
  const layout = attempt.layout as LayoutItem[];
  const qIds = layout.map((l) => l.q);
  const [correctOpts, answers] = await Promise.all([
    prisma.option.findMany({ where: { questionId: { in: qIds }, isCorrect: true }, select: { id: true, questionId: true } }),
    prisma.attemptAnswer.findMany({ where: { attemptId } }),
  ]);
  const result = score(
    layout,
    new Map(answers.map((a) => [a.questionId, a.optionId])),
    new Map(correctOpts.map((o) => [o.questionId, o.id])),
  );

  const finished = await prisma.$transaction(async (tx) => {
    // Faqat hali yakunlanmagan bo'lsa yangilaymiz (ikki marta bosilsa ham bir marta hisoblanadi)
    const upd = await tx.attempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: {
        status: expired ? "EXPIRED" : "FINISHED",
        finishedAt: new Date(),
        correctCount: result.correctCount,
        totalCount: result.totalCount,
        scorePct: result.scorePct,
      },
    });
    if (upd.count > 0) {
      for (const [questionId, isCorrect] of result.perQuestion) {
        await tx.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          create: { attemptId, questionId, isCorrect },
          update: { isCorrect },
        });
      }
    }
    return tx.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  });

  await issueCertificateIfEligible(finished);
  return finished;
}

/** Reytingdagi o'rin: shu testda har bir foydalanuvchining eng yaxshi natijasi bo'yicha. */
export async function rankOf(attempt: Attempt): Promise<number | null> {
  if (attempt.scorePct == null) return null;
  const rows = await prisma.$queryRaw<{ better: bigint }[]>`
    SELECT COUNT(*)::bigint AS better FROM (
      SELECT "userId", MAX("scorePct") AS best FROM "Attempt"
      WHERE "testId" = ${attempt.testId} AND "status" <> 'IN_PROGRESS' AND "userId" <> ${attempt.userId}
      GROUP BY "userId"
    ) t WHERE t.best > ${attempt.scorePct}`;
  return Number(rows[0]?.better ?? 0) + 1;
}
