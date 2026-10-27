import { useState, type FormEvent } from "react";
import { PageHeader } from "../../components/layouts";
import { Alert, Button, Card, Field, Input, useToast } from "../../components/ui";
import { api, ApiError } from "../../lib/api";

export default function Password() {
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
    <>
      <PageHeader title="Parolni o'zgartirish" />
      <Card className="max-w-md p-6">
        <form onSubmit={submit} className="space-y-4">
          {err && <Alert>{err}</Alert>}
          <Field label="Joriy parol">
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="Yangi parol" hint="Kamida 8 belgi">
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Yangi parolni takrorlang">
            <Input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button type="submit" loading={busy}>
            Saqlash
          </Button>
        </form>
      </Card>
    </>
  );
}
