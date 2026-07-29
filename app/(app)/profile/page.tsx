import { redirect } from "next/navigation";
import { backendFetch, getBackendSession } from "@/lib/server-backend";
import { ProfileForm } from "@/components/profile/profile-form";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getBackendSession() as { name: string; email: string; department?: string | null } | null;
  if (!session) redirect("/login");
  const profileResponse = await backendFetch("/api/profile");
  const profileData = await profileResponse.json().catch(() => ({})) as { departmentLeader?: { name: string; email: string } | null };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Conta"
        title="Perfil"
        description="Atualize seus dados básicos e veja o responsável do seu setor."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Perfil" },
        ]}
      />
      <ProfileForm
        initialName={session.name}
        email={session.email}
        department={session.department ?? null}
        departmentLeader={profileData.departmentLeader ?? null}
      />
    </div>
  );
}
