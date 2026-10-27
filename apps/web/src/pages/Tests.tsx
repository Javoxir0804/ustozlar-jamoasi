import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { Centered } from "./Attempt";

type Subject = { id: string; name: string };
type Test = { id: string; title: string; description: string | null; durationMin: number; questionCount: number; requiresCode: boolean; requiresSubscription: boolean; subjectId: string };

export function TestsPage() {
  const nav = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string>();
  const [tests, setTests] = useState<Test[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api<Subject[]>("/subjects").then((s) => {
      setSubjects(s);
      setSubjectId(s[0]?.id);
    }).catch((e) => setMsg(e.message));
  }, []);

  useEffect(() => {
    if (subjectId) api<Test[]>(`/tests?subjectId=${subjectId}`).then(setTests);
  }, [subjectId]);

  const start = async (t: Test) => {
    setMsg(null);
    const code = t.requiresCode ? window.prompt("Kirish kodi yoki parolni kiriting:") ?? "" : undefined;
    if (t.requiresCode && !code) return;
    try {
      const { attemptId } = await api<{ attemptId: string }>(`/tests/${t.id}/start`, { method: "POST", body: code ? { code, password: code } : {} });
      nav(`/attempt/${attemptId}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "SUBSCRIPTION_REQUIRED") setMsg("Bu test uchun obuna kerak. Botdagi «💳 Obuna» bo'limidan obuna bo'ling.");
      else setMsg((e as Error).message);
    }
  };

  if (!tests && !msg) return <Centered>Yuklanmoqda…</Centered>;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Testlar</h1>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {subjects.map((s) => (
          <button key={s.id} onClick={() => setSubjectId(s.id)} className={`rounded-full border px-4 py-1 ${s.id === subjectId ? "border-primary bg-primary/20" : "border-line"}`}>
            {s.name}
          </button>
        ))}
      </div>
      {msg && <div className="mb-3 rounded-lg border border-warn/40 bg-warn/10 p-3 text-warn">{msg}</div>}
      <div className="space-y-3">
        {tests?.length === 0 && <p className="text-muted">Bu fanda hozircha faol test yo'q.</p>}
        {tests?.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4">
            <div>
              <p className="font-medium">
                {t.title} {t.requiresCode && "🔒"}
              </p>
              <p className="text-sm text-muted">
                {t.questionCount} ta savol · {t.durationMin} daqiqa
              </p>
            </div>
            <button onClick={() => start(t)} className="shrink-0 rounded-lg bg-primary px-4 py-2 font-medium">
              Boshlash
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
