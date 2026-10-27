// Sayt sozlamalari: nomi, aloqa, biz haqimizda va bot uchun majburiy kanallar.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { PageHeader } from "../../components/layouts";
import { IconPlus, IconTrash } from "../../components/icons";
import { Alert, Badge, Button, Card, Field, Input, PageLoader, Textarea, useToast } from "../../components/ui";
import { api, ApiError } from "../../lib/api";

type Settings = {
  site?: { title?: string; tagline?: string };
  contacts?: { phone?: string; telegram?: string; address?: string; email?: string; mapUrl?: string };
  about?: { text?: string };
};
type Channel = { id: string; chatId: string; title: string; inviteUrl: string; isActive: boolean; order: number };

function Section({ title, subtitle, onSubmit, busy, children }: { title: string; subtitle?: string; onSubmit: (e: FormEvent) => void; busy: boolean; children: ReactNode }) {
  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h2 className="font-display font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            Saqlash
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ch, setCh] = useState({ chatId: "", title: "", inviteUrl: "" });

  useEffect(() => {
    Promise.all([api<Settings>("/admin/settings"), api<Channel[]>("/admin/channels")]).then(
      ([a, b]) => {
        setS(a);
        setChannels(b);
      },
      (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"),
    );
  }, []);

  async function save(key: keyof Settings) {
    setBusy(key);
    try {
      await api(`/admin/settings/${key}`, { method: "PUT", body: s?.[key] ?? {} });
      toast("Saqlandi");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    } finally {
      setBusy(null);
    }
  }

  async function channelAction(fn: () => Promise<unknown>, ok: string) {
    setBusy("channels");
    try {
      await fn();
      setChannels(await api<Channel[]>("/admin/channels"));
      toast(ok);
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (err) return <Alert>{err}</Alert>;
  if (!s) return <PageLoader />;

  const site = s.site ?? {};
  const c = s.contacts ?? {};
  const setSite = (k: string, v: string) => setS({ ...s, site: { ...site, [k]: v } });
  const setC = (k: string, v: string) => setS({ ...s, contacts: { ...c, [k]: v } });

  return (
    <>
      <PageHeader title="Sozlamalar" subtitle="Saytda va botda ko'rinadigan ma'lumotlar" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Sayt" busy={busy === "site"} onSubmit={(e) => (e.preventDefault(), save("site"))}>
          <Field label="Platforma nomi">
            <Input value={site.title ?? ""} onChange={(e) => setSite("title", e.target.value)} placeholder="Ustozlar jamoasi" />
          </Field>
          <Field label="Qisqa tavsif">
            <Textarea rows={2} value={site.tagline ?? ""} onChange={(e) => setSite("tagline", e.target.value)} />
          </Field>
        </Section>

        <Section title="Aloqa" subtitle="Saytning pastki qismida va botdagi Bog'lanish tugmasida chiqadi" busy={busy === "contacts"} onSubmit={(e) => (e.preventDefault(), save("contacts"))}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefon">
              <Input value={c.phone ?? ""} onChange={(e) => setC("phone", e.target.value)} placeholder="+998 90 123 45 67" />
            </Field>
            <Field label="Telegram">
              <Input value={c.telegram ?? ""} onChange={(e) => setC("telegram", e.target.value)} placeholder="@admin" />
            </Field>
            <Field label="Email">
              <Input value={c.email ?? ""} onChange={(e) => setC("email", e.target.value)} />
            </Field>
            <Field label="Manzil">
              <Input value={c.address ?? ""} onChange={(e) => setC("address", e.target.value)} />
            </Field>
          </div>
          <Field label="Xarita havolasi" hint="Google yoki Yandex xarita havolasi (ixtiyoriy)">
            <Input value={c.mapUrl ?? ""} onChange={(e) => setC("mapUrl", e.target.value)} />
          </Field>
        </Section>

        <Section title="Biz haqimizda" subtitle="Bosh sahifada ko'rinadi" busy={busy === "about"} onSubmit={(e) => (e.preventDefault(), save("about"))}>
          <Textarea rows={6} value={s.about?.text ?? ""} onChange={(e) => setS({ ...s, about: { text: e.target.value } })} />
        </Section>

        <Card className="p-6">
          <h2 className="font-display font-semibold">Majburiy obuna kanallari</h2>
          <p className="mt-0.5 text-sm text-muted">Ro'yxat bo'sh bo'lsa, bot obunani tekshirmaydi. Bot kanalda admin bo'lishi kerak.</p>
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {channels.length === 0 && <li className="px-4 py-3 text-sm text-muted">Kanal qo'shilmagan</li>}
            {channels.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {x.title} {!x.isActive && <Badge>O'chiq</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted">{x.chatId}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => channelAction(() => api(`/admin/channels/${x.id}`, { method: "PATCH", body: { isActive: !x.isActive } }), "Saqlandi")}>
                    {x.isActive ? "O'chirish" : "Yoqish"}
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="O'chirish" onClick={() => confirm("Kanal ro'yxatdan olib tashlansinmi?") && channelAction(() => api(`/admin/channels/${x.id}`, { method: "DELETE" }), "Kanal olib tashlandi")}>
                    <IconTrash className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await channelAction(() => api("/admin/channels", { body: { ...ch, order: channels.length } }), "Kanal qo'shildi")) setCh({ chatId: "", title: "", inviteUrl: "" });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={ch.title} onChange={(e) => setCh({ ...ch, title: e.target.value })} placeholder="Kanal nomi" />
              <Input value={ch.chatId} onChange={(e) => setCh({ ...ch, chatId: e.target.value })} placeholder="@kanal yoki -100..." />
            </div>
            <Input value={ch.inviteUrl} onChange={(e) => setCh({ ...ch, inviteUrl: e.target.value })} placeholder="https://t.me/kanal" />
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" loading={busy === "channels"}>
                <IconPlus className="h-4 w-4" /> Kanal qo'shish
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
