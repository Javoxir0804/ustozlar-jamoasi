import { defineConfig } from "vitest/config";

export default defineConfig({ test: { fileParallelism: false, env: { BOT_TOKEN: "123:TEST", JWT_SECRET: "test", BOT_API_KEY: "botkey" } } });
