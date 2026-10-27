import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CourseGrid } from "../components/CourseGrid";
import type { CourseCard } from "./courses/types";
import { api } from "../lib/api";
import { Button, Card } from "../components/ui";
import { IconAward, IconChart, IconCheck, IconPlay } from "../components/icons";
import { useAuth } from "../lib/auth";
import { siteTitle, useConfig } from "../lib/config";

const FEATURES = [
  { icon: IconPlay, title: "Video darslar", text: "Fanlar bo'yicha tartiblangan kurslar, modullar va darslar." },
  { icon: IconCheck, title: "Testlar va imtihonlar", text: "Taymer, savollar paneli va natijani darhol ko'rish." },
  { icon: IconAward, title: "Sertifikat", text: "QR kodli PDF sertifikat, uni istalgan kishi tekshira oladi." },
  { icon: IconChart, title: "Reyting", text: "Har bir fan bo'yicha eng yaxshi 10 talaba." },
];

export default function Home() {
  const { user } = useAuth();
  const config = useConfig();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  useEffect(() => {
    api<CourseCard[]>("/courses").then(setCourses, () => {});
  }, [user?.id]);
  const to = user ? (user.role === "ADMIN" ? "/admin" : "/cabinet") : "/login";
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">{siteTitle(config)}</h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">{config?.site?.tagline || "Video darslar, testlar va sertifikatlar bitta platformada."}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={to}>
              <Button size="lg">{user ? "Davom etish" : "Telegram orqali kirish"}</Button>
            </Link>
            <a href="#contacts">
              <Button size="lg" variant="secondary">
                Bog'lanish
              </Button>
            </a>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </Card>
          ))}
        </div>
        {courses.length > 0 && (
          <div className="mt-14">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Video darslar</h2>
              <Link to="/courses" className="text-sm font-medium text-brand-700 hover:underline">
                Barchasi
              </Link>
            </div>
            <CourseGrid courses={courses.slice(0, 6)} />
          </div>
        )}
        {config?.about?.text && (
          <Card className="mt-10 p-6">
            <h2 className="text-lg font-semibold">Biz haqimizda</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{config.about.text}</p>
          </Card>
        )}
      </section>
    </>
  );
}
