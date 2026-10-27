// Dars muharriri: nomi, video, konspekt (Markdown + formulalar), sozlamalar va fayllar.
import { useRef, useState, type FormEvent } from "react";
import { Markdown } from "../../components/Markdown";
import { IconFile, IconTrash, IconUpload } from "../../components/icons";
import { Alert, Button, Field, Input, Modal, Textarea, Toggle, useToast } from "../../components/ui";
import { api, ApiError, fileHref, fmtSize, uploadFile } from "../../lib/api";

export type LessonFileRow = { id: string; title: string; fileId: string; file: { name: string; size: number; mime: string } };
export type AdminLesson = {
  id: string;
  title: string;
  videoUrl: string | null;
  content: string | null;
  durationSec: number | null;
  isPreview: boolean;
  isPublished: boolean;
  order: number;
  files: LessonFileRow[];
};

type Draft = { title: string; videoUrl: string; content: string; minutes: string; isPreview: boolean; isPublished: boolean };
const toDraft = (l?: AdminLesson): Draft => ({
  title: l?.title ?? "",
  videoUrl: l?.videoUrl ?? "",
  content: l?.content ?? "",
  minutes: l?.durationSec ? String(Math.round(l.durationSec / 60)) : "",
  isPreview: l?.isPreview ?? false,
  isPublished: l?.isPublished ?? true,
});

export function LessonEditor({ moduleId, lesson, onClose, onChanged }: { moduleId: string; lesson?: AdminLesson; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState<AdminLesson | undefined>(lesson);
  const [d, setD] = useState<Draft>(() => toDraft(lesson));
  const [preview, setPreview] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const body = {
      title: d.title,
      videoUrl: d.videoUrl,
      content: d.content,
      durationSec: d.minutes ? Math.round(Number(d.minutes) * 60) || null : null,
      isPreview: d.isPreview,
      isPublished: d.isPublished,
    };
    try {
      if (current) {
        await api(`/admin/lessons/${current.id}`, { method: "PATCH", body });
        toast("Dars saqlandi");
        onChanged();
        onClose();
      } else {
        const l = await api<AdminLesson>(`/admin/modules/${moduleId}/lessons`, { body });
        setCurrent({ ...l, files: [] });
        toast("Dars qo'shildi. Endi fayl biriktirishingiz mumkin.");
        onChanged();
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function uploadVideo(f: File) {
    setUploading("video");
    try {
      const u = await uploadFile(f, "MATERIAL");
      setD((x) => ({ ...x, videoUrl: u.url }));
      toast("Video yuklandi. Saqlashni unutmang.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Yuklab bo'lmadi", "error");
    } finally {
      setUploading(null);
    }
  }

  async function attach(f: File) {
    if (!current) return;
    setUploading("file");
    try {
      const u = await uploadFile(f, "MATERIAL");
      const row = await api<LessonFileRow>(`/admin/lessons/${current.id}/files`, { body: { fileId: u.id, title: f.name.replace(/\.[^.]+$/, "") } });
      setCurrent({ ...current, files: [...current.files, row] });
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Yuklab bo'lmadi", "error");
    } finally {
      setUploading(null);
    }
  }

  async function detach(row: LessonFileRow) {
    if (!current || !confirm(`"${row.title}" fayli o'chirilsinmi?`)) return;
    await api(`/admin/lesson-files/${row.id}`, { method: "DELETE" });
    setCurrent({ ...current, files: current.files.filter((f) => f.id !== row.id) });
    onChanged();
  }

  return (
    <Modal open onClose={onClose} title={current ? "Darsni tahrirlash" : "Yangi dars"} wide>
      <form onSubmit={save} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <Field label="Dars nomi">
          <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} autoFocus={!current} />
        </Field>
        <Field label="Video" hint="YouTube, Vimeo yoki Bunny Stream havolasi. Yoki MP4 faylni yuklang (30 MB gacha).">
          <div className="flex gap-2">
            <Input value={d.videoUrl} onChange={(e) => setD({ ...d, videoUrl: e.target.value })} placeholder="https://youtu.be/..." />
            <Button type="button" variant="secondary" loading={uploading === "video"} onClick={() => videoInput.current?.click()}>
              <IconUpload className="h-4 w-4" /> MP4
            </Button>
            <input ref={videoInput} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])} />
          </div>
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Konspekt</span>
            <button type="button" onClick={() => setPreview(!preview)} className="text-xs font-medium text-brand-700 hover:underline">
              {preview ? "Tahrirlash" : "Ko'rinishi"}
            </button>
          </div>
          {preview ? (
            <div className="min-h-40 rounded-lg border border-line p-4">{d.content.trim() ? <Markdown>{d.content}</Markdown> : <p className="text-sm text-muted">Bo'sh</p>}</div>
          ) : (
            <Textarea rows={9} value={d.content} onChange={(e) => setD({ ...d, content: e.target.value })} className="font-mono text-[13px]" placeholder={"## Mavzu\nMatn. Formula: $v = \\frac{s}{t}$\n\n$$F = ma$$"} />
          )}
          <p className="mt-1 text-xs text-muted">Markdown: ## sarlavha, **qalin**, - ro'yxat. Formula: $...$ qator ichida, $$...$$ alohida qatorda.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Davomiyligi (daqiqa)">
            <Input type="number" min={0} value={d.minutes} onChange={(e) => setD({ ...d, minutes: e.target.value })} />
          </Field>
          <div className="sm:col-span-2 space-y-3 pt-1">
            <Toggle checked={d.isPublished} onChange={(v) => setD({ ...d, isPublished: v })} label="Nashr qilingan" hint="O'chirilsa talabalar bu darsni ko'rmaydi" />
            <Toggle checked={d.isPreview} onChange={(v) => setD({ ...d, isPreview: v })} label="Tanishtiruv darsi" hint="Pullik kursda ham hamma uchun ochiq" />
          </div>
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">Fayllar (PDF, taqdimot va boshqalar)</span>
            <Button type="button" size="sm" variant="secondary" disabled={!current} loading={uploading === "file"} onClick={() => fileInput.current?.click()}>
              <IconUpload className="h-4 w-4" /> Yuklash
            </Button>
            <input ref={fileInput} type="file" hidden onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])} />
          </div>
          {!current ? (
            <p className="mt-2 text-xs text-muted">Fayl biriktirish uchun avval darsni saqlang.</p>
          ) : current.files.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Fayl yo'q</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {current.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                  <a href={fileHref(`/api/files/${f.fileId}`)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 hover:underline">
                    <IconFile className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{f.title}</span>
                    <span className="shrink-0 text-xs text-muted">{fmtSize(f.file.size)}</span>
                  </a>
                  <button type="button" onClick={() => detach(f)} className="rounded p-1 hover:bg-red-50" aria-label="O'chirish">
                    <IconTrash className="h-4 w-4 text-red-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {current && !lesson ? "Tayyor" : "Bekor qilish"}
          </Button>
          <Button type="submit" loading={busy}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
