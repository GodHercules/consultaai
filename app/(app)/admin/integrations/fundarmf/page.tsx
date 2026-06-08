import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { FilterIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { FundarmfEventsTable } from "@/components/admin/fundarmf-events-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const dynamic = "force-dynamic";

type SearchStatus = "all" | "RECEIVED" | "PROCESSING" | "PROCESSED" | "REVIEW_REQUIRED" | "FAILED" | "DUPLICATE";

function parseStatus(value: string | string[] | undefined): SearchStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    raw === "RECEIVED" ||
    raw === "PROCESSING" ||
    raw === "PROCESSED" ||
    raw === "REVIEW_REQUIRED" ||
    raw === "FAILED" ||
    raw === "DUPLICATE" ||
    raw === "all"
  ) {
    return raw;
  }

  return "all";
}

function buildHref(base: { q: string; status: SearchStatus; page: number }) {
  const params = new URLSearchParams();
  if (base.q.trim()) params.set("q", base.q.trim());
  if (base.status !== "all") params.set("status", base.status);
  if (base.page > 1) params.set("page", String(base.page));
  const query = params.toString();
  return query ? `/admin/integrations/fundarmf?${query}` : "/admin/integrations/fundarmf";
}

function buildWhere(q: string, status: SearchStatus): Prisma.IntegrationEventWhereInput {
  const text = q.trim();
  const filters: Prisma.IntegrationEventWhereInput[] = [{ source: "FundarMF" }];

  if (text) {
    const digits = text.replace(/\D+/g, "");
    filters.push({
      OR: [
        { eventType: { contains: text, mode: "insensitive" } },
        { deliveryId: { contains: text, mode: "insensitive" } },
        { fundarmfCaseId: { contains: text, mode: "insensitive" } },
        { companyCnpj: { contains: text, mode: "insensitive" } },
        { errorMessage: { contains: text, mode: "insensitive" } },
        ...(digits ? [{ companyCnpj: { startsWith: digits } }] : []),
      ],
    });
  }

  if (status !== "all") {
    filters.push({ status });
  }

  if (filters.length === 1) return filters[0];
  return { AND: filters };
}

export default async function FundarmfEventsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = parseStatus(sp.status);
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const where = buildWhere(q, status);

  let totalCount = 0;
  let receivedCount = 0;
  let processingCount = 0;
  let processedCount = 0;
  let reviewCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  let filteredTotal = 0;
  let items: Array<{
    id: string;
    eventType: string;
    deliveryId: string;
    fundarmfCaseId: string | null;
    companyCnpj: string | null;
    status: "RECEIVED" | "PROCESSING" | "PROCESSED" | "REVIEW_REQUIRED" | "FAILED" | "DUPLICATE";
    errorMessage: string | null;
    createdAt: Date;
    processedAt: Date | null;
  }> = [];
  let dataUnavailable = false;

  try {
    const baseWhere = { source: "FundarMF" } satisfies Prisma.IntegrationEventWhereInput;
    const [all, received, processing, processed, review, failed, duplicate, total, listItems] = await Promise.all([
      prisma.integrationEvent.count({ where: baseWhere }),
      prisma.integrationEvent.count({ where: { ...baseWhere, status: "RECEIVED" } }),
      prisma.integrationEvent.count({ where: { ...baseWhere, status: "PROCESSING" } }),
      prisma.integrationEvent.count({ where: { ...baseWhere, status: "PROCESSED" } }),
      prisma.integrationEvent.count({ where: { ...baseWhere, status: "REVIEW_REQUIRED" } }),
      prisma.integrationEvent.count({ where: { ...baseWhere, status: "FAILED" } }),
      prisma.integrationEvent.count({ where: { ...baseWhere, status: "DUPLICATE" } }),
      prisma.integrationEvent.count({ where }),
      prisma.integrationEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          eventType: true,
          deliveryId: true,
          fundarmfCaseId: true,
          companyCnpj: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          processedAt: true,
        },
      }),
    ]);

    totalCount = all;
    receivedCount = received;
    processingCount = processing;
    processedCount = processed;
    reviewCount = review;
    failedCount = failed;
    duplicateCount = duplicate;
    filteredTotal = total;
    items = listItems;
  } catch {
    dataUnavailable = true;
  }

  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const hasFilters = Boolean(q.trim()) || status !== "all" || page > 1;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Integracoes"
        title="Eventos FundarMF"
        description="Acompanhe a fila da integracao, filtre por status e reprocessa eventos diretamente da area admin."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Administracao" },
          { label: "Eventos FundarMF" },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href={buildHref({ q, status, page: 1 })}>
              <RefreshCwIcon className="size-4" />
              Atualizar lista
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total FundarMF</CardDescription>
            <CardTitle>{totalCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Todos os eventos recebidos pela integracao.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Processados</CardDescription>
            <CardTitle>{processedCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Eventos concluidos sem necessidade de revisao.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Em atencao</CardDescription>
            <CardTitle>{reviewCount + failedCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Eventos que pedem analise ou retry manual.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Duplicados</CardDescription>
            <CardTitle>{duplicateCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Entregas repetidas bloqueadas por idempotencia.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="size-4 text-muted-foreground" />
            Filtros
          </CardTitle>
          <CardDescription>
            Busque por empresa, caso, entrega, tipo de evento ou mensagem de erro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto] md:items-end"
            action="/admin/integrations/fundarmf"
            method="get"
          >
            <div className="space-y-2">
              <label htmlFor="q" className="text-sm font-medium text-foreground">
                Busca
              </label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="CNPJ, delivery id, caso, tipo de evento ou erro"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium text-foreground">
                Status
              </label>
              <Select name="status" defaultValue={status}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="PROCESSED">Processed</SelectItem>
                  <SelectItem value="REVIEW_REQUIRED">Review required</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="DUPLICATE">Duplicate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              <SearchIcon className="size-4" />
              Aplicar
            </Button>
            {hasFilters ? (
              <Button asChild variant="outline">
                <Link href="/admin/integrations/fundarmf">Limpar</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">
            {dataUnavailable ? "Dados temporariamente indisponiveis." : `${filteredTotal} evento(s) encontrados`}
          </div>
          <div className="text-sm text-muted-foreground">
            {hasFilters
              ? "Mostrando apenas os eventos que correspondem aos filtros ativos."
              : "Visao geral da fila mais recente."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Pagina {page} de {totalPages}</Badge>
          <Badge variant="outline">Recebidos {receivedCount}</Badge>
          <Badge variant="outline">Processando {processingCount}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
          <CardDescription>
            Reprocessamento disponivel apenas para eventos com erro ou revisao.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length ? (
            <FundarmfEventsTable
              items={items.map((item) => ({
                ...item,
                createdAt: item.createdAt.toISOString(),
                processedAt: item.processedAt ? item.processedAt.toISOString() : null,
              }))}
            />
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
              {dataUnavailable ? "Dados temporariamente indisponiveis." : "Nenhum evento encontrado com os filtros atuais."}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-start justify-between gap-3 rounded-[1.5rem] border border-border/70 bg-card/70 p-4 sm:flex-row sm:items-center">
        <div className="text-sm text-muted-foreground">
          Exibindo pagina {page} de {totalPages}.
        </div>
        <div className="flex items-center gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Pagina anterior
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref({ q, status, page: page - 1 })}>Pagina anterior</Link>
            </Button>
          )}
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Proxima pagina
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref({ q, status, page: page + 1 })}>Proxima pagina</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
