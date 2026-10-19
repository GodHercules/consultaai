import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleHelpIcon, DownloadIcon, PlusIcon, SearchIcon } from "lucide-react";
import { backendFetch, getBackendSession } from "@/lib/server-backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { CompanyExportButton } from "@/components/companies/company-export-button";
import { cn } from "@/lib/utils";
import { formatCnpjDisplay } from "@/utils/cnpj";

export const dynamic = "force-dynamic";

type SearchStatus = "all" | "active" | "inactive";

type CompanyListItem = {
  id: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  codigoInterno: string | null;
  cnpjNumerico: string | null;
  municipio: string | null;
  regimeTributario: string | null;
  sistema?: string | null;
  certificado?: string | null;
  observacao?: string | null;
  ativo: boolean;
  importWarning: string | null;
};

function parseStatus(value: string | string[] | undefined): SearchStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "active" || raw === "inactive" || raw === "all" ? raw : "all";
}

function parseText(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function buildHref(base: { q: string; status: SearchStatus; municipio: string; page: number }) {
  const params = new URLSearchParams();
  if (base.q.trim()) params.set("q", base.q.trim());
  if (base.status !== "all") params.set("status", base.status);
  if (base.municipio.trim()) params.set("municipio", base.municipio.trim());
  if (base.page > 1) params.set("page", String(base.page));
  const query = params.toString();
  return query ? `/companies?${query}` : "/companies";
}

export default async function CompaniesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = (await getBackendSession()) as { role?: string } | null;
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const q = parseText(searchParams.q);
  const municipio = parseText(searchParams.municipio);
  const status = parseStatus(searchParams.status);
  const page = Math.max(1, Number.parseInt(parseText(searchParams.page) || "1", 10) || 1);
  const pageSize = 20;
  const hasSearch = Boolean(q.trim() || municipio.trim() || status !== "all");

  let activeCompaniesCount = 0;
  let inactiveCompaniesCount = 0;
  let warningCompaniesCount = 0;
  let total = 0;
  let items: CompanyListItem[] = [];
  let dataUnavailable = false;

  try {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set("q", q.trim());
    if (municipio.trim()) params.set("municipio", municipio.trim());
    if (status === "active") params.set("ativo", "true");
    if (status === "inactive") params.set("ativo", "false");

    const response = await backendFetch(`/api/companies?${params.toString()}`);
    if (!response.ok) throw new Error("companies unavailable");
    const data = (await response.json()) as {
      total?: number;
      items?: CompanyListItem[];
      summary?: { activeCount?: number; inactiveCount?: number; warningCount?: number };
    };
    total = data.total ?? 0;
    items = data.items ?? [];
    activeCompaniesCount = data.summary?.activeCount ?? 0;
    inactiveCompaniesCount = data.summary?.inactiveCount ?? 0;
    warningCompaniesCount = data.summary?.warningCount ?? 0;
  } catch {
    dataUnavailable = true;
  }

  const totalPages = hasSearch ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const totalCompaniesCount = activeCompaniesCount + inactiveCompaniesCount;
  const currentPageWarnings = items.filter((item) => Boolean(item.importWarning)).length;
  const criteriaTooltip =
    "Ativa: CNPJ informado e sem sinais de baixa/inatividade.\n" +
    "Inativa: BAIXADA, BAIXADO, INATIVA, INATIVO ou MEI desenquadrado.\n" +
    "Linhas sem CNPJ são marcadas como inativas.";

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Pesquisa e triagem"
        title="Consulta avançada"
        description="Encontre empresas por identidade, localização ou situação e leve a mesma seleção para fora do sistema quando precisar trabalhar em conjunto."
        actions={
          <div className="flex flex-wrap gap-2">
            {session.role === "ADMIN" ? (
              <Button asChild>
                <Link href="/companies/new">
                  <PlusIcon className="size-4" />
                  Cadastrar empresa
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/companies/contracts">Tabela Empresas</Link>
            </Button>
          </div>
        }
      />

      <section aria-label="Resumo da base" className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Total da base" value={totalCompaniesCount} detail="Ativas e inativas" />
        <SummaryMetric label="Empresas ativas" value={activeCompaniesCount} detail="Operacionais" tone="positive" />
        <SummaryMetric label="Empresas inativas" value={inactiveCompaniesCount} detail="Pedem revisão" tone="muted" />
        <SummaryMetric label="Com aviso" value={warningCompaniesCount} detail="Sinais de importação" tone="warning" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <div className="min-w-0 space-y-5">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Filtros da consulta</CardTitle>
                  <CardDescription className="mt-1">Combine texto, município e status para refinar a lista.</CardDescription>
                </div>
                <span className="group relative inline-flex">
                  <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40" aria-label="Ver critérios de status">
                    <CircleHelpIcon className="size-4" aria-hidden="true" />
                  </button>
                  <span className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-5 text-foreground opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <span className="block whitespace-pre-line">{criteriaTooltip}</span>
                  </span>
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(9rem,0.5fr)_minmax(8.5rem,0.38fr)_auto] md:items-end" action="/companies" method="get">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="q">Buscar por identidade</label>
                  <Input id="q" name="q" defaultValue={q} placeholder="CNPJ, razão social, fantasia..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="municipio">Município</label>
                  <Input id="municipio" name="municipio" defaultValue={municipio} placeholder="Cidade ou UF" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="status">Status</label>
                  <select id="status" name="status" defaultValue={status} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
                    <option value="all">Todos</option>
                    <option value="active">Ativas</option>
                    <option value="inactive">Inativas</option>
                  </select>
                </div>
                <Button type="submit" className="w-full md:w-auto"><SearchIcon className="size-4" />Buscar</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-none">
            <CardHeader className="pb-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Resultados</CardTitle>
                <CardDescription className="mt-1">{hasSearch ? `${total} registro${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}.` : "Use os filtros acima para iniciar a consulta."}</CardDescription>
              </div>
              <CompanyExportButton q={q} municipio={municipio} status={status} disabled={!hasSearch || dataUnavailable} />
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              {hasSearch ? (
                items.length ? items.map((company) => (
                  <article key={company.id} className={cn("group rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/20", company.importWarning ? "border-amber-300/70 bg-amber-50/35" : "border-border/80 bg-background")}>
                    <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-medium text-foreground">{company.razaoSocial || company.nomeFantasia || "(sem nome)"}</h3><Badge variant={company.ativo ? "secondary" : "outline"}>{company.ativo ? "Ativa" : "Inativa"}</Badge></div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{company.razaoSocial && company.nomeFantasia && company.razaoSocial !== company.nomeFantasia ? company.nomeFantasia : "Sem nome fantasia"}</p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{company.cnpjNumerico ? <span>CNPJ {formatCnpjDisplay(company.cnpjNumerico)}</span> : null}{company.codigoInterno ? <span>Código {company.codigoInterno}</span> : null}{company.municipio ? <span>{company.municipio}</span> : null}{company.regimeTributario ? <span>{company.regimeTributario}</span> : null}</div>
                      </div>
                      <div className="text-sm md:text-right">{company.importWarning ? <p className="font-medium text-amber-800">Aviso na importação</p> : <p className="text-muted-foreground">Dados consistentes</p>}<p className="mt-1 text-xs text-muted-foreground">{company.importWarning ? "Revisar antes de usar" : "Pronto para consulta"}</p></div>
                      <Button asChild size="sm" variant="outline" className="w-full md:w-auto"><Link href={`/companies/${company.id}`}>Ver detalhes</Link></Button>
                    </div>
                  </article>
                )) : <EmptyResults unavailable={dataUnavailable} />
              ) : <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">Preencha a busca ou escolha um status para listar empresas.</div>}

              {hasSearch ? <nav aria-label="Paginação de empresas" className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-2 py-3 text-sm"><Link href={buildHref({ q, status, municipio, page: Math.max(1, page - 1) })} aria-disabled={page <= 1} className={cn("rounded-lg px-3 py-2 transition hover:bg-muted", page <= 1 && "pointer-events-none opacity-40")}>Anterior</Link><span className="text-muted-foreground">Página {page} de {totalPages} · {currentPageWarnings} aviso{currentPageWarnings === 1 ? "" : "s"} nesta página</span><Link href={buildHref({ q, status, municipio, page: Math.min(totalPages, page + 1) })} aria-disabled={page >= totalPages} className={cn("rounded-lg px-3 py-2 transition hover:bg-muted", page >= totalPages && "pointer-events-none opacity-40")}>Próxima</Link></nav> : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-2"><CardTitle>Leitura rápida</CardTitle><CardDescription className="mt-1">O estado da seleção atual.</CardDescription></CardHeader>
            <CardContent className="space-y-4 pt-5 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4"><SummaryPair label="Status" value={status === "all" ? "Todas" : status === "active" ? "Ativas" : "Inativas"} /><SummaryPair label="Resultados" value={hasSearch ? String(total) : "—"} /><SummaryPair label="Página" value={hasSearch ? `${page} / ${totalPages}` : "—"} /><SummaryPair label="Avisos" value={hasSearch ? String(currentPageWarnings) : "—"} /></dl>
              <div className="rounded-lg bg-muted/50 p-4 text-muted-foreground"><p className="font-medium text-foreground">Critérios de status</p><p className="mt-2 whitespace-pre-line text-xs leading-5">{criteriaTooltip}</p></div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-2"><CardTitle>Ações diretas</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-5">{session.role === "ADMIN" ? <QuickLink href="/import" label="Importar planilha" icon={<PlusIcon className="size-4" />} /> : null}<QuickLink href="/import/history" label="Ver histórico" icon={<SearchIcon className="size-4" />} /><QuickLink href="/companies/contracts" label="Tabela Empresas" icon={<DownloadIcon className="size-4" />} /><QuickLink href="/dashboard" label="Painel principal" icon={<CircleHelpIcon className="size-4" />} /></CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SummaryMetric(props: { label: string; value: number; detail: string; tone?: "positive" | "muted" | "warning" }) {
  return <div className="bg-card px-4 py-4 sm:px-5"><p className="text-xs font-medium text-muted-foreground">{props.label}</p><p className={cn("mt-2 text-2xl font-semibold tracking-tight", props.tone === "positive" && "text-emerald-700", props.tone === "warning" && "text-amber-700")}>{props.value.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-muted-foreground">{props.detail}</p></div>;
}

function SummaryPair(props: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{props.label}</dt><dd className="mt-1 font-medium text-foreground">{props.value}</dd></div>;
}

function QuickLink(props: { href: string; label: string; icon: React.ReactNode }) {
  return <Button asChild variant="ghost" className="w-full justify-between rounded-lg px-3"><Link href={props.href}>{props.label}{props.icon}</Link></Button>;
}

function EmptyResults(props: { unavailable: boolean }) {
  return <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">{props.unavailable ? "A base está temporariamente indisponível. Tente novamente em instantes." : "Nenhum registro encontrado para estes filtros."}</div>;
}
