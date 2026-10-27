// Ishlab chiqarish (Render) uchun bitta jarayon: API + sayt (apps/web/dist) + Telegram bot webhook.
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { webhookCallback } from "grammy";
import { createBot } from "@att/bot";
import { createApp } from "./app.js";
import { env } from "./env.js";

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
let publicUrl = (process.env.PUBLIC_WEB_URL || process.env.RENDER_EXTERNAL_URL || "https://ustozlar-jamoasi.onrender.com").trim();
if (!publicUrl.startsWith("http://") && !publicUrl.startsWith("https://")) {
  publicUrl = `https://${publicUrl}`;
}

const bot = env.botToken ? createBot(env.botToken) : null;
// Webhook manzili tokenga bog'liq maxfiy yo'l: begona so'rovlar botga yetib bormaydi
const hookPath = `/api/telegram/${crypto.createHash("sha256").update(env.botToken).digest("hex").slice(0, 32)}`;

const app = createApp({
  beforeRoutes: (a) => {
    if (bot) a.post(hookPath, webhookCallback(bot, "express"));
  },
  beforeErrors: (a) => {
    a.use(express.static(webDist, { index: false, maxAge: "1h" }));
    // React marshrutlari (/tests, /verify/... va h.k.) uchun index.html
    a.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  },
});

app.listen(env.port, "0.0.0.0", async () => {
  console.log(`Server ${env.port}-portda ishga tushdi`);
  if (!bot) return console.warn("BOT_TOKEN berilmagan: bot o'chiq");
  if (!publicUrl?.startsWith("https://")) return console.warn("PUBLIC_WEB_URL https emas: webhook o'rnatilmadi");

  try {
    await bot.init();
    const cleanPublicUrl = publicUrl.replace(/\/+$/, "");
    const webhookUrl = `${cleanPublicUrl}${hookPath}`;
    await bot.api.setWebhook(webhookUrl, { drop_pending_updates: false });
    console.log(`Bot @${bot.botInfo.username} webhook rejimida: ${webhookUrl}`);
  } catch (err) {
    console.error("Bot webhook o'rnatishda xatolik yuz berdi (server ishlashda davom etadi):", err);
  }
});
