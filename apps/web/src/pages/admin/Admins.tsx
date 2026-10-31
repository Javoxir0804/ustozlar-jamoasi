// Adminlar ro'yxati: yangi admin qo'shish, parolini almashtirish, bloklash, o'chirish.
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../../components/layouts";
import { IconPlus } from "../../components/icons";
import { Alert, Badge, Button, Card, Field, Input, PasswordInput, Modal, PageLoader, useToast } from "../../components/ui";
import { api, ApiError, fmtDate, fullName, type User } from "../../lib/api";
import { useAuth } from "../../lib/auth";

type Draft = { login: string; password: string; firstName: string; lastName: string };
const EMPTY: Draft = { login: "", password: "", firstName: "", lastName: "" };

export default function Admins() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<User[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<User[]>("/admin/admins").then((l) => setList(l.filter((a) => a.login)), (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setFormErr(null);
    try {
      await fn();
      toast(ok);
      await load();
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Xatolik";
      setFormErr(msg);
      toast(msg, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (await run(() => api("/admin/admins", { body: draft }), "Admin qo'shildi")) {
      setCreating(false);
      setDraft(EMPTY);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (await run(() => api(`/admin/admins/${editing.id}`, { method: "PATCH", body: { password: newPassword } }), "Parol almashtirildi")) {
      setEditing(null);
      setNewPassword("");
    }
  }

  if (err) return <Alert>{err}</Alert>;
  if (!list) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="Adminlar"
        subtitle="Admin panelga login va parol bilan kiradiganlar"
        actions={
          <Button
            onClick={() => {
              setFormErr(null);
              setCreating(true);
            }}
          >
            <IconPlus className="h-4 w-4" /> Admin qo'shish
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {list.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {fullName(a)} {a.id === me?.id && <Badge tone="blue">Siz</Badge>} {a.status === "BLOCKED" && <Badge tone="red">Bloklangan</Badge>}
                </p>
                <p className="text-xs text-muted">
                  Login: {a.login} · Oxirgi kirish: {fmtDate(a.lastActiveAt, true)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setFormErr(null);
                    setNewPassword("");
                    setEditing(a);
                  }}
                >
                  Parolni almashtirish
                </Button>
                {a.id !== me?.id && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => api(`/admin/admins/${a.id}`, { method: "PATCH", body: { status: a.status === "BLOCKED" ? "ACTIVE" : "BLOCKED" } }),
                          a.status === "BLOCKED" ? "Blokdan chiqarildi" : "Bloklandi",
                        )
                      }
                    >
                      {a.status === "BLOCKED" ? "Blokdan chiqarish" : "Bloklash"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => confirm(`${fullName(a)} adminlar ro'yxatidan o'chirilsinmi?`) && run(() => api(`/admin/admins/${a.id}`, { method: "DELETE" }), "Admin o'chirildi")}
                    >
                      O'chirish
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Yangi admin">
        <form onSubmit={create} className="space-y-4">
          {formErr && <Alert>{formErr}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ism">
              <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
            </Field>
            <Field label="Familiya">
              <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
            </Field>
          </div>
          <Field label="Login" hint="Lotin harflari, raqam, _ . -">
            <Input value={draft.login} onChange={(e) => setDraft({ ...draft, login: e.target.value })} autoCapitalize="none" autoComplete="off" />
          </Field>
          <Field label="Parol" hint="Kamida 8 belgi">
            <PasswordInput value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} autoComplete="new-password" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={busy}>
              Qo'shish
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Yangi parol: ${editing.login}` : ""}>
        <form onSubmit={savePassword} className="space-y-4">
          {formErr && <Alert>{formErr}</Alert>}
          <Field label="Yangi parol" hint="Kamida 8 belgi">
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={busy}>
              Saqlash
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
