// Talaba kirishi: Telegram Login Widget. Bot ichida ochilsa AuthProvider o'zi kiritadi.
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Atom, AtomMark } from "../components/Physics";
import { Alert, Card, PageLoader, Spinner } from "../components/ui";
import { api, ApiError, type User } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useConfig } from "../lib/config";

export default function Login() {
  const { user, loading, error, setSession } = useAuth();
  const config = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    if (!config?.botUsername || !box.current || user) return;
    window.onTelegramAuth = async (data) => {
      setBusy(true);
      setErr(null);
      try {
        const r = await api<{ token: string; user: User }>("/auth/telegram/widget", { body: data });
        setSession(r.token, r.user);
        navigate(r.user.profileCompleted ? from || "/cabinet" : "/onboarding", { replace: true });
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Kirib bo'lmadi");
      } finally {
        setBusy(false);
      }
    };
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", config.botUsername);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "10");
    s.setAttribute("data-request-access", "write");
    s.setAttribute("data-onauth", "onTelegramAuth(user)");
    box.current.innerHTML = "";
    box.current.appendChild(s);
  }, [config?.botUsername, user, setSession, navigate, from]);

  if (loading) return <PageLoader />;
  if (user) return <Navigate to={user.role === "ADMIN" ? "/admin" : user.profileCompleted ? from || "/cabinet" : "/onboarding"} replace />;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:py-16 md:grid-cols-2">
      <div className="bg-cosmos relative hidden min-h-[440px] overflow-hidden rounded-3xl p-10 text-white md:block">
        <div className="bg-grid-dark mask-fade absolute inset-0" />
        <Atom className="absolute -bottom-16 -right-16 h-72 w-72 opacity-80" />
        <p className="absolute bottom-8 left-10 font-mono text-sm text-brand-200/80">E = mc² · F = ma</p>
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-200">Xush kelibsiz</p>
          <h2 className="mt-3 max-w-xs font-display text-2xl font-semibold leading-tight">Bilim ham energiya kabi yo'qolmaydi</h2>
          <p className="mt-4 max-w-xs text-sm text-slate-300">Darslar, testlar va natijalaringiz bitta kabinetda saqlanadi.</p>
        </div>
      </div>
      <Card className="relative overflow-hidden p-8 text-center sm:p-10">
        <div className="bg-grid absolute inset-x-0 top-0 h-40 mask-fade" />
        <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cosmos-900 text-brand-300 shadow-[0_10px_30px_-10px_rgb(67_83_240/0.8)]">
          <AtomMark className="h-10 w-10" spin />
        </span>
        <h1 className="relative mt-6 font-display text-2xl font-semibold">Kirish</h1>
        <p className="relative mt-2 text-sm text-muted">Platformaga Telegram hisobingiz orqali kirasiz. Parol kerak emas.</p>
        <div className="mt-6 space-y-3 text-left">
          {(error || err) && <Alert>{error || err}</Alert>}
        </div>
        <div className="mt-6 flex min-h-12 justify-center">
          {!config ? <Spinner /> : config.botUsername ? <div ref={box} /> : <Alert tone="amber">Telegram bot hali sozlanmagan.</Alert>}
        </div>
        {busy && <p className="mt-3 text-sm text-muted">Tekshirilmoqda...</p>}
        {config?.botUsername && (
          <p className="mt-8 border-t border-line pt-6 text-sm text-muted">
            Yoki botimiz orqali kiring:{" "}
            <a href={`https://t.me/${config.botUsername}`} className="font-semibold text-brand-700 hover:underline" target="_blank" rel="noreferrer">
              @{config.botUsername}
            </a>
          </p>
        )}
      </Card>
    </div>
  );
}
