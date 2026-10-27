// Lokal ishlab chiqish: API 4000-portda, bot long polling rejimida (webhooksiz).
import { createApp } from "./app.js";
import { createBot } from "./bot/index.js";
import { env } from "./env.js";

createApp().listen(env.port, () => console.log(`API http://localhost:${env.port}`));

if (env.botToken) {
  const bot = createBot(env.botToken);
  await bot.api.deleteWebhook();
  void bot.start({ onStart: (me) => console.log(`Bot @${me.username} polling rejimida`) });
} else console.warn("BOT_TOKEN yo'q: bot ishga tushmadi");
