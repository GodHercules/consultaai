import { redirect } from "next/navigation";
import { backendFetch, getBackendSession } from "@/lib/server-backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AndamentosGantt } from "@/components/admin/andamentos-gantt";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

type ProgressRow = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  startDate: Date;
  endDate: Date;
  company: { id: string; razaoSocial: string | null; nomeFantasia: string | null; cnpjNumerico: string | null };
  createdByUser: { id: string; name: string; email: string };
};

export default async function AndamentosGanttPage() {
  const session = await getBackendSession() as { role?: string } | null;
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/companies");

  let items: ProgressRow[] = [];
  let dataUnavailable = false;

  try {
    const response = await backendFetch("/api/company-progress?take=300");
    if (!response.ok) throw new Error("progress unavailable");
    const data = await response.json() as { items?: Array<Omit<ProgressRow, "startDate" | "endDate"> & { startDate: string; endDate: string }> };
    items = (data.items ?? []).map((item) => ({ ...item, startDate: new Date(item.startDate), endDate: new Date(item.endDate) }));
  } catch {
    dataUnavailable = true;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Linha do tempo"
        title="Andamentos (visão admin)"
        description="Visão consolidada dos andamentos enviados pelo setor Contábil."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Andamentos (Gantt)" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Até 300 registros. A visualização agora é mais legível e espaçada.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length ? (
            <AndamentosGantt
              items={items.map((i: ProgressRow) => ({
                ...i,
                startDate: i.startDate.toISOString(),
                endDate: i.endDate.toISOString(),
              }))}
            />
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
              {dataUnavailable ? "Dados temporariamente indisponíveis." : "Sem registros na linha do tempo."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
