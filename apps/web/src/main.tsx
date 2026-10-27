import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ensureLogin, User } from "./api";
import { Navbar } from "./components/Navbar";
import { AdminPage } from "./pages/Admin";
import { AttemptPage, Centered } from "./pages/Attempt";
import { CabinetPage } from "./pages/Cabinet";
import { LoginPage } from "./pages/Login";
import { TestsPage } from "./pages/Tests";
import { VerifyPage } from "./pages/Verify";
import "./index.css";

function ProtectedLayout({
  children,
  requireAdmin,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<"wait" | "ok" | "no">("wait");

  useEffect(() => {
    ensureLogin()
      .then((u) => {
        if (u) {
          setUser(u);
          if (requireAdmin && u.role !== "ADMIN") {
            setState("no");
          } else {
            setState("ok");
          }
        } else {
          setState("no");
        }
      })
      .catch((e) => {
        console.error("Login verification failed:", e);
        setState("no");
      });
  }, [requireAdmin]);

  if (state === "wait") {
    return <Centered>Kirilmoqda…</Centered>;
  }

  if (state === "no") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#05070c] text-[#f8fafc]">
      <Navbar user={user} />
      <main className="pb-12">{children}</main>
    </div>
  );
}

// Hali to'liq yozilmagan bo'limlar (darslar, obuna)
const Soon = ({ title }: { title: string }) => (
  <div className="mx-auto max-w-xl p-8 text-center text-slate-400">
    <div className="mb-3 text-4xl">🚀</div>
    <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
    <p className="text-sm">Ushbu bo'lim hozirda tayyorlanmoqda va tez orada taqdim etiladi.</p>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Ommaviy sahifalar */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify/:number" element={<VerifyPage />} />

        {/* Himoyalangan asosiy sahifalar */}
        <Route
          path="/tests"
          element={
            <ProtectedLayout>
              <TestsPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/cabinet"
          element={
            <ProtectedLayout>
              <CabinetPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/lessons"
          element={
            <ProtectedLayout>
              <Soon title="Video darslar va materiallar" />
            </ProtectedLayout>
          }
        />
        <Route
          path="/subscribe"
          element={
            <ProtectedLayout>
              <Soon title="Obuna tariflari" />
            </ProtectedLayout>
          }
        />

        {/* Test jarayoni */}
        <Route
          path="/attempt/:id"
          element={
            <ProtectedLayout>
              <AttemptPage />
            </ProtectedLayout>
          }
        />

        {/* Admin panel (faqat ADMIN uchun) */}
        <Route
          path="/admin"
          element={
            <ProtectedLayout requireAdmin>
              <AdminPage />
            </ProtectedLayout>
          }
        />

        {/* Qolgan barcha yo'nalishlar testlarga yo'naltiriladi */}
        <Route path="*" element={<Navigate to="/tests" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
