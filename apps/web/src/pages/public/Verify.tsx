// Ochiq sahifa: sertifikat raqami yoki QR kod orqali haqiqiyligini tekshirish.
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconAward, IconSearch } from "../../components/icons";
import { Alert, Button, Card, Input, Spinner } from "../../components/ui";
import { api, ApiError, fmtDate } from "../../lib/api";

type Cert = { number: string; issuedAt: string; fullName: string; institution: string | null; region: string | null; subject: string; test: string; scorePct: number; correct: number; total: number };

export default function Verify() {
  const { number } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(number ?? "");
  const [cert, setCert] = useState<Cert | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCert(null);
    setErr(null);
    if (!number) return;
    setQ(number);
    setLoading(true);
    api<Cert>(`/certificates/${encodeURIComponent(number)}`)
      .then(setCert, (e) => setErr(e instanceof ApiError ? e.message : "Tekshirib bo'lmadi"))
      .finally(() => setLoading(false));
  }, [number]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = q.trim().toUpperCase();
    if (v) navigate(`/verify/${encodeURIComponent(v)}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Sertifikatni tekshirish</h1>
      <p className="mt-1 text-sm text-muted">Sertifikatdagi raqamni kiriting yoki QR kodni telefon kamerasi bilan skanerlang.</p>
      <form onSubmit={submit} className="mt-5 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="UJ-2026-XXXXXXXX" className="font-mono uppercase" aria-label="Sertifikat raqami" />
        <Button type="submit">
          <IconSearch className="h-4 w-4" /> Tekshirish
        </Button>
      </form>
      <div className="mt-6">
        {loading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {err && <Alert>{err}</Alert>}
        {cert && (
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-800">
              <IconAward className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-semibold">Sertifikat haqiqiy</p>
                <p className="font-mono text-xs">{cert.number}</p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-4 p-6 sm:grid-cols-2">
              {(
                [
                  ["F.I.Sh.", cert.fullName],
                  ["Ta'lim muassasasi", cert.institution],
                  ["Viloyat", cert.region],
                  ["Fan", cert.subject],
                  ["Test", cert.test],
                  ["Natija", `${cert.scorePct}% (${cert.correct} / ${cert.total})`],
                  ["Berilgan sana", fmtDate(cert.issuedAt)],
                ] as [string, string | null][]
              ).map(([k, v]) => (
                <div key={k} className={k === "F.I.Sh." ? "sm:col-span-2" : undefined}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className={k === "F.I.Sh." ? "text-lg font-semibold" : "text-sm"}>{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-line px-6 py-4">
              <a href={`/api/certificates/${cert.number}/pdf`} target="_blank" rel="noreferrer">
                <Button variant="secondary">PDF ko'rish</Button>
              </a>
              <a href={`/api/certificates/${cert.number}/pdf?download=1`}>
                <Button>Yuklab olish</Button>
              </a>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
