import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { ImportUpload } from "@/components/import/import-upload";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  return <ImportUpload />;
}

