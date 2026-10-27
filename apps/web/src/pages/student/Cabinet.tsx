import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CourseGrid } from "../../components/CourseGrid";
import type { CourseCard } from "../courses/types";
import { Atom } from "../../components/Physics";
import { ProfileForm } from "../../components/ProfileForm";
import { IconAward, IconEdit } from "../../components/icons";
import { Badge, Button, Card, EmptyState, useToast } from "../../components/ui";
import { api, fmtDate, fullName } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function Cabinet() {
  const { user } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  const [certs, setCerts] = useState<{ number: string; issuedAt: string; scorePct: number; test: string; subject: string }[]>([]);
  const [attempts, setAttempts] = useState<{ id: string; status: string; startedAt: string; scorePct: number | null; test: { title: string } }[] | null>(null);
  useEffect(() => {
    api<CourseCard[]>("/courses?mine=1").then(setCourses, () => setCourses([]));
    api<typeof attempts>("/me/attempts").then(setAttempts, () => setAttempts([]));
    api<typeof certs>("/me/certificates").then(setCerts, () => setCerts([]));
  }, []);
  if (!user) return null;
  const scores = (attempts ?? []).filter((x) => x.status !== "IN_PROGRESS" && x.scorePct != null).map((x) => x.scorePct as number);
  const best = scores.length ? Math.max(...scores) : null;
  const rows: [string, string | null][] = [
    ["Telefon", user.phone],
    ["Viloyat", user.region],
    ["Tuman", user.district],
    ["Manzil", user.address],
    ["Ta'lim muassasasi", user.institution],
    ["Sinf yoki kurs", user.grade],
    ["Telegram", user.telegramUsername ? `@${user.telegramUsername}` : user.telegramId],
    ["Ro'yxatdan o'tgan", fmtDate(user.createdAt)],
  ];
  return (
    <>
      <div className="bg-cosmos relative mb-8 overflow-hidden rounded-3xl p-6 text-white sm:p-8">
        <div className="bg-grid-dark mask-fade absolute inset-0" />
        <Atom className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 opacity-60 sm:h-72 sm:w-72" />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-200">Shaxsiy kabinet</p>
          <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Salom, {user.firstName || "talaba"}!</h1>
          <dl className="mt-6 grid max-w-xl grid-cols-3 gap-3">
            {(
              [
                ["Kurslar", courses?.length ?? 0],
                ["Eng yaxshi natija", best == null ? "—" : `${best}%`],
                ["Sertifikat", certs.length],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                <dd className="truncate font-display text-lg font-semibold tabular-nums sm:text-2xl">{v}</dd>
                <dt className="mt-0.5 text-[11px] text-slate-300 sm:text-xs">{k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Kurslarim</h2>
          <Link to="/courses" className="text-sm font-medium text-brand-700 hover:underline">
            Barcha kurslar
          </Link>
        </div>
        {courses && courses.length > 0 ? (
          <CourseGrid courses={courses} />
        ) : (
          <Card>
            <EmptyState
              title="Hali ochilgan kurs yo'q"
              text="Pullik kursga yozilganingizdan keyin admin uni sizga ochadi va kurs shu yerda chiqadi."
              action={
                <Link to="/courses">
                  <Button variant="secondary">Kurslarni ko'rish</Button>
                </Link>
              }
            />
          </Card>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">{fullName(user)}</h2>
              <Badge tone="green">Faol</Badge>
            </div>
            {!editing && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <IconEdit className="h-4 w-4" /> Tahrirlash
              </Button>
            )}
          </div>
          {editing ? (
            <ProfileForm
              submitLabel="Saqlash"
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                toast("Ma'lumotlar saqlandi");
              }}
            />
          ) : (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="text-sm text-ink">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
        <div className="space-y-6">
          {certs.length > 0 && (
            <Card className="overflow-hidden">
              <h2 className="font-display border-b border-line px-5 py-3.5 font-semibold">Sertifikatlarim</h2>
              <ul className="divide-y divide-line">
                {certs.map((c) => (
                  <li key={c.number} className="flex items-center gap-3 px-5 py-3">
                    <IconAward className="h-5 w-5 shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.test}</span>
                      <span className="block text-xs text-muted">
                        {c.scorePct}% · {fmtDate(c.issuedAt)}
                      </span>
                    </span>
                    <a href={`/api/certificates/${c.number}/pdf?download=1`} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
                      PDF
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-display font-semibold">Test natijalari</h2>
              <Link to="/tests" className="text-sm font-medium text-brand-700 hover:underline">
                Testlar
              </Link>
            </div>
            {attempts && attempts.length > 0 ? (
              <ul className="divide-y divide-line">
                {attempts.slice(0, 10).map((a) => (
                  <li key={a.id}>
                    <Link to={`/attempts/${a.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{a.test.title}</span>
                        <span className="text-xs text-muted">{fmtDate(a.startedAt, true)}</span>
                      </span>
                      {a.status === "IN_PROGRESS" ? (
                        <Badge tone="blue">Davom etmoqda</Badge>
                      ) : (
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{a.scorePct}%</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Natijalar yo'q" text="Test topshirganingizdan keyin natijalaringiz shu yerda chiqadi." />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
