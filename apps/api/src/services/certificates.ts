// Sertifikatlar: yakunlangan urinishga avtomatik berish, ochiq tekshirish va PDF (QR kod bilan).
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { prisma, type Attempt, type CertificateTemplate } from "@edu/db";
import { env } from "../env.js";
import { notFound } from "../lib/errors.js";

const FONTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets/fonts");

export async function getTemplate(): Promise<CertificateTemplate> {
  return (await prisma.certificateTemplate.findFirst({ orderBy: { updatedAt: "desc" } })) ?? prisma.certificateTemplate.create({ data: {} });
}

function newNumber() {
  return `UJ-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Ball shablondagi chegaradan past bo'lmasa sertifikat beradi (bir urinishga bitta). */
export async function issueCertificateIfEligible(attempt: Attempt) {
  if (attempt.status === "IN_PROGRESS" || attempt.scorePct == null) return null;
  const tpl = await getTemplate();
  if (!tpl.isActive || attempt.scorePct < tpl.minScorePct) return null;
  const existing = await prisma.certificate.findUnique({ where: { attemptId: attempt.id } });
  if (existing) return { cert: existing, created: false };
  const cert = await prisma.certificate.create({ data: { number: newNumber(), attemptId: attempt.id, userId: attempt.userId } });
  return { cert, created: true };
}

export const verifyUrl = (number: string) => `${env.publicWebUrl}/verify/${encodeURIComponent(number)}`;

export type CertInfo = {
  number: string;
  issuedAt: Date;
  fullName: string;
  institution: string | null;
  region: string | null;
  subject: string;
  test: string;
  scorePct: number;
  correct: number;
  total: number;
};

export async function lookupCertificate(number: string): Promise<CertInfo> {
  const cert = await prisma.certificate.findUnique({
    where: { number: number.trim().toUpperCase() },
    include: {
      user: { select: { firstName: true, lastName: true, institution: true, region: true } },
      attempt: { select: { scorePct: true, correctCount: true, totalCount: true, test: { select: { title: true, subject: { select: { name: true } } } } } },
    },
  });
  if (!cert) throw notFound("Bunday raqamli sertifikat topilmadi");
  return {
    number: cert.number,
    issuedAt: cert.issuedAt,
    fullName: `${cert.user.lastName} ${cert.user.firstName}`.trim(),
    institution: cert.user.institution,
    region: cert.user.region,
    subject: cert.attempt.test.subject.name,
    test: cert.attempt.test.title,
    scorePct: cert.attempt.scorePct ?? 0,
    correct: cert.attempt.correctCount ?? 0,
    total: cert.attempt.totalCount ?? 0,
  };
}

const BRAND = "#1d4ed8";
const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

/** A4 albom PDF. Fon rasmi berilsa butun sahifaga qo'yiladi, aks holda ramkali oddiy dizayn. */
export async function renderCertificatePdf(c: CertInfo, tpl: CertificateTemplate): Promise<Buffer> {
  const qr = await QRCode.toBuffer(verifyUrl(c.number), { margin: 1, width: 360, color: { dark: "#0f172a" } });
  const bg = tpl.backgroundFileId ? await prisma.file.findUnique({ where: { id: tpl.backgroundFileId }, select: { data: true, mime: true } }) : null;

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, info: { Title: `${tpl.title} ${c.number}`, Author: tpl.organization ?? "" } });
  doc.registerFont("Sans", path.join(FONTS, "DejaVuSans.ttf"));
  doc.registerFont("SansBold", path.join(FONTS, "DejaVuSans-Bold.ttf"));
  doc.registerFont("SerifBold", path.join(FONTS, "DejaVuSerif-Bold.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (d: Buffer) => chunks.push(d));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width;
  const H = doc.page.height;
  if (bg && /^image\/(png|jpeg)$/.test(bg.mime)) {
    doc.image(Buffer.from(bg.data), 0, 0, { width: W, height: H });
  } else {
    doc.rect(0, 0, W, H).fill("#ffffff");
    doc.rect(18, 18, W - 36, H - 36).lineWidth(6).stroke(BRAND);
    doc.rect(30, 30, W - 60, H - 60).lineWidth(1).stroke("#93c5fd");
    // Burchak bezaklari
    for (const [x, y] of [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]]) doc.circle(x, y, 6).fill(BRAND);
  }

  const center = (text: string, y: number, font: string, size: number, color: string, opts: PDFKit.Mixins.TextOptions = {}) =>
    doc.font(font).fontSize(size).fillColor(color).text(text, 80, y, { width: W - 160, align: "center", ...opts });

  if (tpl.organization) center(tpl.organization.toUpperCase(), 62, "SansBold", 13, "#475569", { characterSpacing: 1.5 });
  center(tpl.title || "SERTIFIKAT", 95, "SerifBold", 46, BRAND, { characterSpacing: 4 });
  center("Ushbu sertifikat", 170, "Sans", 15, "#475569");
  center(c.fullName, 198, "SerifBold", 32, "#0f172a");
  doc.moveTo(W / 2 - 200, 245).lineTo(W / 2 + 200, 245).lineWidth(1).stroke("#cbd5e1");
  center(`${c.subject} fanidan «${c.test}» testini muvaffaqiyatli topshirgani uchun berildi.`, 262, "Sans", 15, "#334155", { lineGap: 4 });
  center(`Natija: ${c.scorePct}%  (${c.correct} / ${c.total} to'g'ri javob)`, 318, "SansBold", 17, "#0f172a");

  // Pastki qism: sana va raqam chapda, imzo o'rtada, QR o'ngda
  const by = H - 150;
  doc.font("Sans").fontSize(10).fillColor("#64748b").text("Berilgan sana", 70, by);
  doc.font("SansBold").fontSize(13).fillColor("#0f172a").text(fmt(c.issuedAt), 70, by + 14);
  doc.font("Sans").fontSize(10).fillColor("#64748b").text("Sertifikat raqami", 70, by + 44);
  doc.font("SansBold").fontSize(13).fillColor("#0f172a").text(c.number, 70, by + 58);
  if (tpl.signerName) {
    doc.moveTo(W / 2 - 110, by + 40).lineTo(W / 2 + 110, by + 40).lineWidth(1).stroke("#94a3b8");
    doc.font("SansBold").fontSize(12).fillColor("#0f172a").text(tpl.signerName, W / 2 - 150, by + 48, { width: 300, align: "center" });
    doc.font("Sans").fontSize(9).fillColor("#64748b").text("imzo", W / 2 - 150, by + 64, { width: 300, align: "center" });
  }
  doc.image(qr, W - 175, by - 20, { width: 105 });
  doc.font("Sans").fontSize(8).fillColor("#64748b").text("Haqiqiyligini tekshirish", W - 190, by + 90, { width: 135, align: "center" });
  doc.end();
  return done;
}

/** Namuna: shablon sozlamalarini ko'rish uchun. */
export const SAMPLE: CertInfo = {
  number: "UJ-2026-NAMUNA00",
  issuedAt: new Date(),
  fullName: "Aliyev Vali",
  institution: "12-maktab",
  region: "Toshkent shahri",
  subject: "Fizika",
  test: "Kinematika",
  scorePct: 85,
  correct: 17,
  total: 20,
};
