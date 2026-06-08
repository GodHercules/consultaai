import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { ProfileForm } from "@/components/profile/profile-form";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  let leader: { name: string; email: string } | null = null;
  if (session.user.department) {
    try {
      leader = await prisma.user.findFirst({
        where: {
          role: "ADMIN",
          isActive: true,
          department: session.user.department,
          isDepartmentLeader: true,
        },
        select: { name: true, email: true },
      });
    } catch {
      leader = null;
    }
  }

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
        initialName={session.user.name}
        email={session.user.email}
        department={session.user.department ?? null}
        departmentLeader={leader}
      />
    </div>
  );
}
