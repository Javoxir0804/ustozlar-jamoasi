// Admin kirishi: login va parol.
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { Alert, Button, Card, Field, Input, PageLoader } from "../../components/ui";
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6">
          <h1 className="text-lg font-semibold">Admin panelga kirish</h1>
          <form onSubmit={submit} className="mt-5 space-y-4">
            {err && <Alert>{err}</Alert>}
            <Field label="Login">
              <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus />
            </Field>
            <Field label="Parol">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
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
