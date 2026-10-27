import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithWidget } from "../api";

const BOT = import.meta.env.VITE_BOT_USERNAME as string | undefined;

// Saytga kirish: Telegram Login Widget. Ro'yxatdan faqat botda o'tiladi.
export function LoginPage() {
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    (window as unknown as { onTelegramAuth: (u: Record<string, string | number>) => void }).onTelegramAuth = async (u) => {
      try {
        await loginWithWidget(u);
        nav("/tests");
      } catch (e) {
        alert((e as Error).message);
      }
    };
    if (!BOT || !ref.current) return;
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.dataset.telegramLogin = BOT;
    s.dataset.size = "large";
    s.dataset.onauth = "onTelegramAuth(user)";
    ref.current.appendChild(s);
  }, [nav]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Attestatsiyaga tayyorlov platformasi</h1>
      <p className="max-w-sm text-muted">Kirish uchun avval botda ro'yxatdan o'ting, so'ng Telegram orqali kiring.</p>
      {BOT && (
        <a href={`https://t.me/${BOT}`} className="text-primary">
          @{BOT} botini ochish
        </a>
      )}
      <div ref={ref} />
    </div>
  );
}
