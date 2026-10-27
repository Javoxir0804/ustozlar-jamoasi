// To'liq oqim: bot orqali ro'yxat -> Web App orqali kirish -> test -> natija -> sertifikat. Haqiqiy PostgreSQL kerak.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@att/db";
import { createApp } from "../src/app.js";
import { signInitData } from "./helpers.js";

const app = createApp();
const TG = 900000000 + Math.floor(Math.random() * 1000000);
let token = "";
let testId = "";

beforeAll(async () => {
  const subject = await prisma.subject.create({ data: { name: "Test fan", slug: `t-${TG}` } });
  const t = await prisma.test.create({
    data: {
      subjectId: subject.id, title: "Oqim testi", questionCount: 2, isActive: true, requiresCode: true, maxAttempts: 2,
      questions: {
        create: [1, 2, 3].map((n) => ({ text: `Savol ${n}`, order: n, options: { create: [{ text: "to'g'ri", isCorrect: true }, { text: "xato" }] } })),
      },
    },
  });
  testId = t.id;
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(TG) } });
  if (user) {
    await prisma.certificate.deleteMany({ where: { userId: user.id } });
    await prisma.attempt.deleteMany({ where: { userId: user.id } });
    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  const t = await prisma.test.findUnique({ where: { id: testId } });
  await prisma.test.delete({ where: { id: testId } });
  await prisma.subject.delete({ where: { id: t!.subjectId } });
  await prisma.$disconnect();
});

describe("asosiy oqim", () => {
  it("ro'yxatdan o'tmagan foydalanuvchi saytga kira olmaydi", async () => {
    const r = await request(app).post("/api/auth/telegram/webapp").send({ initData: signInitData({ id: TG }) });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("NOT_REGISTERED");
  });

  it("bot ro'yxatdan o'tkazadi, keyin Web App orqali kiradi", async () => {
    const reg = await request(app).post("/api/bot/users").set("x-bot-key", "botkey").send({
      telegramId: String(TG), firstName: "Ali", lastName: "Valiyev", phone: "+998 90 123-45-67", region: "Toshkent", school: "1-maktab", grade: "Oliy toifa",
    });
    expect(reg.status).toBe(200);
    expect(reg.body.phone).toBe("+998901234567");
    const r = await request(app).post("/api/auth/telegram/webapp").send({ initData: signInitData({ id: TG }) });
    expect(r.status).toBe(200);
    token = r.body.token;
  });

  it("obunasiz pullik test ochilmaydi", async () => {
    const r = await request(app).post(`/api/tests/${testId}/start`).set("authorization", `Bearer ${token}`).send({});
    expect(r.status).toBe(402);
  });

  it("kod bilan test ishlanadi, baholanadi va sertifikat beriladi", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: BigInt(TG) } });
    await prisma.subscription.create({ data: { userId: user.id, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000) } });
    const auth = { authorization: `Bearer ${token}` };

    expect((await request(app).post(`/api/tests/${testId}/start`).set(auth).send({})).status).toBe(403);
    const { body: codes } = await request(app).post(`/api/admin/tests/${testId}/codes`).set(auth).send({ count: 1 });
    expect(codes.error?.code).toBe("FORBIDDEN"); // oddiy foydalanuvchi admin emas
    const code = await prisma.accessCode.create({ data: { code: `C${TG}`, testId } });

    const start = await request(app).post(`/api/tests/${testId}/start`).set(auth).send({ code: code.code });
    expect(start.status).toBe(200);
    const attemptId = start.body.attemptId;

    const view = await request(app).get(`/api/attempts/${attemptId}`).set(auth);
    expect(view.body.questions).toHaveLength(2);
    expect(view.body.questions[0].options[0].isCorrect).toBeUndefined(); // javob oshkor emas

    const [q1, q2] = view.body.questions;
    const right = await prisma.option.findFirstOrThrow({ where: { questionId: q1.id, isCorrect: true } });
    await request(app).put(`/api/attempts/${attemptId}/answers/${q1.id}`).set(auth).send({ optionId: right.id }).expect(200);
    await request(app).put(`/api/attempts/${attemptId}/answers/${q2.id}`).set(auth).send({ flagged: true }).expect(200);

    const fin = await request(app).post(`/api/attempts/${attemptId}/finish`).set(auth);
    expect(fin.body.status).toBe("FINISHED");
    expect(fin.body.result.scorePct).toBe(50);
    expect(fin.body.result.rank).toBe(1);
    expect(fin.body.result.certificate).toMatch(/^ATT-/);

    // Kod bir martalik: qayta ishlatib bo'lmaydi
    const again = await request(app).post(`/api/tests/${testId}/start`).set(auth).send({ code: code.code });
    expect(again.status).toBe(403);

    const verify = await request(app).get(`/api/public/certificates/${fin.body.result.certificate}`);
    expect(verify.body.fullName).toBe("Valiyev Ali");

    const pdf = await request(app).get(`/api/me/certificates/${fin.body.result.certificate}.pdf`).set(auth);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.body.length).toBeGreaterThan(1000);
  });
});
