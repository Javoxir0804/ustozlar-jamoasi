// Test urinishlari: boshlash (ruxsat, jadval, urinishlar, parol/kod), javob saqlash, yakunlash, reytingdagi o'rin.
import { prisma, type Attempt, type Test, type User } from "@edu/db";
import { ApiError, badRequest, forbidden, notFound } from "../lib/errors.js";
import { hasCourseAccess } from "./access.js";
import { buildLayout, score, type LayoutItem } from "./scoring.js";

/** Talaba testni boshlay oladimi: kursga bog'langan bo'lsa kursga ruxsat kerak. */
export async function canTakeTest(user: User | undefined, test: Test & { course?: { id: string; isPaid: boolean } | null }) {
  if (!test.courseId) return !!user && (user.role === "ADMIN" || user.profileCompleted);
  const course = test.course ?? (await prisma.course.findUnique({ where: { id: test.courseId }, select: { id: true, isPaid: true } }));
  return !!course && hasCourseAccess(user, course);
}

export async function startAttempt(user: User, testId: string, opts: { code?: string; password?: string }) {
  const test = await prisma.test.findUnique({ where: { id: testId }, include: { questions: { where: { isActive: true }, include: { options: true } } } });
  if (!test || (!test.isActive && user.role !== "ADMIN")) throw notFound("Test topilmadi yoki faol emas");
  if (!(await canTakeTest(user, test))) throw forbidden("Bu test kursga ruxsati borlar uchun");
  const now = new Date();
  if (user.role !== "ADMIN") {
    if (test.opensAt && now < test.opensAt) throw badRequest("TEST_NOT_OPEN", "Test hali ochilmagan");
    if (test.closesAt && now > test.closesAt) throw badRequest("TEST_CLOSED", "Test yopilgan");
  }

  // Tugallanmagan urinish bo'lsa o'shani davom ettiramiz
  const open = await prisma.attempt.findFirst({ where: { userId: user.id, testId, status: "IN_PROGRESS" } });
  if (open) {
    if (open.deadlineAt > now) return open;
    await finishAttempt(open.id, user, true);
  }

  if (test.maxAttempts != null && user.role !== "ADMIN") {
    const used = await prisma.attempt.count({ where: { userId: user.id, testId } });
    if (used >= test.maxAttempts) throw badRequest("ATTEMPTS_EXCEEDED", "Urinishlar soni tugagan");
  }

  return prisma.$transaction(async (tx) => {
    let accessCodeId: string | undefined;
    if (test.requiresCode && user.role !== "ADMIN") {
      const passwordOk = !!test.password && !!opts.password && opts.password.trim() === test.password;
      if (!passwordOk) {
        const input = (opts.code ?? opts.password ?? "").trim().toUpperCase();
        if (!input) throw new ApiError(403, "CODE_REQUIRED", "Testga kirish uchun kod yoki parol kerak");
        const code = await tx.accessCode.findUnique({ where: { code: input } });
        if (!code || code.testId !== test.id || code.revokedAt || (code.expiresAt && code.expiresAt < now)) throw new ApiError(403, "BAD_CODE", "Kod yoki parol noto'g'ri");
        // Atomar: kod ishlatish chegarasidan oshmasin
        const upd = await tx.accessCode.updateMany({ where: { id: code.id, usedCount: { lt: code.maxUses } }, data: { usedCount: { increment: 1 } } });
        if (upd.count === 0) throw new ApiError(403, "CODE_USED", "Bu kod allaqachon ishlatilgan");
        accessCodeId = code.id;
      }
    }
    const layout = buildLayout(test.questions, { count: test.questionCount, shuffleQuestions: test.shuffleQuestions, shuffleOptions: test.shuffleOptions });
    if (layout.length === 0) throw badRequest("NO_QUESTIONS", "Testda savollar yo'q");
    return tx.attempt.create({ data: { userId: user.id, testId, deadlineAt: new Date(now.getTime() + test.durationMin * 60_000), layout, accessCodeId } });
  });
}

