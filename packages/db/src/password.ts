import crypto from "node:crypto";

/** Parolni scrypt bilan xeshlaydi: "tuz:xesh" ko'rinishida saqlanadi. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored?: string | null): boolean {
  if (!stored) return false;
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}
