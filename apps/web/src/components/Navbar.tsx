import { Link, useLocation } from "react-router-dom";
import { getCurrentUser, logout, User } from "../api";

export function Navbar({ user }: { user?: User | null }) {
  const loc = useLocation();
  const u = user ?? getCurrentUser();

  const roleLabel = {
    ADMIN: "👑 Admin",
    TEACHER: "👨‍🏫 Ustoz",
    STUDENT: "🎓 O'quvchi",
  }[u?.role ?? "STUDENT"];

  const roleBadgeColor = {
    ADMIN: "border-purple-500/40 bg-purple-500/10 text-purple-400",
    TEACHER: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    STUDENT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  }[u?.role ?? "STUDENT"];

  const navLinks = [
    { to: "/tests", label: "📝 Testlar" },
    { to: "/cabinet", label: "👤 Shaxsiy kabinet" },
  ];

  if (u?.role === "ADMIN") {
    navLinks.push({ to: "/admin", label: "👑 Admin Panel" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-panel/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Brand / Logo */}
        <Link to="/tests" className="flex items-center gap-2.5 font-bold tracking-tight text-white transition hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-lg shadow-md shadow-primary/20">
            📚
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold leading-none text-ink">Ustozlar Jamoasi</span>
            <span className="text-[11px] font-medium text-muted">Attestatsiya platformasi</span>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navLinks.map((link) => {
            const isActive = loc.pathname === link.to || (link.to !== "/tests" && loc.pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                    : "text-muted hover:bg-card hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User badge and Logout */}
        <div className="flex items-center gap-3">
          {u && (
            <div className="hidden sm:flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleBadgeColor}`}>
                {roleLabel}
              </span>
              <span className="text-sm font-medium text-ink max-w-[120px] truncate">
                {u.firstName} {u.lastName ? `${u.lastName[0]}.` : ""}
              </span>
            </div>
          )}

          <button
            onClick={() => logout()}
            title="Chiqish"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-danger/50 hover:bg-danger/10 hover:text-danger"
          >
            <span>Chiqish</span>
            <span>🚪</span>
          </button>
        </div>
      </div>
    </header>
  );
}
