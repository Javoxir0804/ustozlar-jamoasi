// Test sahifasi (admin): savollar banki, sozlamalar, kirish kodlari, natijalar.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/layouts";
import { Markdown } from "../../components/Markdown";
import { IconDown, IconEdit, IconLeft, IconPlus, IconTrash, IconUp } from "../../components/icons";
import { Alert, Badge, Button, Card, cx, EmptyState, Field, Input, Modal, PageLoader, Select, Tabs, Textarea, Toggle, useToast } from "../../components/ui";
import { api, ApiError, fmtDate, fullName, type User } from "../../lib/api";
import { QuestionEditor, type AdminQuestion } from "./QuestionEditor";
import type { Subject } from "./Subjects";

type Test = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  courseId: string | null;
  durationMin: number;
  questionCount: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number | null;
  opensAt: string | null;
  closesAt: string | null;
  requiresCode: boolean;
  password: string | null;
  showAnswers: boolean;
  isActive: boolean;
  subject: { id: string; name: string };
  questions: AdminQuestion[];
  _count: { attempts: number };
};
type Tab = "questions" | "settings" | "codes" | "results";
const LETTERS = "ABCDEFGH";

export default function TestEdit() {
  const { id } = useParams();
  const toast = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("questions");
  const [editing, setEditing] = useState<{ q?: AdminQuestion } | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => api<Test>(`/admin/tests/${id}`).then(setTest, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi")), [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (err) return <Alert>{err}</Alert>;
  if (!test) return <PageLoader />;

  const qs = test.questions;
  const reorder = (i: number, d: number) => {
    const ids = qs.map((q) => q.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    api(`/admin/tests/${test.id}/questions/reorder`, { body: { ids } }).then(load);
  };
  const toggleActive = async () => {
    try {
      await api(`/admin/tests/${test.id}`, { method: "PATCH", body: { isActive: !test.isActive } });
      toast(test.isActive ? "Test o'chirildi" : "Test faollashtirildi");
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    }
  };

  return (
    <>
      <Link to="/admin/tests" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <IconLeft className="h-4 w-4" /> Testlar
      </Link>
      <PageHeader
        title={test.title}
        subtitle={`${test.subject.name} · ${test.durationMin} daqiqa · ${Math.min(test.questionCount, qs.length)} ta savol`}
        actions={
          <div className="flex items-center gap-2">
            {test.isActive ? <Badge tone="green">Faol</Badge> : <Badge>Nofaol</Badge>}
            <Button size="sm" variant={test.isActive ? "secondary" : "primary"} onClick={toggleActive} disabled={!test.isActive && qs.length === 0}>
              {test.isActive ? "O'chirish" : "Faollashtirish"}
            </Button>
          </div>
        }
      />
      {qs.length < test.questionCount && (
        <div className="mb-4">
          <Alert tone="amber">
            Bankda {qs.length} ta savol bor, testda {test.questionCount} ta so'raladi. Savollar yetmasa test bankdagi barcha savollar bilan o'tadi.
          </Alert>
        </div>
      )}
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "questions", label: `Savollar (${qs.length})` },
          { value: "settings", label: "Sozlamalar" },
          { value: "codes", label: "Kirish kodlari" },
          { value: "results", label: `Natijalar (${test._count.attempts})` },
        ]}
      />

      {tab === "questions" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={() => setEditing({})}>
              <IconPlus className="h-4 w-4" /> Savol qo'shish
            </Button>
            <Button variant="secondary" onClick={() => setImporting(true)}>
              Matndan import
            </Button>
          </div>
          {qs.length === 0 ? (
            <Card>
              <EmptyState title="Savollar yo'q" text="Savollarni birma-bir qo'shing yoki tayyor ro'yxatni matndan import qiling." />
            </Card>
          ) : (
            <div className="space-y-3">
              {qs.map((q, i) => (
                <Card key={q.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Markdown>{q.text}</Markdown>
                      {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-2 max-h-40 rounded-lg" />}
                      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                        {q.options.map((o, oi) => (
                          <li key={o.id} className={cx("flex gap-2 rounded-lg px-2.5 py-1.5 text-sm", o.isCorrect ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : "bg-slate-50")}>
                            <b>{LETTERS[oi]})</b>
                            <div className="min-w-0">
                              {o.text && <Markdown>{o.text}</Markdown>}
                              {o.imageUrl && <img src={o.imageUrl} alt="" className="max-h-16 rounded" />}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
                      <button disabled={i === 0} onClick={() => reorder(i, -1)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Yuqoriga">
                        <IconUp className="h-4 w-4" />
                      </button>
                      <button disabled={i === qs.length - 1} onClick={() => reorder(i, 1)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Pastga">
                        <IconDown className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditing({ q })} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tahrirlash">
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`${i + 1}-savol o'chirilsinmi?`)) return;
                          await api(`/admin/questions/${q.id}`, { method: "DELETE" });
                          load();
                        }}
                        className="rounded p-1.5 hover:bg-red-50"
                        aria-label="O'chirish"
                      >
                        <IconTrash className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {tab === "settings" && <TestSettings test={test} onSaved={load} />}
      {tab === "codes" && <AccessCodes test={test} />}
      {tab === "results" && <Results testId={test.id} />}

      {editing && <QuestionEditor testId={test.id} question={editing.q} onClose={() => setEditing(null)} onSaved={(keep) => (load(), keep || setEditing(null))} />}
      {importing && <ImportModal testId={test.id} onClose={() => setImporting(false)} onDone={load} />}
    </>
  );
}

const SAMPLE = `1. Jism 10 m/s tezlik bilan 5 s harakatlandi. Bosib o'tilgan yo'l?
A) 2 m
*B) 50 m
C) 15 m
D) 0,5 m
Izoh: $s = v \\cdot t = 10 \\cdot 5 = 50$ m

2. Nyutonning ikkinchi qonuni:
*A) $F = ma$
B) $F = mv$
C) $E = mc^2$`;

function ImportModal({ testId, onClose, onDone }: { testId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [check, setCheck] = useState<{ questions: unknown[]; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const r = await api<{ questions: unknown[]; errors: string[]; created: number }>(`/admin/tests/${testId}/import`, { body: { text, dryRun } });
      setCheck(r);
      if (r.created) {
        toast(`${r.created} ta savol qo'shildi`);
        onDone();
        onClose();
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Savollarni matndan import qilish" wide>
      <div className="space-y-4">
        <Alert tone="blue">
          Har bir savol bo'sh qator bilan ajratiladi. Variantlar A), B), C)... ko'rinishida, to'g'ri javob oldiga <b>*</b> qo'yiladi. "Izoh:" qatori ixtiyoriy. Formulalar $...$ ichida.
        </Alert>
        <Textarea rows={12} value={text} onChange={(e) => (setText(e.target.value), setCheck(null))} placeholder={SAMPLE} className="font-mono text-[13px]" />
        {check && (
          <div className="space-y-2">
            {check.errors.length > 0 ? (
              <Alert>
                <p className="font-medium">Tuzatish kerak ({check.errors.length}):</p>
                <ul className="mt-1 list-disc pl-5">
                  {check.errors.slice(0, 20).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <Alert tone="green">{check.questions.length} ta savol to'g'ri o'qildi. Import qilish mumkin.</Alert>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setText(SAMPLE)}>
            Namuna
          </Button>
          <Button variant="secondary" loading={busy} disabled={!text.trim()} onClick={() => run(true)}>
            Tekshirish
          </Button>
          <Button loading={busy} disabled={!check || check.errors.length > 0 || !check.questions.length} onClick={() => run(false)}>
            Import qilish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const toLocal = (s: string | null) => (s ? new Date(new Date(s).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (s: string) => (s ? new Date(s).toISOString() : null);

function TestSettings({ test, onSaved }: { test: Test; onSaved: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string; subject: { id: string } }[]>([]);
  const [d, setD] = useState({
    title: test.title,
    description: test.description ?? "",
    subjectId: test.subjectId,
    courseId: test.courseId ?? "",
    durationMin: String(test.durationMin),
    questionCount: String(test.questionCount),
    shuffleQuestions: test.shuffleQuestions,
    shuffleOptions: test.shuffleOptions,
    maxAttempts: test.maxAttempts ? String(test.maxAttempts) : "",
    opensAt: toLocal(test.opensAt),
    closesAt: toLocal(test.closesAt),
    access: test.requiresCode ? (test.password ? "password" : "code") : "open",
    password: test.password ?? "",
    showAnswers: test.showAnswers,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Subject[]>("/admin/subjects").then(setSubjects, () => {});
    api<{ id: string; title: string; subject: { id: string } }[]>("/admin/courses").then(setCourses, () => {});
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/tests/${test.id}`, {
        method: "PATCH",
        body: {
          title: d.title,
          description: d.description,
          subjectId: d.subjectId,
          courseId: d.courseId || null,
          durationMin: Number(d.durationMin),
          questionCount: Number(d.questionCount),
          shuffleQuestions: d.shuffleQuestions,
          shuffleOptions: d.shuffleOptions,
          maxAttempts: d.maxAttempts ? Number(d.maxAttempts) : null,
          opensAt: fromLocal(d.opensAt),
          closesAt: fromLocal(d.closesAt),
          requiresCode: d.access !== "open",
          password: d.access === "password" ? d.password : null,
          showAnswers: d.showAnswers,
        },
      });
      toast("Sozlamalar saqlandi");
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Test butunlay o'chirilsinmi?")) return;
    try {
      await api(`/admin/tests/${test.id}`, { method: "DELETE" });
      navigate("/admin/tests");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-2">
      {err && (
        <div className="lg:col-span-2">
          <Alert>{err}</Alert>
        </div>
      )}
      <Card className="space-y-4 p-6">
        <h3 className="font-semibold">Asosiy</h3>
        <Field label="Test nomi">
          <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </Field>
        <Field label="Tavsif (ixtiyoriy)">
          <Textarea rows={3} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fan">
            <Select value={d.subjectId} onChange={(e) => setD({ ...d, subjectId: e.target.value, courseId: "" })}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kursga bog'lash" hint="Bog'lansa faqat kurs ochilganlar topshiradi">
            <Select value={d.courseId} onChange={(e) => setD({ ...d, courseId: e.target.value })}>
              <option value="">Bog'lanmagan (hammaga)</option>
              {courses
                .filter((c) => c.subject.id === d.subjectId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Vaqt (daqiqa)">
            <Input type="number" min={1} value={d.durationMin} onChange={(e) => setD({ ...d, durationMin: e.target.value })} />
          </Field>
          <Field label="Savollar soni" hint={`Bankda ${test.questions.length} ta; ko'p bo'lsa tasodifiy tanlanadi`}>
            <Input type="number" min={1} value={d.questionCount} onChange={(e) => setD({ ...d, questionCount: e.target.value })} />
          </Field>
        </div>
        <Toggle checked={d.shuffleQuestions} onChange={(v) => setD({ ...d, shuffleQuestions: v })} label="Savollarni aralashtirish" />
        <Toggle checked={d.shuffleOptions} onChange={(v) => setD({ ...d, shuffleOptions: v })} label="Variantlarni aralashtirish" />
        <Toggle checked={d.showAnswers} onChange={(v) => setD({ ...d, showAnswers: v })} label="Tugagach to'g'ri javoblarni ko'rsatish" hint="O'chirilsa talaba faqat ballini ko'radi" />
      </Card>
      <div className="space-y-6">
        <Card className="space-y-4 p-6">
          <h3 className="font-semibold">Imtihon rejimi</h3>
          <Field label="Urinishlar soni" hint="Bo'sh: cheksiz">
            <Input type="number" min={1} value={d.maxAttempts} onChange={(e) => setD({ ...d, maxAttempts: e.target.value })} placeholder="Cheksiz" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ochilish vaqti">
              <Input type="datetime-local" value={d.opensAt} onChange={(e) => setD({ ...d, opensAt: e.target.value })} />
            </Field>
            <Field label="Yopilish vaqti">
              <Input type="datetime-local" value={d.closesAt} onChange={(e) => setD({ ...d, closesAt: e.target.value })} />
            </Field>
          </div>
          <Field label="Kirish">
            <Select value={d.access} onChange={(e) => setD({ ...d, access: e.target.value })}>
              <option value="open">Ochiq</option>
              <option value="password">Parol bilan (barchaga bitta parol)</option>
              <option value="code">Bir martalik kodlar bilan</option>
            </Select>
          </Field>
          {d.access === "password" && (
            <Field label="Parol" hint="Kodlar yaratilsa ular ham ishlaydi">
              <Input value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} />
            </Field>
          )}
          {d.access === "code" && <p className="text-xs text-muted">Kodlarni "Kirish kodlari" bo'limida yarating va talabalarga tarqating.</p>}
        </Card>
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="danger" onClick={remove}>
            Testni o'chirish
          </Button>
          <Button type="submit" loading={busy}>
            Saqlash
          </Button>
        </div>
      </div>
    </form>
  );
}

type Code = { id: string; code: string; maxUses: number; usedCount: number; expiresAt: string | null; revokedAt: string | null; createdAt: string };

function AccessCodes({ test }: { test: Test }) {
  const toast = useToast();
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [count, setCount] = useState("10");
  const [maxUses, setMaxUses] = useState("1");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<Code[]>(`/admin/tests/${test.id}/codes`).then(setCodes, () => setCodes([])), [test.id]);
  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    try {
      const r = await api<{ codes: string[] }>(`/admin/tests/${test.id}/codes`, { body: { count: Number(count), maxUses: Number(maxUses) } });
      toast(`${r.codes.length} ta kod yaratildi`);
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  const active = (codes ?? []).filter((c) => !c.revokedAt && c.usedCount < c.maxUses);
  return (
    <div className="space-y-4">
      {!test.requiresCode && <Alert tone="amber">Test hozir ochiq: kodlar talab qilinmaydi. Sozlamalarda "Kirish"ni o'zgartiring.</Alert>}
      <Card className="flex flex-wrap items-end gap-3 p-5">
        <Field label="Nechta kod">
          <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} className="w-28" />
        </Field>
        <Field label="Har biri necha marta">
          <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="w-28" />
        </Field>
        <Button loading={busy} onClick={generate}>
          Kod yaratish
        </Button>
        {active.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(active.map((c) => c.code).join("\n"));
              toast(`${active.length} ta kod nusxalandi`);
            }}
          >
            Faol kodlarni nusxalash
          </Button>
        )}
      </Card>
      <Card className="overflow-hidden">
        {!codes ? (
          <PageLoader />
        ) : codes.length === 0 ? (
          <EmptyState title="Kodlar yo'q" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Kod</th>
                  <th className="px-4 py-2.5 font-medium">Ishlatilgan</th>
                  <th className="px-4 py-2.5 font-medium">Holat</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 font-mono font-semibold tracking-wider">{c.code}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {c.usedCount}/{c.maxUses}
                    </td>
                    <td className="px-4 py-2.5">{c.revokedAt ? <Badge tone="red">Bekor qilingan</Badge> : c.usedCount >= c.maxUses ? <Badge>Ishlatilgan</Badge> : <Badge tone="green">Faol</Badge>}</td>
                    <td className="px-4 py-2.5 text-right">
                      {!c.revokedAt && c.usedCount < c.maxUses && (
                        <button className="text-xs text-red-600 hover:underline" onClick={async () => (await api(`/admin/codes/${c.id}`, { method: "DELETE" }), load())}>
                          bekor qilish
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

type Result = { id: string; status: string; finishedAt: string | null; correctCount: number | null; totalCount: number | null; scorePct: number | null; durationSec: number | null; user: User };
const mmss = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

function Results({ testId }: { testId: string }) {
  const [rows, setRows] = useState<Result[] | null>(null);
  useEffect(() => {
    api<Result[]>(`/admin/tests/${testId}/attempts`).then(setRows, () => setRows([]));
  }, [testId]);
  if (!rows) return <PageLoader />;
  if (!rows.length)
    return (
      <Card>
        <EmptyState title="Hali hech kim topshirmagan" />
      </Card>
    );
  const avg = rows.reduce((s, r) => s + (r.scorePct ?? 0), 0) / rows.length;
  const max = Math.max(...rows.map((r) => r.scorePct ?? 0));
  const people = new Set(rows.map((r) => r.user.id)).size;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Ishtirokchilar", people],
          ["Urinishlar", rows.length],
          ["O'rtacha", `${avg.toFixed(1)}%`],
          ["Eng yuqori", `${max}%`],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Talaba</th>
                <th className="px-4 py-2.5 font-medium">Natija</th>
                <th className="px-4 py-2.5 font-medium">To'g'ri</th>
                <th className="px-4 py-2.5 font-medium">Vaqt</th>
                <th className="px-4 py-2.5 font-medium">Sana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 text-muted">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{fullName(r.user)}</p>
                    <p className="text-xs text-muted">{[r.user.region, r.user.institution].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">{r.scorePct}%</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {r.correctCount}/{r.totalCount}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {mmss(r.durationSec)} {r.status === "EXPIRED" && <Badge tone="amber">vaqt tugagan</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{fmtDate(r.finishedAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
