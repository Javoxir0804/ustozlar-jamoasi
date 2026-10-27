import { z } from "zod";

export const REGIONS = [
  "Toshkent shahri", "Toshkent viloyati", "Andijon viloyati", "Buxoro viloyati", "Farg'ona viloyati", "Jizzax viloyati",
  "Xorazm viloyati", "Namangan viloyati", "Navoiy viloyati", "Qashqadaryo viloyati", "Qoraqalpog'iston Respublikasi",
  "Samarqand viloyati", "Sirdaryo viloyati", "Surxondaryo viloyati",
] as const;

/** Telefonni +998XXXXXXXXX ko'rinishiga keltiradi; noto'g'ri bo'lsa null. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 9) d = `998${d}`;
  return /^\d{11,15}$/.test(d) ? `+${d}` : null;
}

const name = (label: string) =>
  z.string().trim().min(2, `${label} kamida 2 harf`).max(60, `${label} juda uzun`).regex(/^[^\d<>]+$/, `${label}da raqam bo'lmasin`);

// Anketa (TZ 5.1): barcha maydonlar majburiy
export const profileSchema = z.object({
  firstName: name("Ism"),
  lastName: name("Familiya"),
  phone: z.string().transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: "Telefon raqami noto'g'ri" });
    return p ?? "";
  }),
  region: z.enum(REGIONS, { message: "Viloyatni ro'yxatdan tanlang" }),
  district: z.string().trim().min(2, "Tumanni kiriting").max(80),
  address: z.string().trim().min(3, "Manzilni kiriting").max(200),
  institution: z.string().trim().min(2, "Ta'lim muassasasini kiriting").max(150),
  grade: z.string().trim().min(1, "Sinf yoki kursni kiriting").max(40),
});
export type Profile = z.infer<typeof profileSchema>;
