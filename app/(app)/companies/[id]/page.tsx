import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, Edit3Icon, ShieldAlertIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { formatCnpjDisplay } from "@/utils/cnpj";

export const dynamic = "force-dynamic";

function statusMeta(ativo: boolean) {
  return ativo
    ? {
        label: "Ativa",
        headline: "Empresa ativa e pronta para operação.",
        description: "A empresa está habilitada para uso normal, consulta e rotina operacional.",
        badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-800",
        panelClassName: "border-emerald-200 bg-emerald-50/70",
      }
    : {
        label: "Inativa",
        headline: "Empresa inativa e fora do fluxo normal.",
        description: "A empresa está bloqueada para operação até que seja reativada.",
        badgeClassName: "border-rose-200 bg-rose-100 text-rose-800",
        panelClassName: "border-rose-200 bg-rose-50/70",
      };
}

export default async function CompanyDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const { id } = await props.params;
  let company: {
    id: string;
    codigoInterno: string | null;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    observacao: string | null;
    cnpj: string | null;
    cnpjNumerico: string | null;
    grupo: string | null;
    regimeTributario: string | null;
    sistema: string | null;
    certificado: string | null;
    anexo: string | null;
    das: string | null;
    municipio: string | null;
    telefoneContato: string | null;
    emailContato: string | null;
    ehGrupo: boolean | null;
    ativo: boolean;
    importWarning: string | null;
  } | null = null;

  try {
    company = await prisma.company.findUnique({ where: { id } });
  } catch {
    company = null;
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          kicker="Cadastro e contexto"
          title="Empresa indisponível no momento"
          description="Não conseguimos carregar os dados desta empresa agora. Você ainda pode voltar para a consulta."
          breadcrumbs={[
            { label: "Consulta avançada", href: "/companies" },
            { label: "Detalhe da empresa" },
          ]}
          actions={
            <Button asChild variant="outline">
              <Link href="/companies">
                <ArrowLeftIcon className="size-4" />
                Voltar
              </Link>
            </Button>
          }
        />
        <Card>
          <CardHeader>
            <CardDescription>Dados temporariamente indisponíveis</CardDescription>
            <CardTitle>Tente novamente em instantes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A página continua navegável, mas o banco local não respondeu para carregar esta empresa.
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = company.razaoSocial || company.nomeFantasia || "Empresa";
  const cnpjLabel = formatCnpjDisplay(company.cnpjNumerico || company.cnpj);
  const codeLabel = company.codigoInterno || "-";
  const municipalityLabel = company.municipio || "-";
  const phoneLabel = company.telefoneContato || "-";
  const emailLabel = company.emailContato || "-";
  const status = statusMeta(company.ativo);
  const groupLabel = company.ehGrupo && company.grupo ? company.grupo : null;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Cadastro e contexto"
        title={displayName}
        description={`${cnpjLabel} • CÓD ${codeLabel} • ${municipalityLabel}${groupLabel ? ` • Grupo ${groupLabel}` : ""}`}
        breadcrumbs={[
          { label: "Consulta avançada", href: "/companies" },
          { label: displayName },
        ]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/companies">
                <ArrowLeftIcon className="size-4" />
                Voltar
              </Link>
            </Button>
            {session.user.role === "ADMIN" ? (
              <>
                <Button asChild>
                  <Link href={`/companies/${company.id}/edit`}>
                    <Edit3Icon className="size-4" />
                    Editar
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/companies/${company.id}/status`}>
                    <ShieldAlertIcon className="size-4" />
                    Inativar / reativar
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardDescription>Resumo cadastral</CardDescription>
            <CardTitle>Dados principais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4 sm:col-span-2 xl:col-span-3">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Status cadastral</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className={status.badgeClassName}>{status.label}</Badge>
                <span className="text-sm font-medium">{status.headline}</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{status.description}</div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">CNPJ</div>
              <div className="mt-2 text-sm font-medium">{cnpjLabel}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">CÓD</div>
              <div className="mt-2 text-sm font-medium">{codeLabel}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Razão social</div>
              <div className="mt-2 text-sm font-medium">{company.razaoSocial || "-"}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Nome fantasia</div>
              <div className="mt-2 text-sm font-medium">{company.nomeFantasia || "-"}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Município</div>
              <div className="mt-2 text-sm font-medium">{municipalityLabel}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Telefone</div>
              <div className="mt-2 text-sm font-medium">{phoneLabel}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">E-mail</div>
              <div className="mt-2 text-sm font-medium break-all">{emailLabel}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Tipo de tributação</div>
              <div className="mt-2 text-sm font-medium">{company.regimeTributario || "-"}</div>
            </div>
            {groupLabel ? (
              <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Grupo</div>
                <div className="mt-2 text-sm font-medium">{groupLabel}</div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Sistema</div>
              <div className="mt-2 text-sm font-medium">{company.sistema || "-"}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Regime</div>
              <div className="mt-2 text-sm font-medium">{company.certificado || "-"}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Anexo</div>
              <div className="mt-2 text-sm font-medium">{company.anexo || "-"}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">DAS</div>
              <div className="mt-2 text-sm font-medium">{company.das || "-"}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4 sm:col-span-2">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Observações</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{company.observacao || "-"}</div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className={status.panelClassName}>
            <CardHeader>
              <CardDescription>Status operacional</CardDescription>
              <CardTitle>Visibilidade rápida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className={`rounded-full border ${status.badgeClassName}`}>{status.label}</Badge>
              <div className="text-sm text-muted-foreground">{status.description}</div>
            </CardContent>
          </Card>

          {company.importWarning ? (
            <Card className="border-amber-300/50 bg-amber-50/70 text-amber-950">
              <CardHeader>
                <CardDescription className="text-amber-800">Aviso da importação</CardDescription>
                <CardTitle>Necessita atenção</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-amber-950">
                {company.importWarning}
              </CardContent>
            </Card>
          ) : null}

          {session.user.role === "ADMIN" ? (
            <Card>
              <CardHeader>
                <CardDescription>Administração</CardDescription>
                <CardTitle>Próximas ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`/companies/${company.id}/edit`}>
                    <Edit3Icon className="size-4" />
                    Editar empresa
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`/companies/${company.id}/status`}>
                    <ShieldAlertIcon className="size-4" />
                    Alterar status
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
