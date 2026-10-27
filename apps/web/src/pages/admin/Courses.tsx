import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/layouts";
import { IconPlus } from "../../components/icons";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, Select } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { Subject } from "./Subjects";

export type AdminCourse = {
  id: string;
  title: string;
  description: string | null;
  coverFileId: string | null;
  isPaid: boolean;
  isPublished: boolean;
  subject: { id: string; name: string };
  moduleCount: number;
  lessonCount: number;
  accessCount: number;
};

export default function Courses() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const subject = params.get("subject") ?? "";
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [list, setList] = useState<AdminCourse[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ subjectId: "", title: "", isPaid: true });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Subject[]>("/admin/subjects").then(setSubjects, () => setSubjects([]));
  }, []);
  useEffect(() => {
    setList(null);
    api<AdminCourse[]>(`/admin/courses${subject ? `?subjectId=${subject}` : ""}`).then(setList, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  }, [subject]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    try {
      const c = await api<{ id: string }>("/admin/courses", { body: { ...draft, isPublished: false } });
      navigate(`/admin/courses/${c.id}`);
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
        title="Kurslar"
        subtitle="Kurs → modul → dars. Pullik kursga talabalarni o'zingiz qo'shasiz."
        actions={
          <Button
            onClick={() => {
              setFormErr(null);
              setDraft({ subjectId: subject || subjects?.[0]?.id || "", title: "", isPaid: true });
              setCreating(true);
            }}
            disabled={!subjects?.length}
          >
            <IconPlus className="h-4 w-4" /> Kurs qo'shish
          </Button>
        }
      />
      {subjects && subjects.length === 0 && (
        <div className="mb-4">
          <Alert tone="amber">
            Avval <Link to="/admin/subjects" className="font-medium underline">fan qo'shing</Link>, keyin unga kurs yarating.
          </Alert>
        </div>
      )}
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
          <EmptyState title="Kurslar yo'q" text="Kurs qo'shing va unga modul hamda darslar yarating." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <Link key={c.id} to={`/admin/courses/${c.id}`}>
              <Card className="h-full overflow-hidden transition hover:shadow-md">
                <div className="aspect-[16/7] bg-gradient-to-br from-brand-100 to-brand-50">
                  {c.coverFileId && <img src={`/api/files/${c.coverFileId}`} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="p-4">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <Badge tone="blue">{c.subject.name}</Badge>
                    {c.isPaid ? <Badge tone="amber">Pullik</Badge> : <Badge tone="green">Bepul</Badge>}
                    {!c.isPublished && <Badge>Qoralama</Badge>}
                  </div>
                  <h3 className="font-semibold text-ink">{c.title}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {c.moduleCount} modul · {c.lessonCount} dars{c.isPaid ? ` · ${c.accessCount} talabaga ochiq` : ""}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Yangi kurs">
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
          <Field label="Kurs nomi">
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus placeholder="Masalan: Mexanika asoslari" />
          </Field>
          <Field label="Turi">
            <Select value={draft.isPaid ? "1" : "0"} onChange={(e) => setDraft({ ...draft, isPaid: e.target.value === "1" })}>
              <option value="1">Pullik: faqat siz ruxsat bergan talabalarga</option>
              <option value="0">Bepul: ro'yxatdan o'tgan hammaga</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={busy}>
              Yaratish
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
