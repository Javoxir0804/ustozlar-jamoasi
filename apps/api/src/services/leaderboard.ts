import { prisma } from "@att/db";

export type LeaderRow = { userId: string; fullName: string; region: string | null; bestPct: number; finishedAt: Date };

/** Fan bo'yicha reyting: har bir foydalanuvchining eng yaxshi natijasi, teng bo'lsa kim oldin topshirgan. */
export async function subjectLeaderboard(subjectId: string, limit = 10): Promise<LeaderRow[]> {
  return prisma.$queryRaw<LeaderRow[]>`
    SELECT DISTINCT ON (a."userId")
      a."userId", u."lastName" || ' ' || u."firstName" AS "fullName", u."region",
      a."scorePct" AS "bestPct", a."finishedAt"
    FROM "Attempt" a
    JOIN "Test" t ON t.id = a."testId"
    JOIN "User" u ON u.id = a."userId"
    WHERE t."subjectId" = ${subjectId} AND a."status" <> 'IN_PROGRESS' AND a."scorePct" IS NOT NULL
    ORDER BY a."userId", a."scorePct" DESC, a."finishedAt" ASC`.then((rows) =>
    rows.sort((x, y) => y.bestPct - x.bestPct || +x.finishedAt - +y.finishedAt).slice(0, limit),
  );
}
