import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { CompanyForm } from "@/components/companies/company-form";

export const dynamic = "force-dynamic";

export default async function CompanyEditPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const { id } = await props.params;
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) redirect("/companies");

  return (
    <CompanyForm
      mode="edit"
      companyId={company.id}
      initial={{
        codigoInterno: company.codigoInterno,
        razaoSocial: company.razaoSocial,
        nomeFantasia: company.nomeFantasia,
        cnpj: company.cnpj,
        grupo: company.grupo,
        regimeTributario: company.regimeTributario,
        sistema: company.sistema,
        certificado: company.certificado,
        ativo: company.ativo,
      }}
    />
  );
}

