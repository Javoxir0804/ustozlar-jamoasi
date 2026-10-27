import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ensureLogin } from "./api";
import { AttemptPage, Centered } from "./pages/Attempt";
import { LoginPage } from "./pages/Login";
import { TestsPage } from "./pages/Tests";
import { VerifyPage } from "./pages/Verify";
import "./index.css";

function Protected({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"wait" | "ok" | "no">("wait");
  useEffect(() => {
    ensureLogin().then((ok) => setState(ok ? "ok" : "no")).catch((e) => {
      alert(e.message);
      setState("no");
    });
  }, []);
  if (state === "wait") return <Centered>Kirilmoqda…</Centered>;
  return state === "ok" ? <>{children}</> : <Navigate to="/login" replace />;
}

// Hali yozilmagan bo'limlar (keyingi bosqichlar)
const Soon = ({ title }: { title: string }) => <Centered>{title}: keyingi bosqichda qo'shiladi.</Centered>;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify/:number" element={<VerifyPage />} />
        <Route path="/tests" element={<Protected><TestsPage /></Protected>} />
        <Route path="/attempt/:id" element={<Protected><AttemptPage /></Protected>} />
        <Route path="/lessons" element={<Protected><Soon title="Video darslar" /></Protected>} />
        <Route path="/cabinet" element={<Protected><Soon title="Shaxsiy kabinet" /></Protected>} />
        <Route path="/subscribe" element={<Protected><Soon title="Obuna" /></Protected>} />
        <Route path="*" element={<Navigate to="/tests" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
