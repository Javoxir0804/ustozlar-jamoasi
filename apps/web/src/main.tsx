import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { AdminLayout, BlockedNotice, PublicLayout, RequireAdmin, RequireStudent, StudentLayout } from "./components/layouts";
import { ToastProvider } from "./components/ui";
import { AuthProvider } from "./lib/auth";
import { ConfigProvider } from "./lib/config";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Onboarding from "./pages/student/Onboarding";
import Cabinet from "./pages/student/Cabinet";
import AdminLogin from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import Students from "./pages/admin/Students";
import Admins from "./pages/admin/Admins";
import SettingsPage from "./pages/admin/Settings";
import Password from "./pages/admin/Password";

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <p className="mt-3 text-muted">Sahifa topilmadi</p>
      <a href="/" className="mt-6 inline-block font-medium text-brand-700 hover:underline">
        Bosh sahifaga qaytish
      </a>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <BlockedNotice />
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="login" element={<Login />} />
              </Route>
              <Route path="onboarding" element={<Onboarding />} />
              <Route element={<RequireStudent />}>
                <Route element={<StudentLayout />}>
                  <Route path="cabinet" element={<Cabinet />} />
                </Route>
              </Route>
              <Route path="admin/login" element={<AdminLogin />} />
              <Route path="admin" element={<RequireAdmin />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="students" element={<Students />} />
                  <Route path="admins" element={<Admins />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="password" element={<Password />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ConfigProvider>
  </StrictMode>,
);
