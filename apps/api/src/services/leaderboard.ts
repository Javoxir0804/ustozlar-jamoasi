import { prisma } from "@edu/db";

export type LeaderRow = { userId: string; fullName: string; region: string | null; institution: string | null; bestPct: number; finishedAt: Date };

/** Reyting: har bir talabaning eng yaxshi natijasi; teng bo'lsa kim oldin topshirgan yuqorida. Fan yoki test bo'yicha. */
export async function leaderboard(by: { subjectId?: string; testId?: string }, limit = 10): Promise<LeaderRow[]> {
  const rows = await prisma.$queryRaw<LeaderRow[]>`
    SELECT DISTINCT ON (a."userId")
      a."userId", TRIM(u."lastName" || ' ' || u."firstName") AS "fullName", u."region", u."institution",
      a."scorePct" AS "bestPct", a."finishedAt"
    FROM "Attempt" a
    JOIN "Test" t ON t.id = a."testId"
    JOIN "User" u ON u.id = a."userId"
    WHERE a."status" <> 'IN_PROGRESS' AND a."scorePct" IS NOT NULL AND u."role" = 'STUDENT' AND u."status" = 'ACTIVE'
      AND (${by.subjectId ?? null}::text IS NULL OR t."subjectId" = ${by.subjectId ?? null})
      AND (${by.testId ?? null}::text IS NULL OR t.id = ${by.testId ?? null})
    ORDER BY a."userId", a."scorePct" DESC, a."finishedAt" ASC`;
  return rows.sort((x, y) => y.bestPct - x.bestPct || +x.finishedAt - +y.finishedAt).slice(0, limit);
}
