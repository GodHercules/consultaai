import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleHelpIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import { formatCnpjDisplay } from "@/utils/cnpj";

export const dynamic = "force-dynamic";

type SearchStatus = "all" | "active" | "inactive";

function parseStatus(value: string | string[] | undefined): SearchStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "active" || raw === "inactive" || raw === "all") return raw;
  return "all";
}

function buildSearchWhere(q: string, status: SearchStatus): Prisma.CompanyWhereInput | null {
  const text = q.trim();
  const clauses: Prisma.CompanyWhereInput[] = [];

  if (text) {
    const digits = text.replace(/\D+/g, "");
    clauses.push({
      OR: [
        { razaoSocial: { contains: text, mode: "insensitive" } },
        { nomeFantasia: { contains: text, mode: "insensitive" } },
        { codigoInterno: { contains: text, mode: "insensitive" } },
        { municipio: { contains: text, mode: "insensitive" } },
        { regimeTributario: { contains: text, mode: "insensitive" } },
        ...(digits ? [{ cnpjNumerico: { startsWith: digits } }] : []),
      ],
    });
  }

  if (status === "active") clauses.push({ ativo: true });
  if (status === "inactive") clauses.push({ ativo: false });

  if (!clauses.length) return null;
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

function buildHref(base: { q: string; status: SearchStatus; page: number }) {
  const params = new URLSearchParams();
  if (base.q.trim()) params.set("q", base.q.trim());
  if (base.status !== "all") params.set("status", base.status);
  if (base.page > 1) params.set("page", String(base.page));
  const query = params.toString();
  return query ? `/companies?${query}` : "/companies";
}

export default async function CompaniesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = parseStatus(sp.status);
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1"));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const where = buildSearchWhere(q, status);
  const hasSearch = Boolean(where);
  let activeCompaniesCount = 0;
  let inactiveCompaniesCount = 0;
  let warningCompaniesCount = 0;
  let total = 0;
  let items: Array<{
    id: string;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    codigoInterno: string | null;
    cnpjNumerico: string | null;
    municipio: string | null;
    regimeTributario: string | null;
    ativo: boolean;
    importWarning: string | null;
  }> = [];
  let dataUnavailable = false;

  try {
    [activeCompaniesCount, inactiveCompaniesCount, warningCompaniesCount] = await Promise.all([
      prisma.company.count({ where: { ativo: true } }),
      prisma.company.count({ where: { ativo: false } }),
      prisma.company.count({ where: { importWarning: { not: null } } }),
    ]);

    if (where) {
      [total, items] = await Promise.all([
        prisma.company.count({ where }),
        prisma.company.findMany({
          where,
          orderBy: [{ ativo: "desc" }, { razaoSocial: "asc" }],
          skip,
          take: pageSize,
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
            codigoInterno: true,
            cnpjNumerico: true,
            municipio: true,
            regimeTributario: true,
            ativo: true,
            importWarning: true,
          },
        }),
      ]);
    }
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
    <div className="space-y-6 xl:grid xl:grid-cols-[minmax(0,1.06fr)_minmax(320px,0.54fr)] xl:items-start xl:gap-6">
      <div className="animate-glass-rise space-y-6">
        <PageHeader
          kicker="Pesquisa e triagem"
          title="Consulta avançada"
          description="Busque por CNPJ, razão social, fantasia, código interno, município, regime ou status. A interface foi desenhada para reduzir a fricção na leitura da base."
          actions={
            <>
              {session.user.role === "ADMIN" ? (
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
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total da base</CardDescription>
              <CardTitle>{totalCompaniesCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Empresas ativas e inativas cadastradas no banco.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Empresas ativas</CardDescription>
              <CardTitle>{activeCompaniesCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Base considerada operacional para uso normal.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Empresas inativas</CardDescription>
              <CardTitle>{inactiveCompaniesCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Registros que pedem atenção ou revisão.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Com aviso</CardDescription>
              <CardTitle>{warningCompaniesCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Sinais importados com observações ou alerta.
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Filtros
              <span className="group relative inline-flex items-center">
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
                  aria-label="Ver critérios de status"
                >
                  <CircleHelpIcon className="size-4" aria-hidden="true" />
                </button>
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-2xl border border-border/70 bg-popover/96 px-3 py-2 text-xs leading-5 text-foreground opacity-0 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.4)] transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <span className="block whitespace-pre-line">{criteriaTooltip}</span>
                </span>
              </span>
            </CardTitle>
            <CardDescription>Combine texto livre, CNPJ parcial e status para refinar a lista.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_180px_auto] md:items-end xl:grid-cols-[minmax(0,1.25fr)_180px_auto]"
              action="/companies"
              method="get"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="q">
                  Busca
                </label>
                <Input id="q" name="q" defaultValue={q} placeholder="CNPJ, razão social, fantasia..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={status}
                  className="h-10 w-full rounded-xl border border-input/80 bg-background/70 px-3 text-sm shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <option value="all">Todos</option>
                  <option value="active">Ativas</option>
                  <option value="inactive">Inativas</option>
                </select>
              </div>
              <Button type="submit" className="w-full md:w-auto">
                <SearchIcon className="size-4" />
                Buscar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
            <CardDescription>
              {hasSearch ? (
                <>
                  {total} registro{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}.
                </>
              ) : (
                <>Use os filtros acima para pesquisar empresas.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasSearch ? (
              items.length ? (
                items.map((c, index) => (
                  <div
                    key={c.id}
                    className={cn(
                      "flex flex-col gap-4 rounded-[1.35rem] border p-4 shadow-sm transition md:hover:-translate-y-0.5 md:hover:shadow-md xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.62fr)_auto] xl:items-center",
                      c.importWarning
                        ? "border-amber-200/80 bg-amber-50/55"
                        : "border-border/70 bg-background/60",
                      index === 0 && "ring-1 ring-sky-200/70"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-medium text-foreground">
                          {c.razaoSocial || c.nomeFantasia || "(sem nome)"}
                        </div>
                        <Badge variant={c.ativo ? "secondary" : "outline"}>
                          {c.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {c.razaoSocial && c.nomeFantasia && c.razaoSocial !== c.nomeFantasia
                          ? c.nomeFantasia
                          : "Sem nome fantasia"}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[0.72rem] text-muted-foreground">
                        {c.cnpjNumerico ? (
                          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                            CNPJ {formatCnpjDisplay(c.cnpjNumerico)}
                          </span>
                        ) : null}
                        {c.codigoInterno ? (
                          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                            Cód {c.codigoInterno}
                          </span>
                        ) : null}
                        {c.municipio ? (
                          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                            {c.municipio}
                          </span>
                        ) : null}
                        {c.regimeTributario ? (
                          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                            Tipo de tributação {c.regimeTributario}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      {c.importWarning ? <Badge variant="outline">Aviso na importação</Badge> : null}
                      <div className="text-xs text-muted-foreground xl:max-w-40 xl:text-right">
                        {c.importWarning ? "Rever dados marcados na importação." : "Leitura normal da base."}
                      </div>
                    </div>

                    <Button asChild size="sm" variant="outline" className="w-full xl:w-auto">
                      <Link href={`/companies/${c.id}`}>Detalhes</Link>
                    </Button>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
                  {dataUnavailable
                    ? "Base temporariamente indisponível. Tente novamente em instantes."
                    : "Nenhum registro encontrado."}
                </div>
              )
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
                {dataUnavailable
                  ? "Base temporariamente indisponível. Você ainda pode usar os atalhos laterais."
                  : "Preencha a busca ou escolha um status para listar empresas."}
              </div>
            )}

            {hasSearch ? (
              <div className="flex items-center justify-between pt-2 text-sm">
                <Link
                  href={buildHref({ q, status, page: Math.max(1, page - 1) })}
                  aria-disabled={page <= 1}
                  className={
                    page <= 1
                      ? "pointer-events-none inline-flex items-center justify-center rounded-xl px-3 py-2 text-muted-foreground opacity-40"
                      : "inline-flex items-center justify-center rounded-xl px-3 py-2 text-foreground transition hover:bg-muted/70"
                  }
                >
                  Anterior
                </Link>
                <div className="text-muted-foreground">
                  Página {page} de {totalPages}
                </div>
                <Link
                  href={buildHref({ q, status, page: Math.min(totalPages, page + 1) })}
                  aria-disabled={page >= totalPages}
                  className={
                    page >= totalPages
                      ? "pointer-events-none inline-flex items-center justify-center rounded-xl px-3 py-2 text-muted-foreground opacity-40"
                      : "inline-flex items-center justify-center rounded-xl px-3 py-2 text-foreground transition hover:bg-muted/70"
                  }
                >
                  Próxima
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <aside className="animate-glass-rise space-y-6 xl:sticky xl:top-6 [animation-delay:120ms]">
        <Card>
          <CardHeader>
            <CardDescription>Leitura rápida</CardDescription>
            <CardTitle>Resumo da busca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1rem] border border-border/70 bg-background/60 p-3">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">Status</div>
                <div className="mt-1 font-medium text-foreground">
                  {status === "all" ? "Todas" : status === "active" ? "Ativas" : "Inativas"}
                </div>
              </div>
              <div className="rounded-[1rem] border border-border/70 bg-background/60 p-3">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">Resultados</div>
                <div className="mt-1 font-medium text-foreground">{hasSearch ? total : 0}</div>
              </div>
              <div className="rounded-[1rem] border border-border/70 bg-background/60 p-3">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">Página</div>
                <div className="mt-1 font-medium text-foreground">
                  {hasSearch ? `${page} / ${totalPages}` : "—"}
                </div>
              </div>
              <div className="rounded-[1rem] border border-border/70 bg-background/60 p-3">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">Avisos</div>
                <div className="mt-1 font-medium text-foreground">{currentPageWarnings}</div>
              </div>
            </div>

            <div className="rounded-[1.1rem] border border-dashed border-border/70 bg-background/50 p-4 text-muted-foreground">
              <p className="text-xs uppercase tracking-[0.28em]">Critérios</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6">{criteriaTooltip}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Atalhos</CardDescription>
            <CardTitle>Ações diretas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {session.user.role === "ADMIN" ? (
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/import">
                  Importar planilha
                  <PlusIcon className="size-4" />
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href="/import/history">
                Ver histórico
                <SearchIcon className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href="/companies/contracts">
                Tabela Empresas
                <SearchIcon className="size-4" />
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
