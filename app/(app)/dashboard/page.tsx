import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const [companiesActive, companiesInactive, usersActive, lastImports] =
    await Promise.all([
      prisma.company.count({ where: { ativo: true } }),
      prisma.company.count({ where: { ativo: false } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.importHistory.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          fileName: true,
          total: true,
          created: true,
          updated: true,
          ignored: true,
          createdAt: true,
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral operacional (free tier friendly).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Empresas ativas</CardTitle>
            <CardDescription>Total</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {companiesActive}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Empresas inativas</CardTitle>
            <CardDescription>Total</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {companiesInactive}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Usuários ativos</CardTitle>
            <CardDescription>Total</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {usersActive}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas importações</CardTitle>
          <CardDescription>Histórico recente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lastImports.length ? (
            lastImports.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 truncate">{item.fileName}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">+{item.created}</Badge>
                  <Badge variant="secondary">~{item.updated}</Badge>
                  <Badge variant="outline">={item.total}</Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Nenhuma importação encontrada.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
