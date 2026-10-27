// 4-bosqich: sertifikat berish (chegara, shablon), ochiq tekshirish, PDF, Top 10 reyting.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@edu/db";
import { createApp } from "../src/app.js";
import { signToken } from "../src/auth/session.js";

const app = createApp();
const tag = `z${Date.now()}`;
const as = (t: string) => ({ authorization: `Bearer ${t}` });
let admin = "";
const students: { id: string; token: string }[] = [];
let subjectId = "";
let testId = "";
let tplBefore: { minScorePct: number; isActive: boolean } | null = null;

// Talaba testni `right` ta to'g'ri javob bilan topshiradi (testda 2 savol)
async function take(token: string, right: number) {
  const s = await request(app).post(`/api/tests/${testId}/start`).set(as(token)).send({});
  const v = (await request(app).get(`/api/attempts/${s.body.attemptId}`).set(as(token))).body;
  for (const [i, q] of v.questions.entries()) {
    const opts = await prisma.option.findMany({ where: { questionId: q.id } });
    const pick = opts.find((o) => o.isCorrect === i < right)!;
    await request(app).put(`/api/attempts/${s.body.attemptId}/answers/${q.id}`).set(as(token)).send({ optionId: pick.id });
  }
  await request(app).post(`/api/attempts/${s.body.attemptId}/finish`).set(as(token));
  return (await request(app).get(`/api/attempts/${s.body.attemptId}`).set(as(token))).body;
}

beforeAll(async () => {
  const a = await prisma.user.create({ data: { role: "ADMIN", login: `${tag}a`, firstName: "A", profileCompleted: true } });
  admin = signToken(a.id);
  for (const n of ["Birinchi", "Ikkinchi", "Uchinchi"]) {
    const u = await prisma.user.create({ data: { firstName: n, lastName: tag, profileCompleted: true } });
    students.push({ id: u.id, token: signToken(u.id) });
  }
  subjectId = (await prisma.subject.create({ data: { name: `Fan ${tag}`, slug: tag } })).id;
  const t = await prisma.test.create({
    data: {
      subjectId,
      title: "Sertifikat testi",
      questionCount: 2,
      isActive: true,
      questions: {
        create: [0, 1].map((i) => ({ text: `S${i}`, order: i, options: { create: [{ text: "ha", isCorrect: true, order: 0 }, { text: "yo'q", isCorrect: false, order: 1 }] } })),
      },
    },
  });
  testId = t.id;
  const tpl = (await request(app).get("/api/admin/certificate-template").set(as(admin))).body;
  tplBefore = { minScorePct: tpl.minScorePct, isActive: tpl.isActive };
  await request(app).put("/api/admin/certificate-template").set(as(admin)).send({ ...tpl, minScorePct: 60, isActive: true });
});

afterAll(async () => {
  const tpl = await prisma.certificateTemplate.findFirst({ orderBy: { updatedAt: "desc" } });
  if (tpl && tplBefore) await prisma.certificateTemplate.update({ where: { id: tpl.id }, data: tplBefore });
  const ids = [...students.map((s) => s.id)];
  await prisma.certificate.deleteMany({ where: { userId: { in: ids } } });
  await prisma.attempt.deleteMany({ where: { testId } });
  await prisma.test.deleteMany({ where: { id: testId } });
  await prisma.subject.deleteMany({ where: { id: subjectId } });
  await prisma.auditLog.deleteMany({ where: { actor: { login: `${tag}a` } } });
  await prisma.user.deleteMany({ where: { OR: [{ id: { in: ids } }, { login: `${tag}a` }] } });
  await prisma.$disconnect();
});

describe("sertifikat", () => {
  let number = "";

  it("chegaradan yuqori natijaga sertifikat beriladi, pastiga yo'q", async () => {
    const good = await take(students[0].token, 2);
    expect(good.result.scorePct).toBe(100);
    expect(good.result.certificate).toMatch(/^UJ-\d{4}-[0-9A-F]{8}$/);
    number = good.result.certificate;
    const bad = await take(students[1].token, 0);
    expect(bad.result.certificate).toBeNull();
    const mine = await request(app).get("/api/me/certificates").set(as(students[0].token));
    expect(mine.body[0].number).toBe(number);
  });

  it("ochiq tekshirish va PDF ishlaydi, soxta raqam topilmaydi", async () => {
    const v = await request(app).get(`/api/certificates/${number.toLowerCase()}`);
    expect(v.status).toBe(200);
    expect(v.body.fullName).toBe(`${tag} Birinchi`);
    expect(v.body.phone).toBeUndefined();
    const pdf = await request(app).get(`/api/certificates/${number}/pdf`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
    expect((await request(app).get("/api/certificates/UJ-2000-00000000")).status).toBe(404);
  });

  it("shablon o'chirilsa sertifikat berilmaydi", async () => {
    const tpl = (await request(app).get("/api/admin/certificate-template").set(as(admin))).body;
    await request(app).put("/api/admin/certificate-template").set(as(admin)).send({ ...tpl, isActive: false });
    const r = await take(students[2].token, 2);
    expect(r.result.certificate).toBeNull();
    await request(app).put("/api/admin/certificate-template").set(as(admin)).send({ ...tpl, isActive: true });
  });
});

describe("reyting", () => {
  it("fan bo'yicha eng yaxshi natijalar, teng ballda oldin topshirgan yuqorida", async () => {
    const r = await request(app).get("/api/leaderboard");
    const mine = r.body.find((x: { subject: { id: string } }) => x.subject.id === subjectId);
    expect(mine.rows.map((x: { fullName: string }) => x.fullName)).toEqual([`${tag} Birinchi`, `${tag} Uchinchi`, `${tag} Ikkinchi`]);
    const byTest = await request(app).get(`/api/tests/${testId}/leaderboard`);
    expect(byTest.body).toHaveLength(3);
  });
});
