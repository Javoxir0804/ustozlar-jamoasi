import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Markdown } from "../../components/Markdown";
import { VideoPlayer, type Video } from "../../components/VideoPlayer";
import { IconCheck, IconFile, IconLeft, IconRight } from "../../components/icons";
import { Alert, Button, Card, PageLoader, useToast } from "../../components/ui";
import { api, ApiError, fileHref, fmtSize } from "../../lib/api";

type Lesson = {
  id: string;
  title: string;
  content: string | null;
  video: Video;
  completed: boolean;
  course: { id: string; title: string };
  module: { id: string; title: string };
  files: { id: string; title: string; name: string; size: number; mime: string; url: string }[];
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  position: { index: number; total: number };
};

export default function LessonPage() {
  const { id } = useParams();
  const toast = useToast();
  const [l, setL] = useState<Lesson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setL(null);
    setErr(null);
    api<Lesson>(`/lessons/${id}`).then(setL, (e) => setErr(e instanceof ApiError ? e.message : "Yuklab bo'lmadi"));
    window.scrollTo(0, 0);
  }, [id]);

  async function toggle() {
    if (!l) return;
    setBusy(true);
    try {
      const r = await api<{ completed: boolean }>(`/lessons/${l.id}/complete`, { body: { done: !l.completed } });
      setL({ ...l, completed: r.completed });
      if (r.completed) toast("Dars tugatildi");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  if (err)
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <Alert tone="amber">{err}</Alert>
        <Link to="/courses" className="text-sm font-medium text-brand-700 hover:underline">
          Kurslarga qaytish
        </Link>
      </div>
    );
  if (!l) return <PageLoader />;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to={`/courses/${l.course.id}`} className="mb-3 inline-flex max-w-full items-center gap-1 text-sm text-muted hover:text-ink">
        <IconLeft className="h-4 w-4 shrink-0" /> <span className="truncate">{l.course.title}</span>
      </Link>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {l.module.title} · {l.position.index}/{l.position.total}
      </p>
      <h1 className="font-display mb-4 mt-1 text-2xl font-semibold tracking-tight">{l.title}</h1>
      <VideoPlayer video={l.video} title={l.title} />
      {l.content && (
        <Card className="mt-6 p-5 sm:p-6">
          <Markdown>{l.content}</Markdown>
        </Card>
      )}
      {l.files.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="font-display mb-3 text-sm font-semibold">Dars materiallari</h2>
          <ul className="space-y-2">
            {l.files.map((f) => (
              <li key={f.id}>
                <a href={fileHref(f.url)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm hover:bg-slate-50">
                  <IconFile className="h-5 w-5 shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1 truncate font-medium">{f.title}</span>
                  <span className="shrink-0 text-xs text-muted">{fmtSize(f.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant={l.completed ? "secondary" : "primary"} loading={busy} onClick={toggle}>
          <IconCheck className="h-4 w-4" /> {l.completed ? "Tugatilgan" : "Darsni tugatdim"}
        </Button>
        <div className="flex gap-2">
          {l.prev && (
            <Link to={`/lessons/${l.prev.id}`}>
              <Button variant="secondary">
                <IconLeft className="h-4 w-4" /> Oldingi
              </Button>
            </Link>
          )}
          {l.next && (
            <Link to={`/lessons/${l.next.id}`}>
              <Button variant="secondary">
                Keyingi <IconRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
