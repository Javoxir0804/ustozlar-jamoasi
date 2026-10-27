import { prisma, type User } from "@att/db";
import { badRequest, forbidden, notFound } from "../lib/errors.js";

/** Obunani uzaytiradi: faol obuna bo'lsa uning oxiridan, bo'lmasa hozirdan boshlab. */
export async function grantSubscription(userId: string, days: number, source: string, planId?: string) {
  const now = new Date();
  const last = await prisma.subscription.findFirst({ where: { userId, endsAt: { gt: now } }, orderBy: { endsAt: "desc" } });
  const startsAt = last?.endsAt ?? now;
  return prisma.subscription.create({ data: { userId, planId, startsAt, endsAt: new Date(startsAt.getTime() + days * 86_400_000), source } });
}

/** Foydalanuvchi chek yuborganda: kutilayotgan qo'lda to'lov yaratiladi. */
export async function createManualPayment(userId: string, planId: string, receiptFileId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw notFound("Tarif topilmadi");
  const pending = await prisma.payment.count({ where: { userId, status: "PENDING" } });
  if (pending >= 3) throw badRequest("TOO_MANY_PENDING", "Oldingi cheklaringiz hali ko'rib chiqilmoqda");
  return prisma.payment.create({
    data: { userId, planId, provider: "MANUAL", amountUzs: plan.priceUzs, receiptFileId },
    include: { plan: true, user: true },
  });
}

/** Admin chekni tasdiqlaydi yoki rad etadi. Tasdiqlansa obuna yoqiladi (bir marta). */
export async function reviewPayment(paymentId: string, admin: User, approve: boolean, note?: string) {
  if (admin.role !== "ADMIN") throw forbidden();
  return prisma.$transaction(async (tx) => {
    const upd = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: approve ? "PAID" : "CANCELLED", paidAt: approve ? new Date() : null, reviewedById: admin.id, reviewNote: note },
    });
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { plan: true, user: true } });
    if (!payment) throw notFound("To'lov topilmadi");
    if (upd.count === 0) throw badRequest("ALREADY_REVIEWED", "Bu to'lov allaqachon ko'rib chiqilgan");
    let endsAt: Date | null = null;
    if (approve) {
      const now = new Date();
      const last = await tx.subscription.findFirst({ where: { userId: payment.userId, endsAt: { gt: now } }, orderBy: { endsAt: "desc" } });
      const startsAt = last?.endsAt ?? now;
      const sub = await tx.subscription.create({
        data: { userId: payment.userId, planId: payment.planId, startsAt, endsAt: new Date(startsAt.getTime() + payment.plan.days * 86_400_000), source: "manual-receipt" },
      });
      endsAt = sub.endsAt;
    }
    await tx.auditLog.create({ data: { actorId: admin.id, action: approve ? "payment.approve" : "payment.reject", entity: "Payment", entityId: paymentId } });
    return { ...payment, subscriptionEndsAt: endsAt };
  });
}
