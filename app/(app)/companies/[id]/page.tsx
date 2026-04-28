import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const { id } = await props.params;
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) redirect("/companies");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {company.razaoSocial || company.nomeFantasia || "Empresa"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.cnpjNumerico || company.cnpj || "-"} • {company.codigoInterno || "-"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={company.ativo ? "secondary" : "outline"}>
            {company.ativo ? "Ativa" : "Inativa"}
          </Badge>
          <Link href="/companies" className="text-sm underline">
            Voltar
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Grupo</div>
            <div>{company.grupo || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Regime tributário</div>
            <div>{company.regimeTributario || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Sistema</div>
            <div>{company.sistema || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Certificado</div>
            <div>{company.certificado || "-"}</div>
          </div>
        </CardContent>
      </Card>

      {session.user.role === "ADMIN" ? (
        <Card>
          <CardHeader>
            <CardTitle>Ações administrativas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <Link href={`/companies/${company.id}/edit`} className="underline">
              Editar empresa
            </Link>
            <Link href={`/companies/${company.id}/status`} className="underline">
              Inativar/Reativar
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

