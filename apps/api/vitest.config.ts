import { defineConfig } from "vitest/config";

// Lokal .env (DATABASE_URL) bo'lsa yuklanadi; CI'da muhit o'zgaruvchilari ishlatiladi
try {
  process.loadEnvFile("../../.env");
} catch {
  /* .env yo'q */
}

export default defineConfig({
  test: { fileParallelism: false, env: { BOT_TOKEN: "123:TEST", JWT_SECRET: "test-secret", BOT_USERNAME: "test_bot" } },
});
