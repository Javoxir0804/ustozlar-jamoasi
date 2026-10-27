// Himoyalangan video pleyer: YouTube va yuklangan videoni o'z boshqaruvimiz bilan ko'rsatadi.
// YouTube havolasi, logotip va "YouTube'da ko'rish" tugmalari bosilmaydi, yuklab olish menyusi yo'q,
// ustida talabaning ismi bilan suv belgisi (ekrandan yozib olishni tiyadi).
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { fullName } from "../lib/api";
import { useAuth } from "../lib/auth";
import { cx } from "./ui";

export type Video = { kind: "youtube"; id: string } | { kind: "iframe"; src: string } | { kind: "file"; src: string } | null;

// Ikkala manba (YouTube va fayl) uchun bir xil boshqaruv
interface Engine {
  play(): void;
  pause(): void;
  seek(sec: number): void;
  time(): number;
  setRate(r: number): void;
  setMuted(m: boolean): void;
  destroy(): void;
}
type Status = "idle" | "playing" | "paused" | "ended" | "error";

const RATES = [1, 1.25, 1.5, 2, 0.75];
const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

export function VideoPlayer({ video, title }: { video: Video; title: string }) {
  if (!video) return null;
  if (video.kind === "iframe") return <PlainFrame src={video.src} title={title} />;
  return <ProtectedPlayer key={video.kind === "youtube" ? video.id : video.src} video={video} title={title} />;
}

/** Vimeo va Bunny: o'z pleyeri (domen cheklovi o'sha xizmat sozlamasida qilinadi). */
function PlainFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="relative aspect-video w-full select-none overflow-hidden rounded-2xl bg-black shadow-[0_20px_50px_-20px_rgb(5_8_22/0.6)]" onContextMenu={(e) => e.preventDefault()}>
      <iframe src={src} title={title} className="h-full w-full" referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
      <Watermark />
    </div>
  );
}

// ---------- YouTube IFrame API ----------
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allow: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(r: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
};
type YTNamespace = { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let ytApi: Promise<YTNamespace> | null = null;
function loadYouTube() {
  ytApi ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => {
      ytApi = null;
      reject(new Error("YouTube yuklanmadi"));
    };
    document.head.appendChild(s);
  });
  return ytApi;
}

