import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyLoginWidget, verifyWebAppInitData } from "../src/auth/telegram.js";
import { signInitData } from "./helpers.js";

const TOKEN = "123:TEST";

describe("Telegram imzo tekshiruvi", () => {
  it("to'g'ri initData ni qabul qiladi", () => {
    expect(verifyWebAppInitData(signInitData({ id: 42 }), TOKEN)?.id).toBe(42);
  });
  it("boshqa token bilan imzolanganini rad etadi", () => {
    expect(verifyWebAppInitData(signInitData({ id: 42 }, "999:OTHER"), TOKEN)).toBeNull();
  });
  it("eskirgan initData ni rad etadi", () => {
    expect(verifyWebAppInitData(signInitData({ id: 42 }, TOKEN, 1000), TOKEN)).toBeNull();
  });
  it("Login Widget imzosini tekshiradi", () => {
    const data: Record<string, string | number> = { id: 7, first_name: "Ali", auth_date: Math.floor(Date.now() / 1000) };
    const dc = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join("\n");
    data.hash = crypto.createHmac("sha256", crypto.createHash("sha256").update(TOKEN).digest()).update(dc).digest("hex");
    expect(verifyLoginWidget(data, TOKEN)?.id).toBe(7);
    expect(verifyLoginWidget({ ...data, id: 8 }, TOKEN)).toBeNull();
  });
});
