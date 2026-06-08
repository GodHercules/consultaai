import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingCompaniesTable } from "@/components/admin/pending-companies-table";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function PendingCompaniesPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  let items: Array<{
    id: string;
    source: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    receivedAt: Date;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    cnpjNumerico: string | null;
    codigoInterno: string | null;
    grupo: string | null;
    sistema: string | null;
  }> = [];
  let dataUnavailable = false;

  try {
    items = await prisma.pendingCompany.findMany({
      where: { status: "PENDING" },
      orderBy: { receivedAt: "desc" },
      take: 50,
      select: {
        id: true,
        source: true,
        status: true,
        receivedAt: true,
        razaoSocial: true,
        nomeFantasia: true,
        cnpjNumerico: true,
        codigoInterno: true,
        grupo: true,
        sistema: true,
      },
    });
  } catch {
    dataUnavailable = true;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Webhook"
        title="Empresas recebidas"
        description="Itens recebidos via webhook aguardando triagem, cadastro ou rejeição."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Empresas recebidas" },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Pendentes</CardDescription>
            <CardTitle>{items.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Recebimentos aguardando decisão.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Fonte</CardDescription>
            <CardTitle>FundarMF</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">O fluxo atual é seguro e auditável.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ação principal</CardDescription>
            <CardTitle>Cadastrar / rejeitar</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Cada item pode ser tratado individualmente.</CardContent>
        </Card>
      </div>

        <Card>
          <CardHeader>
            <CardTitle>Pendentes</CardTitle>
            <CardDescription>Até 50 registros mais recentes.</CardDescription>
          </CardHeader>
          <CardContent>
          {items.length ? (
            <PendingCompaniesTable
              initialItems={items.map((i) => ({ ...i, receivedAt: i.receivedAt.toISOString() }))}
            />
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
              {dataUnavailable ? "Dados temporariamente indisponíveis." : "Nenhum item pendente."}
            </div>
          )}
          </CardContent>
        </Card>
      </div>
  );
}
