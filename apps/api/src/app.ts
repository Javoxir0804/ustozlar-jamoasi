import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./lib/errors.js";
import { adminRouter } from "./routes/admin/index.js";
import { authRouter } from "./routes/auth.js";
import { coursesRouter } from "./routes/courses.js";
import { filesRouter } from "./routes/files.js";
import { publicRouter } from "./routes/public.js";
import { testsRouter } from "./routes/tests.js";

// BigInt (Telegram ID) JSON da satr bo'lib chiqadi
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

export function createApp(opts: { beforeApi?: (app: express.Express) => void; afterApi?: (app: express.Express) => void } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Telegram Web App SDK va Login Widget; KaTeX inline uslublari; video pleyerlar
          scriptSrc: ["'self'", "https://telegram.org"],
          frameSrc: ["https://oauth.telegram.org", "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://iframe.mediadelivery.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          mediaSrc: ["'self'", "https:", "blob:"],
          // Bot ichida Telegram sahifani iframe'da ochadi
          frameAncestors: ["'self'", "https://web.telegram.org", "https://*.telegram.org"],
        },
      },
      frameguard: false,
    }),
  );
  // Kirish Bearer token orqali (cookie yo'q), shuning uchun CORS ochiq bo'lishi xavfsiz
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_req, res) => res.json({ ok: true }));

  opts.beforeApi?.(app);

  app.use("/api", rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  app.use("/api/auth", authRouter);
  app.use("/api/public", publicRouter);
  // Fayl yuklash JSON chegarasidan katta: admin routerdan oldin
  app.use("/api", filesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", coursesRouter);
  app.use("/api", testsRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Bunday manzil yo'q" } }));

  opts.afterApi?.(app);
  app.use(errorHandler);
  return app;
}
