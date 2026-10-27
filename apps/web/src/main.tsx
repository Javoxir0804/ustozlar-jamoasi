import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { AdminLayout, BlockedNotice, CoursesLayout, PublicLayout, RequireAdmin, RequireStudent, StudentLayout } from "./components/layouts";
import { PageLoader, ToastProvider } from "./components/ui";
import { AuthProvider } from "./lib/auth";
import { ConfigProvider } from "./lib/config";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Onboarding from "./pages/student/Onboarding";
import Cabinet from "./pages/student/Cabinet";
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Students = lazy(() => import("./pages/admin/Students"));
const Admins = lazy(() => import("./pages/admin/Admins"));
const SettingsPage = lazy(() => import("./pages/admin/Settings"));
const Password = lazy(() => import("./pages/admin/Password"));
const Subjects = lazy(() => import("./pages/admin/Subjects"));
const AdminCourses = lazy(() => import("./pages/admin/Courses"));
const CourseEdit = lazy(() => import("./pages/admin/CourseEdit"));
const Catalog = lazy(() => import("./pages/courses/Catalog"));
const CoursePage = lazy(() => import("./pages/courses/CoursePage"));
const LessonPage = lazy(() => import("./pages/courses/LessonPage"));
const AdminTests = lazy(() => import("./pages/admin/Tests"));
const TestEdit = lazy(() => import("./pages/admin/TestEdit"));
const TestList = lazy(() => import("./pages/tests/TestList"));
const TestIntro = lazy(() => import("./pages/tests/TestIntro"));
const AttemptPage = lazy(() => import("./pages/tests/AttemptPage"));
const Verify = lazy(() => import("./pages/public/Verify"));
const Rating = lazy(() => import("./pages/public/Rating"));
const AdminCertificates = lazy(() => import("./pages/admin/Certificates"));

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
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="login" element={<Login />} />
              </Route>
              <Route element={<PublicLayout padded />}>
                <Route path="verify" element={<Verify />} />
                <Route path="verify/:number" element={<Verify />} />
              </Route>
              <Route element={<CoursesLayout />}>
                <Route path="courses" element={<Catalog />} />
                <Route path="courses/:id" element={<CoursePage />} />
                <Route path="tests" element={<TestList />} />
                <Route path="tests/:id" element={<TestIntro />} />
                <Route path="rating" element={<Rating />} />
              </Route>
              <Route path="onboarding" element={<Onboarding />} />
              <Route element={<RequireStudent />}>
                <Route path="attempts/:id" element={<AttemptPage />} />
                <Route element={<StudentLayout />}>
                  <Route path="cabinet" element={<Cabinet />} />
                  <Route path="lessons/:id" element={<LessonPage />} />
                </Route>
              </Route>
              <Route path="admin/login" element={<AdminLogin />} />
              <Route path="admin" element={<RequireAdmin />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="students" element={<Students />} />
                  <Route path="subjects" element={<Subjects />} />
                  <Route path="courses" element={<AdminCourses />} />
                  <Route path="courses/:id" element={<CourseEdit />} />
                  <Route path="tests" element={<AdminTests />} />
                  <Route path="tests/:id" element={<TestEdit />} />
                  <Route path="certificates" element={<AdminCertificates />} />
                  <Route path="admins" element={<Admins />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="password" element={<Password />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ConfigProvider>
  </StrictMode>,
);