async function loadOwnAttempt(attemptId: string, user: User) {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw notFound("Urinish topilmadi");
  if (attempt.userId !== user.id && user.role !== "ADMIN") throw forbidden();
  return attempt;
}

/** Test oynasi uchun ma'lumot. To'g'ri javoblar faqat yakunlangandan keyin (va test ruxsat bersa) qaytariladi. */
export async function getAttemptView(attemptId: string, user: User) {
  let attempt = await loadOwnAttempt(attemptId, user);
  if (attempt.status === "IN_PROGRESS" && attempt.deadlineAt <= new Date()) attempt = await finishAttempt(attempt.id, user, true);
  const layout = attempt.layout as LayoutItem[];
  const finished = attempt.status !== "IN_PROGRESS";
  const [questions, answers, test] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: layout.map((l) => l.q) } }, include: { options: true } }),
    prisma.attemptAnswer.findMany({ where: { attemptId } }),
    prisma.test.findUniqueOrThrow({ where: { id: attempt.testId }, select: { id: true, title: true, durationMin: true, showAnswers: true, subject: { select: { name: true } } } }),
  ]);
  const qById = new Map(questions.map((q) => [q.id, q]));
  const aByQ = new Map(answers.map((a) => [a.questionId, a]));
  const reveal = finished && (test.showAnswers || user.role === "ADMIN");
  return {
    id: attempt.id,
    test,
    status: attempt.status,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    serverNow: new Date(),
    deadlineAt: attempt.deadlineAt,
    result: finished ? { correctCount: attempt.correctCount, totalCount: attempt.totalCount, scorePct: attempt.scorePct, rank: await rankOf(attempt), participants: await participantsOf(attempt.testId) } : null,
    reveal,
    questions: layout.map((item, idx) => {
      const q = qById.get(item.q)!;
      const optById = new Map(q.options.map((o) => [o.id, o]));
      const ans = aByQ.get(item.q);
      return {
        n: idx + 1,
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl,
        ...(reveal ? { explanation: q.explanation, isCorrect: ans?.isCorrect ?? false } : {}),
        options: item.o
          .map((oid) => optById.get(oid))
          .filter((o) => !!o)
          .map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl, ...(reveal ? { isCorrect: o.isCorrect } : {}) })),
        selected: ans?.optionId ?? null,
        flagged: ans?.flagged ?? false,
      };
    }),
  };
}

export async function saveAnswer(attemptId: string, user: User, questionId: string, data: { optionId?: string | null; flagged?: boolean }) {
  const attempt = await loadOwnAttempt(attemptId, user);
  if (attempt.userId !== user.id) throw forbidden();
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
    update: { ...(data.optionId !== undefined ? { optionId: data.optionId } : {}), ...(data.flagged !== undefined ? { flagged: data.flagged } : {}) },
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
  const result = score(layout, new Map(answers.map((a) => [a.questionId, a.optionId])), new Map(correctOpts.map((o) => [o.questionId, o.id])));
  return prisma.$transaction(async (tx) => {
    // Faqat hali yakunlanmagan bo'lsa (ikki marta bosilsa ham bir marta hisoblanadi)
    const upd = await tx.attempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: { status: expired ? "EXPIRED" : "FINISHED", finishedAt: new Date(), correctCount: result.correctCount, totalCount: result.totalCount, scorePct: result.scorePct },
    });
    if (upd.count > 0) {
      for (const [questionId, isCorrect] of result.perQuestion) {
        await tx.attemptAnswer.upsert({ where: { attemptId_questionId: { attemptId, questionId } }, create: { attemptId, questionId, isCorrect }, update: { isCorrect } });
      }
    }
    return tx.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  });
}

/** Reytingdagi o'rin: har bir talabaning shu testdagi eng yaxshi natijasi bo'yicha. */
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

export async function participantsOf(testId: string) {
  const rows = await prisma.attempt.groupBy({ by: ["userId"], where: { testId, status: { not: "IN_PROGRESS" } } });
  return rows.length;
}
