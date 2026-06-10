import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { CompanyForm } from "@/components/companies/company-form";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CompanyEditPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const { id } = await props.params;
  let company: {
    id: string;
    qtd: number | null;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    codigoInterno: string | null;
    observacao: string | null;
    cnpj: string | null;
    ehGrupo: boolean | null;
    grupo: string | null;
    regimeTributario: string | null;
    sistema: string | null;
    certificado: string | null;
    anexo: string | null;
    das: string | null;
    municipio: string | null;
    telefoneContato: string | null;
    emailContato: string | null;
    ativo: boolean;
  } | null = null;

  try {
    company = await prisma.company.findUnique({ where: { id } });
  } catch {
    company = null;
  }
  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          kicker="Edição"
          title="Empresa indisponível"
          description="Não conseguimos carregar os dados agora. A ação fica protegida sem quebrar a navegação."
          breadcrumbs={[
            { label: "Consulta avançada", href: "/companies" },
            { label: "Editar empresa" },
          ]}
        />
        <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
          Tente novamente em instantes ou volte para a consulta.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Edição"
        title={company.razaoSocial || company.nomeFantasia || "Editar empresa"}
        description={`Ajuste os dados cadastrais sem perder o contexto da consulta. Status atual: ${
          company.ativo ? "Ativa" : "Inativa"
        }.`}
        breadcrumbs={[
          { label: "Consulta avançada", href: "/companies" },
          { label: company.razaoSocial || company.nomeFantasia || "Empresa" },
          { label: "Editar" },
        ]}
      />
      <div className={`flex items-center justify-between rounded-2xl border p-4 ${company.ativo ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}`}>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Situação da empresa</div>
          <div className="mt-1 text-sm font-medium">
            {company.ativo
              ? "A empresa está ativa e pronta para operação."
              : "A empresa está inativa e fora do fluxo normal."}
          </div>
        </div>
        <Badge className={company.ativo ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-rose-200 bg-rose-100 text-rose-800"}>
          {company.ativo ? "Ativa" : "Inativa"}
        </Badge>
      </div>
      <CompanyForm
        mode="edit"
        companyId={company.id}
        initial={{
          qtd: company.qtd != null ? String(company.qtd) : "",
          codigoInterno: company.codigoInterno,
          razaoSocial: company.razaoSocial,
          nomeFantasia: company.nomeFantasia,
          observacao: company.observacao,
          cnpj: company.cnpj,
          ehGrupo: company.ehGrupo,
          grupo: company.grupo,
          regimeTributario: company.regimeTributario,
          sistema: company.sistema,
          certificado: company.certificado,
          anexo: company.anexo,
          das: company.das,
          municipio: company.municipio,
          telefoneContato: company.telefoneContato,
          emailContato: company.emailContato,
          ativo: company.ativo,
        }}
      />
    </div>
  );
}
