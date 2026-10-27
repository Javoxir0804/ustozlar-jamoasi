// 1-bosqich: Telegram orqali kirish, anketa, admin login-paroli va bloklash. Haqiqiy PostgreSQL kerak.
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { hashPassword, prisma } from "@edu/db";
import { createApp } from "../src/app.js";
import { signInitData, signWidget } from "./helpers.js";

const app = createApp();
const TG = 700000000 + Math.floor(Math.random() * 1_000_000);
const login = `t${Date.now()}`;
const created: string[] = [];

const profile = {
  firstName: "Ali",
  lastName: "Valiyev",
  phone: "90 123 45 67",
  region: "Toshkent shahri",
  district: "Yunusobod",
  address: "Amir Temur 1",
  institution: "12-maktab",
  grade: "Oliy toifa",
};

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { OR: [{ telegramId: BigInt(TG) }, { id: { in: created } }, { login: { startsWith: login } }] } });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }] } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("talaba: Telegram orqali kirish", () => {
  let token = "";

  it("soxta imzo rad etiladi", async () => {
    const r = await request(app).post("/api/auth/telegram/widget").send({ id: TG, auth_date: Math.floor(Date.now() / 1000), hash: "00" });
    expect(r.status).toBe(401);
  });

  it("birinchi kirishda hisob yaratiladi, anketa to'ldirilmagan", async () => {
    const r = await request(app).post("/api/auth/telegram/widget").send(signWidget({ id: TG, first_name: "Ali", username: "ali_t", auth_date: Math.floor(Date.now() / 1000) }));
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe("STUDENT");
    expect(r.body.user.profileCompleted).toBe(false);
    expect(r.body.user.telegramId).toBe(String(TG));
    token = r.body.token;
  });

  it("anketa tekshiriladi va saqlanadi, telefon formatlanadi", async () => {
    const bad = await request(app).put("/api/auth/me/profile").set("authorization", `Bearer ${token}`).send({ ...profile, region: "Mars" });
    expect(bad.status).toBe(400);
    const r = await request(app).put("/api/auth/me/profile").set("authorization", `Bearer ${token}`).send(profile);
    expect(r.status).toBe(200);
    expect(r.body.profileCompleted).toBe(true);
    expect(r.body.phone).toBe("+998901234567");
  });

  it("bot Web App orqali o'sha hisobga kiradi (qayta ro'yxatsiz)", async () => {
    const r = await request(app).post("/api/auth/telegram/webapp").send({ initData: signInitData({ id: TG, first_name: "Ali" }) });
    expect(r.status).toBe(200);
    expect(r.body.user.profileCompleted).toBe(true);
    expect(r.body.user.lastName).toBe("Valiyev");
  });

  it("talaba admin bo'limiga kira olmaydi", async () => {
    const r = await request(app).get("/api/admin/dashboard").set("authorization", `Bearer ${token}`);
    expect(r.status).toBe(403);
  });
});

describe("admin: login va parol", () => {
  let adminToken = "";

  it("noto'g'ri parol rad etiladi, to'g'risi bilan kiradi", async () => {
    const a = await prisma.user.create({ data: { role: "ADMIN", login, passwordHash: hashPassword("parol12345"), firstName: "Test", profileCompleted: true } });
    created.push(a.id);
    expect((await request(app).post("/api/auth/admin/login").send({ login, password: "xato" })).status).toBe(401);
    const r = await request(app).post("/api/auth/admin/login").send({ login: login.toUpperCase(), password: "parol12345" });
    expect(r.status).toBe(200);
    adminToken = r.body.token;
  });

  it("5 marta xato kiritilsa login bloklanadi", async () => {
    const lg = `${login}x`;
    const a = await prisma.user.create({ data: { role: "ADMIN", login: lg, passwordHash: hashPassword("parol12345"), profileCompleted: true } });
    created.push(a.id);
    for (let i = 0; i < 4; i++) expect((await request(app).post("/api/auth/admin/login").send({ login: lg, password: "xato" })).status).toBe(401);
    expect((await request(app).post("/api/auth/admin/login").send({ login: lg, password: "xato" })).status).toBe(423);
    expect((await request(app).post("/api/auth/admin/login").send({ login: lg, password: "parol12345" })).status).toBe(423);
  });

  it("admin yangi admin qo'shadi, talabani bloklaydi", async () => {
    const auth = { authorization: `Bearer ${adminToken}` };
    const n = await request(app).post("/api/admin/admins").set(auth).send({ login: `${login}n`, password: "yangi12345", firstName: "Yangi" });
    expect(n.status).toBe(200);
    created.push(n.body.id);
    expect((await request(app).post("/api/auth/admin/login").send({ login: `${login}n`, password: "yangi12345" })).status).toBe(200);

    const dash = await request(app).get("/api/admin/dashboard").set(auth);
    expect(dash.body.students).toBeGreaterThan(0);

    const student = await prisma.user.findUniqueOrThrow({ where: { telegramId: BigInt(TG) } });
    const list = await request(app).get("/api/admin/students?q=Valiyev").set(auth);
    expect(list.body.items.some((u: { id: string }) => u.id === student.id)).toBe(true);
    await request(app).patch(`/api/admin/students/${student.id}`).set(auth).send({ status: "BLOCKED" }).expect(200);
    const r = await request(app).post("/api/auth/telegram/webapp").send({ initData: signInitData({ id: TG }) });
    expect(r.body.error.code).toBe("BLOCKED");
  });

  it("admin o'zini o'chira olmaydi", async () => {
    const me = await request(app).get("/api/auth/me").set("authorization", `Bearer ${adminToken}`);
    const r = await request(app).delete(`/api/admin/admins/${me.body.id}`).set("authorization", `Bearer ${adminToken}`);
    expect(r.body.error.code).toBe("SELF");
  });
});
