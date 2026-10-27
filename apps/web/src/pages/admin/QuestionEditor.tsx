// Savol muharriri: matn va formulalar, rasm, 2-8 variant (har birida matn yoki rasm), to'g'ri javob, izoh.
import { useRef, useState, type FormEvent } from "react";
import { Markdown } from "../../components/Markdown";
import { IconPlus, IconTrash, IconUpload } from "../../components/icons";
import { Alert, Button, cx, Field, Modal, Textarea, useToast } from "../../components/ui";
import { api, ApiError, uploadFile } from "../../lib/api";

export type AdminOption = { id?: string; text: string; imageUrl: string | null; isCorrect: boolean };
export type AdminQuestion = { id: string; text: string; imageUrl: string | null; explanation: string | null; order: number; options: (AdminOption & { id: string })[]; pCorrect?: number | null };

const LETTERS = "ABCDEFGH";

function ImagePicker({ url, onChange, small }: { url: string | null; onChange: (u: string | null) => void; small?: boolean }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {url && <img src={url} alt="" className={cx("rounded border border-line object-contain", small ? "h-10 w-14" : "h-20 w-28")} />}
      <Button type="button" size="sm" variant="ghost" loading={busy} onClick={() => input.current?.click()} title="Rasm yuklash">
        <IconUpload className="h-4 w-4" /> {!small && (url ? "Almashtirish" : "Rasm")}
      </Button>
      {url && (
        <button type="button" onClick={() => onChange(null)} className="text-xs text-red-600 hover:underline">
          olib tashlash
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            onChange((await uploadFile(f, "IMAGE")).url);
          } catch (err) {
            toast(err instanceof ApiError ? err.message : "Yuklab bo'lmadi", "error");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function QuestionEditor({ testId, question, onClose, onSaved }: { testId: string; question?: AdminQuestion; onClose: () => void; onSaved: (keepOpen: boolean) => void }) {
  const toast = useToast();
  const empty = () => ({ text: "", imageUrl: null as string | null, explanation: "", options: [0, 1, 2, 3].map((i) => ({ text: "", imageUrl: null, isCorrect: i === 0 })) as AdminOption[] });
  const [d, setD] = useState(() => (question ? { text: question.text, imageUrl: question.imageUrl, explanation: question.explanation ?? "", options: question.options.map((o) => ({ ...o })) } : empty()));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const setOpt = (i: number, patch: Partial<AdminOption>) => setD((x) => ({ ...x, options: x.options.map((o, j) => (j === i ? { ...o, ...patch } : patch.isCorrect ? { ...o, isCorrect: false } : o)) }));

  async function save(e: FormEvent, again = false) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = { ...d, options: d.options.filter((o) => o.text.trim() || o.imageUrl) };
      if (question) await api(`/admin/questions/${question.id}`, { method: "PATCH", body });
      else await api(`/admin/tests/${testId}/questions`, { body });
      toast("Savol saqlandi");
      if (again) setD(empty());
      onSaved(again);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={question ? "Savolni tahrirlash" : "Yangi savol"} wide>
      <form onSubmit={(e) => save(e)} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Savol matni</span>
            <button type="button" onClick={() => setPreview(!preview)} className="text-xs font-medium text-brand-700 hover:underline">
              {preview ? "Tahrirlash" : "Ko'rinishi"}
            </button>
          </div>
          {preview ? (
            <div className="space-y-3 rounded-lg border border-line p-4">
              <Markdown>{d.text || "_bo'sh_"}</Markdown>
              {d.imageUrl && <img src={d.imageUrl} alt="" className="max-h-60 rounded-lg" />}
              <ul className="space-y-1.5">
                {d.options.map((o, i) => (
                  <li key={i} className={cx("flex gap-2 rounded-lg border px-3 py-2 text-sm", o.isCorrect ? "border-emerald-300 bg-emerald-50" : "border-line")}>
                    <b>{LETTERS[i]})</b>
                    <div className="min-w-0 flex-1">
                      {o.text && <Markdown>{o.text}</Markdown>}
                      {o.imageUrl && <img src={o.imageUrl} alt="" className="mt-1 max-h-24 rounded" />}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Textarea rows={4} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder="Masalan: Jism $v = 10$ m/s tezlik bilan 5 s harakatlandi. Bosib o'tilgan yo'l?" autoFocus={!question} />
          )}
          <p className="mt-1 text-xs text-muted">Formula: $...$ qator ichida, $$...$$ alohida qatorda. Masalan: $\frac{'{a}'}{'{b}'}$, $x^2$, $\sqrt{'{x}'}$</p>
        </div>
        <ImagePicker url={d.imageUrl} onChange={(u) => setD({ ...d, imageUrl: u })} />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Javob variantlari (to'g'risini belgilang)</span>
          <div className="space-y-2">
            {d.options.map((o, i) => (
              <div key={o.id ?? `n${i}`} className={cx("flex items-start gap-2 rounded-lg border p-2", o.isCorrect ? "border-emerald-300 bg-emerald-50/50" : "border-line")}>
                <button
                  type="button"
                  onClick={() => setOpt(i, { isCorrect: true })}
                  title="To'g'ri javob"
                  className={cx("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", o.isCorrect ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
                >
                  {LETTERS[i]}
                </button>
                <textarea
                  rows={1}
                  value={o.text}
                  onChange={(e) => setOpt(i, { text: e.target.value })}
                  placeholder={`${LETTERS[i]} variant`}
                  className="min-h-9 flex-1 resize-y rounded-md border border-line bg-white px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
                <ImagePicker small url={o.imageUrl} onChange={(u) => setOpt(i, { imageUrl: u })} />
                {d.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setD((x) => {
                      const options = x.options.filter((_, j) => j !== i);
                      if (!options.some((y) => y.isCorrect)) options[0] = { ...options[0], isCorrect: true };
                      return { ...x, options };
                    })}
                    className="mt-1.5 rounded p-1 hover:bg-red-50"
                    aria-label="Variantni o'chirish"
                  >
                    <IconTrash className="h-4 w-4 text-red-600" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {d.options.length < 8 && (
            <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setD((x) => ({ ...x, options: [...x.options, { text: "", imageUrl: null, isCorrect: false }] }))}>
              <IconPlus className="h-4 w-4" /> Variant qo'shish
            </Button>
          )}
        </div>

        <Field label="Izoh yoki yechim (ixtiyoriy)" hint="Test tugagach talabaga ko'rsatiladi (sozlamada yoqilgan bo'lsa)">
          <Textarea rows={2} value={d.explanation} onChange={(e) => setD({ ...d, explanation: e.target.value })} />
        </Field>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          {!question && (
            <Button type="button" variant="secondary" loading={busy} onClick={(e) => save(e as unknown as FormEvent, true)}>
              Saqlash va yana qo'shish
            </Button>
          )}
          <Button type="submit" loading={busy}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
