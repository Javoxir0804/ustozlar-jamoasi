import { Link } from "react-router-dom";
import type { CourseCard } from "../pages/courses/types";
import { IconLock, IconPlay } from "./icons";
import { Badge, Card } from "./ui";

export function CourseGrid({ courses }: { courses: CourseCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => {
        const pct = c.lessonCount ? Math.round((c.completedCount / c.lessonCount) * 100) : 0;
        return (
          <Link key={c.id} to={`/courses/${c.id}`}>
            <Card className="flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="relative aspect-[16/8] bg-gradient-to-br from-brand-600 to-brand-800">
                {c.coverUrl ? <img src={c.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <IconPlay className="absolute inset-0 m-auto h-10 w-10 text-white/40" />}
                {!c.hasAccess && c.isPaid && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs font-medium text-white">
                    <IconLock className="h-3.5 w-3.5" /> Yopiq
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex gap-1.5">
                  <Badge tone="blue">{c.subject.name}</Badge>
                  {!c.isPaid && <Badge tone="green">Bepul</Badge>}
                </div>
                <h3 className="font-semibold leading-snug text-ink">{c.title}</h3>
                <p className="mt-1 text-xs text-muted">{c.lessonCount} ta dars</p>
                {c.hasAccess && c.completedCount > 0 && (
                  <div className="mt-auto pt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{pct}% tugatildi</p>
                  </div>
                )}
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
