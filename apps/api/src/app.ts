import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./env.js";
import { errorHandler } from "./lib/errors.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { botRouter } from "./routes/bot.js";
import { publicRouter } from "./routes/public.js";
import { testsRouter } from "./routes/tests.js";

// BigInt (Telegram ID) JSON ga satr bo'lib chiqadi
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

export function createApp(opts: { beforeErrors?: (app: express.Express) => void } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Telegram Web App SDK va Login Widget; KaTeX inline uslublari
          scriptSrc: ["'self'", "https://telegram.org"],
          frameSrc: ["https://oauth.telegram.org"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "data:"],
          // Bot ichida Telegram sahifani iframe'da ochadi
          frameAncestors: ["'self'", "https://web.telegram.org", "https://*.telegram.org"],
        },
      },
      frameguard: false,
    }),
  );
  app.use(cors({ origin: env.webOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", rateLimit({ windowMs: 60_000, limit: 300 }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/bot", botRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", testsRouter);

  opts.beforeErrors?.(app);
  app.use(errorHandler);
  return app;
}
