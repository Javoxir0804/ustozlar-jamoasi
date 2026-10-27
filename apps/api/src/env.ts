function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`${name} muhit o'zgaruvchisi berilmagan`);
  return v;
}

export const env = {
  port: Number(process.env.API_PORT ?? 4000),
  jwtSecret: req("JWT_SECRET", "dev-secret"),
  botToken: process.env.BOT_TOKEN ?? "",
  botApiKey: req("BOT_API_KEY", "dev-bot-key"),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? "http://localhost:5173",
};
