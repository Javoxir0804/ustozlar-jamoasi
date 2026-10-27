// Server bilan ishlash. Token localStorage da (bot ichida ham, brauzerda ham).
const TOKEN_KEY = "edu_token";

export type Role = "ADMIN" | "STUDENT";

export interface User {
  id: string;
  role: Role;
  status: "ACTIVE" | "BLOCKED";
  telegramId: string | null;
  telegramUsername: string | null;
  login: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  region: string | null;
  district: string | null;
  address: string | null;
  institution: string | null;
  grade: string | null;
  profileCompleted: boolean;
  lastActiveAt: string | null;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const token = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* maxfiy rejim */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* maxfiy rejim */
    }
  },
};

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = token.get();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...(t ? { authorization: `Bearer ${t}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Internet aloqasi yo'q. Qayta urinib ko'ring.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error?.code ?? "HTTP", data.error?.message ?? "Xatolik yuz berdi");
  return data as T;
}

export const fullName = (u: Pick<User, "firstName" | "lastName">) => `${u.lastName} ${u.firstName}`.trim() || "Ismsiz";

export const fmtDate = (s: string | null | undefined, withTime = false) =>
  s
    ? new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) })
    : "—";

export type Uploaded = { id: string; name: string; mime: string; size: number; kind: string; url: string };

/** Faylni admin sifatida yuklaydi. Tana xom holda, asl turi ?mime= da. */
export async function uploadFile(file: File, kind: "IMAGE" | "MATERIAL" | "PRIVATE"): Promise<Uploaded> {
  const q = new URLSearchParams({ kind, name: file.name, mime: file.type || "application/octet-stream" });
  let res: Response;
  try {
    res = await fetch(`/api/admin/files?${q}`, { method: "POST", headers: { "content-type": "application/octet-stream", authorization: `Bearer ${token.get() ?? ""}` }, body: file });
  } catch {
    throw new ApiError(0, "NETWORK", "Internet aloqasi yo'q. Qayta urinib ko'ring.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error?.code ?? "HTTP", data.error?.message ?? (res.status === 413 ? "Fayl juda katta" : "Yuklab bo'lmadi"));
  return data as Uploaded;
}

/** Himoyalangan fayl havolasi (<a>, <video> sarlavha yubora olmaydi, token so'rovda). */
export const fileHref = (url: string) => {
  const t = token.get();
  return t && url.startsWith("/api/files/") ? `${url}?t=${encodeURIComponent(t)}` : url;
};

export const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
