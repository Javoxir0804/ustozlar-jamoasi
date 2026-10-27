import { useState } from "react";
import { PageHeader } from "../../components/layouts";
import { ProfileForm } from "../../components/ProfileForm";
import { IconEdit } from "../../components/icons";
import { Badge, Button, Card, EmptyState, useToast } from "../../components/ui";
import { fmtDate, fullName } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function Cabinet() {
  const { user } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  if (!user) return null;
  const rows: [string, string | null][] = [
    ["Telefon", user.phone],
    ["Viloyat", user.region],
    ["Tuman", user.district],
    ["Manzil", user.address],
    ["Ta'lim muassasasi", user.institution],
    ["Sinf yoki kurs", user.grade],
    ["Telegram", user.telegramUsername ? `@${user.telegramUsername}` : user.telegramId],
    ["Ro'yxatdan o'tgan", fmtDate(user.createdAt)],
  ];
  return (
    <>
      <PageHeader title={`Salom, ${user.firstName || "talaba"}!`} subtitle="Shaxsiy kabinet" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{fullName(user)}</h2>
              <Badge tone="green">Faol</Badge>
            </div>
            {!editing && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <IconEdit className="h-4 w-4" /> Tahrirlash
              </Button>
            )}
          </div>
          {editing ? (
            <ProfileForm
              submitLabel="Saqlash"
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                toast("Ma'lumotlar saqlandi");
              }}
            />
          ) : (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="text-sm text-ink">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <EmptyState title="Kurslar tez orada" text="Admin sizga kursga ruxsat berganda u shu yerda ko'rinadi." />
          </Card>
          <Card>
            <EmptyState title="Natijalar yo'q" text="Test topshirganingizdan keyin natijalar va sertifikatlar shu yerda chiqadi." />
          </Card>
        </div>
      </div>
    </>
  );
}
