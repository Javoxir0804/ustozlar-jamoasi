import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, getToken } from "../api";
import { RichText } from "../RichText";

type Option = { id: string; text: string; imageUrl: string | null; isCorrect?: boolean };
type Question = { n: number; id: string; text: string; imageUrl: string | null; options: Option[]; selected: string | null; flagged: boolean };
type View = {
  id: string;
  test: { title: string; durationMin: number };
  status: "IN_PROGRESS" | "FINISHED" | "EXPIRED";
  serverNow: string;
  deadlineAt: string;
  result: { correctCount: number; totalCount: number; scorePct: number; rank: number | null; certificate: string | null } | null;
  questions: Question[];
};

const fmt = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export function AttemptPage() {
  const { id } = useParams();
  const [view, setView] = useState<View | null>(null);
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0); // server va qurilma soati farqi
  const finishing = useRef(false);

  const load = useCallback(async () => {
    const v = await api<View>(`/attempts/${id}`);
    offset.current = new Date(v.serverNow).getTime() - Date.now();
    setView(v);
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      setView(await api<View>(`/attempts/${id}/finish`, { method: "POST" }));
      setConfirm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      finishing.current = false;
    }
  }, [id]);

  // Taymer server vaqti bo'yicha; tugasa test avtomatik yakunlanadi
  useEffect(() => {
    if (view?.status !== "IN_PROGRESS") return;
    const tick = () => {
      const sec = Math.max(0, Math.round((new Date(view.deadlineAt).getTime() - (Date.now() + offset.current)) / 1000));
      setLeft(sec);
      if (sec === 0) finish();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [view?.status, view?.deadlineAt, finish]);

  const patch = async (q: Question, body: { optionId?: string | null; flagged?: boolean }) => {
    // Darhol ekranda ko'rsatamiz, keyin serverga saqlaymiz
    setView((v) => v && { ...v, questions: v.questions.map((x) => (x.id === q.id ? { ...x, selected: body.optionId !== undefined ? body.optionId : x.selected, flagged: body.flagged ?? x.flagged } : x)) });
    try {
      await api(`/attempts/${id}/answers/${q.id}`, { method: "PUT", body });
    } catch (e) {
      setError(`Saqlanmadi: ${(e as Error).message}`);
      load();
    }
  };

  const unanswered = useMemo(() => view?.questions.filter((q) => !q.selected) ?? [], [view]);

  if (error && !view) return <Centered>{error}</Centered>;
  if (!view) return <Centered>Yuklanmoqda…</Centered>;
  if (view.status !== "IN_PROGRESS" && view.result) return <Result view={view} />;

  const q = view.questions[idx];
  const lowTime = left <= 300;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <h1 className="truncate text-base font-semibold">{view.test.title}</h1>
        <div className={`rounded-lg px-3 py-1 font-mono text-lg tabular-nums ${lowTime ? "bg-danger/15 text-danger" : "bg-card"}`} aria-label="Qolgan vaqt">
          ⏱ {fmt(left)}
        </div>
      </header>

      {error && <div className="mb-3 rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-danger">{error}</div>}

      <div className="grid gap-4 md:grid-cols-[1fr_240px]">
        <section className="rounded-2xl border border-line bg-card p-5">
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>
              Savol {q.n} / {view.questions.length}
            </span>
            <button onClick={() => patch(q, { flagged: !q.flagged })} className={`rounded-lg border px-3 py-1 ${q.flagged ? "border-warn text-warn" : "border-line"}`}>
              {q.flagged ? "🚩 Belgilangan" : "🏳 Belgilash"}
            </button>
          </div>
          <div className="mb-4 text-lg">
            <RichText text={q.text} />
          </div>
          {q.imageUrl && <img src={q.imageUrl} alt="" className="mb-4 max-h-80 rounded-lg" />}
          <div className="space-y-2">
            {q.options.map((o, i) => (
              <button
                key={o.id}
                onClick={() => patch(q, { optionId: q.selected === o.id ? null : o.id })}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${q.selected === o.id ? "border-primary bg-primary/15" : "border-line hover:border-muted"}`}
              >
                <span className="font-semibold text-muted">{String.fromCharCode(65 + i)})</span>
                <span className="flex-1">
                  <RichText text={o.text} />
                  {o.imageUrl && <img src={o.imageUrl} alt="" className="mt-2 max-h-40 rounded" />}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-between">
            <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="rounded-lg border border-line px-4 py-2 disabled:opacity-40">
              ← Oldingi
            </button>
            {idx < view.questions.length - 1 ? (
              <button onClick={() => setIdx(idx + 1)} className="rounded-lg bg-primary px-4 py-2 font-medium">
                Keyingi →
              </button>
            ) : (
              <button onClick={() => setConfirm(true)} className="rounded-lg bg-ok px-4 py-2 font-medium text-black">
                Yakunlash
              </button>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-line bg-card p-4">
          <p className="mb-3 text-sm text-muted">Savollar</p>
          <div className="grid grid-cols-5 gap-2">
            {view.questions.map((x, i) => (
              <button
                key={x.id}
                onClick={() => setIdx(i)}
                aria-label={`Savol ${x.n}`}
                className={`relative h-10 rounded-lg border text-sm ${i === idx ? "border-primary" : "border-line"} ${x.selected ? "bg-primary/25" : ""}`}
              >
                {x.n}
                {x.flagged && <span className="absolute -right-1 -top-1 text-xs">🚩</span>}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs text-muted">
            <p>Javob berilgan: {view.questions.length - unanswered.length}</p>
            <p>Belgilangan: {view.questions.filter((x) => x.flagged).length}</p>
          </div>
          <button onClick={() => setConfirm(true)} className="mt-4 w-full rounded-lg bg-ok py-2 font-medium text-black">
            Testni yakunlash
          </button>
        </aside>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5">
            <h2 className="mb-2 text-lg font-semibold">Testni yakunlaysizmi?</h2>
            {unanswered.length > 0 ? (
              <p className="mb-3 text-warn">
                ⚠️ {unanswered.length} ta savolga javob berilmagan: {unanswered.map((x) => x.n).join(", ")}
              </p>
            ) : (
              <p className="mb-3 text-muted">Barcha savollarga javob berdingiz.</p>
            )}
            <p className="mb-4 text-sm text-muted">Yakunlangandan keyin javoblarni o'zgartirib bo'lmaydi.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="flex-1 rounded-lg border border-line py-2">
                Qaytish
              </button>
              <button onClick={finish} className="flex-1 rounded-lg bg-ok py-2 font-medium text-black">
                Yakunlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function downloadCert(number: string) {
  const res = await fetch(`/api/me/certificates/${number}.pdf`, { headers: { authorization: `Bearer ${getToken()}` } });
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: `${number}.pdf` });
  a.click();
  URL.revokeObjectURL(url);
}

function Result({ view }: { view: View }) {
  const r = view.result!;
  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 rounded-2xl border border-line bg-card p-6 text-center">
        <p className="text-muted">{view.status === "EXPIRED" ? "Vaqt tugadi, test avtomatik yakunlandi" : "Test yakunlandi"}</p>
        <p className="my-2 text-5xl font-bold">{r.scorePct}%</p>
        <p>
          {r.correctCount} / {r.totalCount} to'g'ri javob {r.rank && <>· Reytingda {r.rank}-o'rin</>}
        </p>
        {r.certificate && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button onClick={() => downloadCert(r.certificate!)} className="rounded-lg bg-primary px-4 py-2 font-medium">
              📄 Sertifikatni yuklab olish
            </button>
            <Link to={`/verify/${r.certificate}`} className="rounded-lg border border-line px-4 py-2">
              ID: {r.certificate}
            </Link>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {view.questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-line bg-card p-4">
            <div className="mb-2 flex gap-2 font-medium">
              <span>{q.n}.</span>
              <RichText text={q.text} />
            </div>
            {q.options.map((o) => (
              <div key={o.id} className={`rounded px-2 py-1 ${o.isCorrect ? "text-ok" : q.selected === o.id ? "text-danger line-through" : "text-muted"}`}>
                <RichText text={`${o.isCorrect ? "✓ " : q.selected === o.id ? "✗ " : ""}${o.text}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <Link to="/tests" className="mt-6 inline-block text-primary">
        ← Testlarga qaytish
      </Link>
    </div>
  );
}

export const Centered = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted">{children}</div>;
