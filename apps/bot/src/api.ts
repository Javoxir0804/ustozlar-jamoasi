// Bot faqat API orqali ishlaydi: baza bilan to'g'ridan-to'g'ri gaplashmaydi.
const API_URL = process.env.API_URL ?? "http://localhost:4000";
const BOT_API_KEY = process.env.BOT_API_KEY ?? "dev-bot-key";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api/bot${path}`, {
    method,
    headers: { "content-type": "application/json", "x-bot-key": BOT_API_KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } };
    throw new ApiError(res.status, err.error?.code ?? "HTTP", err.error?.message ?? res.statusText);
  }
  return res.headers.get("content-type")?.includes("json") ? ((await res.json()) as T) : ((await res.arrayBuffer()) as T);
}

export type BotUser = { id: string; registered: boolean; firstName: string; lastName: string; phone: string | null; region: string | null; school: string | null; grade: string | null; subscriptionEndsAt: string | null };
export type Channel = { chatId: string; title: string; inviteUrl: string };
export type Subject = { id: string; name: string };
export type Plan = { id: string; name: string; priceUzs: number; days: number };
export type Leader = { fullName: string; region: string | null; bestPct: number };

export const api = {
  getUser: (tgId: number) => call<BotUser>("GET", `/users/${tgId}`).catch((e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e))),
  register: (data: Record<string, unknown>) => call<BotUser>("POST", "/users", data),
  channels: () => call<Channel[]>("GET", "/channels"),
  subjects: () => call<Subject[]>("GET", "/subjects"),
  attempts: (tgId: number) => call<{ scorePct: number; finishedAt: string; test: { title: string }; certificate: { number: string } | null }[]>("GET", `/users/${tgId}/attempts`),
  certificatePdf: (number: string) => call<ArrayBuffer>("GET", `/certificates/${encodeURIComponent(number)}.pdf`),
  plans: () => call<Plan[]>("GET", "/plans"),
  createPayment: (data: { telegramId: string; planId: string; receiptFileId: string }) =>
    call<{ id: string; amountUzs: number; plan: string; user: { fullName: string; phone: string | null } }>("POST", "/payments", data),
  reviewPayment: (id: string, adminTelegramId: number, approve: boolean) =>
    call<{ status: string; userTelegramId: string | null; plan: string; subscriptionEndsAt: string | null }>("POST", `/payments/${id}/review`, { adminTelegramId: String(adminTelegramId), approve }),
  leaderboard: async (subjectId: string) => {
    const res = await fetch(`${API_URL}/api/public/leaderboard/${subjectId}?limit=10`);
    return (await res.json()) as Leader[];
  },
  setting: async <T>(key: string) => {
    const res = await fetch(`${API_URL}/api/public/settings/${key}`);
    return (await res.json()) as T | null;
  },
};
