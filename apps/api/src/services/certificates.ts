import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { prisma, type Attempt } from "@att/db";
import { env } from "../env.js";
import { notFound } from "../lib/errors.js";

function newNumber() {
  const year = new Date().getFullYear();
  return `ATT-${year}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Yakunlangan urinishga sertifikat beradi (shablondagi minimal balldan past bo'lmasa). */
export async function issueCertificateIfEligible(attempt: Attempt) {
  if (attempt.status === "IN_PROGRESS" || attempt.scorePct == null) return null;
  const template = await prisma.certificateTemplate.findFirst({ where: { isActive: true } });
  if (attempt.scorePct < (template?.minScorePct ?? 0)) return null;
  const existing = await prisma.certificate.findUnique({ where: { attemptId: attempt.id } });
  if (existing) return existing;
  return prisma.certificate.create({ data: { number: newNumber(), attemptId: attempt.id, userId: attempt.userId } });
}

export function verifyUrl(number: string) {
  return `${env.publicWebUrl}/verify/${encodeURIComponent(number)}`;
}

/** Ochiq tekshiruv: sertifikat haqiqiymi va kimga berilgan. */
export async function lookupCertificate(number: string) {
  const cert = await prisma.certificate.findUnique({
    where: { number },
    include: {
      user: { select: { firstName: true, lastName: true, school: true, region: true } },
      attempt: { select: { scorePct: true, correctCount: true, totalCount: true, finishedAt: true, test: { select: { title: true, subject: { select: { name: true } } } } } },
    },
  });
  if (!cert) throw notFound("Sertifikat topilmadi");
  return {
    number: cert.number,
    issuedAt: cert.issuedAt,
    fullName: `${cert.user.lastName} ${cert.user.firstName}`,
    school: cert.user.school,
    region: cert.user.region,
    subject: cert.attempt.test.subject.name,
    test: cert.attempt.test.title,
    scorePct: cert.attempt.scorePct,
    correct: cert.attempt.correctCount,
    total: cert.attempt.totalCount,
  };
}

/** PDF sertifikat. Shablon (fon rasmi, joylashuv) keyingi bosqichda admin paneldan sozlanadi. */
export async function renderCertificatePdf(number: string): Promise<Buffer> {
  const c = await lookupCertificate(number);
  const qr = await QRCode.toBuffer(verifyUrl(c.number), { margin: 1, width: 300 });
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (d: Buffer) => chunks.push(d));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width;
  doc.rect(20, 20, W - 40, doc.page.height - 40).lineWidth(3).stroke("#7C3AED");
  doc.fontSize(40).fillColor("#111").text("SERTIFIKAT", 0, 90, { align: "center", width: W });
  doc.fontSize(16).fillColor("#555").text("Ushbu sertifikat", 0, 160, { align: "center", width: W });
  doc.fontSize(30).fillColor("#111").text(c.fullName, 0, 190, { align: "center", width: W });
  doc
    .fontSize(16)
    .fillColor("#333")
    .text(`${c.subject} fanidan "${c.test}" testini ${c.scorePct}% natija bilan`, 80, 250, { align: "center", width: W - 160 })
    .text(`(${c.correct}/${c.total} to'g'ri javob) topshirgani uchun berildi.`, { align: "center", width: W - 160 });
  doc.fontSize(12).fillColor("#555").text(`Sertifikat ID: ${c.number}`, 60, 470).text(`Sana: ${c.issuedAt.toISOString().slice(0, 10)}`, 60, 490);
  doc.image(qr, W - 190, 400, { width: 120 });
  doc.fontSize(9).text("Tekshirish uchun skanerlang", W - 205, 525, { width: 150, align: "center" });
  doc.end();
  return done;
}
