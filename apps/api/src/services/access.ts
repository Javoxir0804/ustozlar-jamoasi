import { prisma, type User } from "@att/db";

/** Foydalanuvchida hozir faol obuna bormi. Admin uchun doim ha. */
export async function hasActiveSubscription(user: User, now = new Date()) {
  if (user.role === "ADMIN") return true;
  const sub = await prisma.subscription.findFirst({
    where: { userId: user.id, startsAt: { lte: now }, endsAt: { gt: now } },
    select: { id: true },
  });
  return !!sub;
}

export async function activeSubscriptionEnd(userId: string, now = new Date()) {
  const sub = await prisma.subscription.findFirst({
    where: { userId, endsAt: { gt: now } },
    orderBy: { endsAt: "desc" },
  });
  return sub?.endsAt ?? null;
}
