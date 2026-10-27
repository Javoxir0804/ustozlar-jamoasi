import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/layouts";
import { IconEdit, IconPlus, IconTrash } from "../../components/icons";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, Textarea, Toggle, useToast } from "../../components/ui";
import { api, ApiError } from "../../lib/api";

export type Subject = { id: string; name: string; slug: string; description: string | null; order: number; isActive: boolean; _count: { courses: number; tests: number } };
type Draft = { id?: string; name: string; description: string; isActive: boolean };

export default function Subjects() {
  const toast = useToast();
  const [list, setList] = useState<Subject[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<Subject[]>("/admin/subjects").then(setList, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  useEffect(() => {
    load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setFormErr(null);
    try {
      const body = { name: draft.name, description: draft.description, isActive: draft.isActive };
      if (draft.id) await api(`/admin/subjects/${draft.id}`, { method: "PATCH", body });
      else await api("/admin/subjects", { body });
      toast("Saqlandi");
      setDraft(null);
      load();
    } catch (e) {
      setFormErr(e instanceof ApiError ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Subject) {
    if (!confirm(`"${s.name}" fani o'chirilsinmi?`)) return;
    try {
      await api(`/admin/subjects/${s.id}`, { method: "DELETE" });
      toast("Fan o'chirildi");
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    }
  }

  if (err) return <Alert>{err}</Alert>;
  if (!list) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="Fanlar"
        subtitle="Kurslar va testlar fanlar bo'yicha guruhlanadi"
        actions={
          <Button onClick={() => (setFormErr(null), setDraft({ name: "", description: "", isActive: true }))}>
            <IconPlus className="h-4 w-4" /> Fan qo'shish
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState title="Fanlar yo'q" text="Birinchi fanni qo'shing, masalan: Fizika." />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {s.name} {!s.isActive && <Badge>Nofaol</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    <Link to={`/admin/courses?subject=${s.id}`} className="hover:underline">
                      {s._count.courses} ta kurs
                    </Link>{" "}
                    · {s._count.tests} ta test
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => (setFormErr(null), setDraft({ id: s.id, name: s.name, description: s.description ?? "", isActive: s.isActive }))} aria-label="Tahrirlash">
                    <IconEdit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s)} aria-label="O'chirish">
                    <IconTrash className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Fanni tahrirlash" : "Yangi fan"}>
        {draft && (
          <form onSubmit={save} className="space-y-4">
            {formErr && <Alert>{formErr}</Alert>}
            <Field label="Nomi">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Tavsif (ixtiyoriy)">
              <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Toggle checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Faol" hint="Nofaol fan va uning kurslari talabalarga ko'rinmaydi" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                Bekor qilish
              </Button>
              <Button type="submit" loading={busy}>
                Saqlash
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
