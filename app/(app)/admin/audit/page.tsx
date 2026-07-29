import { redirect } from "next/navigation";
import { backendFetch, getBackendSession } from "@/lib/server-backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await getBackendSession() as { role?: string } | null;
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/companies");

  let items: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: Date;
    user: { email: string; name: string } | null;
  }> = [];
  let dataUnavailable = false;

  try {
    const response = await backendFetch("/api/admin/audit?page=1&pageSize=50");
    if (!response.ok) throw new Error("audit unavailable");
    const data = await response.json() as { items?: typeof items };
    items = (data.items ?? []).map((item) => ({ ...item, createdAt: new Date(item.createdAt) }));
  } catch {
    dataUnavailable = true;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Governança"
        title="Auditoria"
        description="Últimos eventos da plataforma com leitura mais limpa e hierarquia melhor definida."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Auditoria" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>Inclui login, importação, alterações e resets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {items.length ? (
            items.map((it) => (
              <div
                key={it.id}
                className="flex flex-col gap-2 rounded-[1.25rem] border border-border/70 bg-background/55 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {it.action} • {it.entity}
                  </div>
                  <div className="truncate text-muted-foreground">
                    {it.user ? `${it.user.name} <${it.user.email}>` : "Sistema"} •{" "}
                    {it.createdAt.toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="text-muted-foreground">{it.entityId || "-"}</div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
              {dataUnavailable ? "Dados temporariamente indisponíveis." : "Nenhum log encontrado."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
