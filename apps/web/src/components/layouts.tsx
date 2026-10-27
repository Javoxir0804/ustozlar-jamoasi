// Sahifa qoliplari: ochiq sahifalar, talaba bo'limi, admin panel; va kirish tekshiruvlari.
import { useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { fullName } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useConfig } from "../lib/config";
import { insideTelegram } from "../lib/telegram";
import { IconHome, IconKey, IconLogout, IconMenu, IconSettings, IconShield, IconUser, IconUsers } from "./icons";
import { Logo } from "./Logo";
import { Alert, Button, cx, PageLoader } from "./ui";

// ---------- Kirish tekshiruvlari ----------

/** Talaba bo'limi: kirmagan bo'lsa /login, anketa to'ldirilmagan bo'lsa /onboarding. */
export function RequireStudent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role === "STUDENT" && !user.profileCompleted) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user || user.role !== "ADMIN") return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}

// ---------- Ochiq sahifalar ----------

export function PublicLayout() {
  const { user } = useAuth();
  const config = useConfig();
  const c = config?.contacts;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="/#contacts" className="hidden rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 sm:block">
              Bog'lanish
            </a>
            {user ? (
              <Link to={user.role === "ADMIN" ? "/admin" : "/cabinet"}>
                <Button size="sm">{user.role === "ADMIN" ? "Admin panel" : "Kabinetim"}</Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button size="sm">Kirish</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer id="contacts" className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-muted">{config?.site?.tagline || "Video darslar, testlar va sertifikatlar bitta platformada."}</p>
          </div>
          <ContactList contacts={c} />
        </div>
        <div className="border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()} {config?.site?.title || "Ustozlar jamoasi"}</div>
      </footer>
    </div>
  );
}

export function ContactList({ contacts }: { contacts?: { phone?: string; telegram?: string; address?: string; email?: string; mapUrl?: string } | null }) {
  const c = contacts ?? {};
  const tg = c.telegram?.replace(/^https?:\/\/t\.me\//, "@");
  const rows = [
    c.phone && { label: "Telefon", value: c.phone, href: `tel:${c.phone.replace(/[^\d+]/g, "")}` },
    tg && { label: "Telegram", value: tg, href: `https://t.me/${tg.replace(/^@/, "")}` },
    c.email && { label: "Email", value: c.email, href: `mailto:${c.email}` },
    c.address && { label: "Manzil", value: c.address, href: c.mapUrl || undefined },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">Bog'lanish</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Aloqa ma'lumotlari tez orada qo'shiladi.</p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-3">
              <dt className="w-20 shrink-0 text-muted">{r.label}</dt>
              <dd className="text-ink">
                {r.href ? (
                  <a href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="hover:text-brand-700 hover:underline">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ---------- Talaba bo'limi ----------

// Keyingi bosqichlarda bu ro'yxatga Kurslar, Testlar, Natijalar qo'shiladi
const STUDENT_NAV = [{ to: "/cabinet", label: "Kabinet", icon: IconUser }];

export function StudentLayout() {
  const { user, logout } = useAuth();
  const tg = insideTelegram();
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Logo to="/cabinet" />
          <nav className="hidden items-center gap-1 sm:flex">
            {STUDENT_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx("rounded-lg px-3 py-2 text-sm font-medium", isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100")}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-600 md:block">{user && fullName(user)}</span>
            {!tg && (
              <Button variant="ghost" size="sm" onClick={logout} aria-label="Chiqish">
                <IconLogout className="h-4 w-4" />
                <span className="hidden sm:inline">Chiqish</span>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
      {STUDENT_NAV.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden" style={{ gridTemplateColumns: `repeat(${STUDENT_NAV.length}, 1fr)` }}>
          {STUDENT_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-brand-700" : "text-slate-500")}>
              <n.icon className="h-5 w-5" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

// ---------- Admin panel ----------

const ADMIN_NAV = [
  { to: "/admin", label: "Bosh panel", icon: IconHome, end: true },
  { to: "/admin/students", label: "Talabalar", icon: IconUsers },
  { to: "/admin/admins", label: "Adminlar", icon: IconShield },
  { to: "/admin/settings", label: "Sozlamalar", icon: IconSettings },
  { to: "/admin/password", label: "Parolni o'zgartirish", icon: IconKey },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {ADMIN_NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) => cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition", isActive ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white")}
        >
          <n.icon className="h-5 w-5" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="flex h-16 items-center gap-2 px-5 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold">A</span>
        <span className="font-semibold">Admin panel</span>
      </div>
      <div className="flex-1 overflow-y-auto">{nav}</div>
      <div className="border-t border-white/10 p-3">
        <div className="px-3 pb-2 text-xs text-slate-400">
          {user && fullName(user)} · <span className="text-slate-300">{user?.login}</span>
        </div>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
          <IconLogout className="h-5 w-5" /> Chiqish
        </button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50" />
          <aside className="absolute inset-y-0 left-0 w-64" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Menyu">
          <IconMenu className="h-6 w-6" />
        </button>
        <span className="font-semibold">Admin panel</span>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function BlockedNotice() {
  const { error } = useAuth();
  return error ? (
    <div className="mx-auto max-w-md px-4 pt-6">
      <Alert>{error}</Alert>
    </div>
  ) : null;
}
