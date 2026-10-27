import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithCredentials, loginWithWidget, registerWithCredentials, RegisterData } from "../api";

const BOT = import.meta.env.VITE_BOT_USERNAME as string | undefined;
const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO === "1";

export function LoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kirish formasi holatlari
  const [loginInput, setLoginInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Ro'yxatdan o'tish formasi holatlari
  const [regData, setRegData] = useState<RegisterData>({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "TEACHER",
    phone: "",
    school: "",
    grade: "",
    region: "",
    district: "",
  });

  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  // Telegram Widget orqali kirishni qo'llab-quvvatlash
  useEffect(() => {
    (window as unknown as { onTelegramAuth: (u: Record<string, string | number>) => void }).onTelegramAuth = async (u) => {
      try {
        setLoading(true);
        setError(null);
        await loginWithWidget(u);
        nav("/tests");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    if (!BOT || !ref.current) return;
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.dataset.telegramLogin = BOT;
    s.dataset.size = "large";
    s.dataset.onauth = "onTelegramAuth(user)";
    ref.current.innerHTML = "";
    ref.current.appendChild(s);
  }, [nav]);

  // Login yuborish
  const handleLogin = async (e?: React.FormEvent, customLogin?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const l = customLogin ?? loginInput.trim();
    const p = customPass ?? passwordInput;

    if (!l || !p) {
      setError("Login va parolni kiriting");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const user = await loginWithCredentials(l, p);
      if (user.role === "ADMIN") {
        nav("/admin");
      } else {
        nav("/tests");
      }
    } catch (err) {
      setError((err as Error).message || "Login yoki parol xato");
    } finally {
      setLoading(false);
    }
  };

  // Demo hisob bilan tezkor kirish
  const quickDemoLogin = (l: string, p: string) => {
    setLoginInput(l);
    setPasswordInput(p);
    handleLogin(undefined, l, p);
  };

  // Ro'yxatdan o'tish yuborish
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regData.username.trim() || !regData.password || !regData.firstName.trim() || !regData.lastName.trim()) {
      setError("Ism, familiya, login va parolni kiritish shart");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await registerWithCredentials({
        ...regData,
        username: regData.username.trim(),
        firstName: regData.firstName.trim(),
        lastName: regData.lastName.trim(),
        phone: regData.phone?.trim() || undefined,
        school: regData.school?.trim() || undefined,
        grade: regData.grade?.trim() || undefined,
        region: regData.region?.trim() || undefined,
        district: regData.district?.trim() || undefined,
      });
      nav("/tests");
    } catch (err) {
      setError((err as Error).message || "Ro'yxatdan o'tishda xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-[#05070c] text-[#f8fafc]">
      <div className="w-full max-w-lg">
        {/* Header / Brand */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-indigo-600 text-3xl shadow-lg shadow-purple-500/25">
            📚
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Ustozlar Jamoasi</h1>
          <p className="mt-1 text-sm text-slate-400">
            Attestatsiya va milliy sertifikatga tayyorlov platformasi
          </p>
        </div>

        {/* Tezkor demo hisoblar: faqat sinov muhitida (VITE_SHOW_DEMO=1). Admin paroli hech qachon sahifada ko'rsatilmaydi */}
        {SHOW_DEMO && (
        <div className="mb-6 rounded-2xl border border-slate-800 bg-[#0e0f17]/90 p-4 shadow-xl backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
            ⚡ Tezkor sinov hisoblari (1-bosishda kirish):
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => quickDemoLogin("ustoz", "ustoz123")}
              className="flex flex-col items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-center transition hover:border-blue-500/70 hover:bg-blue-500/20 active:scale-95"
            >
              <span className="text-base">👨‍🏫</span>
              <span className="text-xs font-bold text-blue-300">Ustoz</span>
              <span className="text-[10px] text-slate-400 font-mono">ustoz123</span>
            </button>

            <button
              type="button"
              onClick={() => quickDemoLogin("talaba", "talaba123")}
              className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-center transition hover:border-emerald-500/70 hover:bg-emerald-500/20 active:scale-95"
            >
              <span className="text-base">🎓</span>
              <span className="text-xs font-bold text-emerald-300">O'quvchi</span>
              <span className="text-[10px] text-slate-400 font-mono">talaba123</span>
            </button>
          </div>
        </div>

        )}

        {/* Asosiy Kartochka */}
        <div className="rounded-2xl border border-slate-800 bg-[#11131c] p-6 shadow-2xl">
          {/* Tab tugmalari */}
          <div className="mb-6 flex rounded-xl border border-slate-800 bg-[#0e0f17] p-1">
            <button
              type="button"
              onClick={() => { setTab("login"); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                tab === "login"
                  ? "bg-[#7c3aed] text-white shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Kirish
            </button>
            <button
              type="button"
              onClick={() => { setTab("register"); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                tab === "register"
                  ? "bg-[#7c3aed] text-white shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Ro'yxatdan o'tish
            </button>
          </div>

          {/* Xatolik xabari */}
          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs sm:text-sm text-rose-300 flex items-start gap-2">
              <span className="text-rose-400 font-bold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* 1. Kirish formasi */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Login yoki Telefon raqami
                </label>
                <input
                  type="text"
                  required
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Masalan: ustoz yoki +998901234567"
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Parol
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-slate-400 hover:text-purple-400"
                  >
                    {showPassword ? "Yashirish" : "Ko'rsatish"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Parolni kiriting"
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Kirilmoqda..." : "Tizimga kirish"}
              </button>
            </form>
          )}

          {/* 2. Ro'yxatdan o'tish formasi */}
          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Rol tanlash */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Siz kimsiz? (Rolingizni tanlang)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegData({ ...regData, role: "TEACHER" })}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                      regData.role === "TEACHER"
                        ? "border-blue-500 bg-blue-500/20 text-blue-300"
                        : "border-slate-800 bg-[#0e0f17] text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>👨‍🏫</span>
                    <span>Ustoz (O'qituvchi)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegData({ ...regData, role: "STUDENT" })}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                      regData.role === "STUDENT"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-800 bg-[#0e0f17] text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>🎓</span>
                    <span>O'quvchi / Talaba</span>
                  </button>
                </div>
              </div>

              {/* Ism & Familiya */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ism</label>
                  <input
                    type="text"
                    required
                    value={regData.firstName}
                    onChange={(e) => setRegData({ ...regData, firstName: e.target.value })}
                    placeholder="Ismingiz"
                    className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Familiya</label>
                  <input
                    type="text"
                    required
                    value={regData.lastName}
                    onChange={(e) => setRegData({ ...regData, lastName: e.target.value })}
                    placeholder="Familiyangiz"
                    className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Login & Parol */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Yangi Login</label>
                  <input
                    type="text"
                    required
                    value={regData.username}
                    onChange={(e) => setRegData({ ...regData, username: e.target.value })}
                    placeholder="masalan: zafer01"
                    className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Parol (min 6)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regData.password}
                    onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                    placeholder="Kamida 6 belgi"
                    className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Telefon & Maktab */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Telefon (ixtiyoriy)</label>
                  <input
                    type="tel"
                    value={regData.phone}
                    onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {regData.role === "TEACHER" ? "Maktab / Muassasa" : "Maktab / Universitet"}
                  </label>
                  <input
                    type="text"
                    value={regData.school}
                    onChange={(e) => setRegData({ ...regData, school: e.target.value })}
                    placeholder="Masalan: 14-maktab"
                    className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Ro'yxatdan o'tilmoqda..." : "Ro'yxatdan o'tish va kirish"}
              </button>
            </form>
          )}

          {/* Telegram orqali kirish opsiyasi */}
          <div className="mt-6 border-t border-slate-800/80 pt-5 text-center">
            <p className="text-xs text-slate-400 mb-3">Yoki Telegram orqali bog'lanish:</p>
            {BOT && (
              <a
                href={`https://t.me/${BOT}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-400 transition hover:border-sky-500/60 hover:bg-sky-500/20"
              >
                <span>✈️</span>
                <span>@{BOT} Telegram botini ochish</span>
              </a>
            )}
            <div ref={ref} className="mt-3 flex justify-center" />
          </div>
        </div>
      </div>
    </div>
  );
}
