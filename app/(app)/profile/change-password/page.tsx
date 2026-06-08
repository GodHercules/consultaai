import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Segurança"
        title="Alterar senha"
        description="Mantenha sua conta protegida com uma senha forte e exclusiva."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Perfil", href: "/profile" },
          { label: "Alterar senha" },
        ]}
      />
      <ChangePasswordForm />
    </div>
  );
}
