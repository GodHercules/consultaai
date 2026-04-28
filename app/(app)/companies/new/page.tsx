import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { CompanyForm } from "@/components/companies/company-form";

export const dynamic = "force-dynamic";

export default async function CompanyNewPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  return <CompanyForm mode="create" />;
}

