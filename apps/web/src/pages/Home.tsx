// Bosh sahifa: fizika uslubidagi kosmik hero, imkoniyatlar, qanday ishlaydi, kurslar va chaqiriq.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CourseGrid } from "../components/CourseGrid";
import { IconAward, IconChart, IconCheck, IconPlay, IconRight, IconSend } from "../components/icons";
import { Atom, FloatingFormulas, Wave } from "../components/Physics";
import { Button } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { siteTitle, useConfig } from "../lib/config";
import type { CourseCard } from "./courses/types";

type Stats = { students: number; lessons: number; tests: number; certificates: number };

const FEATURES = [
  { icon: IconPlay, title: "Video darslar", text: "Mexanikadan kvant fizikasigacha: modullarga bo'lingan darslar, formulali konspektlar va materiallar.", tone: "from-brand-500 to-brand-700" },
  { icon: IconCheck, title: "Testlar va imtihonlar", text: "Haqiqiy attestatsiya formatida: taymer, savollar paneli va har bir javob tahlili.", tone: "from-cyan-400 to-sky-600" },
  { icon: IconAward, title: "QR kodli sertifikat", text: "Yuqori natija uchun PDF sertifikat. Uning haqiqiyligini istalgan kishi QR orqali tekshiradi.", tone: "from-amber-300 to-orange-500" },
  { icon: IconChart, title: "Reyting", text: "Har bir fan bo'yicha Top 10. O'z o'rningizni ko'ring va kuchlilar bilan bellashing.", tone: "from-violet-400 to-fuchsia-600" },
];

const STEPS = [
  { n: "01", title: "Telegram orqali kiring", text: "Parol shart emas. Bir marta anketani to'ldirasiz." },
  { n: "02", title: "Darslarni o'rganing", text: "Video, konspekt va formulalar bilan mavzuni chuqur tushuning." },
  { n: "03", title: "Test topshiring", text: "Natija, tahlil va sertifikatni darhol oling." },
];

export default function Home() {
  const { user } = useAuth();
  const config = useConfig();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    api<CourseCard[]>("/courses").then(setCourses, () => {});
  }, [user?.id]);
  useEffect(() => {
    api<Stats>("/public/stats").then(setStats, () => {});
  }, []);
  const to = user ? (user.role === "ADMIN" ? "/admin" : "/cabinet") : "/login";
  const title = siteTitle(config);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="bg-cosmos relative overflow-hidden text-white">
        <div className="bg-grid-dark mask-fade absolute inset-0" />
        <FloatingFormulas />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
          <div className="stagger">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-xs text-brand-200 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ion" />
              Fizika · attestatsiyaga tayyorgarlik
            </span>
            <h1 className="mt-5 font-display text-[1.85rem] font-medium leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[2.9rem]">
              Fizikani <span className="text-gradient">tushunib</span> o'rganing,
              <br className="hidden sm:block" /> imtihonni ishonch bilan topshiring
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              {config?.site?.tagline || `${title}: video darslar, testlar va QR kodli sertifikatlar bitta platformada.`}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={to}>
                <Button size="lg">
                  {user ? (
                    "Davom etish"
                  ) : (
                    <>
                      <IconSend className="h-5 w-5" /> Telegram orqali kirish
                    </>
                  )}
                </Button>
              </Link>
              <Link to="/courses">
                <Button size="lg" variant="ghost" className="border border-white/15 bg-white/5 !text-white hover:!bg-white/10">
                  Darslarni ko'rish <IconRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            {stats && (
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
                {(
                  [
                    ["Talaba", stats.students],
                    ["Dars", stats.lessons],
                    ["Test", stats.tests],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dd className="font-display text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                      <Counter value={v} />
                    </dd>
                    <dt className="mt-0.5 text-xs uppercase tracking-wider text-slate-400">{k}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[420px]">
            <div className="absolute inset-[12%] rounded-full border border-white/10" />
            <div className="absolute inset-[2%] rounded-full border border-dashed border-white/10 animate-orbit-slow" />
            <Atom className="relative h-full w-full drop-shadow-[0_0_40px_rgba(91,108,255,0.45)]" />
          </div>
        </div>
        <Wave className="absolute inset-x-0 bottom-0 h-20 w-full text-ion/40" />
      </section>

      {/* ---------- Imkoniyatlar ---------- */}
      <section className="bg-grid relative">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <SectionTitle kicker="Imkoniyatlar" title="Tayyorgarlik uchun hammasi bir joyda" />
          <div className="stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-lift group relative overflow-hidden rounded-2xl border border-line bg-white p-6">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.tone} text-white shadow-lg transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105`}>
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Qanday ishlaydi ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <SectionTitle kicker="Qanday ishlaydi" title="Uch qadamda boshlang" />
        <div className="relative mt-12">
          <Wave className="absolute inset-x-0 top-6 hidden h-12 w-full text-brand-300 md:block" />
          <ol className="relative grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cosmos-900 font-mono text-sm font-semibold text-ion shadow-[0_0_0_6px_var(--color-surface),0_10px_30px_-10px_rgb(67_83_240/0.8)]">
                  {s.n}
                </span>
                <h3 className="mt-5 font-display text-base font-semibold">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Kurslar ---------- */}
      {courses.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:pb-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <SectionTitle kicker="Kurslar" title="Video darslar" left />
            <Link to="/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:gap-2 transition-all">
              Barcha kurslar <IconRight className="h-4 w-4" />
            </Link>
          </div>
          <CourseGrid courses={courses.slice(0, 6)} />
        </section>
      )}

      {/* ---------- Biz haqimizda ---------- */}
      {config?.about?.text && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="grid gap-6 rounded-3xl border border-line bg-white p-6 sm:p-10 md:grid-cols-[200px_1fr]">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-600">Biz haqimizda</p>
            <p className="whitespace-pre-line leading-relaxed text-slate-700">{config.about.text}</p>
          </div>
        </section>
      )}

      {/* ---------- Chaqiriq ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="bg-cosmos relative overflow-hidden rounded-3xl px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <div className="bg-grid-dark mask-fade absolute inset-0" />
          <p className="relative font-mono text-sm text-brand-200">E = mc² · F = ma · λ = h/p</p>
          <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-2xl font-semibold leading-tight sm:text-4xl">Bilimingizni sinab ko'ring va sertifikat oling</h2>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/tests">
              <Button size="lg">Testlarni ko'rish</Button>
            </Link>
            <Link to="/rating">
              <Button size="lg" variant="ghost" className="border border-white/15 bg-white/5 !text-white hover:!bg-white/10">
                Reytingni ko'rish
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ kicker, title, left }: { kicker: string; title: string; left?: boolean }) {
  return (
    <div className={left ? "" : "text-center"}>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-brand-600">{kicker}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-[2rem]">{title}</h2>
    </div>
  );
}

/** Raqam 0 dan qiymatgacha tez o'sadi. */
function Counter({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!value) return setN(0);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1200);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n.toLocaleString("ru-RU")}</>;
}
