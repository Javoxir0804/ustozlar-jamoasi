import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { prisma, type Role, type User } from "@att/db";
import { env } from "../env.js";
import { ApiError, forbidden } from "../lib/errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: "7d" });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "Tizimga kiring");
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Foydalanuvchi topilmadi");
    if (user.status === "BLOCKED") throw forbidden("Hisobingiz bloklangan");
    req.user = user;
    next();
  } catch (e) {
    next(e instanceof ApiError ? e : new ApiError(401, "UNAUTHORIZED", "Token yaroqsiz"));
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && roles.includes(req.user.role) ? next() : next(forbidden());

/** Bot -> API ichki so'rovlari uchun kalit tekshiruvi. */
export function requireBot(req: Request, _res: Response, next: NextFunction) {
  if (req.headers["x-bot-key"] !== env.botApiKey) return next(forbidden("Bot kaliti noto'g'ri"));
  next();
}
