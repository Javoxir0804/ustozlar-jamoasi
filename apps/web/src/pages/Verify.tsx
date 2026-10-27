import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Centered } from "./Attempt";

type Cert = { number: string; fullName: string; school: string | null; region: string | null; subject: string; test: string; scorePct: number; correct: number; total: number; issuedAt: string };

// Ochiq sahifa: QR-kod shu yerga olib keladi
export function VerifyPage() {
  const { number } = useParams();
  const [cert, setCert] = useState<Cert | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api<Cert>(`/public/certificates/${encodeURIComponent(number!)}`).then(setCert).catch(() => setNotFound(true));
  }, [number]);

  if (notFound) return <Centered>❌ «{number}» raqamli sertifikat topilmadi.</Centered>;
  if (!cert) return <Centered>Tekshirilmoqda…</Centered>;
  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border border-ok/40 bg-card p-6">
        <p className="mb-4 text-ok">✅ Sertifikat haqiqiy</p>
        <dl className="space-y-2 text-sm">
          <Row k="F.I.O." v={cert.fullName} />
          <Row k="Fan" v={cert.subject} />
          <Row k="Test" v={cert.test} />
          <Row k="Natija" v={`${cert.scorePct}% (${cert.correct}/${cert.total})`} />
          {cert.school && <Row k="Maktab" v={cert.school} />}
          {cert.region && <Row k="Hudud" v={cert.region} />}
          <Row k="Berilgan sana" v={cert.issuedAt.slice(0, 10)} />
          <Row k="ID" v={cert.number} />
        </dl>
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4 border-b border-line pb-2">
    <dt className="text-muted">{k}</dt>
    <dd className="text-right">{v}</dd>
  </div>
);
