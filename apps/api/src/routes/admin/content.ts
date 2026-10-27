// Kontent: Fan → Kurs → Modul → Dars, dars fayllari va pullik kursga ruxsatlar.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@edu/db";
import { audit, publicUser } from "../../auth/session.js";
import { badRequest, h, notFound } from "../../lib/errors.js";
import { notifyAccessGranted } from "../../bot/notify.js";

export const contentRouter = Router();

const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ'`‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "fan";

// ---------- Fanlar ----------
const subjectSchema = z.object({ name: text(2, 80, "Fan nomini kiriting"), description: optText(500), order: z.number().int().optional(), isActive: z.boolean().optional() });

contentRouter.get(
  "/subjects",
  h(async (_req, res) => {
    res.json(await prisma.subject.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], include: { _count: { select: { courses: true, tests: true } } } }));
  }),
);

contentRouter.post(
  "/subjects",
  h(async (req, res) => {
    const d = subjectSchema.parse(req.body);
    let slug = slugify(d.name);
    if (await prisma.subject.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const s = await prisma.subject.create({ data: { ...d, slug } });
    await audit(req.user!.id, "subject.create", "Subject", s.id);
    res.json(s);
  }),
);

contentRouter.patch("/subjects/:id", h(async (req, res) => res.json(await prisma.subject.update({ where: { id: req.params.id }, data: subjectSchema.partial().parse(req.body) }))));

contentRouter.delete(
  "/subjects/:id",
  h(async (req, res) => {
    const s = await prisma.subject.findUnique({ where: { id: req.params.id }, include: { _count: { select: { courses: true, tests: true } } } });
    if (!s) throw notFound("Fan topilmadi");
    if (s._count.courses || s._count.tests) throw badRequest("NOT_EMPTY", "Fanda kurs yoki test bor. Avval ularni o'chiring yoki fanni nofaol qiling.");
    await prisma.subject.delete({ where: { id: s.id } });
    await audit(req.user!.id, "subject.delete", "Subject", s.id, { name: s.name });
    res.json({ ok: true });
  }),
);

// ---------- Kurslar ----------
const courseSchema = z.object({
  subjectId: z.string().min(1, "Fanni tanlang"),
  title: text(2, 150, "Kurs nomini kiriting"),
  description: optText(5000),
  coverFileId: z.string().nullish(),
  isPaid: z.boolean().default(true),
  isPublished: z.boolean().default(false),
  order: z.number().int().optional(),
});

contentRouter.get(
  "/courses",
  h(async (req, res) => {
    const subjectId = typeof req.query.subjectId === "string" && req.query.subjectId ? req.query.subjectId : undefined;
    const courses = await prisma.course.findMany({
      where: subjectId ? { subjectId } : {},
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: { subject: { select: { id: true, name: true } }, modules: { select: { _count: { select: { lessons: true } } } }, _count: { select: { access: true } } },
    });
    res.json(
      courses.map(({ modules, _count, ...c }) => ({ ...c, moduleCount: modules.length, lessonCount: modules.reduce((n, m) => n + m._count.lessons, 0), accessCount: _count.access })),
    );
  }),
);

contentRouter.post(
  "/courses",
  h(async (req, res) => {
    const c = await prisma.course.create({ data: courseSchema.parse(req.body) });
    await audit(req.user!.id, "course.create", "Course", c.id);
    res.json(c);
  }),
);

const lessonOrder = { orderBy: [{ order: "asc" as const }, { createdAt: "asc" as const }] };

contentRouter.get(
  "/courses/:id",
  h(async (req, res) => {
    const c = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        subject: { select: { id: true, name: true } },
        modules: { orderBy: { order: "asc" }, include: { lessons: { ...lessonOrder, include: { files: { orderBy: { order: "asc" }, include: { file: { select: { name: true, size: true, mime: true } } } } } } } },
      },
    });
    if (!c) throw notFound("Kurs topilmadi");
    res.json(c);
  }),
);

contentRouter.patch("/courses/:id", h(async (req, res) => res.json(await prisma.course.update({ where: { id: req.params.id }, data: courseSchema.partial().parse(req.body) }))));

contentRouter.delete(
  "/courses/:id",
  h(async (req, res) => {
    const c = await prisma.course.findUnique({ where: { id: req.params.id }, include: { _count: { select: { tests: true } } } });
    if (!c) throw notFound("Kurs topilmadi");
    if (c._count.tests) throw badRequest("HAS_TESTS", "Kursga test bog'langan. Avval testni boshqa joyga o'tkazing.");
    await prisma.course.delete({ where: { id: c.id } });
    await audit(req.user!.id, "course.delete", "Course", c.id, { title: c.title });
    res.json({ ok: true });
  }),
);

// ---------- Modullar ----------
const moduleSchema = z.object({ title: text(1, 150, "Modul nomini kiriting") });
const reorderSchema = z.object({ ids: z.array(z.string()).min(1) });

