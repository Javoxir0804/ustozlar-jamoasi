import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CourseGrid } from "../../components/CourseGrid";
import type { CourseCard } from "../courses/types";
import { PageHeader } from "../../components/layouts";
import { ProfileForm } from "../../components/ProfileForm";
import { IconEdit } from "../../components/icons";
import { Badge, Button, Card, EmptyState, useToast } from "../../components/ui";
import { api, fmtDate, fullName } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function Cabinet() {
  const { user } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  useEffect(() => {
    api<CourseCard[]>("/courses?mine=1").then(setCourses, () => setCourses([]));
  }, []);
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
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kurslarim</h2>
          <Link to="/courses" className="text-sm font-medium text-brand-700 hover:underline">
            Barcha kurslar
          </Link>
        </div>
        {courses && courses.length > 0 ? (
          <CourseGrid courses={courses} />
        ) : (
          <Card>
            <EmptyState
              title="Hali ochilgan kurs yo'q"
              text="Pullik kursga yozilganingizdan keyin admin uni sizga ochadi va kurs shu yerda chiqadi."
              action={
                <Link to="/courses">
                  <Button variant="secondary">Kurslarni ko'rish</Button>
                </Link>
              }
            />
          </Card>
        )}
      </section>
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
            <EmptyState title="Natijalar yo'q" text="Test topshirganingizdan keyin natijalar va sertifikatlar shu yerda chiqadi." />
          </Card>
        </div>
      </div>
    </>
  );
}
