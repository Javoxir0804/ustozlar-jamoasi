// Ochiq reyting: har bir fan bo'yicha eng yaxshi natija ko'rsatgan 10 talaba.
import { useEffect, useState } from "react";
import { PageHeader } from "../../components/layouts";
import { Card, cx, EmptyState, PageLoader, Tabs } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export type LeaderRow = { userId: string; fullName: string; region: string | null; institution: string | null; bestPct: number; finishedAt: string };
type Board = { subject: { id: string; name: string }; rows: LeaderRow[] };

const MEDAL = ["bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-[0_4px_12px_-4px_rgb(245_158_11/0.8)]", "bg-gradient-to-br from-slate-300 to-slate-500 text-white", "bg-gradient-to-br from-orange-300 to-orange-500 text-white"];

/** Birinchi uchlik: shohsupa ko'rinishida (2, 1, 3 tartibida). */
function Podium({ rows }: { rows: LeaderRow[] }) {
  const order = [1, 0, 2];
  const heights = ["h-28", "h-20", "h-14"];
  return (
    <div className="bg-cosmos relative overflow-hidden px-4 pt-8 text-white">
      <div className="bg-grid-dark mask-fade absolute inset-0" />
      <div className="relative mx-auto grid max-w-md grid-cols-3 items-end gap-3">
        {order.map((i) => {
          const r = rows[i];
          return (
            <div key={r.userId} className="flex animate-rise flex-col items-center text-center" style={{ animationDelay: `${i * 120}ms` }}>
              <span className={cx("flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-semibold", MEDAL[i])}>{i + 1}</span>
              <p className="mt-2 line-clamp-2 text-xs font-semibold leading-tight sm:text-sm">{r.fullName}</p>
              <p className="font-mono text-xs text-ion">{r.bestPct}%</p>
              <div className={cx("mt-2 w-full rounded-t-xl border border-b-0 border-white/15 bg-white/10 backdrop-blur", heights[i])} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeaderTable({ rows }: { rows: LeaderRow[] }) {
  const { user } = useAuth();
  return (
    <ol className="divide-y divide-line">
      {rows.map((r, i) => (
        <li key={r.userId} className={cx("flex items-center gap-3 px-4 py-3 sm:px-5", r.userId === user?.id && "bg-brand-50")}>
          <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums", MEDAL[i] ?? "bg-slate-100 text-slate-600")}>{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {r.fullName}
              {r.userId === user?.id && <span className="ml-1.5 text-xs font-normal text-brand-700">(siz)</span>}
            </span>
            <span className="block truncate text-xs text-muted">{[r.region, r.institution].filter(Boolean).join(" · ") || "—"}</span>
          </span>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-brand-700">{r.bestPct}%</span>
        </li>
      ))}
    </ol>
  );
}

export default function Rating() {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [active, setActive] = useState("");
  useEffect(() => {
    api<Board[]>("/leaderboard").then(
      (b) => {
        setBoards(b);
        setActive(b[0]?.subject.id ?? "");
      },
      () => setBoards([]),
    );
  }, []);
  if (!boards) return <PageLoader />;
  const board = boards.find((b) => b.subject.id === active);
  return (
    <>
      <PageHeader title="Reyting" subtitle="Har bir fan bo'yicha eng yaxshi natija ko'rsatgan 10 talaba" />
      {boards.length === 0 ? (
        <Card>
          <EmptyState title="Reyting hali shakllanmagan" text="Talabalar test topshirgandan keyin eng yaxshi natijalar shu yerda chiqadi." />
        </Card>
      ) : (
        <>
          {boards.length > 1 && (
            <Tabs value={active} onChange={setActive} items={boards.map((b) => ({ value: b.subject.id, label: b.subject.name }))} />
          )}
          {board && (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-3.5">
                <h2 className="font-display font-semibold">{board.subject.name}</h2>
                <p className="text-xs text-muted">Har bir talabaning eng yaxshi natijasi olinadi; teng bo'lsa oldin topshirgan yuqorida turadi.</p>
              </div>
              {board.rows.length >= 3 && <Podium rows={board.rows.slice(0, 3)} />}
              <LeaderTable rows={board.rows} />
            </Card>
          )}
        </>
      )}
    </>
  );
}
