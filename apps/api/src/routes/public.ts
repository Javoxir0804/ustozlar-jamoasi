import { Router } from "express";
import { prisma } from "@att/db";
import { h, notFound } from "../lib/errors.js";
import { lookupCertificate } from "../services/certificates.js";
import { subjectLeaderboard } from "../services/leaderboard.js";

export const publicRouter = Router();

// Sertifikatni ID orqali tekshirish (QR-kod shu manzilga olib boradi)
publicRouter.get(
  "/certificates/:number",
  h(async (req, res) => {
    res.json(await lookupCertificate(req.params.number));
  }),
);

publicRouter.get(
  "/leaderboard/:subjectId",
  h(async (req, res) => {
    res.json(await subjectLeaderboard(req.params.subjectId, Math.min(Number(req.query.limit ?? 10), 100)));
  }),
);

// Aloqa, litsey haqida va boshqa ochiq sozlamalar
const PUBLIC_KEYS = new Set(["contacts", "about", "payment"]);
publicRouter.get(
  "/settings/:key",
  h(async (req, res) => {
    if (!PUBLIC_KEYS.has(req.params.key)) throw notFound();
    const s = await prisma.setting.findUnique({ where: { key: req.params.key } });
    res.json(s?.value ?? null);
  }),
);
