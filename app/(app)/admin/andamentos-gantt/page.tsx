import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
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
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  let items: ProgressRow[] = [];
  let dataUnavailable = false;

  try {
    items = (await prisma.companyProgress.findMany({
      orderBy: [{ endDate: "desc" }],
      take: 300,
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        company: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjNumerico: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    })) as ProgressRow[];
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
