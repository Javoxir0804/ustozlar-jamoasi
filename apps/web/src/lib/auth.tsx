// Kirgan foydalanuvchi holati. Bot ichida ochilsa Telegram orqali avtomatik kiradi.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, token, type User } from "./api";
import { webApp } from "./telegram";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  setSession: (t: string, u: User) => void;
  setUser: (u: User) => void;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const tg = webApp();
      if (tg) {
        tg.ready();
        tg.expand();
        try {
          const r = await api<{ token: string; user: User }>("/auth/telegram/webapp", { body: { initData: tg.initData } });
          token.set(r.token);
          setUser(r.user);
          return;
        } catch (e) {
          setError(e instanceof ApiError ? e.message : "Telegram orqali kirib bo'lmadi");
        }
      }
      if (!token.get()) return;
      try {
        setUser(await api<User>("/auth/me"));
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          token.clear();
          if (e.code === "BLOCKED") setError(e.message);
        }
      }
    })().finally(() => setLoading(false));
  }, []);

  const setSession = useCallback((t: string, u: User) => {
    token.set(t);
    setError(null);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    token.clear();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, error, setSession, setUser, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AuthProvider yo'q");
  return ctx;
}
