import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/layouts";
import { IconLock } from "../../components/icons";
import { Alert, Badge, Card, cx, EmptyState, PageLoader } from "../../components/ui";
import { api, ApiError, fmtDate } from "../../lib/api";
import { AtomMark } from "../../components/Physics";
import type { TestCard } from "./types";

export function TestStateBadge({ t }: { t: TestCard }) {
  if (t.openAttemptId) return <Badge tone="blue">Davom etmoqda</Badge>;
  if (t.state === "UPCOMING") return <Badge tone="amber">{fmtDate(t.opensAt, true)} da ochiladi</Badge>;
  if (t.state === "CLOSED") return <Badge>Yopilgan</Badge>;
  if (t.locked)
    return (
      <Badge>
        <IconLock className="mr-1 h-3 w-3" /> Yopiq
      </Badge>
    );
  if (t.bestScore != null) return <Badge tone="green">Eng yaxshi: {t.bestScore}%</Badge>;
  return null;
}

export default function TestList() {
  const [list, setList] = useState<TestCard[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  useEffect(() => {
    api<TestCard[]>("/tests").then(setList, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  }, []);
  const subjects = useMemo(() => [...new Map((list ?? []).map((t) => [t.subject.id, t.subject])).values()], [list]);
  if (err) return <Alert>{err}</Alert>;
  if (!list) return <PageLoader />;
  const shown = list.filter((t) => !subject || t.subject.id === subject);
  return (
    <>
      <PageHeader title="Testlar" subtitle="Bilimingizni sinab ko'ring" />
      {subjects.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "", name: "Barchasi" }, ...subjects].map((s) => (
            <button key={s.id} onClick={() => setSubject(s.id)} className={cx("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium", subject === s.id ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-line hover:bg-slate-50")}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <Card>
          <EmptyState title="Hozircha testlar yo'q" />
        </Card>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2">
          {shown.map((t) => (
            <Link key={t.id} to={`/tests/${t.id}`} className="group">
              <Card className="card-lift relative h-full overflow-hidden p-5 pl-20">
                <span className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-xl bg-cosmos-900 text-brand-300 transition-transform duration-500 group-hover:rotate-12">
                  <AtomMark className="h-7 w-7" />
                </span>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge tone="blue">{t.subject.name}</Badge>
                  <TestStateBadge t={t} />
                </div>
                <h3 className="font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-brand-700">{t.title}</h3>
                <p className="mt-1 text-sm text-muted">
                  {t.questionCount} ta savol · {t.durationMin} daqiqa
                  {t.maxAttempts ? ` · ${t.attemptsUsed}/${t.maxAttempts} urinish` : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
