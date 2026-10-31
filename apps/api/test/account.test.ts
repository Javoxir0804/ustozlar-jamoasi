// Admin o'z profilini tahrirlaydi: ism, login (joriy parol bilan), parol.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword, prisma } from "@edu/db";
import { createApp } from "../src/app.js";
import { signToken } from "../src/auth/session.js";

const app = createApp();
const tag = `p${Date.now()}`;
let token = "";
let id = "";

beforeAll(async () => {
  const a = await prisma.user.create({ data: { role: "ADMIN", login: `${tag}a`, passwordHash: hashPassword("eski-parol-1"), firstName: "Bosh", lastName: "Admin", profileCompleted: true } });
  await prisma.user.create({ data: { role: "ADMIN", login: `${tag}b`, firstName: "B", profileCompleted: true } });
  id = a.id;
  token = signToken(a.id);
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { login: { startsWith: tag } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [id, ...users.map((u) => u.id)] } } });
  await prisma.user.deleteMany({ where: { OR: [{ id }, { login: { startsWith: tag } }] } });
  await prisma.$disconnect();
});

describe("admin profili", () => {
  const as = () => ({ authorization: `Bearer ${token}` });

  it("ism parolsiz o'zgaradi", async () => {
    const r = await request(app).patch("/api/auth/me/account").set(as()).send({ firstName: "Javoxir", lastName: "Aliyev", login: `${tag}a` });
    expect(r.status).toBe(200);
    expect(r.body.firstName).toBe("Javoxir");
  });

  it("login faqat to'g'ri joriy parol bilan va band bo'lmasa o'zgaradi", async () => {
    const base = { firstName: "Javoxir", lastName: "Aliyev" };
    expect((await request(app).patch("/api/auth/me/account").set(as()).send({ ...base, login: `${tag}yangi` })).status).toBe(400);
    expect((await request(app).patch("/api/auth/me/account").set(as()).send({ ...base, login: `${tag}yangi`, current: "xato" })).status).toBe(400);
    const taken = await request(app).patch("/api/auth/me/account").set(as()).send({ ...base, login: `${tag}b`, current: "eski-parol-1" });
    expect(taken.body.error.code).toBe("LOGIN_TAKEN");
    const ok = await request(app).patch("/api/auth/me/account").set(as()).send({ ...base, login: `${tag.toUpperCase()}Yangi`, current: "eski-parol-1" });
    expect(ok.status).toBe(200);
    expect(ok.body.login).toBe(`${tag}yangi`);
    const login = await request(app).post("/api/auth/admin/login").send({ login: `${tag}yangi`, password: "eski-parol-1" });
    expect(login.status).toBe(200);
  });

  it("talaba bu bo'limdan foydalana olmaydi", async () => {
    const s = await prisma.user.create({ data: { firstName: "S", login: `${tag}s`, profileCompleted: true } });
    const r = await request(app).patch("/api/auth/me/account").set({ authorization: `Bearer ${signToken(s.id)}` }).send({ firstName: "X", login: `${tag}s` });
    expect(r.status).toBe(400);
  });
});