function ProtectedPlayer({ video, title }: { video: Exclude<Video, null | { kind: "iframe" }>; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [ready, setReady] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [cssFull, setCssFull] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const hideTimer = useRef(0);

  // Manbani ulash
  useEffect(() => {
    let alive = true;
    const el = mount.current!;
    if (video.kind === "youtube") {
      const host = document.createElement("div");
      el.appendChild(host);
      loadYouTube().then(
        (YT) => {
          if (!alive) return;
          const p = new YT.Player(host, {
            host: "https://www.youtube-nocookie.com",
            videoId: video.id,
            width: "100%",
            height: "100%",
            playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, playsinline: 1, origin: window.location.origin },
            events: {
              onReady: () => {
                if (!alive) return;
                setReady(true);
                setDur(p.getDuration() || 0);
              },
              onStateChange: (e: { data: number }) => {
                if (!alive) return;
                if (e.data === 1) setStatus("playing");
                else if (e.data === 2) setStatus("paused");
                else if (e.data === 0) setStatus("ended");
                setDur(p.getDuration() || 0);
              },
              onError: () => alive && setStatus("error"),
            },
          });
          engine.current = {
            play: () => p.playVideo(),
            pause: () => p.pauseVideo(),
            seek: (s) => p.seekTo(s, true),
            time: () => p.getCurrentTime() || 0,
            setRate: (r) => p.setPlaybackRate(r),
            setMuted: (m) => (m ? p.mute() : p.unMute()),
            destroy: () => p.destroy(),
          };
        },
        () => alive && setStatus("error"),
      );
    } else {
      const v = document.createElement("video");
      v.src = video.src;
      v.preload = "metadata";
      v.playsInline = true;
      v.disablePictureInPicture = true;
      v.setAttribute("controlsList", "nodownload noremoteplayback noplaybackrate");
      v.setAttribute("disableRemotePlayback", "");
      v.className = "h-full w-full";
      v.oncontextmenu = (e) => e.preventDefault();
      v.onloadedmetadata = () => {
        setDur(v.duration || 0);
        setReady(true);
      };
      v.onplay = () => setStatus("playing");
      v.onpause = () => !v.ended && setStatus("paused");
      v.onended = () => setStatus("ended");
      v.onerror = () => setStatus("error");
      el.appendChild(v);
      engine.current = {
        play: () => void v.play().catch(() => {}),
        pause: () => v.pause(),
        seek: (s) => (v.currentTime = s),
        time: () => v.currentTime,
        setRate: (r) => (v.playbackRate = r),
        setMuted: (m) => (v.muted = m),
        destroy: () => {
          v.pause();
          v.removeAttribute("src");
          v.load();
        },
      };
    }
    return () => {
      alive = false;
      engine.current?.destroy();
      engine.current = null;
      el.innerHTML = "";
    };
  }, [video]);

  // Vaqtni yangilab turish
  useEffect(() => {
    if (status !== "playing") return;
    const id = window.setInterval(() => engine.current && setT(engine.current.time()), 250);
    return () => clearInterval(id);
  }, [status]);

  // Ijro paytida boshqaruv paneli 2.5 soniyadan keyin yashirinadi
  const poke = useCallback(() => {
    setShowUi(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowUi(false), 2500);
  }, []);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const toggle = () => {
    const e = engine.current;
    if (!e) return;
    if (status === "playing") e.pause();
    else {
      if (status === "ended") e.seek(0);
      e.play();
      poke();
    }
  };
  const seekTo = (s: number) => {
    engine.current?.seek(s);
    setT(s);
  };

  // To'liq ekran: brauzer qo'llasa haqiqiy, aks holda (iPhone, Telegram) sahifani to'ldiruvchi rejim.
  // Ikkalasida ham suv belgisi va bizning boshqaruv saqlanadi.
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    const el = box.current;
    if (!el) return;
    if (full) return void document.exitFullscreen?.();
    if (cssFull) return setCssFull(false);
    if (el.requestFullscreen) el.requestFullscreen().catch(() => setCssFull(true));
    else setCssFull(true);
  };
  useEffect(() => {
    if (!cssFull) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setCssFull(false);
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [cssFull]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowRight") seekTo(Math.min(dur, t + 5));
    else if (e.key === "ArrowLeft") seekTo(Math.max(0, t - 5));
    else if (e.key === "f") toggleFull();
  };

  const started = status !== "idle";
  const yt = video.kind === "youtube";
  const big = full || cssFull;

  return (
    <div
      ref={box}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={poke}
      onTouchStart={poke}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={title}
      className={cx(
        "relative select-none overflow-hidden bg-black outline-none",
        cssFull ? "fixed inset-0 z-[100] flex items-center" : full ? "flex items-center" : "aspect-video w-full rounded-2xl shadow-[0_20px_50px_-20px_rgb(5_8_22/0.6)] ring-1 ring-black/5",
        status === "playing" && !showUi && "cursor-none",
      )}
    >
      <div ref={mount} className={cx("w-full [&>iframe]:h-full [&>iframe]:w-full", big ? "aspect-video max-h-full" : "h-full")} />

      {/* Iframe ustidagi qoplama: YouTube havolalari bosilmaydi. Boshlanishidan oldin YouTube'ning o'z
          ijro tugmasi uchun o'rta qism ochiq qoladi (iPhone'da birinchi ijro faqat iframe ichidan ishlaydi). */}
      {yt && !started ? (
        <>
          <div className="absolute inset-x-0 top-0 h-[26%] bg-gradient-to-b from-black via-black/95 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-t from-black via-black/95 to-transparent" />
          <p className="pointer-events-none absolute left-4 right-4 top-3 truncate font-display text-sm font-semibold text-white/90">{title}</p>
          {!ready && <Loading />}
        </>
      ) : (
        <button type="button" aria-label={status === "playing" ? "Pauza" : "Ijro"} onClick={toggle} className="absolute inset-0 h-full w-full cursor-[inherit]" />
      )}

      {!yt && !started && (ready ? <Center><BigPlay onClick={toggle} /></Center> : <Loading />)}
      {(status === "paused" || status === "ended") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cosmos-950/75 backdrop-blur-[2px]" onClick={toggle}>
          <BigPlay onClick={toggle} replay={status === "ended"} />
          {status === "ended" && <p className="text-sm font-medium text-white/90">Dars tugadi</p>}
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-cosmos-950 p-6 text-center text-sm text-slate-300">Videoni yuklab bo'lmadi. Sahifani yangilang yoki keyinroq urinib ko'ring.</div>
      )}

      <Watermark />

      {started && status !== "error" && (
        <div className={cx("absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-2 pt-10 transition-opacity duration-300 sm:px-4", status !== "playing" || showUi ? "opacity-100" : "pointer-events-none opacity-0")}>
          <Seek value={t} max={dur} onChange={seekTo} />
          <div className="mt-1 flex items-center gap-1 text-white sm:gap-2">
            <CtrlButton label={status === "playing" ? "Pauza" : "Ijro"} onClick={toggle}>
              {status === "playing" ? <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" stroke="none" /> : <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />}
            </CtrlButton>
            <CtrlButton label="10 soniya orqaga" onClick={() => seekTo(Math.max(0, t - 10))}>
              <path d="M11 5 6 9l5 4M6 9h8a5 5 0 0 1 0 10h-3" />
            </CtrlButton>
            <CtrlButton
              label={muted ? "Ovozni yoqish" : "Ovozni o'chirish"}
              onClick={() => {
                engine.current?.setMuted(!muted);
                setMuted(!muted);
              }}
            >
              <path d="M4 9h4l5-4v14l-5-4H4z" />
              {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
            </CtrlButton>
            <span className="ml-1 font-mono text-[11px] tabular-nums text-white/85 sm:text-xs">
              {fmt(t)} / {fmt(dur)}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => {
                const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
                engine.current?.setRate(r);
                setRate(r);
              }}
              className="rounded-md px-2 py-1 font-mono text-xs font-semibold hover:bg-white/15"
              aria-label="Tezlik"
            >
              {rate}×
            </button>
            <CtrlButton label="To'liq ekran" onClick={toggleFull}>
              {big ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </CtrlButton>
          </div>
        </div>
      )}
    </div>
  );
}

const Center = ({ children }: { children: ReactNode }) => <div className="pointer-events-none absolute inset-0 flex items-center justify-center [&>*]:pointer-events-auto">{children}</div>;

function Loading() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-ion" />
    </div>
  );
}

