import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAdminActions } from "@/components/users/user-admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    take: 50,
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestão usuários</h1>
        <p className="text-sm text-muted-foreground">Criação, ativação e senhas temporárias.</p>
      </div>

      <UserAdminActions />

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Até 50 registros (MVP).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="truncate font-medium">{u.name}</div>
                <div className="truncate text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{u.role}</Badge>
                <Badge variant={u.isActive ? "secondary" : "outline"}>
                  {u.isActive ? "Ativo" : "Inativo"}
                </Badge>
                {u.mustChangePassword ? <Badge variant="outline">troca senha</Badge> : null}
                <UserAdminActions userId={u.id} currentActive={u.isActive} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

