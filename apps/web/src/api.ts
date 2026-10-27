// API bilan ishlash. Token localStorage da; bot ichida (Telegram Web App) avtomatik kiriladi.
declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; ready(): void; expand(): void } };
  }
}

const TOKEN_KEY = "att_token";

export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export interface User {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string | null;
  school?: string | null;
  grade?: string | null;
  region?: string | null;
  district?: string | null;
  address?: string | null;
  status?: "ACTIVE" | "BLOCKED";
  subscriptionEndsAt?: string | null;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (t: string) => {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* maxfiy rejimda saqlanmaydi */
  }
};

export const removeToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* maxfiy rejimda saqlanmaydi */
  }
};

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error?.code ?? "HTTP", data.error?.message ?? "Xatolik");
  return data as T;
}

/** Hozirgi kirgan foydalanuvchi ma'lumotlarini olish */
let cachedUser: User | null = null;

export async function getMe(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const user = await api<User>("/auth/me");
    cachedUser = user;
    return user;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      removeToken();
      cachedUser = null;
    }
    return null;
  }
}

export function getCurrentUser(): User | null {
  return cachedUser;
}

export function setCurrentUser(u: User | null) {
  cachedUser = u;
}

/** Bot ichida ochilgan bo'lsa initData orqali kiradi; aks holda tokenni tekshiradi */
export async function ensureLogin(): Promise<User | null> {
  const tg = window.Telegram?.WebApp;
  if (tg?.initData) {
    tg.ready();
    tg.expand();
    try {
      const { token, user } = await api<{ token: string; user: User }>("/auth/telegram/webapp", {
        method: "POST",
        body: { initData: tg.initData },
      });
      setToken(token);
      cachedUser = user;
      return user;
    } catch {
      // Webapp orqali xato bo'lsa token borligini tekshiramiz
    }
  }

  const token = getToken();
  if (!token) return null;

  return await getMe();
}

/** Login va parol orqali kirish */
export async function loginWithCredentials(login: string, password: string): Promise<User> {
  const res = await api<{ token: string; user: User }>("/auth/login", {
    method: "POST",
    body: { login, password },
  });
  setToken(res.token);
  cachedUser = res.user;
  return res.user;
}

/** Yangi hisob ochish (Ustoz yoki O'quvchi) */
export interface RegisterData {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "TEACHER" | "STUDENT";
  phone?: string;
  school?: string;
  grade?: string;
  region?: string;
  district?: string;
}

export async function registerWithCredentials(data: RegisterData): Promise<User> {
  const res = await api<{ token: string; user: User }>("/auth/register", {
    method: "POST",
    body: data,
  });
  setToken(res.token);
  cachedUser = res.user;
  return res.user;
}

export async function loginWithWidget(data: Record<string, string | number>) {
  const res = await api<{ token: string; user: User }>("/auth/telegram/widget", { method: "POST", body: data });
  setToken(res.token);
  cachedUser = res.user;
  return res.user;
}

export function logout() {
  removeToken();
  cachedUser = null;
  window.location.href = "/login";
}
