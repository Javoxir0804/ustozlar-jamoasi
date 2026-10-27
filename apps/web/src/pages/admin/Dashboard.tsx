import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/layouts";
import { Alert, Badge, Card, cx, EmptyState, PageLoader } from "../../components/ui";
import { api, ApiError, fmtDate, fullName, type User } from "../../lib/api";

type Stats = { students: number; completed: number; newToday: number; newWeek: number; activeToday: number; blocked: number; admins: number; recent: User[] };

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<Stats>("/admin/dashboard").then(setS, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  }, []);
  if (err) return <Alert>{err}</Alert>;
  if (!s) return <PageLoader />;
  const tiles = [
    { label: "Jami talabalar", value: s.students },
    { label: "Anketani to'ldirgan", value: s.completed },
    { label: "Bugun qo'shilgan", value: s.newToday },
    { label: "Shu hafta qo'shilgan", value: s.newWeek },
    { label: "Bugun faol", value: s.activeToday },
    { label: "Bloklangan", value: s.blocked },
  ];
  return (
    <>
      <PageHeader title="Bosh panel" subtitle="Platformadagi asosiy ko'rsatkichlar" />
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-3">
        {tiles.map((t, i) => (
          <Card key={t.label} className={cx("relative overflow-hidden p-5", i === 0 && "bg-cosmos border-transparent text-white")}>
            {i === 0 && <div className="bg-grid-dark mask-fade absolute inset-0" />}
            <p className={cx("relative text-sm", i === 0 ? "text-slate-300" : "text-muted")}>{t.label}</p>
            <p className={cx("relative mt-2 font-display text-3xl font-semibold tabular-nums", i === 0 ? "text-white" : "text-ink")}>{t.value.toLocaleString("ru-RU")}</p>
            <span className={cx("absolute right-4 top-4 h-2 w-2 rounded-full", i === 0 ? "bg-ion animate-pulse" : "bg-brand-200")} />
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display font-semibold">Yangi talabalar</h2>
          <Link to="/admin/students" className="text-sm font-medium text-brand-700 hover:underline">
            Barchasi
          </Link>
        </div>
        {s.recent.length === 0 ? (
          <EmptyState title="Hali talabalar yo'q" text="Talabalar bot yoki sayt orqali Telegram bilan kirganda shu yerda ko'rinadi." />
        ) : (
          <ul className="divide-y divide-line">
            {s.recent.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{fullName(u)}</p>
                  <p className="truncate text-xs text-muted">{[u.phone, u.region].filter(Boolean).join(" · ") || "Anketa to'ldirilmagan"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!u.profileCompleted && <Badge tone="amber">Anketasiz</Badge>}
                  <span className="text-xs text-muted">{fmtDate(u.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
