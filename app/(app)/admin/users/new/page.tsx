import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/services/auth/session";
import { UserCreateForm } from "@/components/users/user-create-form";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Administracao"
        title="Criar novo usuario"
        description="Tela guiada para cadastrar contas com senha temporaria, setor e perfil de acesso."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Gestao de usuarios", href: "/admin/users" },
          { label: "Novo usuario" },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/users">
              <ArrowLeftIcon className="size-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <UserCreateForm />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sky-700">
                <UsersIcon className="size-4" />
                <CardTitle>Criterios rapidos</CardTitle>
              </div>
              <CardDescription>Ajuda para decidir o perfil antes de salvar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>Use <strong>USER</strong> para acesso operacional simples.</p>
              <p>Use <strong>ADMIN</strong> quando a conta precisar de gestao e supervisao.</p>
              <p>
                Se o perfil for do tipo lider de setor, marque o setor correspondente para liberar a regra.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sky-200 bg-sky-50/60">
            <CardHeader>
              <div className="flex items-center gap-2 text-sky-700">
                <ShieldCheckIcon className="size-4" />
                <CardTitle>Seguranca</CardTitle>
              </div>
              <CardDescription>O fluxo ja nasce pronto para o primeiro acesso.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
              <p>A senha temporaria expira em 24 horas.</p>
              <p>O usuario precisara trocar a senha no primeiro login.</p>
              <p>Todas as mudancas ficam registradas na auditoria.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
