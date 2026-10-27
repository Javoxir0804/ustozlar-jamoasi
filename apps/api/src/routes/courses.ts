// Talaba va mehmon uchun kurslar: katalog ochiq, dars mazmuni faqat ruxsat bilan (yoki tanishtiruv darsi).
import { Router } from "express";
import { prisma, type User } from "@edu/db";
import { optionalAuth, requireAuth, requireProfile, signMediaToken } from "../auth/session.js";
import { accessibleCourseIds, hasCourseAccess } from "../services/access.js";
import { forbidden, h, notFound } from "../lib/errors.js";
import { videoEmbed, type VideoEmbed } from "../lib/video.js";

/** Yuklangan video uchun sessiya tokeni o'rniga shu faylga bog'langan qisqa muddatli havola. */
function protectVideo(v: VideoEmbed | null, userId: string): VideoEmbed | null {
  if (v?.kind !== "file") return v;
  const m = /^\/api\/files\/([\w-]+)$/.exec(v.src);
  return m ? { kind: "file", src: `${v.src}?m=${signMediaToken(userId, m[1])}` } : v;
}

export const coursesRouter = Router();

const published = { isPublished: true, subject: { isActive: true } };
const lessonSort = [{ order: "asc" as const }, { createdAt: "asc" as const }];

function canOpen(user: User | undefined, course: { id: string; isPaid: boolean }, ids: Set<string>) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.profileCompleted && (!course.isPaid || ids.has(course.id));
}

// Kurslar ro'yxati; ?mine=1 faqat ochiq kurslar (kabinet uchun)
coursesRouter.get(
  "/courses",
  optionalAuth,
  h(async (req, res) => {
    const user = req.user;
    const ids = await accessibleCourseIds(user);
    const courses = await prisma.course.findMany({
      where: published,
      orderBy: [{ subject: { order: "asc" } }, { order: "asc" }, { createdAt: "desc" }],
      include: { subject: { select: { id: true, name: true, slug: true } }, modules: { select: { lessons: { where: { isPublished: true }, select: { id: true } } } } },
    });
    const done = user
      ? new Set((await prisma.lessonProgress.findMany({ where: { userId: user.id }, select: { lessonId: true } })).map((p) => p.lessonId))
      : new Set<string>();
    let list = courses.map(({ modules, ...c }) => {
      const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        coverUrl: c.coverFileId ? `/api/files/${c.coverFileId}` : null,
        isPaid: c.isPaid,
        subject: c.subject,
        lessonCount: lessonIds.length,
        completedCount: lessonIds.filter((id) => done.has(id)).length,
        hasAccess: canOpen(user, c, ids),
      };
    });
    if (req.query.mine) list = list.filter((c) => c.hasAccess && (c.isPaid || c.completedCount > 0));
    res.json(list);
  }),
);

coursesRouter.get(
  "/courses/:id",
  optionalAuth,
  h(async (req, res) => {
    const c = await prisma.course.findFirst({
      where: { id: req.params.id, ...published },
      include: { subject: { select: { id: true, name: true } }, modules: { orderBy: { order: "asc" }, include: { lessons: { where: { isPublished: true }, orderBy: lessonSort } } } },
    });
    if (!c) throw notFound("Kurs topilmadi");
    const user = req.user;
    const access = await hasCourseAccess(user, c);
    const done = user ? new Set((await prisma.lessonProgress.findMany({ where: { userId: user.id, lesson: { module: { courseId: c.id } } }, select: { lessonId: true } })).map((p) => p.lessonId)) : new Set<string>();
    const accessRow = user ? await prisma.courseAccess.findUnique({ where: { userId_courseId: { userId: user.id, courseId: c.id } }, select: { expiresAt: true } }) : null;
    res.json({
      id: c.id,
      title: c.title,
      description: c.description,
      coverUrl: c.coverFileId ? `/api/files/${c.coverFileId}` : null,
      isPaid: c.isPaid,
      subject: c.subject,
      hasAccess: access,
      expiresAt: accessRow?.expiresAt ?? null,
      modules: c.modules
        .filter((m) => m.lessons.length)
        .map((m) => ({
          id: m.id,
          title: m.title,
          lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, durationSec: l.durationSec, hasVideo: !!l.videoUrl, isPreview: l.isPreview, locked: !access && !l.isPreview, completed: done.has(l.id) })),
        })),
    });
  }),
);

async function loadLesson(id: string) {
  const l = await prisma.lesson.findFirst({
    where: { id, isPublished: true, module: { course: published } },
    include: { files: { orderBy: { order: "asc" }, include: { file: { select: { name: true, size: true, mime: true } } } }, module: { include: { course: true } } },
  });
  if (!l) throw notFound("Dars topilmadi");
  return l;
}

coursesRouter.get(
  "/lessons/:id",
  requireAuth,
  requireProfile,
  h(async (req, res) => {
    const l = await loadLesson(req.params.id);
    const course = l.module.course;
    if (!l.isPreview && !(await hasCourseAccess(req.user, course))) throw forbidden("Bu dars yopiq. Kursga ruxsat olish uchun admin bilan bog'laning.");
    // Kurs ichidagi tartib: oldingi va keyingi dars
    const all = await prisma.lesson.findMany({
      where: { isPublished: true, module: { courseId: course.id } },
      orderBy: [{ module: { order: "asc" } }, ...lessonSort],
      select: { id: true, title: true },
    });
    const i = all.findIndex((x) => x.id === l.id);
    const completed = !!(await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: req.user!.id, lessonId: l.id } } }));
    res.json({
      id: l.id,
      title: l.title,
      content: l.content,
      video: protectVideo(videoEmbed(l.videoUrl), req.user!.id),
      durationSec: l.durationSec,
      completed,
      course: { id: course.id, title: course.title },
      module: { id: l.module.id, title: l.module.title },
      files: l.files.map((f) => ({ id: f.id, title: f.title, name: f.file.name, size: f.file.size, mime: f.file.mime, url: `/api/files/${f.fileId}` })),
      prev: all[i - 1] ?? null,
      next: all[i + 1] ?? null,
      position: { index: i + 1, total: all.length },
    });
  }),
);

coursesRouter.post(
  "/lessons/:id/complete",
  requireAuth,
  requireProfile,
  h(async (req, res) => {
    const l = await loadLesson(req.params.id);
    if (!l.isPreview && !(await hasCourseAccess(req.user, l.module.course))) throw forbidden();
    const done = req.body?.done !== false;
    if (done) await prisma.lessonProgress.upsert({ where: { userId_lessonId: { userId: req.user!.id, lessonId: l.id } }, create: { userId: req.user!.id, lessonId: l.id }, update: {} });
    else await prisma.lessonProgress.deleteMany({ where: { userId: req.user!.id, lessonId: l.id } });
    res.json({ completed: done });
  }),
);
