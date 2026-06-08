import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAdminActions } from "@/components/users/user-admin-actions";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  let users: Array<{
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "ACCOUNTING" | "USER";
    department: string | null;
    isDepartmentLeader: boolean;
    isActive: boolean;
    mustChangePassword: boolean;
  }> = [];
  let dataUnavailable = false;

  try {
    users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isDepartmentLeader: true,
        isActive: true,
        mustChangePassword: true,
      },
    });
  } catch {
    dataUnavailable = true;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Administração"
        title="Gestão de usuários"
        description="Crie, ative e reemita senhas temporárias com uma visualização mais organizada e confiável."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Gestão de usuários" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/users/new">Novo usuario</Link>
            </Button>
            <UserAdminActions />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total carregado</CardDescription>
            <CardTitle>{users.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Até 50 registros por vez.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Perfis administrativos</CardDescription>
            <CardTitle>{users.filter((user) => user.role === "ADMIN").length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Usuários com acesso expandido.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Contas em troca de senha</CardDescription>
            <CardTitle>{users.filter((user) => user.mustChangePassword).length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Fluxo de segurança ativo.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Ative, inative ou reenvie senha temporária diretamente da lista.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.length ? (
            users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-background/55 p-4 text-sm xl:flex-row xl:items-center xl:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{u.name}</div>
                  <div className="truncate text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{u.role}</Badge>
                  {u.department ? <Badge variant="outline">{u.department}</Badge> : null}
                  {u.isDepartmentLeader ? <Badge variant="secondary">líder</Badge> : null}
                  <Badge variant={u.isActive ? "secondary" : "outline"}>
                    {u.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                  {u.mustChangePassword ? <Badge variant="outline">troca senha</Badge> : null}
                  <UserAdminActions userId={u.id} currentActive={u.isActive} />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
              {dataUnavailable
                ? "Dados temporariamente indisponíveis."
                : "Nenhum usuário encontrado."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
