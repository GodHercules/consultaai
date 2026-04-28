import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const items = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        <p className="text-sm text-muted-foreground">Últimos 50 eventos (MVP).</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>Inclui login, importação, alterações e resets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {items.map((it) => (
            <div key={it.id} className="flex flex-col gap-1 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {it.action} • {it.entity}
                </div>
                <div className="truncate text-muted-foreground">
                  {it.user ? `${it.user.name} <${it.user.email}>` : "Sistema"} • {it.createdAt.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="text-muted-foreground">{it.entityId || "-"}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

