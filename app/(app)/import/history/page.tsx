import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ImportHistoryPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const items = await prisma.importHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Histórico importação</h1>
          <p className="text-sm text-muted-foreground">Últimas execuções.</p>
        </div>
        <Link href="/import" className="text-sm underline">
          Nova importação
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
          <CardDescription>Exibindo até 30 entradas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length ? (
            items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{it.fileName}</div>
                  <div className="text-muted-foreground">
                    {it.createdAt.toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">+{it.created}</Badge>
                  <Badge variant="secondary">~{it.updated}</Badge>
                  <Badge variant="outline">ign {it.ignored}</Badge>
                  <Badge variant="outline">={it.total}</Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Sem histórico.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

