function publicUrl() {
  const raw = (process.env.PUBLIC_WEB_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173").trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

const isProd = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET ?? (isProd ? "" : "dev-secret");
if (!jwtSecret) throw new Error("JWT_SECRET berilmagan");

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  botToken: process.env.BOT_TOKEN ?? "",
  botUsername: (process.env.BOT_USERNAME ?? "").replace(/^@/, ""),
  // Yangi talaba haqida xabar boradigan chat (admin yoki guruh), ixtiyoriy
  adminChatId: process.env.ADMIN_CHAT_ID ?? "",
  publicWebUrl: publicUrl(),
};
