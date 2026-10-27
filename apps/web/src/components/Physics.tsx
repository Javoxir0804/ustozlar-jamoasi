// Fizika uslubidagi bezaklar: atom, to'lqin, formulalar. Faqat ko'rinish uchun (aria-hidden).
import { cx } from "./ui";

/** Atom belgisi: uchta orbita va yadro. `spin` bo'lsa elektronlar aylanadi. */
export function AtomMark({ className, spin }: { className?: string; spin?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.7" className={cx(spin && "origin-center animate-orbit-slow")} style={{ transformBox: "fill-box" }}>
        <ellipse cx="16" cy="16" rx="12" ry="4.6" />
        <ellipse cx="16" cy="16" rx="12" ry="4.6" transform="rotate(60 16 16)" />
        <ellipse cx="16" cy="16" rx="12" ry="4.6" transform="rotate(-60 16 16)" />
      </g>
      <circle cx="16" cy="16" r="2.8" fill="var(--color-ion)" />
    </svg>
  );
}

/** Katta animatsiyali atom: orbitalar bo'ylab elektronlar harakatlanadi. */
export function Atom({ className }: { className?: string }) {
  const orbits = [0, 60, -60];
  return (
    <svg viewBox="-120 -120 240 240" className={className} aria-hidden>
      <defs>
        <radialGradient id="nucleus" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="halo">
          <stop offset="0%" stopColor="#5b6cff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#5b6cff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="orbit" x1="0" x2="1">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#a5b4fc" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <circle r="70" fill="url(#halo)" className="origin-center animate-pulse-glow" style={{ transformBox: "fill-box" }} />
      {orbits.map((deg, i) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <ellipse rx="100" ry="36" fill="none" stroke="url(#orbit)" strokeWidth="1.6" />
          <circle r="5" fill={i === 1 ? "#fbbf24" : "#22d3ee"}>
            <animateMotion dur={`${4 + i * 1.3}s`} repeatCount="indefinite" path="M100,0 A100,36 0 1,1 -100,0 A100,36 0 1,1 100,0" begin={`${-i * 0.9}s`} />
          </circle>
        </g>
      ))}
      <circle r="13" fill="url(#nucleus)" />
      <circle r="13" fill="none" stroke="#fde68a" strokeOpacity="0.6" />
    </svg>
  );
}

/** Harakatlanuvchi sinusoida (to'lqin). */
export function Wave({ className, color = "currentColor" }: { className?: string; color?: string }) {
  const d = Array.from({ length: 41 }, (_, i) => `${i === 0 ? "M" : "L"}${i * 20},${50 + Math.sin(i * 0.6) * 30}`).join(" ");
  return (
    <svg viewBox="0 0 800 100" preserveAspectRatio="none" className={className} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 8" className="animate-wave" />
    </svg>
  );
}

const FORMULAS = ["F = ma", "E = mc²", "v = λν", "p = mv", "U = IR", "E = hν", "a = Δv/Δt", "W = Fs"];

/** Fonda suzib yuruvchi formulalar. */
export function FloatingFormulas({ className }: { className?: string }) {
  const spots = [
    "right-[6%] top-[10%]",
    "left-[52%] top-[5%]",
    "right-[3%] bottom-[24%]",
    "left-[50%] bottom-[16%]",
    "right-[2%] top-[46%]",
    "right-[36%] bottom-[6%]",
  ];
  return (
    <div className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {spots.map((pos, i) => (
        <span
          key={pos}
          className={cx("absolute rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-xs text-brand-200/80 backdrop-blur-sm animate-float", pos, i > 2 && "hidden sm:block")}
          style={{ animationDelay: `${i * -1.1}s`, animationDuration: `${6 + (i % 3)}s` }}
        >
          {FORMULAS[i]}
        </span>
      ))}
    </div>
  );
}

/** Kurs muqovasi yo'q bo'lsa: kosmik fon, orbitalar va to'lqin. `seed` rang tusini o'zgartiradi. */
export function PhysicsCover({ seed = "", className }: { seed?: string; className?: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const hues = [230, 250, 200, 270, 190];
  const hue = hues[h % hues.length];
  const formula = FORMULAS[h % FORMULAS.length];
  return (
    <div className={cx("relative h-full w-full overflow-hidden", className)} style={{ background: `radial-gradient(70% 90% at 85% 0%, hsl(${hue} 90% 62% / .55), transparent 60%), linear-gradient(160deg, hsl(${hue} 60% 16%), #050816)` }}>
      <div className="bg-grid-dark absolute inset-0" />
      <svg viewBox="0 0 200 100" className="absolute -right-6 top-1/2 h-[140%] -translate-y-1/2 opacity-70" aria-hidden>
        <g fill="none" stroke="white" strokeOpacity=".35">
          <ellipse cx="140" cy="50" rx="55" ry="18" />
          <ellipse cx="140" cy="50" rx="55" ry="18" transform="rotate(60 140 50)" />
          <ellipse cx="140" cy="50" rx="55" ry="18" transform="rotate(-60 140 50)" />
        </g>
        <circle cx="140" cy="50" r="5" fill="#fbbf24" />
      </svg>
      <span className="absolute bottom-3 left-4 font-mono text-sm text-white/70">{formula}</span>
    </div>
  );
}
