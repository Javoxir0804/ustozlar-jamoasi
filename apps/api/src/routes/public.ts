import { Router } from "express";
import { prisma } from "@edu/db";
import { env } from "../env.js";
import { h } from "../lib/errors.js";
import { REGIONS } from "../services/profile.js";

export const publicRouter = Router();

export const PUBLIC_SETTINGS = ["site", "contacts", "about"] as const;

// Sayt ochilganda bitta so'rov: bot nomi (Telegram tugmasi uchun), sayt matnlari, aloqa, viloyatlar
publicRouter.get(
  "/config",
  h(async (_req, res) => {
    const rows = await prisma.setting.findMany({ where: { key: { in: [...PUBLIC_SETTINGS] } } });
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ botUsername: env.botUsername || null, site: s.site ?? null, contacts: s.contacts ?? null, about: s.about ?? null, regions: REGIONS });
  }),
);

// Bosh sahifa hisoblagichlari
publicRouter.get(
  "/stats",
  h(async (_req, res) => {
    const [students, lessons, tests, certificates] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE", profileCompleted: true } }),
      prisma.lesson.count({ where: { isPublished: true, module: { course: { isPublished: true } } } }),
      prisma.test.count({ where: { isActive: true } }),
      prisma.certificate.count(),
    ]);
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ students, lessons, tests, certificates });
  }),
);