contentRouter.post(
  "/courses/:id/modules",
  h(async (req, res) => {
    const d = moduleSchema.parse(req.body);
    const order = await prisma.module.count({ where: { courseId: req.params.id } });
    res.json(await prisma.module.create({ data: { ...d, courseId: req.params.id, order } }));
  }),
);
contentRouter.patch("/modules/:id", h(async (req, res) => res.json(await prisma.module.update({ where: { id: req.params.id }, data: moduleSchema.parse(req.body) }))));
contentRouter.delete(
  "/modules/:id",
  h(async (req, res) => {
    await prisma.module.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);
contentRouter.post(
  "/courses/:id/modules/reorder",
  h(async (req, res) => {
    const { ids } = reorderSchema.parse(req.body);
    await prisma.$transaction(ids.map((id, order) => prisma.module.updateMany({ where: { id, courseId: req.params.id }, data: { order } })));
    res.json({ ok: true });
  }),
);

// ---------- Darslar ----------
const lessonSchema = z.object({
  title: text(1, 200, "Dars nomini kiriting"),
  videoUrl: optText(500),
  content: optText(50_000),
  durationSec: z.number().int().min(0).nullish(),
  isPreview: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  moduleId: z.string().optional(),
});

contentRouter.post(
  "/modules/:id/lessons",
  h(async (req, res) => {
    const { moduleId: _ignored, ...d } = lessonSchema.parse(req.body);
    const order = await prisma.lesson.count({ where: { moduleId: req.params.id } });
    res.json(await prisma.lesson.create({ data: { ...d, moduleId: req.params.id, order } }));
  }),
);
contentRouter.patch("/lessons/:id", h(async (req, res) => res.json(await prisma.lesson.update({ where: { id: req.params.id }, data: lessonSchema.partial().parse(req.body) }))));
contentRouter.delete(
  "/lessons/:id",
  h(async (req, res) => {
    const files = await prisma.lessonFile.findMany({ where: { lessonId: req.params.id }, select: { fileId: true } });
    await prisma.lesson.delete({ where: { id: req.params.id } });
    await prisma.file.deleteMany({ where: { id: { in: files.map((f) => f.fileId) }, lessonFiles: { none: {} } } });
    res.json({ ok: true });
  }),
);
contentRouter.post(
  "/modules/:id/lessons/reorder",
  h(async (req, res) => {
    const { ids } = reorderSchema.parse(req.body);
    await prisma.$transaction(ids.map((id, order) => prisma.lesson.updateMany({ where: { id, moduleId: req.params.id }, data: { order } })));
    res.json({ ok: true });
  }),
);

// Dars fayllari (fayl avval /admin/files ga MATERIAL turida yuklanadi)
contentRouter.post(
  "/lessons/:id/files",
  h(async (req, res) => {
    const d = z.object({ fileId: z.string().min(1), title: text(1, 200, "Fayl nomini kiriting") }).parse(req.body);
    const order = await prisma.lessonFile.count({ where: { lessonId: req.params.id } });
    res.json(await prisma.lessonFile.create({ data: { lessonId: req.params.id, fileId: d.fileId, title: d.title, order }, include: { file: { select: { name: true, size: true, mime: true } } } }));
  }),
);
contentRouter.delete(
  "/lesson-files/:id",
  h(async (req, res) => {
    const lf = await prisma.lessonFile.delete({ where: { id: req.params.id } });
    await prisma.file.deleteMany({ where: { id: lf.fileId, lessonFiles: { none: {} } } });
    res.json({ ok: true });
  }),
);

// ---------- Ruxsatlar ----------
contentRouter.get(
  "/courses/:id/access",
  h(async (req, res) => {
    const rows = await prisma.courseAccess.findMany({ where: { courseId: req.params.id }, orderBy: { grantedAt: "desc" }, include: { user: true, grantedBy: { select: { firstName: true, lastName: true } } } });
    res.json(rows.map((r) => ({ id: r.id, grantedAt: r.grantedAt, expiresAt: r.expiresAt, grantedBy: r.grantedBy, user: publicUser(r.user) })));
  }),
);

contentRouter.post(
  "/courses/:id/access",
  h(async (req, res) => {
    const d = z.object({ userIds: z.array(z.string()).min(1, "Talabani tanlang").max(500), expiresAt: z.coerce.date().nullish() }).parse(req.body);
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) throw notFound("Kurs topilmadi");
    const users = await prisma.user.findMany({ where: { id: { in: d.userIds }, role: "STUDENT" } });
    for (const u of users) {
      await prisma.courseAccess.upsert({
        where: { userId_courseId: { userId: u.id, courseId: course.id } },
        create: { userId: u.id, courseId: course.id, grantedById: req.user!.id, expiresAt: d.expiresAt ?? null },
        update: { grantedById: req.user!.id, grantedAt: new Date(), expiresAt: d.expiresAt ?? null },
      });
      void notifyAccessGranted(u, course, d.expiresAt ?? null);
    }
    await audit(req.user!.id, "access.grant", "Course", course.id, { users: users.map((u) => u.id), expiresAt: d.expiresAt });
    res.json({ granted: users.length });
  }),
);

contentRouter.delete(
  "/access/:id",
  h(async (req, res) => {
    const a = await prisma.courseAccess.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, "access.revoke", "Course", a.courseId, { userId: a.userId });
    res.json({ ok: true });
  }),
);

contentRouter.get(
  "/students/:id/access",
  h(async (req, res) => {
    res.json(await prisma.courseAccess.findMany({ where: { userId: req.params.id }, orderBy: { grantedAt: "desc" }, include: { course: { select: { id: true, title: true } } } }));
  }),
);
