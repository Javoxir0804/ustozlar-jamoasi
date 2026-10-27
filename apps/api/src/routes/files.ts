// Fayllar bazada saqlanadi. IMAGE ochiq, MATERIAL faqat kursga ruxsati borlarga, PRIVATE faqat adminga.
import express, { Router } from "express";
import { prisma, type FileKind } from "@edu/db";
import { optionalAuth, requireAdmin, requireAuth } from "../auth/session.js";
import { hasCourseAccess } from "../services/access.js";
import { badRequest, forbidden, h, notFound, unauthorized } from "../lib/errors.js";

export const filesRouter = Router();

const LIMITS: Record<FileKind, number> = { IMAGE: 5 * 1024 * 1024, MATERIAL: 30 * 1024 * 1024, PRIVATE: 30 * 1024 * 1024 };
const IMAGE_MIME = /^image\/(png|jpeg|gif|webp|svg\+xml)$/;

// Yuklash: tana xom fayl, nomi va turi so'rov parametrlarida
filesRouter.post(
  "/admin/files",
  requireAuth,
  requireAdmin,
  express.raw({ type: () => true, limit: "31mb" }),
  h(async (req, res) => {
    const kind = String(req.query.kind ?? "IMAGE") as FileKind;
    if (!(kind in LIMITS)) throw badRequest("BAD_KIND", "Fayl turi noto'g'ri");
    const data = req.body as Buffer;
    if (!Buffer.isBuffer(data) || data.length === 0) throw badRequest("EMPTY", "Fayl bo'sh");
    if (data.length > LIMITS[kind]) throw badRequest("TOO_BIG", `Fayl juda katta (ko'pi bilan ${LIMITS[kind] / 1024 / 1024} MB)`);
    // Mijoz tanani application/octet-stream qilib yuboradi (JSON fayl express.json ga tushmasin), asl turi ?mime= da
    const mime = String(req.query.mime || req.headers["content-type"] || "application/octet-stream").split(";")[0].trim().toLowerCase().slice(0, 100);
    if (kind === "IMAGE" && !IMAGE_MIME.test(mime)) throw badRequest("NOT_IMAGE", "Faqat rasm (PNG, JPG, GIF, WEBP, SVG)");
    const name = String(req.query.name ?? "fayl").slice(0, 200);
    const f = await prisma.file.create({ data: { kind, name, mime, size: data.length, data: new Uint8Array(data), uploadedById: req.user!.id }, select: { id: true, name: true, mime: true, size: true, kind: true } });
    res.json({ ...f, url: `/api/files/${f.id}` });
  }),
);

filesRouter.get(
  "/files/:id",
  optionalAuth,
  h(async (req, res) => {
    const f = await prisma.file.findUnique({ where: { id: req.params.id } });
    if (!f) throw notFound("Fayl topilmadi");
    if (f.kind !== "IMAGE") {
      const user = req.user;
      if (!user) throw unauthorized();
      if (user.role !== "ADMIN") {
        if (f.kind === "PRIVATE") throw forbidden();
        // Fayl dars ilovasi yoki darsning yuklangan videosi bo'lishi mumkin
        const lessons = await prisma.lesson.findMany({
          where: { isPublished: true, OR: [{ files: { some: { fileId: f.id } } }, { videoUrl: `/api/files/${f.id}` }] },
          select: { isPreview: true, module: { select: { course: true } } },
        });
        let ok = false;
        for (const l of lessons) {
          if (!l.module.course.isPublished) continue;
          if ((l.isPreview && user.profileCompleted) || (await hasCourseAccess(user, l.module.course))) {
            ok = true;
            break;
          }
        }
        if (!ok) throw forbidden("Bu faylga ruxsatingiz yo'q");
      }
    }
    res.setHeader("Content-Type", f.mime);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", f.kind === "IMAGE" ? "public, max-age=31536000, immutable" : "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // SVG ichida skript bo'lishi mumkin: alohida sahifa sifatida ochilmasin
    if (f.mime === "image/svg+xml") res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    const inline = f.kind === "IMAGE" || f.mime === "application/pdf" || f.mime.startsWith("video/") || f.mime.startsWith("audio/");
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    // Video oldinga-orqaga surilishi uchun Range so'rovlari
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, f.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), f.size - 1) : f.size - 1;
      if (start >= f.size || start > end) {
        res.status(416).setHeader("Content-Range", `bytes */${f.size}`);
        return res.end();
      }
      res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${f.size}`);
      res.setHeader("Content-Length", end - start + 1);
      return res.end(Buffer.from(f.data).subarray(start, end + 1));
    }
    res.setHeader("Content-Length", f.size);
    res.end(f.data);
  }),
);
