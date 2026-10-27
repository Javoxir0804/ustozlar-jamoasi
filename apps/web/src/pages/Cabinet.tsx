import { useEffect, useState } from "react";
import { api, getMe, User } from "../api";
import { Centered } from "./Attempt";

type AttemptItem = {
  id: string;
  scorePct: number;
  correctCount: number;
  totalCount: number;
  finishedAt: string | null;
  test: {
    title: string;
    subject: { name: string };
  };
  certificate: {
    number: string;
  } | null;
};

export function CabinetPage() {
  const [user, setUser] = useState<User | null>(null);
  const [attempts, setAttempts] = useState<AttemptItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    school: "",
    region: "",
    district: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getMe(),
      api<AttemptItem[]>("/me/attempts").catch(() => []),
    ]).then(([u, atts]) => {
      setUser(u);
      if (u) {
        setEditForm({
          firstName: u.firstName || "",
          lastName: u.lastName || "",
          school: u.school || "",
          region: u.region || "",
          district: u.district || "",
        });
      }
      setAttempts(atts);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMsg(null);
      await api("/auth/me", { method: "PATCH", body: editForm });
      const updated = await getMe();
      setUser(updated);
      setEditMode(false);
      setMsg("Ma'lumotlar muvaffaqiyatli saqlandi!");
    } catch (err) {
      setMsg("Xatolik: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Centered>Kabinet yuklanmoqda…</Centered>;
  if (!user) return <Centered>Foydalanuvchi topilmadi</Centered>;

  const roleText = {
    ADMIN: "👑 Bosh Administrator",
    TEACHER: "👨‍🏫 Ustoz (O'qituvchi)",
    STUDENT: "🎓 O'quvchi / Talaba",
  }[user.role];

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      {/* Profil bosh kartasi */}
      <div className="rounded-2xl border border-slate-800 bg-[#11131c] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-purple-500/20">
              {user.firstName[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  {user.firstName} {user.lastName}
                </h1>
                <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-0.5 text-xs font-semibold text-purple-300">
                  {roleText}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Login: <span className="font-mono text-purple-300 font-semibold">{user.username || "—"}</span>
                {user.phone && ` · Tel: ${user.phone}`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setEditMode(!editMode)}
            className="self-start sm:self-auto rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
          >
            {editMode ? "Bekor qilish" : "✏️ Tahrirlash"}
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {msg}
          </div>
        )}

        {/* Tahrirlash formasi */}
        {editMode ? (
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ism</label>
                <input
                  type="text"
                  required
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3.5 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Familiya</label>
                <input
                  type="text"
                  required
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3.5 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Maktab / Muassasa</label>
                <input
                  type="text"
                  value={editForm.school}
                  onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                  placeholder="Masalan: 4-maktab"
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3.5 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Viloyat</label>
                <input
                  type="text"
                  value={editForm.region}
                  onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                  placeholder="Masalan: Samarqand viloyati"
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3.5 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-purple-500 disabled:opacity-50"
              >
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-[#0e0f17] p-3">
              <span className="text-slate-400 block mb-0.5">Muassasa / Maktab</span>
              <span className="font-semibold text-white">{user.school || "Kiritilmagan"}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0e0f17] p-3">
              <span className="text-slate-400 block mb-0.5">Hudud / Viloyat</span>
              <span className="font-semibold text-white">{user.region || "Kiritilmagan"}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0e0f17] p-3">
              <span className="text-slate-400 block mb-0.5">Topshirilgan testlar</span>
              <span className="font-semibold text-purple-400">{attempts?.length ?? 0} ta</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0e0f17] p-3">
              <span className="text-slate-400 block mb-0.5">Obuna holati</span>
              <span className={`font-semibold ${user.subscriptionEndsAt ? "text-emerald-400" : "text-amber-400"}`}>
                {user.subscriptionEndsAt
                  ? `Faol (${new Date(user.subscriptionEndsAt).toLocaleDateString()})`
                  : "Cheklangan"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Natijalar tarixi */}
      <div className="rounded-2xl border border-slate-800 bg-[#11131c] p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>📊</span>
          <span>Mening test natijalarim</span>
        </h2>

        {attempts?.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">Hozircha hech qanday test topshirmagansiz.</p>
            <a
              href="/tests"
              className="mt-3 inline-block rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-purple-500"
            >
              Testlarni ko'rish 🚀
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {attempts?.map((a) => (
              <div
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0e0f17] p-4 transition hover:border-slate-700"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                      {a.test.subject.name}
                    </span>
                    <h3 className="font-semibold text-white text-sm">{a.test.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    To'g'ri: <strong className="text-emerald-400">{a.correctCount}</strong> / {a.totalCount} ta
                    {a.finishedAt && ` · ${new Date(a.finishedAt).toLocaleString()}`}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-extrabold text-purple-400">{a.scorePct}%</span>
                    <span className="text-[10px] text-slate-400">
                      {a.scorePct >= 70 ? "✅ Muvaffaqiyatli" : "❌ Qoniqarsiz"}
                    </span>
                  </div>

                  {a.certificate && (
                    <a
                      href={`/api/me/certificates/${a.certificate.number}.pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                    >
                      📜 Sertifikat (PDF)
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
