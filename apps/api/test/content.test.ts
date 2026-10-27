// 2-bosqich: fan, kurs, modul, dars; pullik kursga ruxsat; dars fayllari himoyasi; dars progressi.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@edu/db";
import { createApp } from "../src/app.js";
import { signToken } from "../src/auth/session.js";

const app = createApp();
const tag = `c${Date.now()}`;
let admin = "";
let student = "";
let studentId = "";
let outsider = "";
const ids = { subject: "", course: "", module: "", lesson: "", preview: "", file: "", image: "" };
const as = (t: string) => ({ authorization: `Bearer ${t}` });

beforeAll(async () => {
  const a = await prisma.user.create({ data: { role: "ADMIN", login: `${tag}a`, firstName: "A", profileCompleted: true } });
  const s = await prisma.user.create({ data: { firstName: "S", profileCompleted: true } });
  const o = await prisma.user.create({ data: { firstName: "O", profileCompleted: true } });
  admin = signToken(a.id);
  student = signToken(s.id);
  studentId = s.id;
  outsider = signToken(o.id);
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { OR: [{ login: `${tag}a` }, { firstName: { in: ["S", "O"] }, createdAt: { gt: new Date(Date.now() - 600_000) }, telegramId: null, role: "STUDENT" }] } });
  const uids = users.map((u) => u.id);
  if (ids.course) await prisma.course.deleteMany({ where: { id: ids.course } });
  if (ids.subject) await prisma.subject.deleteMany({ where: { id: ids.subject } });
  await prisma.file.deleteMany({ where: { uploadedById: { in: uids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: uids } } });
  await prisma.user.deleteMany({ where: { id: { in: uids } } });
  await prisma.$disconnect();
});

describe("admin: kontent", () => {
  it("talaba admin bo'limiga kira olmaydi", async () => {
    expect((await request(app).get("/api/admin/subjects").set(as(student))).status).toBe(403);
  });

  it("fan, kurs, modul va darslar yaratiladi", async () => {
    const s = await request(app).post("/api/admin/subjects").set(as(admin)).send({ name: `Fizika ${tag}` });
    expect(s.status).toBe(200);
    ids.subject = s.body.id;
    expect(s.body.slug).toMatch(/^fizika-/);

    const c = await request(app).post("/api/admin/courses").set(as(admin)).send({ subjectId: ids.subject, title: "Mexanika", isPaid: true, isPublished: true });
    expect(c.status).toBe(200);
    ids.course = c.body.id;

    const m = await request(app).post(`/api/admin/courses/${ids.course}/modules`).set(as(admin)).send({ title: "Kinematika" });
    ids.module = m.body.id;

    const l1 = await request(app).post(`/api/admin/modules/${ids.module}/lessons`).set(as(admin)).send({ title: "Tanishuv", videoUrl: "https://youtu.be/dQw4w9WgXcQ", isPreview: true });
    const l2 = await request(app).post(`/api/admin/modules/${ids.module}/lessons`).set(as(admin)).send({ title: "Tezlik", content: "$v = s/t$" });
    ids.preview = l1.body.id;
    ids.lesson = l2.body.id;
    expect(l2.body.order).toBe(1);

    const tree = await request(app).get(`/api/admin/courses/${ids.course}`).set(as(admin));
    expect(tree.body.modules[0].lessons.map((l: { title: string }) => l.title)).toEqual(["Tanishuv", "Tezlik"]);
  });

  it("darsga fayl biriktiriladi", async () => {
    const up = await request(app).post(`/api/admin/files?kind=MATERIAL&name=konspekt.pdf&mime=application/pdf`).set(as(admin)).set("content-type", "application/octet-stream").send(Buffer.from("%PDF-1.4 test"));
    expect(up.status).toBe(200);
    ids.file = up.body.id;
    const lf = await request(app).post(`/api/admin/lessons/${ids.lesson}/files`).set(as(admin)).send({ fileId: ids.file, title: "Konspekt" });
    expect(lf.status).toBe(200);
    const img = await request(app).post(`/api/admin/files?kind=IMAGE&name=a.txt&mime=text/plain`).set(as(admin)).set("content-type", "application/octet-stream").send(Buffer.from("x"));
    expect(img.status).toBe(400);
  });
});

