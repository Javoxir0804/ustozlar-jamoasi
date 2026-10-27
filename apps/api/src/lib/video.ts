/** Video havolasini pleyer manziliga aylantiradi: YouTube, Vimeo, Bunny Stream iframe yoki to'g'ridan-to'g'ri fayl. */
export function videoEmbed(url: string | null | undefined): { kind: "iframe" | "file"; src: string } | null {
  if (!url) return null;
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/^https:\/\/iframe\.mediadelivery\.net\/(embed|play)\//.test(u)) return { kind: "iframe", src: u.replace("/play/", "/embed/") };
  if (/^(https:\/\/|\/api\/files\/)/.test(u)) return { kind: "file", src: u };
  return null;
}
