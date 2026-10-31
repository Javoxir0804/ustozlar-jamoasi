// Admin profili: ism, familiya va login; parolni o'zgartirish.
import { useState, type FormEvent } from "react";
import { PageHeader } from "../../components/layouts";
import { Alert, Button, Card, Field, Input, PasswordInput, useToast } from "../../components/ui";
import { api, ApiError, type User } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function Profile() {
  return (
    <>
      <PageHeader title="Profil" subtitle="Ismingiz, kirish logini va parolingiz" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AccountForm />
        <PasswordForm />
      </div>
    </>
  );
}

function AccountForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [login, setLogin] = useState(user?.login ?? "");
  const [current, setCurrent] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loginChanged = login.trim().toLowerCase() !== (user?.login ?? "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const u = await api<User>("/auth/me/account", { method: "PATCH", body: { firstName, lastName, login, current: loginChanged ? current : undefined } });
      setUser(u);
      setLogin(u.login ?? "");
      setCurrent("");
      toast(loginChanged ? "Saqlandi. Keyingi safar yangi login bilan kirasiz" : "Saqlandi");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-display font-semibold">Shaxsiy ma'lumotlar</h2>
      <p className="mt-0.5 text-sm text-muted">Panelda va yozuvlarda shu ism ko'rinadi</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        {err && <Alert>{err}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ism">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} autoComplete="given-name" />
          </Field>
          <Field label="Familiya">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Login" hint="Lotin harflari, raqam va _ . - belgilari, 3–32 ta">
          <Input value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" autoComplete="username" maxLength={32} />
        </Field>
        {loginChanged && (
          <Field label="Joriy parol" hint="Loginni o'zgartirish uchun tasdiqlang">
            <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
        )}
        <Button type="submit" loading={busy}>
          Saqlash
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setErr("Yangi parol kamida 8 belgi");
    if (next !== repeat) return setErr("Yangi parollar bir xil emas");
    setBusy(true);
    setErr(null);
    try {
      await api("/auth/me/password", { body: { current, next } });
      setCurrent("");
      setNext("");
      setRepeat("");
      toast("Parol o'zgartirildi");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-display font-semibold">Parolni o'zgartirish</h2>
      <p className="mt-0.5 text-sm text-muted">Kamida 8 belgi</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        {err && <Alert>{err}</Alert>}
        <Field label="Joriy parol">
          <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="Yangi parol">
          <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Yangi parolni takrorlang">
          <PasswordInput value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button type="submit" loading={busy}>
          Parolni saqlash
        </Button>
      </form>
    </Card>
  );
}
