import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return <ProfileForm initialName={session.user.name} email={session.user.email} />;
}

