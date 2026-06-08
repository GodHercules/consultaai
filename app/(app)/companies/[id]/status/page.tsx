import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { CompanyStatusForm } from "@/components/companies/company-status-form";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function CompanyStatusPage(props: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const { id } = await props.params;
  let company: { id: string; ativo: boolean } | null = null;

  try {
    company = await prisma.company.findUnique({ where: { id }, select: { id: true, ativo: true } });
  } catch {
    company = null;
  }
  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          kicker="Status"
          title="Empresa indisponível"
          description="Não foi possível ler o registro para alterar o status neste momento."
          breadcrumbs={[
            { label: "Consulta avançada", href: "/companies" },
            { label: "Detalhe da empresa", href: `/companies/${id}` },
            { label: "Status" },
          ]}
        />
        <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
          Tente novamente em instantes.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Status"
        title={company.ativo ? "Inativar empresa" : "Reativar empresa"}
        description="A mudança de status exige motivo e mantém o histórico na auditoria."
        breadcrumbs={[
          { label: "Consulta avançada", href: "/companies" },
          { label: "Detalhe da empresa", href: `/companies/${company.id}` },
          { label: company.ativo ? "Inativar" : "Reativar" },
        ]}
      />
      <CompanyStatusForm companyId={company.id} ativo={company.ativo} />
    </div>
  );
}
