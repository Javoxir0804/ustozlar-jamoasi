// Kursga kirish huquqi: admin hammasini ko'radi, bepul kurs anketasi to'ldirilgan har bir talabaga ochiq,
// pullik kursga faqat admin bergan (muddati o'tmagan) ruxsat bilan kiriladi.
import { prisma, type User } from "@edu/db";

export const activeAccess = () => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

export async function hasCourseAccess(user: User | undefined, course: { id: string; isPaid: boolean }) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (!user.profileCompleted) return false;
  if (!course.isPaid) return true;
  return !!(await prisma.courseAccess.findFirst({ where: { userId: user.id, courseId: course.id, ...activeAccess() }, select: { id: true } }));
}

/** Talabaning ruxsatli pullik kurslari ID ro'yxati (ro'yxat sahifalari uchun bitta so'rov). */
export async function accessibleCourseIds(user: User | undefined) {
  if (!user || user.role === "ADMIN") return new Set<string>();
  const rows = await prisma.courseAccess.findMany({ where: { userId: user.id, ...activeAccess() }, select: { courseId: true } });
  return new Set(rows.map((r) => r.courseId));
}
