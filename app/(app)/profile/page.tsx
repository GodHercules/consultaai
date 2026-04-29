import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { ProfileForm } from "@/components/profile/profile-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const leader = session.user.department
    ? await prisma.user.findFirst({
        where: {
          role: "ADMIN",
          isActive: true,
          department: session.user.department,
          isDepartmentLeader: true,
        },
        select: { name: true, email: true },
      })
    : null;

  return (
    <ProfileForm
      initialName={session.user.name}
      email={session.user.email}
      department={session.user.department ?? null}
      departmentLeader={leader}
    />
  );
}
