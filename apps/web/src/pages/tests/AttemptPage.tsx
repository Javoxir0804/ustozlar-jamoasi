// Test oynasi: taymer, savollar paneli, belgilash, oldinga-orqaga, yakunlash; tugagach natija va javoblar tahlili.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Markdown } from "../../components/Markdown";
import { IconAward, IconCheck, IconLeft, IconRight } from "../../components/icons";
import { Alert, Button, Card, cx, Modal, PageLoader, useToast } from "../../components/ui";
import { api, ApiError } from "../../lib/api";

type Option = { id: string; text: string; imageUrl: string | null; isCorrect?: boolean };
type Question = { n: number; id: string; text: string; imageUrl: string | null; explanation?: string | null; isCorrect?: boolean; options: Option[]; selected: string | null; flagged: boolean };
type View = {
  id: string;
  test: { id: string; title: string; durationMin: number; showAnswers: boolean; subject: { name: string } };
  status: "IN_PROGRESS" | "FINISHED" | "EXPIRED";
  startedAt: string;
  finishedAt: string | null;
  serverNow: string;
  deadlineAt: string;
  result: { correctCount: number; totalCount: number; scorePct: number; rank: number | null; participants: number; certificate: string | null } | null;
  reveal: boolean;
  questions: Question[];
};

const LETTERS = "ABCDEFGH";
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (x: number) => String(x).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

