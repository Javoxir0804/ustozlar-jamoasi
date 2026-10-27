// Sertifikat shabloni (sarlavha, tashkilot, imzo, fon, minimal ball) va berilgan sertifikatlar.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@edu/db";
import { audit, publicUser } from "../../auth/session.js";
import { h } from "../../lib/errors.js";
import { getTemplate, renderCertificatePdf, SAMPLE } from "../../services/certificates.js";

export const certificatesAdminRouter = Router();

const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
const tplSchema = z.object({
  title: z.string().trim().min(1, "Sarlavhani kiriting").max(40),
  organization: optText(120),
  signerName: optText(80),
  backgroundFileId: z.string().nullish().transform((v) => v || null),
  minScorePct: z.number().min(1, "Minimal natija kamida 1%").max(100),
  isActive: z.boolean(),
});

certificatesAdminRouter.get("/certificate-template", h(async (_req, res) => res.json(await getTemplate())));

certificatesAdminRouter.put(
  "/certificate-template",
  h(async (req, res) => {
    const d = tplSchema.parse(req.body);
    const tpl = await getTemplate();
    const updated = await prisma.certificateTemplate.update({ where: { id: tpl.id }, data: d });
    await audit(req.user!.id, "certificate.template");
    res.json(updated);
  }),
);

// Namuna PDF (saqlanmagan sozlamalar bilan ham ko'rish uchun so'rov parametrlarini qabul qiladi)
certificatesAdminRouter.get(
  "/certificate-template/preview",
  h(async (_req, res) => {
    const pdf = await renderCertificatePdf({ ...SAMPLE, issuedAt: new Date() }, await getTemplate());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="namuna.pdf"');
    res.end(pdf);
  }),
);

certificatesAdminRouter.get(
  "/certificates",
  h(async (_req, res) => {
    const rows = await prisma.certificate.findMany({
      orderBy: { issuedAt: "desc" },
      take: 500,
      include: { user: true, attempt: { select: { scorePct: true, test: { select: { title: true } } } } },
    });
    res.json(rows.map((c) => ({ number: c.number, issuedAt: c.issuedAt, scorePct: c.attempt.scorePct, test: c.attempt.test.title, user: publicUser(c.user) })));
  }),
);
