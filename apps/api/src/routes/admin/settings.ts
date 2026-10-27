import { Router } from "express";
import { z } from "zod";
import { prisma } from "@edu/db";
import { audit } from "../../auth/session.js";
import { badRequest, h } from "../../lib/errors.js";

export const settingsRouter = Router();

const schemas = {
  site: z.object({ title: z.string().trim().max(100).default(""), tagline: z.string().trim().max(300).default("") }),
  contacts: z.object({
    phone: z.string().trim().max(40).default(""),
    telegram: z.string().trim().max(100).default(""),
    address: z.string().trim().max(300).default(""),
    email: z.string().trim().max(100).default(""),
    mapUrl: z.string().trim().max(500).default(""),
  }),
  about: z.object({ text: z.string().trim().max(5000).default("") }),
} as const;

settingsRouter.get(
  "/settings",
  h(async (_req, res) => {
    const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(schemas) } } });
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }),
);

settingsRouter.put(
  "/settings/:key",
  h(async (req, res) => {
    const key = req.params.key;
    if (!(key in schemas)) throw badRequest("BAD_KEY", "Noma'lum sozlama");
    const value = schemas[key as keyof typeof schemas].parse(req.body);
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await audit(req.user!.id, "setting.update", "Setting", key);
    res.json(value);
  }),
);

// ---------- Majburiy kanallar (bot) ----------
const channelSchema = z.object({
  chatId: z.string().trim().regex(/^(@[A-Za-z0-9_]{4,}|-100\d{5,})$/, "Kanal: @kanal_nomi yoki -100... ID"),
  title: z.string().trim().min(1, "Kanal nomini kiriting").max(100),
  inviteUrl: z.string().trim().url("Havola noto'g'ri"),
  isActive: z.boolean().default(true),
  order: z.number().int().default(0),
});

settingsRouter.get("/channels", h(async (_req, res) => res.json(await prisma.channel.findMany({ orderBy: { order: "asc" } }))));
settingsRouter.post("/channels", h(async (req, res) => res.json(await prisma.channel.create({ data: channelSchema.parse(req.body) }))));
settingsRouter.patch(
  "/channels/:id",
  h(async (req, res) => res.json(await prisma.channel.update({ where: { id: req.params.id }, data: channelSchema.partial().parse(req.body) }))),
);
settingsRouter.delete(
  "/channels/:id",
  h(async (req, res) => {
    await prisma.channel.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);