export default function AttemptPage() {
  const { id } = useParams();
  const [view, setView] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api<View>(`/attempts/${id}`).then(setView, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi")), [id]);
  useEffect(() => {
    load();
  }, [load]);
  if (err) return <div className="mx-auto max-w-md p-6"><Alert>{err}</Alert></div>;
  if (!view) return <PageLoader />;
  return view.status === "IN_PROGRESS" ? <TestWindow view={view} onFinished={load} /> : <ResultView view={view} />;
}

function TestWindow({ view, onFinished }: { view: View; onFinished: () => void }) {
  const toast = useToast();
  const [qs, setQs] = useState(view.questions);
  const [cur, setCur] = useState(() => Math.max(0, view.questions.findIndex((q) => !q.selected)));
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [panel, setPanel] = useState(false);
  const pending = useRef(0);
  // Server va qurilma soati farqi: taymer server vaqtiga tayanadi
  const offset = useRef(new Date(view.serverNow).getTime() - Date.now());
  const deadline = new Date(view.deadlineAt).getTime();
  const left = deadline - (now + offset.current);

  const finish = useCallback(async () => {
    setFinishing(true);
    // Saqlanayotgan javoblar tugashini kutamiz
    for (let i = 0; i < 20 && pending.current > 0; i++) await new Promise((r) => setTimeout(r, 150));
    try {
      await api(`/attempts/${view.id}/finish`, { body: {} });
    } catch {
      /* vaqt tugagan bo'lsa server o'zi yakunlagan */
    }
    onFinished();
  }, [view.id, onFinished]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0 && !finishing) {
      toast("Vaqt tugadi. Test yakunlandi.");
      finish();
    }
  }, [left, finishing, finish, toast]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function save(q: Question, patch: { optionId?: string | null; flagged?: boolean }) {
    const prev = q;
    setQs((s) => s.map((x) => (x.id === q.id ? { ...x, ...(patch.optionId !== undefined ? { selected: patch.optionId } : {}), ...(patch.flagged !== undefined ? { flagged: patch.flagged } : {}) } : x)));
    pending.current++;
    try {
      await api(`/attempts/${view.id}/answers/${q.id}`, { method: "PUT", body: patch });
    } catch (e) {
      setQs((s) => s.map((x) => (x.id === q.id ? prev : x)));
      if (e instanceof ApiError && (e.code === "TIME_UP" || e.code === "ATTEMPT_FINISHED")) onFinished();
      else toast(e instanceof ApiError ? e.message : "Javob saqlanmadi, qayta tanlang", "error");
    } finally {
      pending.current--;
    }
  }

  const q = qs[cur];
  const answered = qs.filter((x) => x.selected).length;
  const flagged = qs.filter((x) => x.flagged).length;
  const urgent = left < 5 * 60_000;

  const grid = (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
      {qs.map((x, i) => (
        <button
          key={x.id}
          onClick={() => (setCur(i), setPanel(false))}
          className={cx(
            "relative flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition",
            x.selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            i === cur && "ring-2 ring-brand-500 ring-offset-2",
          )}
        >
          {x.n}
          {x.flagged && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white" />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface pb-24 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{view.test.title}</p>
            <p className="text-xs text-muted">
              {answered}/{qs.length} javob berildi
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cx("rounded-lg px-3 py-1.5 font-mono text-base font-bold tabular-nums", urgent ? "animate-pulse bg-red-50 text-red-700" : "bg-slate-100 text-ink")} aria-label="Qolgan vaqt">
              {clock(left)}
            </span>
            <Button size="sm" onClick={() => setConfirming(true)}>
              Yakunlash
            </Button>
          </div>
        </div>
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${(answered / qs.length) * 100}%` }} />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_280px]">
        <Card className="p-5 sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted">
              Savol {q.n} / {qs.length}
            </span>
            <button
              onClick={() => save(q, { flagged: !q.flagged })}
              className={cx("rounded-full px-3 py-1 text-xs font-medium ring-1 transition", q.flagged ? "bg-amber-50 text-amber-800 ring-amber-300" : "text-slate-500 ring-line hover:bg-slate-50")}
            >
              {q.flagged ? "★ Belgilangan" : "☆ Belgilash"}
            </button>
          </div>
          <div className="text-[1.05rem]">
            <Markdown>{q.text}</Markdown>
          </div>
          {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-4 max-h-80 rounded-xl border border-line" />}
          <div className="mt-6 space-y-2.5" role="radiogroup">
            {q.options.map((o, i) => {
              const sel = q.selected === o.id;
              return (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={sel}
                  onClick={() => save(q, { optionId: sel ? null : o.id })}
                  className={cx("flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition", sel ? "border-brand-600 bg-brand-50" : "border-line bg-white hover:border-slate-300")}
                >
                  <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold", sel ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600")}>{LETTERS[i]}</span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    {o.text && <Markdown>{o.text}</Markdown>}
                    {o.imageUrl && <img src={o.imageUrl} alt="" className="mt-1 max-h-32 rounded-lg" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-7 flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={cur === 0} onClick={() => setCur(cur - 1)}>
              <IconLeft className="h-4 w-4" /> Oldingi
            </Button>
            {cur < qs.length - 1 ? (
              <Button onClick={() => setCur(cur + 1)}>
                Keyingi <IconRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setConfirming(true)}>
                <IconCheck className="h-4 w-4" /> Yakunlash
              </Button>
            )}
          </div>
        </Card>

        <aside className="hidden lg:block">
          <Card className="sticky top-20 p-4">
            <p className="mb-3 text-sm font-semibold">Savollar</p>
            {grid}
            <Legend />
          </Card>
        </aside>
      </div>

      {/* Telefonda: pastki panel */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <button onClick={() => setPanel(true)} className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium">
          <span>
            Savollar paneli · {answered}/{qs.length}
          </span>
          {flagged > 0 && <span className="text-amber-700">★ {flagged}</span>}
        </button>
      </div>
      <Modal open={panel} onClose={() => setPanel(false)} title="Savollar">
        {grid}
        <Legend />
      </Modal>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Testni yakunlaysizmi?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Davom etish
            </Button>
            <Button loading={finishing} onClick={finish}>
              Ha, yakunlash
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            Javob berilgan: <b>{answered}</b> / {qs.length}. Qolgan vaqt: <b>{clock(left)}</b>.
          </p>
          {answered < qs.length && (
            <Alert tone="amber">
              {qs.length - answered} ta savolga javob bermadingiz: {qs.filter((x) => !x.selected).map((x) => x.n).join(", ")}. Ular xato hisoblanadi.
            </Alert>
          )}
          {flagged > 0 && <Alert tone="blue">Belgilangan savollar: {qs.filter((x) => x.flagged).map((x) => x.n).join(", ")}.</Alert>}
          <p className="text-muted">Yakunlagandan keyin javoblarni o'zgartirib bo'lmaydi.</p>
        </div>
      </Modal>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 space-y-1.5 text-xs text-muted">
      <p className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-brand-600" /> Javob berilgan
      </p>
      <p className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-slate-200" /> Javobsiz
      </p>
      <p className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-amber-400" /> Belgilangan
      </p>
    </div>
  );
}

function ResultView({ view }: { view: View }) {
  const r = view.result!;
  const pct = r.scorePct;
  const spent = view.finishedAt ? Math.round((+new Date(view.finishedAt) - +new Date(view.startedAt)) / 1000) : 0;
  const tone = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-brand-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const shown = view.questions.filter((q) => filter === "all" || !q.isCorrect);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/tests" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <IconLeft className="h-4 w-4" /> Testlar
      </Link>
      <Card className="p-6 text-center sm:p-8">
        <p className="text-sm text-muted">{view.test.subject.name}</p>
        <h1 className="mt-1 text-xl font-semibold">{view.test.title}</h1>
        <div className="relative mx-auto mt-6 h-36 w-36">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct} 100`} className={tone} />
          </svg>
          <span className={cx("absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums", tone)}>{pct}%</span>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          {[
            ["To'g'ri", `${r.correctCount} / ${r.totalCount}`],
            ["O'rin", r.rank ? `${r.rank} / ${r.participants}` : "—"],
            ["Vaqt", clock(spent * 1000)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {view.status === "EXPIRED" && <p className="mt-4 text-sm text-amber-700">Vaqt tugagani uchun test avtomatik yakunlandi.</p>}
        {r.certificate && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left sm:flex-row">
            <IconAward className="h-8 w-8 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="font-semibold text-emerald-800">Tabriklaymiz! Sizga sertifikat berildi</p>
              <p className="font-mono text-xs text-emerald-700">{r.certificate}</p>
            </div>
            <a href={`/api/certificates/${r.certificate}/pdf?download=1`}>
              <Button size="sm">Yuklab olish</Button>
            </a>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to={`/tests/${view.test.id}`}>
            <Button variant="secondary">Test sahifasi</Button>
          </Link>
          <Link to="/cabinet">
            <Button>Kabinetga</Button>
          </Link>
        </div>
      </Card>

      {view.reveal ? (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Javoblar tahlili</h2>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              {(["all", "wrong"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cx("rounded-md px-3 py-1 font-medium", filter === f ? "bg-white shadow-sm" : "text-slate-500")}>
                  {f === "all" ? "Barchasi" : "Xatolar"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {shown.map((q) => (
              <Card key={q.id} className={cx("border-l-4 p-5", q.isCorrect ? "border-l-emerald-500" : "border-l-red-500")}>
                <p className="mb-2 text-xs font-medium text-muted">
                  {q.n}-savol · {q.isCorrect ? "to'g'ri" : q.selected ? "xato" : "javob berilmagan"}
                </p>
                <Markdown>{q.text}</Markdown>
                {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-2 max-h-56 rounded-lg" />}
                <ul className="mt-3 space-y-1.5">
                  {q.options.map((o, i) => (
                    <li
                      key={o.id}
                      className={cx(
                        "flex gap-2 rounded-lg px-3 py-2 text-sm",
                        o.isCorrect ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : q.selected === o.id ? "bg-red-50 text-red-900 ring-1 ring-red-200" : "bg-slate-50",
                      )}
                    >
                      <b>{LETTERS[i]})</b>
                      <div className="min-w-0 flex-1">
                        {o.text && <Markdown>{o.text}</Markdown>}
                        {o.imageUrl && <img src={o.imageUrl} alt="" className="max-h-20 rounded" />}
                      </div>
                      {q.selected === o.id && <span className="shrink-0 text-xs font-medium">sizning javob</span>}
                    </li>
                  ))}
                </ul>
                {q.explanation && (
                  <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm">
                    <b>Izoh:</b> <Markdown>{q.explanation}</Markdown>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-muted">Bu testda to'g'ri javoblar ko'rsatilmaydi.</p>
      )}
    </div>
  );
}
