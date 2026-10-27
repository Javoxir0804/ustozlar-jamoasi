// Talaba kirishi: Telegram Login Widget. Bot ichida ochilsa AuthProvider o'zi kiritadi.
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
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
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-8 text-center">
        <h1 className="text-2xl font-semibold">Kirish</h1>
        <p className="mt-2 text-sm text-muted">Platformaga Telegram hisobingiz orqali kirasiz. Parol kerak emas.</p>
        <div className="mt-6 space-y-3 text-left">
          {(error || err) && <Alert>{error || err}</Alert>}
        </div>
        <div className="mt-6 flex min-h-12 justify-center">
          {!config ? <Spinner /> : config.botUsername ? <div ref={box} /> : <Alert tone="amber">Telegram bot hali sozlanmagan.</Alert>}
        </div>
        {busy && <p className="mt-3 text-sm text-muted">Tekshirilmoqda...</p>}
        {config?.botUsername && (
          <p className="mt-6 text-sm text-muted">
            Yoki botimiz orqali kiring:{" "}
            <a href={`https://t.me/${config.botUsername}`} className="font-medium text-brand-700 hover:underline" target="_blank" rel="noreferrer">
              @{config.botUsername}
            </a>
          </p>
        )}
      </Card>
    </div>
  );
}
