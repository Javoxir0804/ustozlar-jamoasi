import crypto from "node:crypto";

export type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string };

const MAX_AGE_SEC = 24 * 60 * 60;

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Telegram Web App initData imzosini tekshiradi (bot ichida ochilgan sayt). */
export function verifyWebAppInitData(initData: string, botToken: string, nowSec = Date.now() / 1000): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (!safeEqual(calc, hash)) return null;
  const authDate = Number(params.get("auth_date"));
  if (!authDate || nowSec - authDate > MAX_AGE_SEC) return null;
  const user = params.get("user");
  return user ? (JSON.parse(user) as TelegramUser) : null;
}

/** Saytdagi "Telegram orqali kirish" (Login Widget) ma'lumotlarini tekshiradi. */
export function verifyLoginWidget(data: Record<string, string | number>, botToken: string, nowSec = Date.now() / 1000): TelegramUser | null {
  const { hash, ...rest } = data;
  if (typeof hash !== "string") return null;
  const dataCheck = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join("\n");
  const secret = crypto.createHash("sha256").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (!safeEqual(calc, hash)) return null;
  if (nowSec - Number(rest.auth_date) > MAX_AGE_SEC) return null;
  return { id: Number(rest.id), first_name: rest.first_name as string, last_name: rest.last_name as string, username: rest.username as string };
}
