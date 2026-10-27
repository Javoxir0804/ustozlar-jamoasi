import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

// Yagona xato formati: { error: { code, message } }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const notFound = (msg = "Topilmadi") => new ApiError(404, "NOT_FOUND", msg);
export const forbidden = (msg = "Ruxsat yo'q") => new ApiError(403, "FORBIDDEN", msg);
export const badRequest = (code: string, msg: string) => new ApiError(400, code, msg);
export const unauthorized = (msg = "Tizimga kiring") => new ApiError(401, "UNAUTHORIZED", msg);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION", message: err.issues.map((i) => i.message).join("; ") } });
  }
  // Prisma: yagona maydon takrorlangan
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
    return res.status(409).json({ error: { code: "DUPLICATE", message: "Bunday qiymat allaqachon mavjud" } });
  }
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2025") {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Topilmadi" } });
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Serverda xatolik" } });
}

// async route xatolarini errorHandler ga uzatadi
export const h =
  (fn: (req: Request<Record<string, string>>, res: Response) => Promise<unknown>) =>
  (req: Request<Record<string, string>>, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
