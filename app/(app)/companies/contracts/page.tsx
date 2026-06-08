import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { SearchIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import {
  compareNullableDates,
  formatContractTenure,
  formatDateDisplay,
  getContractAgeDays,
} from "@/utils/contracts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchStatus = "all" | "active" | "inactive";
type SortKey = "tenure" | "name" | "recent" | "end" | "predicted";

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

const sortLabels: Record<SortKey, string> = {
  tenure: "Mais tempo com agente",
  name: "Nome A-Z",
  recent: "Contrato mais recente",
  end: "Fim de contrato",
  predicted: "Previsão de fim",
};

function parseStatus(value: string | string[] | undefined): SearchStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "active" || raw === "inactive" || raw === "all") return raw;
  return "all";
}

function parseSort(value: string | string[] | undefined): SortKey {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "name" || raw === "recent" || raw === "end" || raw === "predicted" || raw === "tenure") {
    return raw;
  }
  return "tenure";
}

function buildWhere(q: string, status: SearchStatus): Prisma.CompanyWhereInput | undefined {
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

  if (!clauses.length) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

function buildHref(base: { q: string; status: SearchStatus; sort: SortKey; page: number }) {
  const params = new URLSearchParams();
  if (base.q.trim()) params.set("q", base.q.trim());
  if (base.status !== "all") params.set("status", base.status);
  if (base.sort !== "tenure") params.set("sort", base.sort);
  if (base.page > 1) params.set("page", String(base.page));
  const query = params.toString();
  return query ? `/companies/contracts?${query}` : "/companies/contracts";
}

function formatCnpj(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D+/g, "");
  if (digits.length !== 14) return value ?? "";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function compareCompanyName(
  a: { razaoSocial: string | null; nomeFantasia: string | null },
  b: { razaoSocial: string | null; nomeFantasia: string | null },
) {
  return collator.compare(a.razaoSocial || a.nomeFantasia || "", b.razaoSocial || b.nomeFantasia || "");
}

function sortCompanies(
  items: Array<{
    id: string;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    codigoInterno: string | null;
    cnpjNumerico: string | null;
    municipio: string | null;
    regimeTributario: string | null;
    ativo: boolean;
    importWarning: string | null;
    contractStartedAt: Date | null;
    contractEndedAt: Date | null;
    contractPredictedEndedAt: Date | null;
    updatedAt: Date;
  }>,
  sort: SortKey,
) {
  return [...items].sort((a, b) => {
    if (sort === "name") return compareCompanyName(a, b);

    if (sort === "recent") {
      const diff = compareNullableDates(b.contractStartedAt, a.contractStartedAt, "asc");
      return diff !== 0 ? diff : compareCompanyName(a, b);
    }

    if (sort === "end") {
      const diff = compareNullableDates(a.contractEndedAt, b.contractEndedAt, "asc");
      return diff !== 0 ? diff : compareCompanyName(a, b);
    }

    if (sort === "predicted") {
      const diff = compareNullableDates(a.contractPredictedEndedAt, b.contractPredictedEndedAt, "asc");
      return diff !== 0 ? diff : compareCompanyName(a, b);
    }

    const tenureA = getContractAgeDays(a.contractStartedAt, a.contractEndedAt);
    const tenureB = getContractAgeDays(b.contractStartedAt, b.contractEndedAt);

    if (tenureA === null && tenureB === null) return compareCompanyName(a, b);
    if (tenureA === null) return 1;
    if (tenureB === null) return -1;
    if (tenureA !== tenureB) return tenureB - tenureA;

    const startedDiff = compareNullableDates(a.contractStartedAt, b.contractStartedAt, "asc");
    return startedDiff !== 0 ? startedDiff : compareCompanyName(a, b);
  });
}

function getDaysUntil(value: Date | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((value.getTime() - Date.now()) / 86_400_000));
}

