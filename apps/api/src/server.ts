// Ishlab chiqarish: bitta jarayon API + sayt (apps/web/dist) + Telegram bot (webhook).
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { webhookCallback } from "grammy";
import { createApp } from "./app.js";
import { createBot } from "./bot/index.js";
import { env } from "./env.js";

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
const bot = env.botToken ? createBot(env.botToken) : null;
// Webhook manzili tokendan olingan maxfiy yo'l: begona so'rov botga yetib bormaydi
const hookPath = `/telegram/${crypto.createHash("sha256").update(env.botToken).digest("hex").slice(0, 32)}`;

const app = createApp({
  beforeApi: (a) => {
    if (bot) a.post(hookPath, webhookCallback(bot, "express", { onTimeout: "return", timeoutMilliseconds: 25_000 }));
  },
  afterApi: (a) => {
    a.use("/assets", express.static(path.join(webDist, "assets"), { immutable: true, maxAge: "1y" }));
    a.use(express.static(webDist, { index: false, maxAge: "1h" }));
    a.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  },
});

app.listen(env.port, "0.0.0.0", async () => {
  console.log(`Server ${env.port}-portda, manzil: ${env.publicWebUrl}`);
  if (!bot) return console.warn("BOT_TOKEN berilmagan: bot o'chiq");
  if (!env.publicWebUrl.startsWith("https://")) return console.warn("PUBLIC_WEB_URL https emas: webhook o'rnatilmadi");
  try {
    await bot.init();
    await bot.api.setWebhook(`${env.publicWebUrl}${hookPath}`);
    await bot.api.setMyCommands([{ command: "start", description: "Bosh menyu" }]);
    await bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: "Platforma", web_app: { url: `${env.publicWebUrl}/` } } });
    console.log(`Bot @${bot.botInfo.username} webhook rejimida ishlayapti`);
  } catch (e) {
    console.error("Bot webhook o'rnatilmadi (sayt ishlashda davom etadi):", e);
  }
});
