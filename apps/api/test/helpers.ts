import crypto from "node:crypto";

const TOKEN = "123:TEST";

/** Bot ichidagi Web App initData'sini test uchun imzolaydi. */
export function signInitData(user: object, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify(user) });
  const dc = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(TOKEN).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(dc).digest("hex"));
  return params.toString();
}

/** Saytdagi Telegram Login Widget ma'lumotini imzolaydi. */
export function signWidget(data: Record<string, string | number>) {
  const dc = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join("\n");
  const secret = crypto.createHash("sha256").update(TOKEN).digest();
  return { ...data, hash: crypto.createHmac("sha256", secret).update(dc).digest("hex") };
}
