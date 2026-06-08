import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { CompanyForm } from "@/components/companies/company-form";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function CompanyNewPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Cadastro"
        title="Nova empresa"
        description="Inclua os dados base da empresa com uma experiência de formulário mais clara e espaçada."
        breadcrumbs={[
          { label: "Consulta avançada", href: "/companies" },
          { label: "Nova empresa" },
        ]}
      />
      <CompanyForm mode="create" />
    </div>
  );
}
