import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AndamentosGantt } from "@/components/admin/andamentos-gantt";
import type { ProgressStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type ProgressRow = {
  id: string;
  title: string;
  status: ProgressStatus;
  startDate: Date;
  endDate: Date;
  company: { id: string; razaoSocial: string | null; nomeFantasia: string | null; cnpjNumerico: string | null };
  createdByUser: { id: string; name: string; email: string };
};

export default async function AndamentosGanttPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const items = (await prisma.companyProgress.findMany({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Andamentos (visão admin)</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada dos andamentos enviados pelo setor Contábil.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Até 300 registros (MVP).</CardDescription>
        </CardHeader>
        <CardContent>
          <AndamentosGantt
            items={items.map((i: ProgressRow) => ({
              ...i,
              startDate: i.startDate.toISOString(),
              endDate: i.endDate.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
