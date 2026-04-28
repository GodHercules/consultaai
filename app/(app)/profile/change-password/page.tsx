import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return <ChangePasswordForm />;
}

