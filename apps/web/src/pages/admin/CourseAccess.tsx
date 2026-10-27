// Pullik kursga talabalarni qo'shish (muddatli yoki muddatsiz) va ruxsatni bekor qilish.
import { useEffect, useState } from "react";
import { IconSearch } from "../../components/icons";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Spinner, useToast } from "../../components/ui";
import { api, ApiError, fmtDate, fullName, type User } from "../../lib/api";

type Row = { id: string; grantedAt: string; expiresAt: string | null; user: User; grantedBy: { firstName: string; lastName: string } | null };

export function CourseAccess({ courseId, isPaid }: { courseId: string; isPaid: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<User[] | null>(null);
  const [picked, setPicked] = useState<User[]>([]);
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api<Row[]>(`/admin/courses/${courseId}/access`).then(setRows, () => setRows([]));
  useEffect(() => {
    load();
  }, [courseId]);

  useEffect(() => {
    if (!q.trim()) return setFound(null);
    const t = setTimeout(() => {
      api<{ items: User[] }>(`/admin/students?status=ACTIVE&q=${encodeURIComponent(q.trim())}`).then((r) => setFound(r.items), () => setFound([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const has = new Set(rows?.map((r) => r.user.id));
  const pick = (u: User) => setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]));

  async function grant() {
    setBusy(true);
    try {
      const r = await api<{ granted: number }>(`/admin/courses/${courseId}/access`, {
        body: { userIds: picked.map((u) => u.id), expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null },
      });
      toast(`${r.granted} ta talabaga kurs ochildi`);
      setPicked([]);
      setQ("");
      setExpires("");
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(r: Row) {
    if (!confirm(`${fullName(r.user)} uchun ruxsat bekor qilinsinmi?`)) return;
    await api(`/admin/access/${r.id}`, { method: "DELETE" });
    toast("Ruxsat bekor qilindi");
    load();
  }

  if (!isPaid) return <Alert tone="blue">Bu kurs bepul: anketani to'ldirgan har bir talaba uni ko'radi. Ruxsat faqat pullik kurslar uchun kerak.</Alert>;

  const now = Date.now();
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="p-5 lg:col-span-2">
        <h3 className="font-semibold">Talabaga kursni ochish</h3>
        <p className="mt-1 text-xs text-muted">Talaba to'lov qilgach shu yerda qo'shing. Unga botda xabar boradi.</p>
        <div className="relative mt-4">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, telefon yoki @username" className="pl-9" />
        </div>
        {found && (
          <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-line">
            {found.length === 0 && <li className="px-3 py-2 text-sm text-muted">Topilmadi</li>}
            {found.map((u) => {
              const sel = picked.some((x) => x.id === u.id);
              return (
                <li key={u.id}>
                  <button type="button" disabled={has.has(u.id)} onClick={() => pick(u)} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 ${sel ? "bg-brand-50" : ""}`}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{fullName(u)}</span>
                      <span className="block truncate text-xs text-muted">{[u.phone, u.institution].filter(Boolean).join(" · ")}</span>
                    </span>
                    {has.has(u.id) ? <Badge tone="green">Ochiq</Badge> : sel ? <Badge tone="blue">Tanlandi</Badge> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {picked.length > 0 && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {picked.map((u) => (
                <button key={u.id} onClick={() => pick(u)} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
                  {fullName(u)} ×
                </button>
              ))}
            </div>
            <Field label="Muddati (ixtiyoriy)" hint="Bo'sh qolsa muddatsiz">
              <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Button className="w-full" loading={busy} onClick={grant}>
              {picked.length} ta talabaga ochish
            </Button>
          </div>
        )}
      </Card>
      <Card className="overflow-hidden lg:col-span-3">
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-semibold">Kurs ochilgan talabalar {rows && <span className="text-muted">({rows.length})</span>}</h3>
        </div>
        {!rows ? (
          <div className="flex justify-center py-10 text-brand-600">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Hali hech kimga ochilmagan" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const expired = r.expiresAt && +new Date(r.expiresAt) < now;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{fullName(r.user)}</p>
                    <p className="truncate text-xs text-muted">
                      {fmtDate(r.grantedAt)} dan · {r.expiresAt ? `${fmtDate(r.expiresAt)} gacha` : "muddatsiz"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {expired && <Badge tone="red">Muddati o'tgan</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => revoke(r)}>
                      Bekor qilish
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
