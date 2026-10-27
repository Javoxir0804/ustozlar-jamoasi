import { fileHref } from "../lib/api";

export type Video = { kind: "iframe" | "file"; src: string } | null;

export function VideoPlayer({ video, title }: { video: Video; title: string }) {
  if (!video) return null;
  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-sm">
      {video.kind === "iframe" ? (
        <iframe src={video.src} title={title} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <video src={fileHref(video.src)} controls controlsList="nodownload" className="h-full w-full" preload="metadata" />
      )}
    </div>
  );
}