describe("talaba: kurslar va ruxsat", () => {
  it("katalogda kurs ko'rinadi, lekin yopiq", async () => {
    const r = await request(app).get("/api/courses").set(as(student));
    const c = r.body.find((x: { id: string }) => x.id === ids.course);
    expect(c.hasAccess).toBe(false);
    expect(c.lessonCount).toBe(2);
    const d = await request(app).get(`/api/courses/${ids.course}`).set(as(student));
    expect(d.body.modules[0].lessons.map((l: { locked: boolean }) => l.locked)).toEqual([false, true]);
  });

  it("tanishtiruv darsi ochiq, qolgani va fayli yopiq", async () => {
    const p = await request(app).get(`/api/lessons/${ids.preview}`).set(as(student));
    expect(p.status).toBe(200);
    expect(p.body.video).toEqual({ kind: "iframe", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0" });
    expect((await request(app).get(`/api/lessons/${ids.lesson}`).set(as(student))).status).toBe(403);
    expect((await request(app).get(`/api/files/${ids.file}`).set(as(student))).status).toBe(403);
    expect((await request(app).get(`/api/files/${ids.file}`)).status).toBe(401);
  });

  it("admin ruxsat bergach dars, fayl va progress ishlaydi", async () => {
    const g = await request(app).post(`/api/admin/courses/${ids.course}/access`).set(as(admin)).send({ userIds: [studentId] });
    expect(g.body.granted).toBe(1);
    const l = await request(app).get(`/api/lessons/${ids.lesson}`).set(as(student));
    expect(l.status).toBe(200);
    expect(l.body.prev.id).toBe(ids.preview);
    expect(l.body.files[0].title).toBe("Konspekt");
    const f = await request(app).get(`/api/files/${ids.file}?t=${student}`);
    expect(f.status).toBe(200);
    expect(f.headers["content-type"]).toBe("application/pdf");
    expect((await request(app).post(`/api/lessons/${ids.lesson}/complete`).set(as(student)).send({})).body.completed).toBe(true);
    const mine = await request(app).get("/api/courses?mine=1").set(as(student));
    expect(mine.body.find((x: { id: string }) => x.id === ids.course).completedCount).toBe(1);
    // Boshqa talabaga ochilmagan
    expect((await request(app).get(`/api/lessons/${ids.lesson}`).set(as(outsider))).status).toBe(403);
  });

  it("muddati o'tgan ruxsat ishlamaydi, bekor qilingan ham", async () => {
    await request(app).post(`/api/admin/courses/${ids.course}/access`).set(as(admin)).send({ userIds: [studentId], expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect((await request(app).get(`/api/lessons/${ids.lesson}`).set(as(student))).status).toBe(403);
    await request(app).post(`/api/admin/courses/${ids.course}/access`).set(as(admin)).send({ userIds: [studentId] });
    const list = await request(app).get(`/api/admin/courses/${ids.course}/access`).set(as(admin));
    expect(list.body).toHaveLength(1);
    await request(app).delete(`/api/admin/access/${list.body[0].id}`).set(as(admin));
    expect((await request(app).get(`/api/lessons/${ids.lesson}`).set(as(student))).status).toBe(403);
  });

  it("nashr qilinmagan kurs talabaga ko'rinmaydi; kursli fanni o'chirib bo'lmaydi", async () => {
    await request(app).patch(`/api/admin/courses/${ids.course}`).set(as(admin)).send({ isPublished: false });
    expect((await request(app).get(`/api/courses/${ids.course}`).set(as(student))).status).toBe(404);
    expect((await request(app).delete(`/api/admin/subjects/${ids.subject}`).set(as(admin))).status).toBe(400);
  });
});