function BigPlay({ onClick, replay }: { onClick: () => void; replay?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={replay ? "Qayta ko'rish" : "Ijro"}
      className="btn-glow relative flex h-16 w-16 items-center justify-center rounded-full text-white ring-4 ring-white/15 transition hover:scale-105 sm:h-20 sm:w-20"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 sm:h-8 sm:w-8" fill="currentColor" aria-hidden>
        {replay ? <path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" /> : <path d="M8 5v14l11-7z" />}
      </svg>
    </button>
  );
}

function CtrlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function Seek({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="relative flex h-4 items-center">
      <div className="absolute inset-x-0 h-1 rounded-full bg-white/25" />
      <div className="absolute left-0 h-1 rounded-full bg-gradient-to-r from-brand-400 to-ion" style={{ width: `${pct}%` }} />
      <input
        type="range"
        min={0}
        max={max || 0}
        step={0.1}
        value={Math.min(value, max || 0)}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Video vaqti"
        className="relative h-4 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
      />
    </div>
  );
}

/** Talabaning ismi va telefonining oxirgi raqamlari: har 12 soniyada joyini o'zgartiradi. */
function Watermark() {
  const { user } = useAuth();
  const [pos, setPos] = useState(2);
  useEffect(() => {
    const id = window.setInterval(() => setPos((p) => (p + 1 + Math.floor(Math.random() * 3)) % SPOTS.length), 12000);
    return () => clearInterval(id);
  }, []);
  if (!user) return null;
  return (
    <span className={cx("pointer-events-none absolute z-10 whitespace-nowrap font-mono text-[10px] text-white/40 [text-shadow:0_0_3px_rgb(0_0_0/0.7)] transition-all duration-1000 sm:text-xs", SPOTS[pos])} aria-hidden>
      {fullName(user)}
      {user.phone ? ` · ${user.phone.slice(-4)}` : ""}
    </span>
  );
}
const SPOTS = ["left-[6%] top-[10%]", "right-[6%] top-[14%]", "left-[30%] top-[45%]", "right-[10%] bottom-[30%]", "left-[8%] bottom-[32%]", "left-[45%] top-[24%]"];
