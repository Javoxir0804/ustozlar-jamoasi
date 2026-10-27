import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

// Yagona xato formati: { error: { code, message } }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const notFound = (what = "Topilmadi") => new ApiError(404, "NOT_FOUND", what);
export const forbidden = (msg = "Ruxsat yo'q") => new ApiError(403, "FORBIDDEN", msg);
export const badRequest = (code: string, msg: string) => new ApiError(400, code, msg);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION", message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") } });
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Serverda xatolik" } });
}

// async route xatolarini errorHandler ga uzatish
export const h =
  (fn: (req: Request<Record<string, string>>, res: Response) => Promise<unknown>) =>
  (req: Request<Record<string, string>>, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
