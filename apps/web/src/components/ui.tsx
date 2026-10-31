// Umumiy interfeys elementlari: tugma, maydon, karta, oyna, xabarlar.
import { createPortal } from "react-dom";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "btn-glow text-white hover:brightness-110",
  secondary: "bg-white text-ink border border-line hover:border-brand-200 hover:bg-brand-50/50 shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const sizes = { sm: "h-8 px-3 text-sm rounded-lg", md: "h-10 px-4 text-sm rounded-xl", lg: "h-12 px-6 text-base rounded-xl" };
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none", VARIANTS[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export const PageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-brand-600" role="status" aria-label="Yuklanmoqda">
    <svg viewBox="0 0 32 32" className="h-12 w-12" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.5" className="origin-center animate-orbit" style={{ transformBox: "fill-box", animationDuration: "2.4s" }}>
        <ellipse cx="16" cy="16" rx="12" ry="4.6" />
        <ellipse cx="16" cy="16" rx="12" ry="4.6" transform="rotate(60 16 16)" />
        <ellipse cx="16" cy="16" rx="12" ry="4.6" transform="rotate(-60 16 16)" />
      </g>
      <circle cx="16" cy="16" r="2.8" fill="var(--color-ion)" />
    </svg>
  </div>
);

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputBase = "w-full rounded-xl border bg-white px-3 text-sm text-ink placeholder:text-slate-400 transition focus:outline-none focus:ring-4 focus:ring-brand-500/15 focus:border-brand-500";

export function Input({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx(inputBase, "h-10", invalid ? "border-red-400" : "border-line", className)} {...rest} />;
}

/** Parol maydoni: ko'z belgisi bilan ko'rsatish va yashirish. */
export function PasswordInput({ invalid, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} className={cx(inputBase, "h-10 pr-11", invalid ? "border-red-400" : "border-line", className)} {...rest} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
        title={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-brand-600"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {show ? (
            <path d="M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          ) : (
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
          )}
        </svg>
      </button>
    </div>
  );
}

export function Textarea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cx(inputBase, "py-2", invalid ? "border-red-400" : "border-line", className)} {...rest} />;
}

export function Select({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cx(inputBase, "h-10 pr-8", invalid ? "border-red-400" : "border-line", className)} {...rest}>
      {children}
    </select>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(11_16_38/0.04),0_8px_24px_-12px_rgb(11_16_38/0.08)]", className)}>{children}</div>;
}

export function Badge({ tone = "slate", children }: { tone?: "slate" | "green" | "red" | "amber" | "blue"; children: ReactNode }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    red: "bg-red-50 text-red-700 ring-red-600/20",
    amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
    blue: "bg-brand-50 text-brand-700 ring-brand-600/20",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent", tones[tone])}>{children}</span>;
}

export function Alert({ tone = "red", children }: { tone?: "red" | "green" | "blue" | "amber"; children: ReactNode }) {
  const tones = { red: "bg-red-50 text-red-800 border-red-200", green: "bg-emerald-50 text-emerald-800 border-emerald-200", blue: "bg-brand-50 text-brand-800 border-brand-200", amber: "bg-amber-50 text-amber-900 border-amber-200" };
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="bg-grid mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50/60 text-brand-400">
        <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <ellipse cx="16" cy="16" rx="12" ry="4.6" />
          <ellipse cx="16" cy="16" rx="12" ry="4.6" transform="rotate(60 16 16)" />
          <ellipse cx="16" cy="16" rx="12" ry="4.6" transform="rotate(-60 16 16)" />
          <circle cx="16" cy="16" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Oyna: document.body ichiga chiziladi (sahifa animatsiyasi joylashuvini buzmasin), ekran markazida,
 * sarlavha va pastki tugmalar doim ko'rinadi, uzun mazmun ichida aylanadi.
 * Telefon yoki brauzerning "orqaga" tugmasi oynani yopadi (sahifadan chiqib ketmaydi).
 */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  useBackToClose(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cosmos-950/55 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={cx("flex max-h-[92dvh] w-full animate-rise flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-3xl", wide ? "max-w-3xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
          <button onClick={onClose} className="-ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink sm:hidden" aria-label="Orqaga">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2 className="min-w-0 flex-1 truncate font-display text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Yopish" title="Yopish (Esc)">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Oyna ochilganda tarixga belgi qo'yadi: "orqaga" bosilsa sahifa emas, oyna yopiladi. */
function useBackToClose(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  const id = useRef(`m${Math.random().toString(36).slice(2)}`);
  const active = useRef(false);
  useEffect(() => {
    if (!open) return;
    const me = id.current;
    active.current = true;
    if (window.history.state?.modal !== me) window.history.pushState({ ...window.history.state, modal: me }, "");
    const onPop = () => {
      if (active.current && window.history.state?.modal !== me) {
        active.current = false;
        close.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      active.current = false;
      // Tugma bilan yopilganda tarixdagi belgini olib tashlaymiz (qayta ochilgan bo'lsa tegmaymiz)
      setTimeout(() => {
        if (!active.current && window.history.state?.modal === me) window.history.back();
      }, 0);
    };
  }, [open]);
}

// ---------- Qisqa xabarlar (toast) ----------
type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto animate-rise rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-xl", t.tone === "ok" ? "bg-cosmos-900 ring-1 ring-white/10" : "bg-red-600")}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export { cx };

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-brand-600" : "bg-slate-300")}
      >
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((i) => (
        <button
          key={i.value}
          onClick={() => onChange(i.value)}
          className={cx("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition", value === i.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}
