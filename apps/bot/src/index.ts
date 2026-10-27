import { createBot } from "./bot.js";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN berilmagan (.env)");

const bot = createBot(token);
bot.start({ onStart: (me) => console.log(`Bot ishga tushdi: @${me.username}`) });
