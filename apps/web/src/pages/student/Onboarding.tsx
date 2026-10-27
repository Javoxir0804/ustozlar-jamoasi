import { Navigate, useNavigate } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { ProfileForm } from "../../components/ProfileForm";
import { Card, PageLoader } from "../../components/ui";
import { useAuth } from "../../lib/auth";

export default function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Logo />
      </div>
      <Card className="p-6 sm:p-8">
        <h1 className="font-display text-xl font-semibold">Ro'yxatdan o'tish</h1>
        <p className="mt-1 text-sm text-muted">Ma'lumotlaringizni bir marta to'ldiring. Ular sertifikat va natijalarda ishlatiladi.</p>
        <div className="mt-6">
          <ProfileForm submitLabel={user.profileCompleted ? "Saqlash" : "Ro'yxatdan o'tish"} onSaved={() => navigate("/cabinet", { replace: true })} />
        </div>
      </Card>
    </div>
  );
}
