import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Markdown } from "../../components/Markdown";
import { IconCheck, IconLeft, IconLock, IconPlay } from "../../components/icons";
import { Alert, Badge, Button, Card, PageLoader } from "../../components/ui";
import { api, ApiError, fmtDate } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useConfig } from "../../lib/config";

type Lesson = { id: string; title: string; durationSec: number | null; hasVideo: boolean; isPreview: boolean; locked: boolean; completed: boolean };
type Course = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPaid: boolean;
  subject: { id: string; name: string };
  hasAccess: boolean;
  expiresAt: string | null;
  modules: { id: string; title: string; lessons: Lesson[] }[];
};

export default function CoursePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const config = useConfig();
  const [c, setC] = useState<Course | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Course>(`/courses/${id}`).then(setC, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  }, [id, user?.id]);

  if (err) return <Alert>{err}</Alert>;
  if (!c) return <PageLoader />;

  const all = c.modules.flatMap((m) => m.lessons);
  const done = all.filter((l) => l.completed).length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const nextLesson = all.find((l) => !l.locked && !l.completed) ?? all.find((l) => !l.locked);
  const tg = config?.contacts?.telegram?.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "");

  return (
    <>
      <Link to="/courses" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <IconLeft className="h-4 w-4" /> Video darslar
      </Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-2 flex gap-1.5">
              <Badge tone="blue">{c.subject.name}</Badge>
              {!c.isPaid && <Badge tone="green">Bepul</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
          </div>
          {c.description && (
            <Card className="p-5">
              <Markdown>{c.description}</Markdown>
            </Card>
          )}
          <div className="space-y-4">
            {c.modules.map((m, mi) => (
              <Card key={m.id} className="overflow-hidden">
                <h2 className="border-b border-line bg-slate-50 px-4 py-3 text-sm font-semibold">
                  {mi + 1}. {m.title}
                </h2>
                <ul className="divide-y divide-line">
                  {m.lessons.map((l) => {
                    const row = (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${l.completed ? "bg-emerald-50 text-emerald-600" : l.locked ? "bg-slate-100 text-slate-400" : "bg-brand-50 text-brand-700"}`}>
                          {l.completed ? <IconCheck className="h-4 w-4" /> : l.locked ? <IconLock className="h-4 w-4" /> : <IconPlay className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${l.locked ? "text-slate-500" : "font-medium text-ink"}`}>{l.title}</span>
                          {l.durationSec ? <span className="text-xs text-muted">{Math.round(l.durationSec / 60)} daq</span> : null}
                        </span>
                        {l.isPreview && !c.hasAccess && <Badge tone="blue">Bepul ko'rish</Badge>}
                      </div>
                    );
                    return <li key={l.id}>{l.locked || !user ? row : <Link to={`/lessons/${l.id}`} className="block hover:bg-slate-50">{row}</Link>}</li>;
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </div>
        <div>
          <Card className="sticky top-20 overflow-hidden">
            {c.coverUrl && <img src={c.coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />}
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted">
                {c.modules.length} modul · {all.length} dars
              </p>
              {!user ? (
                <>
                  <Alert tone="blue">Darslarni ko'rish uchun Telegram orqali kiring.</Alert>
                  <Link to="/login" state={{ from: `/courses/${c.id}` }}>
                    <Button className="w-full">Kirish</Button>
                  </Link>
                </>
              ) : c.hasAccess ? (
                <>
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {done} / {all.length} dars tugatildi
                    </p>
                  </div>
                  {c.expiresAt && <p className="text-xs text-muted">Kurs {fmtDate(c.expiresAt)} gacha ochiq</p>}
                  {nextLesson && (
                    <Link to={`/lessons/${nextLesson.id}`}>
                      <Button className="w-full">{done ? "Davom etish" : "Boshlash"}</Button>
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Alert tone="amber">Bu kurs yopiq. Kursga yozilish uchun admin bilan bog'laning, to'lovdan keyin kurs sizga ochiladi.</Alert>
                  {tg ? (
                    <a href={`https://t.me/${tg}`} target="_blank" rel="noreferrer">
                      <Button className="w-full">Admin bilan bog'lanish</Button>
                    </a>
                  ) : config?.contacts?.phone ? (
                    <a href={`tel:${config.contacts.phone.replace(/[^\d+]/g, "")}`}>
                      <Button className="w-full">{config.contacts.phone}</Button>
                    </a>
                  ) : null}
                  {nextLesson && (
                    <Link to={`/lessons/${nextLesson.id}`}>
                      <Button variant="secondary" className="w-full">
                        Bepul darsni ko'rish
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
