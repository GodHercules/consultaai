import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { CompanyStatusForm } from "@/components/companies/company-status-form";

export const dynamic = "force-dynamic";

export default async function CompanyStatusPage(props: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const { id } = await props.params;
  const company = await prisma.company.findUnique({ where: { id }, select: { id: true, ativo: true } });
  if (!company) redirect("/companies");

  return <CompanyStatusForm companyId={company.id} ativo={company.ativo} />;
}

