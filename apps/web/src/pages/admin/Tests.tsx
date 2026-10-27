import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/layouts";
import { IconPlus } from "../../components/icons";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, Select } from "../../components/ui";
import { api, ApiError, fmtDate } from "../../lib/api";
import type { Subject } from "./Subjects";

type Row = {
  id: string;
  title: string;
  isActive: boolean;
  durationMin: number;
  questionCount: number;
  requiresCode: boolean;
  opensAt: string | null;
  closesAt: string | null;
  subject: { id: string; name: string };
  course: { id: string; title: string } | null;
  _count: { questions: number; attempts: number };
};

export default function Tests() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const subject = params.get("subject") ?? "";
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [list, setList] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subjectId: string; title: string } | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Subject[]>("/admin/subjects").then(setSubjects, () => setSubjects([]));
  }, []);
  useEffect(() => {
    setList(null);
    api<Row[]>(`/admin/tests${subject ? `?subjectId=${subject}` : ""}`).then(setList, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  }, [subject]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setFormErr(null);
    try {
      const t = await api<{ id: string }>("/admin/tests", { body: draft });
      navigate(`/admin/tests/${t.id}`);
    } catch (e) {
      setFormErr(e instanceof ApiError ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  if (err) return <Alert>{err}</Alert>;

  return (
    <>
      <PageHeader
        title="Testlar"
        subtitle="Savollar banki, vaqt, urinishlar va natijalar"
        actions={
          <Button disabled={!subjects?.length} onClick={() => (setFormErr(null), setDraft({ subjectId: subject || subjects?.[0]?.id || "", title: "" }))}>
            <IconPlus className="h-4 w-4" /> Test qo'shish
          </Button>
        }
      />
      <div className="mb-4 max-w-xs">
        <Select value={subject} onChange={(e) => setParams(e.target.value ? { subject: e.target.value } : {})}>
          <option value="">Barcha fanlar</option>
          {subjects?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      {!list ? (
        <PageLoader />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState title="Testlar yo'q" text="Test qo'shing, keyin savollarni birma-bir yoki matndan import qiling." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {list.map((t) => (
              <li key={t.id}>
                <Link to={`/admin/tests/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.subject.name}
                      {t.course ? ` · ${t.course.title}` : ""} · {Math.min(t.questionCount, t._count.questions)}/{t._count.questions} savol · {t.durationMin} daq · {t._count.attempts} ta topshirilgan
                      {t.closesAt ? ` · ${fmtDate(t.closesAt, true)} gacha` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {t.requiresCode && <Badge tone="amber">Kod bilan</Badge>}
                    {t.isActive ? <Badge tone="green">Faol</Badge> : <Badge>Nofaol</Badge>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Modal open={!!draft} onClose={() => setDraft(null)} title="Yangi test">
        {draft && (
          <form onSubmit={create} className="space-y-4">
            {formErr && <Alert>{formErr}</Alert>}
            <Field label="Fan">
              <Select value={draft.subjectId} onChange={(e) => setDraft({ ...draft, subjectId: e.target.value })}>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Test nomi">
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus placeholder="Masalan: Kinematika, 1-variant" />
            </Field>
            <p className="text-xs text-muted">Standart: 20 ta savol, 60 daqiqa. Keyin sozlamalarda o'zgartirasiz.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                Bekor qilish
              </Button>
              <Button type="submit" loading={busy}>
                Yaratish
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
