// Qo'lda to'lov: chek yuborish -> admin tasdiqlaydi -> obuna yoqiladi (faqat bir marta).
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@att/db";
import { createApp } from "../src/app.js";

const app = createApp();
const bot = { "x-bot-key": "botkey" };
const base = 800000000 + Math.floor(Math.random() * 1000000);
const USER_TG = base, ADMIN_TG = base + 1;

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { telegramId: { in: [BigInt(USER_TG), BigInt(ADMIN_TG)] } } });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.subscription.deleteMany({ where: { userId: { in: ids } } });
  await prisma.plan.deleteMany({ where: { name: `t-${base}` } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("qo'lda to'lov", () => {
  it("chek tasdiqlansa obuna tarif muddatiga yoqiladi", async () => {
    const plan = await prisma.plan.create({ data: { name: `t-${base}`, priceUzs: 99000, days: 30 } });
    await request(app).post("/api/bot/users").set(bot).send({ telegramId: String(USER_TG), firstName: "Ali", lastName: "V", phone: "+998901112233" }).expect(200);
    await prisma.user.create({ data: { telegramId: BigInt(ADMIN_TG), firstName: "Admin", lastName: "A", role: "ADMIN", registered: true } });

    const pay = await request(app).post("/api/bot/payments").set(bot).send({ telegramId: String(USER_TG), planId: plan.id, receiptFileId: "file123" });
    expect(pay.status).toBe(200);
    expect(pay.body.amountUzs).toBe(99000);

    // Oddiy foydalanuvchi o'zi tasdiqlay olmaydi
    const self = await request(app).post(`/api/bot/payments/${pay.body.id}/review`).set(bot).send({ adminTelegramId: String(USER_TG), approve: true });
    expect(self.status).toBe(403);

    const ok = await request(app).post(`/api/bot/payments/${pay.body.id}/review`).set(bot).send({ adminTelegramId: String(ADMIN_TG), approve: true });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("PAID");
    const days = (new Date(ok.body.subscriptionEndsAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);

    const twice = await request(app).post(`/api/bot/payments/${pay.body.id}/review`).set(bot).send({ adminTelegramId: String(ADMIN_TG), approve: true });
    expect(twice.body.error.code).toBe("ALREADY_REVIEWED");

    const u = await request(app).get(`/api/bot/users/${USER_TG}`).set(bot);
    expect(u.body.subscriptionEndsAt).toBeTruthy();
  });
});
