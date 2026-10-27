// Talaba anketasi: birinchi kirishda (onboarding) va kabinetda tahrirlashda ishlatiladi.
import { useState, type FormEvent } from "react";
import { api, ApiError, type User } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useConfig } from "../lib/config";
import { Alert, Button, Field, Input, Select } from "./ui";

type Form = { firstName: string; lastName: string; phone: string; region: string; district: string; address: string; institution: string; grade: string };
const KEYS: (keyof Form)[] = ["firstName", "lastName", "phone", "region", "district", "address", "institution", "grade"];

function check(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.firstName.trim().length < 2) e.firstName = "Ismni kiriting";
  if (f.lastName.trim().length < 2) e.lastName = "Familiyani kiriting";
  const d = f.phone.replace(/\D/g, "");
  if (d.length !== 9 && !(d.length >= 11 && d.length <= 15)) e.phone = "Masalan: +998 90 123 45 67";
  if (!f.region) e.region = "Viloyatni tanlang";
  if (f.district.trim().length < 2) e.district = "Tumanni kiriting";
  if (f.address.trim().length < 3) e.address = "Manzilni kiriting";
  if (f.institution.trim().length < 2) e.institution = "Ta'lim muassasasini kiriting";
  if (!f.grade.trim()) e.grade = "Sinf yoki kursni kiriting";
  return e;
}

export function ProfileForm({ submitLabel, onSaved, onCancel }: { submitLabel: string; onSaved?: (u: User) => void; onCancel?: () => void }) {
  const { user, setUser } = useAuth();
  const config = useConfig();
  const [form, setForm] = useState<Form>(() => Object.fromEntries(KEYS.map((k) => [k, (user?.[k] as string | null) ?? ""])) as Form);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = check(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setServerError(null);
    try {
      const u = await api<User>("/auth/me/profile", { method: "PUT", body: form });
      setUser(u);
      onSaved?.(u);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {serverError && <Alert>{serverError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Familiya" error={errors.lastName}>
          <Input value={form.lastName} onChange={set("lastName")} invalid={!!errors.lastName} autoComplete="family-name" />
        </Field>
        <Field label="Ism" error={errors.firstName}>
          <Input value={form.firstName} onChange={set("firstName")} invalid={!!errors.firstName} autoComplete="given-name" />
        </Field>
        <Field label="Telefon raqami" error={errors.phone}>
          <Input value={form.phone} onChange={set("phone")} invalid={!!errors.phone} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" autoComplete="tel" />
        </Field>
        <Field label="Viloyat" error={errors.region}>
          <Select value={form.region} onChange={set("region")} invalid={!!errors.region}>
            <option value="">Tanlang</option>
            {(config?.regions ?? []).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tuman yoki shahar" error={errors.district}>
          <Input value={form.district} onChange={set("district")} invalid={!!errors.district} />
        </Field>
        <Field label="Manzil" error={errors.address}>
          <Input value={form.address} onChange={set("address")} invalid={!!errors.address} placeholder="Mahalla, ko'cha, uy" autoComplete="street-address" />
        </Field>
        <Field label="Ta'lim muassasasi" error={errors.institution}>
          <Input value={form.institution} onChange={set("institution")} invalid={!!errors.institution} placeholder="Masalan: 12-maktab" />
        </Field>
        <Field label="Sinf yoki kurs" error={errors.grade}>
          <Input value={form.grade} onChange={set("grade")} invalid={!!errors.grade} placeholder="Masalan: 11-sinf" />
        </Field>
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Bekor qilish
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
