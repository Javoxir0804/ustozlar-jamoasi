// Ochiq: sertifikatni tekshirish va PDF; reyting (Top 10). Talaba: o'z sertifikatlari.
import { Router } from "express";
import { prisma } from "@edu/db";
import { requireAuth } from "../auth/session.js";
import { h } from "../lib/errors.js";
import { getTemplate, lookupCertificate, renderCertificatePdf } from "../services/certificates.js";
import { leaderboard } from "../services/leaderboard.js";

export const certificatesRouter = Router();

certificatesRouter.get(
  "/certificates/:number",
  h(async (req, res) => {
    // Ochiq sahifa: ism, muassasa, viloyat va natija (telefon va manzil berilmaydi)
    res.json(await lookupCertificate(req.params.number));
  }),
);

certificatesRouter.get(
  "/certificates/:number/pdf",
  h(async (req, res) => {
    const c = await lookupCertificate(req.params.number);
    const pdf = await renderCertificatePdf(c, await getTemplate());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="sertifikat-${c.number}.pdf"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.end(pdf);
  }),
);

certificatesRouter.get(
  "/me/certificates",
  requireAuth,
  h(async (req, res) => {
    const rows = await prisma.certificate.findMany({
      where: { userId: req.user!.id },
      orderBy: { issuedAt: "desc" },
      include: { attempt: { select: { scorePct: true, test: { select: { title: true, subject: { select: { name: true } } } } } } },
    });
    res.json(rows.map((c) => ({ number: c.number, issuedAt: c.issuedAt, scorePct: c.attempt.scorePct, test: c.attempt.test.title, subject: c.attempt.test.subject.name })));
  }),
);

// Har bir faol fan bo'yicha Top 10
certificatesRouter.get(
  "/leaderboard",
  h(async (_req, res) => {
    const subjects = await prisma.subject.findMany({ where: { isActive: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } });
    const out = [];
    for (const s of subjects) out.push({ subject: s, rows: await leaderboard({ subjectId: s.id }) });
    res.json(out.filter((x) => x.rows.length));
  }),
);

certificatesRouter.get("/tests/:id/leaderboard", h(async (req, res) => res.json(await leaderboard({ testId: req.params.id }))));
