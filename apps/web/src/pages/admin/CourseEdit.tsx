// Kurs sahifasi (admin): darslar tuzilmasi, kurs ma'lumotlari, ruxsatlar.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/layouts";
import { IconDown, IconEdit, IconLeft, IconPlay, IconPlus, IconTrash, IconUp, IconUpload } from "../../components/icons";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageLoader, Select, Tabs, Textarea, Toggle, useToast } from "../../components/ui";
import { api, ApiError, uploadFile } from "../../lib/api";
import { CourseAccess } from "./CourseAccess";
import { LessonEditor, type AdminLesson } from "./LessonEditor";
import type { Subject } from "./Subjects";

type Module = { id: string; title: string; order: number; lessons: AdminLesson[] };
type Course = { id: string; title: string; description: string | null; coverFileId: string | null; isPaid: boolean; isPublished: boolean; subjectId: string; subject: { id: string; name: string }; modules: Module[] };
type Tab = "lessons" | "info" | "access";

const move = <T,>(arr: T[], i: number, d: number) => {
  const a = [...arr];
  [a[i], a[i + d]] = [a[i + d], a[i]];
  return a;
};

export default function CourseEdit() {
  const { id } = useParams();
  const toast = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("lessons");
  const [editing, setEditing] = useState<{ moduleId: string; lesson?: AdminLesson } | null>(null);

  const load = useCallback(() => api<Course>(`/admin/courses/${id}`).then(setCourse, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi")), [id]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    }
  };

  if (err) return <Alert>{err}</Alert>;
  if (!course) return <PageLoader />;

  const addModule = () => {
    const title = prompt("Modul nomi", `${course.modules.length + 1}-modul`);
    if (title?.trim()) run(() => api(`/admin/courses/${course.id}/modules`, { body: { title } }));
  };

  return (
    <>
      <Link to="/admin/courses" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <IconLeft className="h-4 w-4" /> Kurslar
      </Link>
      <PageHeader
        title={course.title}
        subtitle={course.subject.name}
        actions={
          <div className="flex items-center gap-2">
            {course.isPaid ? <Badge tone="amber">Pullik</Badge> : <Badge tone="green">Bepul</Badge>}
            {course.isPublished ? <Badge tone="green">Nashr qilingan</Badge> : <Badge>Qoralama</Badge>}
            <Button size="sm" variant={course.isPublished ? "secondary" : "primary"} onClick={() => run(() => api(`/admin/courses/${course.id}`, { method: "PATCH", body: { isPublished: !course.isPublished } }), course.isPublished ? "Kurs yashirildi" : "Kurs nashr qilindi")}>
              {course.isPublished ? "Yashirish" : "Nashr qilish"}
            </Button>
          </div>
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "lessons", label: "Darslar" },
          { value: "info", label: "Ma'lumot" },
          { value: "access", label: "Talabalar" },
        ]}
      />

      {tab === "lessons" && (
        <div className="space-y-4">
          {course.modules.length === 0 && (
            <Card>
              <EmptyState title="Modullar yo'q" text="Kurs modullardan, modullar darslardan iborat. Birinchi modulni qo'shing." action={<Button onClick={addModule}>Modul qo'shish</Button>} />
            </Card>
          )}
          {course.modules.map((m, mi) => (
            <Card key={m.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-slate-50 px-4 py-3">
                <h3 className="min-w-0 truncate font-semibold">
                  <span className="text-muted">{mi + 1}.</span> {m.title}
                </h3>
                <div className="flex shrink-0 gap-0.5">
                  <IconBtn label="Yuqoriga" disabled={mi === 0} onClick={() => run(() => api(`/admin/courses/${course.id}/modules/reorder`, { body: { ids: move(course.modules, mi, -1).map((x) => x.id) } }))}>
                    <IconUp className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Pastga" disabled={mi === course.modules.length - 1} onClick={() => run(() => api(`/admin/courses/${course.id}/modules/reorder`, { body: { ids: move(course.modules, mi, 1).map((x) => x.id) } }))}>
                    <IconDown className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    label="Nomini o'zgartirish"
                    onClick={() => {
                      const t = prompt("Modul nomi", m.title);
                      if (t?.trim()) run(() => api(`/admin/modules/${m.id}`, { method: "PATCH", body: { title: t } }));
                    }}
                  >
                    <IconEdit className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="O'chirish" onClick={() => confirm(`"${m.title}" moduli va uning ${m.lessons.length} ta darsi o'chirilsinmi?`) && run(() => api(`/admin/modules/${m.id}`, { method: "DELETE" }), "Modul o'chirildi")}>
                    <IconTrash className="h-4 w-4 text-red-600" />
                  </IconBtn>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {m.lessons.map((l, li) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <button onClick={() => setEditing({ moduleId: m.id, lesson: l })} className="flex min-w-0 items-center gap-3 text-left">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${l.videoUrl ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"}`}>
                        <IconPlay className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium hover:underline">{l.title}</span>
                        <span className="flex gap-1.5 text-xs text-muted">
                          {l.durationSec ? `${Math.round(l.durationSec / 60)} daq` : null}
                          {l.files.length > 0 && <span>{l.files.length} fayl</span>}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {l.isPreview && <Badge tone="blue">Tanishtiruv</Badge>}
                      {!l.isPublished && <Badge>Yashirin</Badge>}
                      <IconBtn label="Yuqoriga" disabled={li === 0} onClick={() => run(() => api(`/admin/modules/${m.id}/lessons/reorder`, { body: { ids: move(m.lessons, li, -1).map((x) => x.id) } }))}>
                        <IconUp className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="Pastga" disabled={li === m.lessons.length - 1} onClick={() => run(() => api(`/admin/modules/${m.id}/lessons/reorder`, { body: { ids: move(m.lessons, li, 1).map((x) => x.id) } }))}>
                        <IconDown className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="O'chirish" onClick={() => confirm(`"${l.title}" darsi o'chirilsinmi?`) && run(() => api(`/admin/lessons/${l.id}`, { method: "DELETE" }), "Dars o'chirildi")}>
                        <IconTrash className="h-4 w-4 text-red-600" />
                      </IconBtn>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-2.5">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ moduleId: m.id })}>
                  <IconPlus className="h-4 w-4" /> Dars qo'shish
                </Button>
              </div>
            </Card>
          ))}
          {course.modules.length > 0 && (
            <Button variant="secondary" onClick={addModule}>
              <IconPlus className="h-4 w-4" /> Modul qo'shish
            </Button>
          )}
        </div>
      )}

      {tab === "info" && <CourseInfo course={course} onSaved={load} />}
      {tab === "access" && <CourseAccess courseId={course.id} isPaid={course.isPaid} />}

      {editing && <LessonEditor moduleId={editing.moduleId} lesson={editing.lesson} onClose={() => setEditing(null)} onChanged={load} />}
    </>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-30">
      {children}
    </button>
  );
}

function CourseInfo({ course, onSaved }: { course: Course; onSaved: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [d, setD] = useState({ title: course.title, description: course.description ?? "", subjectId: course.subjectId, isPaid: course.isPaid, coverFileId: course.coverFileId });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cover = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Subject[]>("/admin/subjects").then(setSubjects, () => {});
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/courses/${course.id}`, { method: "PATCH", body: d });
      toast("Saqlandi");
      onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`"${course.title}" kursi butunlay o'chirilsinmi? Barcha modul, dars va ruxsatlar ham o'chadi.`)) return;
    try {
      await api(`/admin/courses/${course.id}`, { method: "DELETE" });
      toast("Kurs o'chirildi");
      navigate("/admin/courses");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="p-6 lg:col-span-2">
        <form onSubmit={save} className="space-y-4">
          <Field label="Kurs nomi">
            <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          </Field>
          <Field label="Fan">
            <Select value={d.subjectId} onChange={(e) => setD({ ...d, subjectId: e.target.value })}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tavsif" hint="Kurs sahifasida ko'rinadi. Markdown va formulalar ishlaydi.">
            <Textarea rows={6} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          </Field>
          <Toggle checked={d.isPaid} onChange={(v) => setD({ ...d, isPaid: v })} label="Pullik kurs" hint="Faqat siz ruxsat bergan talabalar ko'radi" />
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              Saqlash
            </Button>
          </div>
        </form>
      </Card>
      <div className="space-y-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Muqova rasmi</h3>
          <div className="mt-3 aspect-[16/9] overflow-hidden rounded-lg bg-gradient-to-br from-brand-100 to-brand-50">
            {d.coverFileId && <img src={`/api/files/${d.coverFileId}`} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" loading={uploading} onClick={() => cover.current?.click()}>
              <IconUpload className="h-4 w-4" /> Yuklash
            </Button>
            {d.coverFileId && (
              <Button size="sm" variant="ghost" onClick={() => setD({ ...d, coverFileId: null })}>
                Olib tashlash
              </Button>
            )}
          </div>
          <input
            ref={cover}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                const u = await uploadFile(f, "IMAGE");
                setD((x) => ({ ...x, coverFileId: u.id }));
                toast("Rasm yuklandi. Saqlashni unutmang.");
              } catch (err) {
                toast(err instanceof ApiError ? err.message : "Yuklab bo'lmadi", "error");
              } finally {
                setUploading(false);
              }
            }}
          />
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-red-700">Kursni o'chirish</h3>
          <p className="mt-1 text-xs text-muted">Qaytarib bo'lmaydi. Vaqtincha yashirish uchun "Yashirish" tugmasidan foydalaning.</p>
          <Button size="sm" variant="danger" className="mt-3" onClick={remove}>
            O'chirish
          </Button>
        </Card>
      </div>
    </div>
  );
}
