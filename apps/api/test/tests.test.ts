// 3-bosqich: savollar banki, import, urinish (taymer, javoblar, yakunlash), cheklovlar (urinishlar, parol/kod, jadval, kurs).
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@edu/db";
import { createApp } from "../src/app.js";
import { signToken } from "../src/auth/session.js";
import { parseQuestions } from "../src/services/importQuestions.js";
import { buildLayout, score } from "../src/services/scoring.js";

const app = createApp();
const tag = `t${Date.now()}`;
let admin = "";
let student = "";
let subjectId = "";
let testId = "";
const as = (t: string) => ({ authorization: `Bearer ${t}` });
const uids: string[] = [];

beforeAll(async () => {
  const a = await prisma.user.create({ data: { role: "ADMIN", login: `${tag}a`, firstName: "A", profileCompleted: true } });
  const s = await prisma.user.create({ data: { firstName: tag, profileCompleted: true } });
  uids.push(a.id, s.id);
  admin = signToken(a.id);
  student = signToken(s.id);
  subjectId = (await prisma.subject.create({ data: { name: tag, slug: tag } })).id;
});

afterAll(async () => {
  const tests = await prisma.test.findMany({ where: { subjectId }, select: { id: true } });
  await prisma.certificate.deleteMany({ where: { attempt: { testId: { in: tests.map((t) => t.id) } } } });
  await prisma.attempt.deleteMany({ where: { testId: { in: tests.map((t) => t.id) } } });
  await prisma.test.deleteMany({ where: { subjectId } });
  await prisma.course.deleteMany({ where: { subjectId } });
  await prisma.subject.deleteMany({ where: { id: subjectId } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: uids } } });
  await prisma.user.deleteMany({ where: { id: { in: uids } } });
  await prisma.$disconnect();
});

describe("baholash va import (sof mantiq)", () => {
  it("bankdan kerakli sondagi savol tanlanadi, foiz hisoblanadi", () => {
    const qs = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, order: i, options: [{ id: `q${i}a`, order: 0 }, { id: `q${i}b`, order: 1 }] }));
    const layout = buildLayout(qs, { count: 3, shuffleQuestions: true, shuffleOptions: true });
    expect(layout).toHaveLength(3);
    const correct = new Map(layout.map((l) => [l.q, `${l.q}a`]));
    const r = score(layout, new Map([[layout[0].q, `${layout[0].q}a`], [layout[1].q, `${layout[1].q}b`]]), correct);
    expect(r.correctCount).toBe(1);
    expect(r.scorePct).toBe(33.33);
  });

  it("matndan import: yulduzcha to'g'ri javob, xatolar ko'rsatiladi", () => {
    const r = parseQuestions("1. $F = ma$ formulada m nima?\nA) tezlanish\n*B) massa\nC) kuch\nIzoh: m massa\n\n2. Savol\nA) bir\nB) ikki");
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].explanation).toBe("m massa");
    expect(r.errors[0]).toMatch(/2-savol/);
  });
});

describe("admin: test va savollar", () => {
  it("test yaratiladi, savol qo'shiladi va import qilinadi", async () => {
    const t = await request(app).post("/api/admin/tests").set(as(admin)).send({ subjectId, title: "Kinematika testi", questionCount: 3, durationMin: 30 });
    expect(t.status).toBe(200);
    testId = t.body.id;
    const bad = await request(app).post(`/api/admin/tests/${testId}/questions`).set(as(admin)).send({ text: "?", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: true }] });
    expect(bad.status).toBe(400);
    const q = await request(app)
      .post(`/api/admin/tests/${testId}/questions`)
      .set(as(admin))
      .send({ text: "Tezlik formulasi: $v = ?$", explanation: "v = s/t", options: [{ text: "$s/t$", isCorrect: true }, { text: "$s \\cdot t$", isCorrect: false }] });
    expect(q.status).toBe(200);
    const imp = await request(app).post(`/api/admin/tests/${testId}/import`).set(as(admin)).send({ text: "1. 2+2?\n*A) 4\nB) 5\n\n2. 3+3?\nA) 5\n*B) 6" });
    expect(imp.body.created).toBe(2);
    // Variantni tahrirlash: id saqlanadi
    const opt = q.body.options;
    const e = await request(app).patch(`/api/admin/questions/${q.body.id}`).set(as(admin)).send({ text: "Tezlik?", options: [{ id: opt[0].id, text: "$v=s/t$", isCorrect: true }, { id: opt[1].id, text: "boshqa", isCorrect: false }, { text: "uchinchi", isCorrect: false }] });
    expect(e.body.options).toHaveLength(3);
    expect(e.body.options[0].id).toBe(opt[0].id);
  });

  it("nofaol test talabaga ko'rinmaydi, faollashtirilgach ko'rinadi", async () => {
    expect((await request(app).get(`/api/tests/${testId}`).set(as(student))).status).toBe(404);
    await request(app).patch(`/api/admin/tests/${testId}`).set(as(admin)).send({ isActive: true, maxAttempts: 2 });
    const r = await request(app).get(`/api/tests/${testId}`).set(as(student));
    expect(r.body.questionCount).toBe(3);
    expect(r.body.locked).toBe(false);
  });
});

