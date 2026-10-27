// Test haqida va boshlash: qoidalar, urinishlar, parol yoki kod.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Markdown } from "../../components/Markdown";
import { IconLeft } from "../../components/icons";
import { Alert, Badge, Button, Card, Field, Input, PageLoader } from "../../components/ui";
import { api, ApiError, fmtDate } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { TestCard } from "./types";

export default function TestIntro() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [t, setT] = useState<TestCard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [startErr, setStartErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<TestCard>(`/tests/${id}`).then(setT, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  }, [id, user?.id]);

  async function start() {
    setBusy(true);
    setStartErr(null);
    try {
      const r = await api<{ attemptId: string }>(`/tests/${id}/start`, { body: code.trim() ? { code: code.trim(), password: code.trim() } : {} });
      navigate(`/attempts/${r.attemptId}`);
    } catch (e) {
      setStartErr(e instanceof ApiError ? e.message : "Boshlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  if (err) return <Alert>{err}</Alert>;
  if (!t) return <PageLoader />;
  const left = t.maxAttempts != null ? t.maxAttempts - t.attemptsUsed : null;
  const canStart = !!user && !t.locked && t.state === "OPEN" && (left == null || left > 0 || !!t.openAttemptId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/tests" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <IconLeft className="h-4 w-4" /> Testlar
      </Link>
      <Card className="p-6 sm:p-8">
        <Badge tone="blue">{t.subject.name}</Badge>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.title}</h1>
        {t.description && (
          <div className="mt-3">
            <Markdown>{t.description}</Markdown>
          </div>
        )}
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Savollar", `${t.questionCount} ta`],
            ["Vaqt", `${t.durationMin} daqiqa`],
            ["Urinishlar", t.maxAttempts ? `${t.attemptsUsed} / ${t.maxAttempts}` : "Cheksiz"],
            ["Eng yaxshi", t.bestScore != null ? `${t.bestScore}%` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {(t.opensAt || t.closesAt) && (
          <p className="mt-4 text-sm text-muted">
            {t.opensAt && `Ochiladi: ${fmtDate(t.opensAt, true)}. `}
            {t.closesAt && `Yopiladi: ${fmtDate(t.closesAt, true)}.`}
          </p>
        )}
        <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Vaqt "Boshlash" bosilganda boshlanadi va to'xtamaydi. Tugasa test o'zi yakunlanadi.</li>
          <li>Savollar orasida erkin o'tishingiz va javobni o'zgartirishingiz mumkin.</li>
          <li>Ishonchingiz komil bo'lmagan savolni belgilab qo'ying, keyin qaytasiz.</li>
          <li>Javoblar har tanlovda saqlanadi: internet uzilsa ham yo'qolmaydi.</li>
        </ul>
        <div className="mt-6 space-y-3">
          {!user ? (
            <>
              <Alert tone="blue">Test topshirish uchun Telegram orqali kiring.</Alert>
              <Link to="/login" state={{ from: `/tests/${t.id}` }}>
                <Button className="w-full">Kirish</Button>
              </Link>
            </>
          ) : t.locked ? (
            <Alert tone="amber">
              Bu test {t.course ? <Link to={`/courses/${t.course.id}`} className="font-medium underline">{t.course.title}</Link> : "kurs"} kursiga yozilganlar uchun.
            </Alert>
          ) : t.state === "UPCOMING" ? (
            <Alert tone="amber">Test {fmtDate(t.opensAt, true)} da ochiladi.</Alert>
          ) : t.state === "CLOSED" ? (
            <Alert tone="amber">Test yopilgan.</Alert>
          ) : left === 0 && !t.openAttemptId ? (
            <Alert tone="amber">Urinishlar soni tugagan.</Alert>
          ) : null}
          {startErr && <Alert>{startErr}</Alert>}
          {canStart && t.requiresCode && !t.openAttemptId && (
            <Field label="Kirish kodi yoki parol">
              <Input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" />
            </Field>
          )}
          {canStart && (
            <Button size="lg" className="w-full" loading={busy} onClick={start} disabled={t.requiresCode && !t.openAttemptId && !code.trim()}>
              {t.openAttemptId ? "Testni davom ettirish" : "Testni boshlash"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
