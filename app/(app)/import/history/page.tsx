import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleHelpIcon, PlusIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

type ImportHistoryItem = {
  id: string;
  fileName: string;
  createdAt: Date;
  status: string;
  created: number;
  updated: number;
  ignored: number;
  suspectedDuplicates: number;
  total: number;
  errors: unknown;
  report: unknown;
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function statusMeta(status: string) {
  switch (status) {
    case "FAILED":
      return {
        label: "Falhou",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "DONE":
    default:
      return {
        label: "Concluída",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
  }
}

export default async function ImportHistoryPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  let items: ImportHistoryItem[] = [];
  let totalImports = 0;
  let doneImports = 0;
  let failedImports = 0;
  let dataUnavailable = false;

  try {
    const [total, done, failed, history] = await Promise.all([
      prisma.importHistory.count(),
      prisma.importHistory.count({ where: { status: "DONE" } }),
      prisma.importHistory.count({ where: { status: "FAILED" } }),
      prisma.importHistory.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    totalImports = total;
    doneImports = done;
    failedImports = failed;
    items = history as ImportHistoryItem[];
  } catch {
    dataUnavailable = true;
  }

  const otherImports = Math.max(0, totalImports - doneImports - failedImports);
  const topItem = items[0];
  const latestReport = asRecord(topItem?.report);
  const latestIgnoredDuplicate =
    typeof latestReport?.ignoredDuplicate === "number" ? latestReport.ignoredDuplicate : null;
  const latestIssues = topItem && Array.isArray(topItem.errors) ? topItem.errors.length : 0;

  return (
    <div className="space-y-6 xl:grid xl:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.52fr)] xl:items-start xl:gap-6">
      <div className="animate-glass-rise space-y-6">
        <PageHeader
          kicker="Operação"
          title="Histórico de importação"
          description="Acompanhe as últimas execuções, volumes processados e eventuais inconsistências."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Importação Excel", href: "/import" },
            { label: "Histórico" },
          ]}
          actions={
            <Button asChild variant="outline">
              <Link href="/import">Nova importação</Link>
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total de execuções</CardDescription>
              <CardTitle>{totalImports}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Todas as entradas já registradas.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Concluídas</CardDescription>
              <CardTitle>{doneImports}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Importações finalizadas com sucesso.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Falhas</CardDescription>
              <CardTitle>{failedImports}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Execuções que exigem revisão.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Outros estados</CardDescription>
              <CardTitle>{otherImports}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Linhas ainda sem fechamento final.</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registros</CardTitle>
            <CardDescription>Exibindo até 30 entradas recentes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length ? (
              items.map((it, index) => (
                <div
                  key={it.id}
                  className="flex flex-col gap-4 rounded-[1.35rem] border border-border/70 bg-background/55 p-4 text-sm shadow-sm transition xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.9fr)_minmax(160px,0.55fr)] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {index === 0 ? (
                        <Badge className="border-sky-200 bg-sky-50 text-sky-700">Mais recente</Badge>
                      ) : null}
                      <div className="truncate font-medium text-foreground">{it.fileName}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {it.createdAt.toLocaleString("pt-BR")}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-center">
                    <Badge className={statusMeta(it.status).className}>{statusMeta(it.status).label}</Badge>
                    <Badge variant="secondary">+{it.created}</Badge>
                    <Badge variant="secondary">~{it.updated}</Badge>
                    <Badge variant="outline">ign {it.ignored}</Badge>
                    <Badge variant="outline">={it.total}</Badge>
                    <Badge variant="outline">dup {it.suspectedDuplicates ?? 0}</Badge>
                    {Array.isArray(it.errors) && it.errors.length ? <Badge variant="outline">issues {it.errors.length}</Badge> : null}
                  </div>

                  <div className="space-y-1 xl:text-right">
                    <div className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Auditoria</div>
                    <div className="text-xs text-muted-foreground">
                      {asRecord(it.report) && typeof asRecord(it.report)?.ignoredDuplicate === "number"
                        ? `Duplicadas ignoradas: ${asRecord(it.report)?.ignoredDuplicate}`
                        : "Sem observação extra no relatório."}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
                {dataUnavailable ? "Dados temporariamente indisponíveis." : "Sem histórico."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="animate-glass-rise space-y-6 xl:sticky xl:top-6 [animation-delay:120ms]">
        <Card>
          <CardHeader>
            <CardDescription>Resumo rápido</CardDescription>
            <CardTitle>Visão operacional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1rem] border border-border/70 bg-background/60 p-3">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">Status</div>
                <div className="mt-1 font-medium text-foreground">
                  {topItem ? statusMeta(topItem.status).label : "Sem dados"}
                </div>
              </div>
              <div className="rounded-[1rem] border border-border/70 bg-background/60 p-3">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">Última fila</div>
                <div className="mt-1 font-medium text-foreground">{topItem ? topItem.fileName : "—"}</div>
              </div>
              <div className="rounded-[1rem] border border-border/70 bg-background/60 p-3">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">Dups. ignoradas</div>
                <div className="mt-1 font-medium text-foreground">{latestIgnoredDuplicate ?? 0}</div>
              </div>
              <div className="rounded-[1rem] border border-border/70 bg-background/60 p-3">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">Issues</div>
                <div className="mt-1 font-medium text-foreground">{latestIssues}</div>
              </div>
            </div>

            {topItem ? (
              <div className="rounded-[1.1rem] border border-dashed border-border/70 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Última execução</p>
                <p className="mt-2 truncate text-sm font-medium text-foreground">{topItem.fileName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{topItem.createdAt.toLocaleString("pt-BR")}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Atalhos</CardDescription>
            <CardTitle>Ações diretas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href="/import">
                Nova importação
                <PlusIcon className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href="/dashboard">
                Painel principal
                <CircleHelpIcon className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
