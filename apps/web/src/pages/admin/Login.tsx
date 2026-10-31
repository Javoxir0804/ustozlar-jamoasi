// Admin kirishi: login va parol.
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Atom, FloatingFormulas } from "../../components/Physics";
import { Logo } from "../../components/Logo";
import { Alert, Button, Card, Field, Input, PasswordInput, PageLoader } from "../../components/ui";
import { api, ApiError, type User } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function AdminLogin() {
  const { user, loading, setSession } = useAuth();
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageLoader />;
  if (user?.role === "ADMIN") return <Navigate to="/admin" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!login.trim() || !password) return setErr("Login va parolni kiriting");
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ token: string; user: User }>("/auth/admin/login", { body: { login, password } });
      setSession(r.token, r.user);
      navigate("/admin", { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Kirib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-cosmos relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="bg-grid-dark mask-fade absolute inset-0" />
      <FloatingFormulas />
      <Atom className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 opacity-40" />
      <div className="relative w-full max-w-sm animate-rise">
        <div className="mb-6 flex justify-center">
          <Logo dark />
        </div>
        <Card className="p-7 shadow-2xl">
          <h1 className="font-display text-lg font-semibold">Admin panelga kirish</h1>
          <form onSubmit={submit} className="mt-5 space-y-4">
            {err && <Alert>{err}</Alert>}
            <Field label="Login">
              <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus />
            </Field>
            <Field label="Parol">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <Button type="submit" className="w-full" loading={busy}>
              Kirish
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
