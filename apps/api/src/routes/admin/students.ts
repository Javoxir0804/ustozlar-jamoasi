import { Router } from "express";
import { z } from "zod";
import { prisma, type Prisma } from "@edu/db";
import { audit, publicUser } from "../../auth/session.js";
import { h, notFound } from "../../lib/errors.js";

export const studentsRouter = Router();

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// Bosh panel raqamlari
studentsRouter.get(
  "/dashboard",
  h(async (_req, res) => {
    const dayAgo = new Date(Date.now() - 86_400_000);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const student = { role: "STUDENT" as const };
    const [students, completed, newToday, newWeek, activeToday, blocked, admins, recent] = await Promise.all([
      prisma.user.count({ where: student }),
      prisma.user.count({ where: { ...student, profileCompleted: true } }),
      prisma.user.count({ where: { ...student, createdAt: { gt: dayAgo } } }),
      prisma.user.count({ where: { ...student, createdAt: { gt: weekAgo } } }),
      prisma.user.count({ where: { ...student, lastActiveAt: { gt: dayAgo } } }),
      prisma.user.count({ where: { ...student, status: "BLOCKED" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.findMany({ where: student, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);
    res.json({ students, completed, newToday, newWeek, activeToday, blocked, admins, recent: recent.map(publicUser) });
  }),
);

studentsRouter.get(
  "/students",
  h(async (req, res) => {
    const q = str(req.query.q);
    const status = str(req.query.status);
    const region = str(req.query.region);
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = 30;
    const where: Prisma.UserWhereInput = {
      role: "STUDENT",
      ...(status === "ACTIVE" || status === "BLOCKED" ? { status } : {}),
      ...(status === "INCOMPLETE" ? { profileCompleted: false } : {}),
      ...(region ? { region } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q.replace(/[^\d+]/g, "") || q } },
              { telegramUsername: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
              { institution: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
      prisma.user.count({ where }),
    ]);
    res.json({ items: items.map(publicUser), total, page, pageSize: take });
  }),
);

studentsRouter.get(
  "/students/:id",
  h(async (req, res) => {
    const u = await prisma.user.findFirst({ where: { id: req.params.id, role: "STUDENT" } });
    if (!u) throw notFound("Talaba topilmadi");
    res.json(publicUser(u));
  }),
);

// Bloklash yoki blokdan chiqarish
studentsRouter.patch(
  "/students/:id",
  h(async (req, res) => {
    const { status } = z.object({ status: z.enum(["ACTIVE", "BLOCKED"]) }).parse(req.body);
    const u = await prisma.user.findFirst({ where: { id: req.params.id, role: "STUDENT" } });
    if (!u) throw notFound("Talaba topilmadi");
    const updated = await prisma.user.update({ where: { id: u.id }, data: { status } });
    await audit(req.user!.id, status === "BLOCKED" ? "student.block" : "student.unblock", "User", u.id);
    res.json(publicUser(updated));
  }),
);
