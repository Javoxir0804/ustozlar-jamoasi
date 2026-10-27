import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { prisma, type User } from "@edu/db";
import { env } from "../env.js";
import { ApiError, forbidden, unauthorized } from "../lib/errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const signToken = (userId: string) => jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: "30d" });

function tokenOf(req: Request) {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  // Fayl havolalari (<img>, yuklab olish) sarlavha yubora olmaydi
  return typeof req.query.t === "string" ? req.query.t : null;
}

async function loadUser(token: string) {
  let sub: string;
  try {
    sub = (jwt.verify(token, env.jwtSecret) as { sub: string }).sub;
  } catch {
    throw unauthorized("Sessiya tugagan, qayta kiring");
  }
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user) throw unauthorized("Foydalanuvchi topilmadi");
  if (user.status === "BLOCKED") throw new ApiError(403, "BLOCKED", "Hisobingiz bloklangan. Admin bilan bog'laning.");
  return user;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = tokenOf(req);
    if (!token) throw unauthorized();
    req.user = await loadUser(token);
    next();
  } catch (e) {
    next(e);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = tokenOf(req);
  if (token) req.user = await loadUser(token).catch(() => undefined);
  next();
}

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) =>
  req.user?.role === "ADMIN" ? next() : next(forbidden("Faqat admin uchun"));

/** Talaba anketani to'ldirmaguncha kurs va testlar ochilmaydi. */
export const requireProfile = (req: Request, _res: Response, next: NextFunction) =>
  req.user?.role === "ADMIN" || req.user?.profileCompleted ? next() : next(new ApiError(403, "PROFILE_REQUIRED", "Avval anketani to'ldiring"));

/** Mijozga qaytariladigan foydalanuvchi ma'lumoti (parol xeshi va hisoblagichlarsiz). */
export function publicUser(u: User) {
  return {
    id: u.id,
    role: u.role,
    status: u.status,
    telegramId: u.telegramId?.toString() ?? null,
    telegramUsername: u.telegramUsername,
    login: u.login,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    region: u.region,
    district: u.district,
    address: u.address,
    institution: u.institution,
    grade: u.grade,
    profileCompleted: u.profileCompleted,
    lastActiveAt: u.lastActiveAt,
    createdAt: u.createdAt,
  };
}

export const audit = (actorId: string | undefined, action: string, entity?: string, entityId?: string, meta?: object) =>
  prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta } });
