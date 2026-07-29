import { redirect } from "next/navigation";
import { backendFetch, getBackendSession } from "@/lib/server-backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingCompaniesTable } from "@/components/admin/pending-companies-table";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function PendingCompaniesPage() {
  const session = await getBackendSession() as { role?: string } | null;
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/companies");

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
    const response = await backendFetch("/api/admin/pending-companies?status=PENDING&take=50");
    if (!response.ok) throw new Error("pending companies unavailable");
    const data = await response.json() as { items?: typeof items };
    items = (data.items ?? []).map((item) => ({ ...item, receivedAt: new Date(item.receivedAt) }));
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
