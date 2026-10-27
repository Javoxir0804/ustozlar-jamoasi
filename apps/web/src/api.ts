// API bilan ishlash. Token localStorage da; bot ichida (Telegram Web App) avtomatik kiriladi.
declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; ready(): void; expand(): void } };
  }
}

const TOKEN_KEY = "att_token";

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
const setToken = (t: string) => {
  try {
    localStorage.setItem(TOKEN_KEY, t);
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

/** Bot ichida ochilgan bo'lsa initData orqali kiradi. */
export async function ensureLogin(): Promise<boolean> {
  const tg = window.Telegram?.WebApp;
  if (tg?.initData) {
    tg.ready();
    tg.expand();
    const { token } = await api<{ token: string }>("/auth/telegram/webapp", { method: "POST", body: { initData: tg.initData } });
    setToken(token);
    return true;
  }
  return !!getToken();
}

export async function loginWithWidget(data: Record<string, string | number>) {
  const { token } = await api<{ token: string }>("/auth/telegram/widget", { method: "POST", body: data });
  setToken(token);
}
