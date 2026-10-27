import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../../components/layouts";
import { IconSearch } from "../../components/icons";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select, Spinner, useToast } from "../../components/ui";
import { api, ApiError, fmtDate, fullName, type User } from "../../lib/api";
import { useConfig } from "../../lib/config";

type Page = { items: User[]; total: number; page: number; pageSize: number };

function StatusBadge({ u }: { u: User }) {
  if (u.status === "BLOCKED") return <Badge tone="red">Bloklangan</Badge>;
  if (!u.profileCompleted) return <Badge tone="amber">Anketasiz</Badge>;
  return <Badge tone="green">Faol</Badge>;
}

export default function Students() {
  const config = useConfig();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [region, setRegion] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  // Qidiruv maydoni yozish to'xtagandan keyin yuboriladi
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (query.trim()) p.set("q", query.trim());
    if (status) p.set("status", status);
    if (region) p.set("region", region);
    setErr(null);
    api<Page>(`/admin/students?${p}`).then(setData, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
  }, [page, query, status, region]);
  useEffect(load, [load]);

  async function toggleBlock(u: User) {
    setBusy(true);
    try {
      const next = u.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
      const r = await api<User>(`/admin/students/${u.id}`, { method: "PATCH", body: { status: next } });
      setSelected(r);
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === r.id ? r : x)) });
      toast(next === "BLOCKED" ? "Talaba bloklandi" : "Talaba blokdan chiqarildi");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Talabalar" subtitle={data ? `Jami: ${data.total}` : undefined} />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_220px]">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, telefon, @username yoki maktab" className="pl-9" />
          </div>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Barcha holatlar</option>
            <option value="ACTIVE">Faol</option>
            <option value="INCOMPLETE">Anketasiz</option>
            <option value="BLOCKED">Bloklangan</option>
          </Select>
          <Select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Barcha viloyatlar</option>
            {(config?.regions ?? []).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </div>
      </Card>
      {err && <Alert>{err}</Alert>}
      <Card className="overflow-hidden">
        {!data ? (
          <div className="flex justify-center py-14 text-brand-600">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState title="Talaba topilmadi" text="Qidiruv yoki filtrlarni o'zgartirib ko'ring." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">F.I.Sh.</th>
                  <th className="px-4 py-3 font-medium">Telefon</th>
                  <th className="px-4 py-3 font-medium">Viloyat</th>
                  <th className="px-4 py-3 font-medium">Muassasa</th>
                  <th className="px-4 py-3 font-medium">Holat</th>
                  <th className="px-4 py-3 font-medium">Qo'shilgan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((u) => (
                  <tr key={u.id} onClick={() => setSelected(u)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{fullName(u)}</p>
                      {u.telegramUsername && <p className="text-xs text-muted">@{u.telegramUsername}</p>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{u.phone || "—"}</td>
                    <td className="px-4 py-3">{u.region || "—"}</td>
                    <td className="px-4 py-3">{[u.institution, u.grade].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge u={u} />
                    </td>
                    <td className="px-4 py-3 text-muted">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Oldingi
          </Button>
          <span className="text-muted">
            {page} / {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Keyingi
          </Button>
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? fullName(selected) : ""}
        footer={
          selected && (
            <Button variant={selected.status === "BLOCKED" ? "primary" : "danger"} loading={busy} onClick={() => toggleBlock(selected)}>
              {selected.status === "BLOCKED" ? "Blokdan chiqarish" : "Bloklash"}
            </Button>
          )
        }
      >
        {selected && (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {(
              [
                ["Holat", <StatusBadge u={selected} />],
                ["Telefon", selected.phone],
                ["Telegram", selected.telegramUsername ? `@${selected.telegramUsername}` : selected.telegramId],
                ["Telegram ID", selected.telegramId],
                ["Viloyat", selected.region],
                ["Tuman", selected.district],
                ["Manzil", selected.address],
                ["Ta'lim muassasasi", selected.institution],
                ["Sinf yoki kurs", selected.grade],
                ["Ro'yxatdan o'tgan", fmtDate(selected.createdAt, true)],
                ["Oxirgi faollik", fmtDate(selected.lastActiveAt, true)],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="text-sm text-ink">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </>
  );
}
