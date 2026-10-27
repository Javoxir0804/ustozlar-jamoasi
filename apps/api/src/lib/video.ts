/** Video havolasini pleyer turiga aylantiradi: YouTube (o'z pleyerimiz orqali), Vimeo, Bunny Stream iframe yoki yuklangan fayl. */
export type VideoEmbed = { kind: "youtube"; id: string } | { kind: "iframe"; src: string } | { kind: "file"; src: string };

export function videoEmbed(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null;
  const u = url.trim();
  const yt = u.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "youtube", id: yt[1] };
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}?dnt=1&title=0&byline=0&portrait=0` };
  if (/^https:\/\/iframe\.mediadelivery\.net\/(embed|play)\//.test(u)) return { kind: "iframe", src: u.replace("/play/", "/embed/") };
  if (/^(https:\/\/|\/api\/files\/)/.test(u)) return { kind: "file", src: u };
  return null;
}
