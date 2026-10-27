// Adminlar: login va parol bilan. Oxirgi faol adminni o'chirib yoki bloklab bo'lmaydi.
import { Router } from "express";
import { z } from "zod";
import { hashPassword, prisma } from "@edu/db";
import { audit, publicUser } from "../../auth/session.js";
import { badRequest, h, notFound } from "../../lib/errors.js";

export const adminsRouter = Router();

const loginField = z.string().trim().toLowerCase().min(3, "Login kamida 3 belgi").max(32).regex(/^[a-z0-9_.-]+$/, "Loginda faqat lotin harflari, raqam, _ . -");
const passwordField = z.string().min(8, "Parol kamida 8 belgi").max(100);
const nameField = z.string().trim().min(1, "Ismni kiriting").max(60);

adminsRouter.get(
  "/admins",
  h(async (_req, res) => res.json((await prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } })).map(publicUser))),
);

adminsRouter.post(
  "/admins",
  h(async (req, res) => {
    const d = z.object({ login: loginField, password: passwordField, firstName: nameField, lastName: z.string().trim().max(60).default("") }).parse(req.body);
    if (await prisma.user.findUnique({ where: { login: d.login } })) throw badRequest("LOGIN_TAKEN", "Bu login band");
    const u = await prisma.user.create({
      data: { role: "ADMIN", login: d.login, passwordHash: hashPassword(d.password), firstName: d.firstName, lastName: d.lastName, profileCompleted: true },
    });
    await audit(req.user!.id, "admin.create", "User", u.id, { login: d.login });
    res.json(publicUser(u));
  }),
);

async function activeAdminsExcept(id: string) {
  return prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", NOT: { id } } });
}

adminsRouter.patch(
  "/admins/:id",
  h(async (req, res) => {
    const d = z
      .object({ firstName: nameField.optional(), lastName: z.string().trim().max(60).optional(), password: passwordField.optional(), status: z.enum(["ACTIVE", "BLOCKED"]).optional() })
      .parse(req.body);
    const target = await prisma.user.findFirst({ where: { id: req.params.id, role: "ADMIN" } });
    if (!target) throw notFound("Admin topilmadi");
    if (d.status === "BLOCKED") {
      if (target.id === req.user!.id) throw badRequest("SELF", "O'zingizni bloklay olmaysiz");
      if ((await activeAdminsExcept(target.id)) === 0) throw badRequest("LAST_ADMIN", "Oxirgi adminni bloklab bo'lmaydi");
    }
    const { password, ...rest } = d;
    const u = await prisma.user.update({
      where: { id: target.id },
      data: { ...rest, ...(password ? { passwordHash: hashPassword(password), failedLogins: 0, lockedUntil: null } : {}) },
    });
    await audit(req.user!.id, "admin.update", "User", u.id, { ...rest, password: password ? "***" : undefined });
    res.json(publicUser(u));
  }),
);

adminsRouter.delete(
  "/admins/:id",
  h(async (req, res) => {
    const target = await prisma.user.findFirst({ where: { id: req.params.id, role: "ADMIN" } });
    if (!target) throw notFound("Admin topilmadi");
    if (target.id === req.user!.id) throw badRequest("SELF", "O'zingizni o'chira olmaysiz");
    if ((await activeAdminsExcept(target.id)) === 0) throw badRequest("LAST_ADMIN", "Oxirgi adminni o'chirib bo'lmaydi");
    // Admin yaratgan yozuvlar (ruxsatlar, audit) saqlanib qolishi uchun hisob o'chirilmaydi, bloklanadi va login bo'shatiladi
    await prisma.user.update({ where: { id: target.id }, data: { status: "BLOCKED", login: null, passwordHash: null } });
    await audit(req.user!.id, "admin.delete", "User", target.id, { login: target.login });
    res.json({ ok: true });
  }),
);