export default async function CompanyContractsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = parseStatus(sp.status);
  const sort = parseSort(sp.sort);
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1"));
  const pageSize = 24;

  const where = buildWhere(q, status);

  const [total, rawItems] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
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
        contractStartedAt: true,
        contractEndedAt: true,
        contractPredictedEndedAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const sortedItems = sortCompanies(rawItems, sort);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * pageSize;
  const items = sortedItems.slice(skip, skip + pageSize);
  const currentPageMaxTenure = Math.max(
    0,
    ...items.map((item) => getContractAgeDays(item.contractStartedAt, item.contractEndedAt) ?? 0),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Consulta avançada"
        title="Tabela Empresas"
        description="Uma leitura única da base, com filtros no cabeçalho e foco total no contrato."
        breadcrumbs={[
          { label: "Consulta avançada", href: "/companies" },
          { label: "Tabela Empresas" },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/companies">Voltar para consulta</Link>
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-background/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle>Tabela Empresas</CardTitle>
              <CardDescription>
                {total} registro{total === 1 ? "" : "s"} na leitura atual. Os filtros e a ordenação ficam logo acima da tabela.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {sortLabels[sort]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <form
              action="/companies/contracts"
              method="get"
              className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_180px_auto] xl:items-end"
            >
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="page" value="1" />

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="q">
                  Busca
                </label>
                <Input id="q" name="q" defaultValue={q} placeholder="CNPJ, razão social, fantasia..." />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="sort">
                  Ordenação
                </label>
                <select
                  id="sort"
                  name="sort"
                  defaultValue={sort}
                  className="h-10 w-full rounded-xl border border-input/80 bg-background px-3 text-sm shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <option value="tenure">Mais tempo com agente</option>
                  <option value="name">Nome A-Z</option>
                  <option value="recent">Contrato mais recente</option>
                  <option value="end">Fim de contrato</option>
                  <option value="predicted">Previsão de fim</option>
                </select>
              </div>

              <Button type="submit" className="w-full xl:w-auto">
                <SearchIcon className="size-4" />
                Aplicar
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                variant={status === "all" ? "default" : "outline"}
                className={cn("rounded-full", status !== "all" && "bg-background/70")}
              >
                <Link href={buildHref({ q, status: "all", sort, page: 1 })}>Todas</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={status === "active" ? "default" : "outline"}
                className={cn("rounded-full", status !== "active" && "bg-background/70")}
              >
                <Link href={buildHref({ q, status: "active", sort, page: 1 })}>Ativas</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={status === "inactive" ? "default" : "outline"}
                className={cn("rounded-full", status !== "inactive" && "bg-background/70")}
              >
                <Link href={buildHref({ q, status: "inactive", sort, page: 1 })}>Inativas</Link>
              </Button>
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-[1.25rem] border border-border/70 bg-background/60">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[330px] uppercase tracking-[0.22em] text-muted-foreground">
                    Empresa
                  </TableHead>
                  <TableHead className="w-[110px] uppercase tracking-[0.22em] text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="w-[120px] uppercase tracking-[0.22em] text-muted-foreground">
                    Início
                  </TableHead>
                  <TableHead className="w-[120px] uppercase tracking-[0.22em] text-muted-foreground">
                    Fim
                  </TableHead>
                  <TableHead className="w-[140px] uppercase tracking-[0.22em] text-muted-foreground">
                    Previsão
                  </TableHead>
                  <TableHead className="w-[240px] uppercase tracking-[0.22em] text-muted-foreground">
                    Tempo com agente
                  </TableHead>
                  <TableHead className="w-[90px] uppercase tracking-[0.22em] text-muted-foreground">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {items.length ? (
                  items.map((company, index) => {
                    const tenureDays = getContractAgeDays(company.contractStartedAt, company.contractEndedAt);
                    const tenurePercent =
                      company.contractStartedAt && currentPageMaxTenure > 0 && tenureDays !== null
                        ? Math.max(10, Math.round((tenureDays / currentPageMaxTenure) * 100))
                        : 0;
                    const predictedDays = getDaysUntil(company.contractPredictedEndedAt);
                    const predictedSoon = predictedDays !== null && predictedDays <= 90;

                    return (
                      <TableRow
                        key={company.id}
                        className={cn("hover:bg-blue-50/40", index === 0 && "bg-blue-50/20")}
                      >
                        <TableCell className="whitespace-normal align-top">
                          <div className="space-y-1">
                            <div className="text-sm font-medium leading-6 text-foreground">
                              {company.razaoSocial || company.nomeFantasia || "(sem nome)"}
                            </div>
                            <div className="text-xs leading-5 text-muted-foreground">
                              <span>{company.nomeFantasia || "Sem nome fantasia"}</span>
                              <span className="mx-2">•</span>
                              <span>CNPJ {formatCnpj(company.cnpjNumerico)}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1 text-[0.72rem] text-muted-foreground">
                              {company.codigoInterno ? (
                                <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                                  Cód {company.codigoInterno}
                                </span>
                              ) : null}
                              {company.municipio ? (
                                <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                                  {company.municipio}
                                </span>
                              ) : null}
                              {company.regimeTributario ? (
                                <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                                  {company.regimeTributario}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="align-top">
                          <Badge
                            variant={company.ativo ? "default" : "outline"}
                            className={cn(
                              "rounded-full",
                              company.ativo
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-100 text-slate-700",
                            )}
                          >
                            {company.ativo ? "Ativa" : "Inativa"}
                          </Badge>
                          {company.importWarning ? (
                            <div className="mt-2 text-xs text-amber-700">Aviso de importação</div>
                          ) : null}
                        </TableCell>

                        <TableCell className="align-top whitespace-normal">
                          <div className="font-medium text-foreground">{formatDateDisplay(company.contractStartedAt)}</div>
                        </TableCell>

                        <TableCell className="align-top whitespace-normal">
                          <div className="font-medium text-foreground">{formatDateDisplay(company.contractEndedAt)}</div>
                        </TableCell>

                        <TableCell className="align-top whitespace-normal">
                          <div className="space-y-2">
                            <div className="font-medium text-foreground">
                              {formatDateDisplay(company.contractPredictedEndedAt)}
                            </div>
                            {predictedSoon ? (
                              <Badge
                                variant="outline"
                                className="rounded-full border-amber-200 bg-amber-50 text-amber-800"
                              >
                                Vence em {predictedDays} dia{predictedDays === 1 ? "" : "s"}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell className="align-top whitespace-normal">
                          <div className="space-y-2">
                            <div className="font-medium text-foreground">
                              {formatContractTenure(company.contractStartedAt, company.contractEndedAt) || "-"}
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-200 via-blue-500 to-blue-700 transition-all duration-700"
                                style={{ width: `${tenurePercent}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {tenureDays !== null
                                ? `${tenureDays} dia${tenureDays === 1 ? "" : "s"} de contrato`
                                : "Sem data de início"}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="align-top">
                          <Button asChild size="sm" variant="outline" className="rounded-full">
                            <Link href={`/companies/${company.id}`}>Abrir</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="px-6 py-10 text-sm text-muted-foreground">
                      Nenhuma empresa corresponde aos filtros atuais.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 text-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="text-muted-foreground">
              Página {currentPage} de {totalPages} • {total} registro{total === 1 ? "" : "s"}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Link
                href={buildHref({ q, status, sort, page: Math.max(1, currentPage - 1) })}
                aria-disabled={currentPage <= 1}
                className={
                  currentPage <= 1
                    ? "pointer-events-none inline-flex items-center justify-center rounded-xl px-3 py-2 text-muted-foreground opacity-40"
                    : "inline-flex items-center justify-center rounded-xl px-3 py-2 text-foreground transition hover:bg-muted/70"
                }
              >
                Anterior
              </Link>
              <Link
                href={buildHref({ q, status, sort, page: Math.min(totalPages, currentPage + 1) })}
                aria-disabled={currentPage >= totalPages}
                className={
                  currentPage >= totalPages
                    ? "pointer-events-none inline-flex items-center justify-center rounded-xl px-3 py-2 text-muted-foreground opacity-40"
                    : "inline-flex items-center justify-center rounded-xl px-3 py-2 text-foreground transition hover:bg-muted/70"
                }
              >
                Próxima
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
