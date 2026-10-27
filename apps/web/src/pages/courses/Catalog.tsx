// Video darslar: fanlar bo'yicha kurslar katalogi (kirmagan mehmonga ham ko'rinadi).
import { useEffect, useMemo, useState } from "react";
import { CourseGrid } from "../../components/CourseGrid";
import { PageHeader } from "../../components/layouts";
import { Alert, Card, cx, EmptyState, PageLoader } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { CourseCard } from "./types";

export default function Catalog() {
  const [list, setList] = useState<CourseCard[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubject] = useState("");

  useEffect(() => {
    api<CourseCard[]>("/courses").then(setList, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  }, []);

  const subjects = useMemo(() => [...new Map((list ?? []).map((c) => [c.subject.id, c.subject])).values()], [list]);
  const shown = (list ?? []).filter((c) => !subject || c.subject.id === subject);

  if (err) return <Alert>{err}</Alert>;
  if (!list) return <PageLoader />;
  return (
    <>
      <PageHeader title="Video darslar" subtitle="Fanlar bo'yicha kurslar" />
      {subjects.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "", name: "Barchasi" }, ...subjects].map((s) => (
            <button key={s.id} onClick={() => setSubject(s.id)} className={cx("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition", subject === s.id ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-line hover:bg-slate-50")}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <Card>
          <EmptyState title="Kurslar tez orada" text="Hozircha nashr qilingan kurs yo'q." />
        </Card>
      ) : (
        <CourseGrid courses={shown} />
      )}
    </>
  );
}
