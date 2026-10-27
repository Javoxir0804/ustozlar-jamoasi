// Sertifikat shabloni (sarlavha, tashkilot, imzo, fon rasmi, minimal ball) va berilgan sertifikatlar ro'yxati.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "../../components/layouts";
import { IconSearch, IconTrash, IconUpload } from "../../components/icons";
import { Alert, Button, Card, EmptyState, Field, Input, PageLoader, Toggle, useToast } from "../../components/ui";
import { api, ApiError, fmtDate, fullName, token, uploadFile, type User } from "../../lib/api";

type Template = { title: string; organization: string | null; signerName: string | null; backgroundFileId: string | null; minScorePct: number; isActive: boolean };
type Issued = { number: string; issuedAt: string; scorePct: number; test: string; user: User };

export default function Certificates() {
  const toast = useToast();
  const [tpl, setTpl] = useState<Template | null>(null);
  const [list, setList] = useState<Issued[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    Promise.all([api<Template>("/admin/certificate-template"), api<Issued[]>("/admin/certificates")]).then(
      ([a, b]) => {
        setTpl(a);
        setList(b);
      },
      (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"),
    );
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((c) => [c.number, fullName(c.user), c.test, c.user.phone ?? ""].some((v) => v.toLowerCase().includes(s)));
  }, [list, q]);

  if (err) return <Alert>{err}</Alert>;
  if (!tpl) return <PageLoader />;
  const set = (patch: Partial<Template>) => setTpl({ ...tpl, ...patch });

  async function save(e?: FormEvent): Promise<boolean> {
    e?.preventDefault();
    setBusy(true);
    try {
      setTpl(await api<Template>("/admin/certificate-template", { method: "PUT", body: tpl }));
      if (e) toast("Saqlandi");
      return true;
    } catch (x) {
      toast(x instanceof ApiError ? x.message : "Xatolik", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    // Namuna saqlangan shablondan chiziladi, shuning uchun avval saqlaymiz.
    // Oyna darhol ochiladi, aks holda brauzer uni bloklaydi
    const w = window.open("", "_blank");
    if (!(await save())) return w?.close();
    const url = `/api/admin/certificate-template/preview?t=${encodeURIComponent(token.get() ?? "")}&v=${Date.now()}`;
    if (w) w.location.href = url;
    else window.location.href = url;
  }

  async function upload(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return toast("Faqat PNG yoki JPG rasm", "error");
    setUploading(true);
    try {
      set({ backgroundFileId: (await uploadFile(f, "IMAGE")).id });
    } catch (x) {
      toast(x instanceof ApiError ? x.message : "Yuklab bo'lmadi", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <PageHeader title="Sertifikatlar" subtitle="Test natijasi belgilangan balldan yuqori bo'lsa, talabaga QR kodli PDF sertifikat avtomatik beriladi" />
      <Card className="p-6">
        <form onSubmit={save} className="space-y-4">
          <Toggle checked={tpl.isActive} onChange={(v) => set({ isActive: v })} label="Sertifikat berish yoqilgan" hint="O'chirilsa yangi sertifikatlar berilmaydi, oldingilari tekshiriladi" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sarlavha">
              <Input value={tpl.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Minimal natija, %" hint="Shu foizdan past natijaga sertifikat berilmaydi">
              <Input type="number" min={1} max={100} step={1} value={tpl.minScorePct} onChange={(e) => set({ minScorePct: Number(e.target.value) })} />
            </Field>
            <Field label="Tashkilot nomi">
              <Input value={tpl.organization ?? ""} maxLength={120} placeholder="Ustozlar jamoasi" onChange={(e) => set({ organization: e.target.value })} />
            </Field>
            <Field label="Imzo qo'yuvchi">
              <Input value={tpl.signerName ?? ""} maxLength={80} placeholder="Masalan: A. Karimov, direktor" onChange={(e) => set({ signerName: e.target.value })} />
            </Field>
          </div>
          <Field label="Fon rasmi" hint="Ixtiyoriy. A4 albom (297×210) nisbatdagi PNG yoki JPG; butun sahifaga cho'ziladi, matn ustidan yoziladi">
            <div className="flex flex-wrap items-center gap-3">
              {tpl.backgroundFileId ? (
                <>
                  <img src={`/api/files/${tpl.backgroundFileId}`} alt="Fon" className="h-20 w-28 rounded-lg border border-line object-cover" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => set({ backgroundFileId: null })}>
                    <IconTrash className="h-4 w-4" /> Olib tashlash
                  </Button>
                </>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-4 py-3 text-sm text-slate-600 hover:bg-slate-50">
                  <IconUpload className="h-4 w-4" />
                  {uploading ? "Yuklanmoqda..." : "Rasm tanlash"}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={preview} disabled={busy}>
              Namunani ko'rish
            </Button>
            <Button type="submit" loading={busy}>
              Saqlash
            </Button>
          </div>
        </form>
      </Card>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Berilgan sertifikatlar ({list.length})</h2>
        <div className="relative w-full sm:w-72">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Raqam, ism yoki test" className="pl-9" />
        </div>
      </div>
      <Card className="overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState title={list.length ? "Hech narsa topilmadi" : "Hali sertifikat berilmagan"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Raqam</th>
                  <th className="px-4 py-2.5 font-medium">Talaba</th>
                  <th className="px-4 py-2.5 font-medium">Test</th>
                  <th className="px-4 py-2.5 text-right font-medium">Natija</th>
                  <th className="px-4 py-2.5 font-medium">Sana</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((c) => (
                  <tr key={c.number}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{c.number}</td>
                    <td className="px-4 py-2.5">{fullName(c.user)}</td>
                    <td className="px-4 py-2.5 text-muted">{c.test}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{c.scorePct}%</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(c.issuedAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <a href={`/api/certificates/${c.number}/pdf`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
