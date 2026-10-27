// Bir martalik ro'yxatdan o'tish: bosqichma-bosqich savol-javob.
import { Keyboard } from "grammy";
import { REGIONS } from "./regions.js";

export type RegStep = "firstName" | "lastName" | "phone" | "region" | "district" | "address" | "school" | "grade";
export type RegDraft = Partial<Record<RegStep, string>>;

export const STEPS: RegStep[] = ["firstName", "lastName", "phone", "region", "district", "address", "school", "grade"];

const regionKb = () => {
  const kb = new Keyboard();
  REGIONS.forEach((r, i) => (i % 2 ? kb.text(r).row() : kb.text(r)));
  return kb.resized().oneTime();
};

export const PROMPTS: Record<RegStep, { text: string; keyboard?: () => Keyboard }> = {
  firstName: { text: "Ismingizni kiriting:" },
  lastName: { text: "Familiyangizni kiriting:" },
  phone: { text: "Telefon raqamingizni yuboring (pastdagi tugma orqali):", keyboard: () => new Keyboard().requestContact("📱 Raqamni yuborish").resized().oneTime() },
  region: { text: "Viloyatingizni tanlang:", keyboard: regionKb },
  district: { text: "Tuman (shahar) nomini kiriting:" },
  address: { text: "To'liq yashash manzilingizni kiriting:" },
  school: { text: "Maktabingiz (masalan: 12-maktab):" },
  grade: { text: "Sinf yoki toifangiz (masalan: Oliy toifa):" },
};

/** Kiritilgan qiymatni tekshiradi; xato bo'lsa foydalanuvchiga ko'rsatiladigan matn qaytaradi. */
export function validate(step: RegStep, value: string): string | null {
  const v = value.trim();
  if (!v) return "Bo'sh bo'lishi mumkin emas.";
  if ((step === "firstName" || step === "lastName") && (v.length > 60 || /\d/.test(v))) return "Iltimos, to'g'ri yozing (raqamsiz).";
  if (step === "phone" && !/^\+?\d{9,15}$/.test(v.replace(/[\s()-]/g, ""))) return "Raqam noto'g'ri. Tugma orqali yuboring.";
  if (step === "region" && !REGIONS.includes(v)) return "Ro'yxatdan tanlang.";
  if (v.length > 200) return "Juda uzun.";
  return null;
}

export function nextStep(draft: RegDraft): RegStep | null {
  return STEPS.find((s) => !draft[s]) ?? null;
}