describe("talaba: test topshirish", () => {
  let attemptId = "";

  it("boshlaydi; to'g'ri javoblar yashirin", async () => {
    const s = await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({});
    expect(s.status).toBe(200);
    attemptId = s.body.attemptId;
    // Qayta bosilsa o'sha urinish davom etadi
    expect((await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({})).body.attemptId).toBe(attemptId);
    const v = await request(app).get(`/api/attempts/${attemptId}`).set(as(student));
    expect(v.body.questions).toHaveLength(3);
    expect(v.body.questions[0].options[0].isCorrect).toBeUndefined();
    expect(v.body.result).toBeNull();
  });

  it("javob va belgi saqlanadi, yakunlanadi, natija va o'rin chiqadi", async () => {
    const v = (await request(app).get(`/api/attempts/${attemptId}`).set(as(student))).body;
    const correct = await prisma.option.findMany({ where: { questionId: { in: v.questions.map((q: { id: string }) => q.id) }, isCorrect: true } });
    // 2 tasiga to'g'ri, 1 tasiga belgi qo'yib javobsiz
    for (const q of v.questions.slice(0, 2)) {
      const r = await request(app).put(`/api/attempts/${attemptId}/answers/${q.id}`).set(as(student)).send({ optionId: correct.find((c) => c.questionId === q.id)!.id });
      expect(r.status).toBe(200);
    }
    await request(app).put(`/api/attempts/${attemptId}/answers/${v.questions[2].id}`).set(as(student)).send({ flagged: true });
    const bad = await request(app).put(`/api/attempts/${attemptId}/answers/${v.questions[0].id}`).set(as(student)).send({ optionId: "boshqa" });
    expect(bad.status).toBe(400);
    const f = await request(app).post(`/api/attempts/${attemptId}/finish`).set(as(student));
    expect(f.body.scorePct).toBe(66.67);
    const done = (await request(app).get(`/api/attempts/${attemptId}`).set(as(student))).body;
    expect(done.result.rank).toBe(1);
    expect(done.questions[2].flagged).toBe(true);
    expect(done.questions[0].options.some((o: { isCorrect: boolean }) => o.isCorrect)).toBe(true);
    // Yakunlangandan keyin javob o'zgarmaydi
    expect((await request(app).put(`/api/attempts/${attemptId}/answers/${v.questions[2].id}`).set(as(student)).send({ optionId: null })).status).toBe(400);
  });

  it("vaqt tugasa urinish avtomatik yopiladi; urinishlar chegarasi ishlaydi", async () => {
    const s = await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({});
    await prisma.attempt.update({ where: { id: s.body.attemptId }, data: { deadlineAt: new Date(Date.now() - 1000) } });
    const v = await request(app).get(`/api/attempts/${s.body.attemptId}`).set(as(student));
    expect(v.body.status).toBe("EXPIRED");
    const third = await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({});
    expect(third.status).toBe(400);
    expect(third.body.error.code).toBe("ATTEMPTS_EXCEEDED");
    const hist = await request(app).get("/api/me/attempts").set(as(student));
    expect(hist.body.filter((a: { test: { id: string } }) => a.test.id === testId)).toHaveLength(2);
    const results = await request(app).get(`/api/admin/tests/${testId}/attempts`).set(as(admin));
    expect(results.body[0].scorePct).toBe(66.67);
  });

  it("parol yoki bir martalik kod bilan kiriladi", async () => {
    await request(app).patch(`/api/admin/tests/${testId}`).set(as(admin)).send({ maxAttempts: null, requiresCode: true, password: "fizika2026" });
    expect((await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({})).body.error.code).toBe("CODE_REQUIRED");
    expect((await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({ password: "xato" })).status).toBe(403);
    const ok = await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({ password: "fizika2026" });
    expect(ok.status).toBe(200);
    await request(app).post(`/api/attempts/${ok.body.attemptId}/finish`).set(as(student));
    const codes = await request(app).post(`/api/admin/tests/${testId}/codes`).set(as(admin)).send({ count: 1 });
    const code = codes.body.codes[0];
    const c1 = await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({ code: code.toLowerCase() });
    expect(c1.status).toBe(200);
    await request(app).post(`/api/attempts/${c1.body.attemptId}/finish`).set(as(student));
    expect((await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({ code })).body.error.code).toBe("CODE_USED");
  });

  it("jadval va kursga bog'liqlik tekshiriladi", async () => {
    await request(app).patch(`/api/admin/tests/${testId}`).set(as(admin)).send({ requiresCode: false, opensAt: new Date(Date.now() + 3600_000).toISOString() });
    expect((await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({})).body.error.code).toBe("TEST_NOT_OPEN");
    const course = await prisma.course.create({ data: { subjectId, title: "Pullik", isPaid: true, isPublished: true } });
    await request(app).patch(`/api/admin/tests/${testId}`).set(as(admin)).send({ opensAt: null, courseId: course.id });
    expect((await request(app).get(`/api/tests/${testId}`).set(as(student))).body.locked).toBe(true);
    expect((await request(app).post(`/api/tests/${testId}/start`).set(as(student)).send({})).status).toBe(403);
    expect((await request(app).delete(`/api/admin/tests/${testId}`).set(as(admin))).status).toBe(400);
  });
});
