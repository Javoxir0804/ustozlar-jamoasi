import { useEffect, useState } from "react";
import { api, getMe, User } from "../api";
import { Centered } from "./Attempt";

type Subject = {
  id: string;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
};

type AdminTest = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number;
  questionCount: number;
  isActive: boolean;
  requiresSubscription: boolean;
  subjectId: string;
  _count?: { questions: number; attempts: number };
};

type AdminUser = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  phone: string | null;
  school: string | null;
  status: "ACTIVE" | "BLOCKED";
  createdAt: string;
};

type Payment = {
  id: string;
  amountUzs: number;
  status: "PENDING" | "PAID" | "CANCELLED" | "FAILED";
  method: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  plan?: {
    name: string;
    days: number;
  };
};

export function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"users" | "subjects" | "tests" | "payments">("users");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Users tab
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");

  // Subjects tab
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState({ name: "", slug: "", order: 0 });

  // Tests tab
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [newTest, setNewTest] = useState({
    subjectId: "",
    title: "",
    durationMin: 60,
    questionCount: 20,
    isActive: true,
  });

  // Payments tab
  const [payments, setPayments] = useState<Payment[]>([]);

  // Check admin permissions
  useEffect(() => {
    getMe().then((u) => {
      setCurrentUser(u);
      setLoading(false);
      if (u?.role === "ADMIN") {
        loadUsers();
        loadSubjects();
        loadTests();
        loadPayments();
      }
    });
  }, []);

  const loadUsers = async () => {
    try {
      const q = userSearch ? `&q=${encodeURIComponent(userSearch)}` : "";
      const r = userRoleFilter ? `&role=${userRoleFilter}` : "";
      const res = await api<{ items: AdminUser[]; total: number }>(`/admin/users?page=1${q}${r}`);
      setUsers(res.items);
    } catch (e) {
      setMsg({ type: "err", text: "Foydalanuvchilarni yuklashda xatolik: " + (e as Error).message });
    }
  };

  const loadSubjects = async () => {
    try {
      const res = await api<Subject[]>("/admin/subjects");
      setSubjects(res);
      if (res.length > 0 && !newTest.subjectId) {
        setNewTest((prev) => ({ ...prev, subjectId: res[0].id }));
      }
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  const loadTests = async () => {
    try {
      const res = await api<AdminTest[]>("/admin/tests");
      setTests(res);
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  const loadPayments = async () => {
    try {
      const res = await api<Payment[]>("/admin/payments");
      setPayments(res);
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  // User Actions
  const handleRoleChange = async (userId: string, newRole: "ADMIN" | "TEACHER" | "STUDENT") => {
    try {
      await api(`/admin/users/${userId}`, { method: "PATCH", body: { role: newRole } });
      setMsg({ type: "ok", text: "Foydalanuvchi roli o'zgartirildi!" });
      loadUsers();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: "ACTIVE" | "BLOCKED") => {
    const next = currentStatus === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    try {
      await api(`/admin/users/${userId}`, { method: "PATCH", body: { status: next } });
      setMsg({ type: "ok", text: `Foydalanuvchi statusi: ${next}` });
      loadUsers();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  const handleGrantSub = async (userId: string) => {
    const daysStr = window.prompt("Necha kunlik obuna berilsin?", "30");
    if (!daysStr) return;
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days <= 0) return;

    try {
      await api(`/admin/users/${userId}/subscription`, { method: "POST", body: { days } });
      setMsg({ type: "ok", text: `${days} kunlik obuna muvaffaqiyatli berildi!` });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  // Subject Actions
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.name || !newSubject.slug) return;
    try {
      await api("/admin/subjects", { method: "POST", body: newSubject });
      setNewSubject({ name: "", slug: "", order: 0 });
      setMsg({ type: "ok", text: "Fan muvaffaqiyatli qo'shildi!" });
      loadSubjects();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  // Test Actions
  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTest.title || !newTest.subjectId) return;
    try {
      await api("/admin/tests", { method: "POST", body: newTest });
      setNewTest({ ...newTest, title: "" });
      setMsg({ type: "ok", text: "Test muvaffaqiyatli yaratildi!" });
      loadTests();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  const handleToggleTest = async (t: AdminTest) => {
    try {
      await api(`/admin/tests/${t.id}`, { method: "PATCH", body: { isActive: !t.isActive } });
      setMsg({ type: "ok", text: `Test holati: ${!t.isActive ? "Faol" : "Nofaol"}` });
      loadTests();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  // Payment Actions
  const handleReviewPayment = async (id: string, approve: boolean) => {
    try {
      await api(`/admin/payments/${id}/review`, { method: "POST", body: { approve } });
      setMsg({ type: "ok", text: approve ? "To'lov tasdiqlandi!" : "To'lov bekor qilindi." });
      loadPayments();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
  };

  if (loading) return <Centered>Admin panel yuklanmoqda…</Centered>;
  if (currentUser?.role !== "ADMIN") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-rose-500">Ruxsat berilmagan</h1>
        <p className="mt-2 text-slate-400">Ushbu sahifaga faqat ADMIN huquqiga ega foydalanuvchilar kira oladi.</p>
        <a href="/tests" className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white">
          Testlarga qaytish
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span>👑</span>
            <span>Admin Boshqaruv Paneli</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Foydalanuvchilar rollari, testlar, fanlar va to'lovlarni boshqarish
          </p>
        </div>

        {/* Tablar */}
        <div className="flex rounded-xl border border-slate-800 bg-[#0e0f17] p-1 flex-wrap">
          {(
            [
              { id: "users", label: "👥 Foydalanuvchilar" },
              { id: "subjects", label: "📚 Fanlar" },
              { id: "tests", label: "📝 Testlar" },
              { id: "payments", label: "💳 To'lovlar" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setMsg(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.id
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Xabar bildirishnomasi */}
      {msg && (
        <div
          className={`rounded-xl border p-3 text-xs flex items-center justify-between ${
            msg.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* 1. FOYDALANUVCHILAR TABI */}
      {tab === "users" && (
        <div className="space-y-4">
          {/* Qidiruv va filtrlar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadUsers()}
              placeholder="Ism, familiya, login yoki telefon qidirish..."
              className="flex-1 rounded-xl border border-slate-700 bg-[#0e0f17] px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
            />
            <select
              value={userRoleFilter}
              onChange={(e) => {
                setUserRoleFilter(e.target.value);
              }}
              className="rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
            >
              <option value="">Barcha rollar</option>
              <option value="ADMIN">Faqat Adminlar</option>
              <option value="TEACHER">Faqat Ustozlar</option>
              <option value="STUDENT">Faqat O'quvchilar</option>
            </select>
            <button
              onClick={() => loadUsers()}
              className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-purple-500"
            >
              Qidirish 🔍
            </button>
          </div>

          {/* Foydalanuvchilar jadvali */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#11131c]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-[#0e0f17] text-slate-400">
                <tr>
                  <th className="p-3">Foydalanuvchi</th>
                  <th className="p-3">Login</th>
                  <th className="p-3">Telefon</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400">
                      Foydalanuvchilar topilmadi
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/20">
                      <td className="p-3 font-medium text-white">
                        {u.firstName} {u.lastName}
                        {u.school && <span className="block text-[10px] text-slate-400">{u.school}</span>}
                      </td>
                      <td className="p-3 font-mono text-purple-300">{u.username || "—"}</td>
                      <td className="p-3 text-slate-300">{u.phone || "—"}</td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value as "ADMIN" | "TEACHER" | "STUDENT")
                          }
                          className={`rounded-lg border px-2 py-1 text-[11px] font-semibold bg-[#0e0f17] ${
                            u.role === "ADMIN"
                              ? "border-purple-500/40 text-purple-400"
                              : u.role === "TEACHER"
                              ? "border-blue-500/40 text-blue-400"
                              : "border-emerald-500/40 text-emerald-400"
                          }`}
                        >
                          <option value="ADMIN">👑 Admin</option>
                          <option value="TEACHER">👨‍🏫 Ustoz</option>
                          <option value="STUDENT">🎓 O'quvchi</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            u.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {u.status === "ACTIVE" ? "Faol" : "Bloklangan"}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => handleGrantSub(u.id)}
                          title="Obuna berish"
                          className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[11px] font-medium text-purple-300 hover:bg-purple-500/20"
                        >
                          💳 Obuna
                        </button>
                        <button
                          onClick={() => handleStatusToggle(u.id, u.status)}
                          title={u.status === "ACTIVE" ? "Bloklash" : "Faollashtirish"}
                          className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${
                            u.status === "ACTIVE"
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                          }`}
                        >
                          {u.status === "ACTIVE" ? "Bloklash" : "Ochish"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. FANLAR TABI */}
      {tab === "subjects" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Yangi fan qo'shish */}
          <div className="rounded-2xl border border-slate-800 bg-[#11131c] p-5 h-fit">
            <h2 className="text-sm font-bold text-white mb-3">➕ Yangi fan qo'shish</h2>
            <form onSubmit={handleAddSubject} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Fan nomi</label>
                <input
                  type="text"
                  required
                  value={newSubject.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
                    setNewSubject({ ...newSubject, name, slug });
                  }}
                  placeholder="Masalan: Matematika"
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Slug (URL uchun)</label>
                <input
                  type="text"
                  required
                  value={newSubject.slug}
                  onChange={(e) => setNewSubject({ ...newSubject, slug: e.target.value })}
                  placeholder="matematika"
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Tartib raqami</label>
                <input
                  type="number"
                  value={newSubject.order}
                  onChange={(e) => setNewSubject({ ...newSubject, order: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white transition hover:bg-purple-500"
              >
                Fan qo'shish
              </button>
            </form>
          </div>

          {/* Mavjud fanlar ro'yxati */}
          <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-[#11131c] p-5">
            <h2 className="text-sm font-bold text-white mb-3">Mavjud fanlar ({subjects.length} ta)</h2>
            <div className="space-y-2">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0e0f17] p-3 text-xs"
                >
                  <div>
                    <span className="font-semibold text-white">{s.name}</span>
                    <span className="ml-2 font-mono text-[10px] text-slate-500">/{s.slug}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        s.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {s.isActive ? "Faol" : "Nofaol"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. TESTLAR TABI */}
      {tab === "tests" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Yangi test yaratish */}
          <div className="rounded-2xl border border-slate-800 bg-[#11131c] p-5 h-fit">
            <h2 className="text-sm font-bold text-white mb-3">➕ Yangi test yaratish</h2>
            <form onSubmit={handleAddTest} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Fanni tanlang</label>
                <select
                  value={newTest.subjectId}
                  onChange={(e) => setNewTest({ ...newTest, subjectId: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Test sarlavhasi</label>
                <input
                  type="text"
                  required
                  value={newTest.title}
                  onChange={(e) => setNewTest({ ...newTest, title: e.target.value })}
                  placeholder="Masalan: Milliy sertifikat sinovi #1"
                  className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Davomiyligi (daq)</label>
                  <input
                    type="number"
                    value={newTest.durationMin}
                    onChange={(e) => setNewTest({ ...newTest, durationMin: parseInt(e.target.value, 10) || 60 })}
                    className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Savollar soni</label>
                  <input
                    type="number"
                    value={newTest.questionCount}
                    onChange={(e) => setNewTest({ ...newTest, questionCount: parseInt(e.target.value, 10) || 20 })}
                    className="w-full rounded-xl border border-slate-700 bg-[#0e0f17] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white transition hover:bg-purple-500"
              >
                Test yaratish
              </button>
            </form>
          </div>

          {/* Testlar ro'yxati */}
          <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-[#11131c] p-5">
            <h2 className="text-sm font-bold text-white mb-3">Barcha testlar ({tests.length} ta)</h2>
            <div className="space-y-3">
              {tests.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0e0f17] p-4 text-xs"
                >
                  <div>
                    <h3 className="font-semibold text-white text-sm">{t.title}</h3>
                    <p className="text-slate-400 mt-0.5">
                      {t.questionCount} ta savol · {t.durationMin} daqiqa
                      {t._count && ` · ${t._count.attempts} marta topshirilgan`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleTest(t)}
                      className={`rounded-lg border px-3 py-1.5 font-semibold transition ${
                        t.isActive
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {t.isActive ? "✅ Faol" : "⏸️ Nofaol"}
                    </button>

                    <a
                      href={`/api/admin/tests/${t.id}/results.csv`}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      CSV 📥
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. TO'LOVLAR TABI */}
      {tab === "payments" && (
        <div className="rounded-2xl border border-slate-800 bg-[#11131c] p-5">
          <h2 className="text-sm font-bold text-white mb-4">To'lovlar va Cheklar ({payments.length} ta)</h2>
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">To'lovlar mavjud emas</p>
            ) : (
              payments.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0e0f17] p-3.5 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {p.user.firstName} {p.user.lastName}
                      </span>
                      {p.user.phone && <span className="text-slate-400 font-mono">({p.user.phone})</span>}
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Miqdor: <strong className="text-purple-300">{p.amountUzs.toLocaleString()} so'm</strong>
                      {p.plan && ` · ${p.plan.name} (${p.plan.days} kun)`}
                      {` · ${new Date(p.createdAt).toLocaleString()}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        p.status === "PAID"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : p.status === "PENDING"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {p.status}
                    </span>

                    {p.status === "PENDING" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleReviewPayment(p.id, true)}
                          className="rounded-lg bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-500"
                        >
                          Tasdiqlash
                        </button>
                        <button
                          onClick={() => handleReviewPayment(p.id, false)}
                          className="rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-500"
                        >
                          Rad etish
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
