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
import { cn } from "@/lib/utils";
import { formatCnpjDisplay } from "@/utils/cnpj";

export const dynamic = "force-dynamic";

type SearchStatus = "all" | "active" | "inactive";
type SortKey = "recent" | "name";

const sortLabels: Record<SortKey, string> = {
  recent: "Mais recentes",
  name: "Nome A-Z",
};

function parseStatus(value: string | string[] | undefined): SearchStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "active" || raw === "inactive" || raw === "all") return raw;
  return "all";
}

function parseSort(value: string | string[] | undefined): SortKey {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "name") return "name";
  return "recent";
}

function parseText(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function buildWhere(q: string, status: SearchStatus, municipio: string): Prisma.CompanyWhereInput | undefined {
  const text = q.trim();
  const city = municipio.trim();
  const clauses: Prisma.CompanyWhereInput[] = [];

  if (text) {
    const digits = text.replace(/\D+/g, "");
    clauses.push({
      OR: [
        { razaoSocial: { contains: text, mode: "insensitive" } },
        { nomeFantasia: { contains: text, mode: "insensitive" } },
        { codigoInterno: { contains: text, mode: "insensitive" } },
        { regimeTributario: { contains: text, mode: "insensitive" } },
        ...(digits ? [{ cnpjNumerico: { startsWith: digits } }] : []),
      ],
    });
  }

  if (city) clauses.push({ municipio: { contains: city, mode: "insensitive" } });

  if (status === "active") clauses.push({ ativo: true });
  if (status === "inactive") clauses.push({ ativo: false });

  if (!clauses.length) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

function buildHref(base: { q: string; status: SearchStatus; municipio: string; sort: SortKey; page: number }) {
  const params = new URLSearchParams();
  if (base.q.trim()) params.set("q", base.q.trim());
  if (base.status !== "all") params.set("status", base.status);
  if (base.municipio.trim()) params.set("municipio", base.municipio.trim());
  if (base.sort !== "recent") params.set("sort", base.sort);
  if (base.page > 1) params.set("page", String(base.page));
  const query = params.toString();
  return query ? `/companies/contracts?${query}` : "/companies/contracts";
}

function compareCompanyName(
  a: { razaoSocial: string | null; nomeFantasia: string | null },
  b: { razaoSocial: string | null; nomeFantasia: string | null },
) {
  return (a.razaoSocial || a.nomeFantasia || "").localeCompare(b.razaoSocial || b.nomeFantasia || "", "pt-BR", {
    sensitivity: "base",
  });
}

export default async function CompanyContractsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const municipio = parseText(sp.municipio);
  const status = parseStatus(sp.status);
  const sort = parseSort(sp.sort);
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1"));
  const pageSize = 24;

  const where = buildWhere(q, status, municipio);

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
        updatedAt: true,
      },
    }),
  ]);

  const sortedItems = [...rawItems].sort((a, b) => {
    if (sort === "name") return compareCompanyName(a, b);
    const diff = b.updatedAt.getTime() - a.updatedAt.getTime();
    return diff !== 0 ? diff : compareCompanyName(a, b);
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * pageSize;
  const items = sortedItems.slice(skip, skip + pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Consulta avançada"
        title="Tabela Empresas"
        description="Uma leitura objetiva da base, com busca, status e informações essenciais da empresa."
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
              className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_180px_180px_auto] xl:items-end"
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
                  <option value="recent">Mais recentes</option>
                  <option value="name">Nome A-Z</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="municipio">
                  Município
                </label>
                <Input id="municipio" name="municipio" defaultValue={municipio} placeholder="Cidade/UF" />
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
                <Link href={buildHref({ q, status: "all", municipio, sort, page: 1 })}>Todas</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={status === "active" ? "default" : "outline"}
                className={cn("rounded-full", status !== "active" && "bg-background/70")}
              >
                <Link href={buildHref({ q, status: "active", municipio, sort, page: 1 })}>Ativas</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={status === "inactive" ? "default" : "outline"}
                className={cn("rounded-full", status !== "inactive" && "bg-background/70")}
              >
                <Link href={buildHref({ q, status: "inactive", municipio, sort, page: 1 })}>Inativas</Link>
              </Button>
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-[1.25rem] border border-border/70 bg-background/60">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[340px] uppercase tracking-[0.22em] text-muted-foreground">
                    Empresa
                  </TableHead>
                  <TableHead className="w-[110px] uppercase tracking-[0.22em] text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="w-[160px] uppercase tracking-[0.22em] text-muted-foreground">
                    CNPJ
                  </TableHead>
                  <TableHead className="w-[180px] uppercase tracking-[0.22em] text-muted-foreground">
                    Município
                  </TableHead>
                  <TableHead className="w-[220px] uppercase tracking-[0.22em] text-muted-foreground">
                    Tipo de tributação
                  </TableHead>
                  <TableHead className="w-[90px] uppercase tracking-[0.22em] text-muted-foreground">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {items.length ? (
                  items.map((company, index) => (
                    <TableRow key={company.id} className={cn("hover:bg-blue-50/40", index === 0 && "bg-blue-50/20")}>
                      <TableCell className="whitespace-normal align-top">
                        <div className="space-y-1">
                          <div className="text-sm font-medium leading-6 text-foreground">
                            {company.razaoSocial || company.nomeFantasia || "(sem nome)"}
                          </div>
                          <div className="text-xs leading-5 text-muted-foreground">
                            <span>{company.nomeFantasia || "Sem nome fantasia"}</span>
                            <span className="mx-2">•</span>
                            <span>Cód {company.codigoInterno || "-"}</span>
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
                        {company.importWarning ? <div className="mt-2 text-xs text-amber-700">Aviso de importação</div> : null}
                      </TableCell>

                      <TableCell className="align-top whitespace-normal text-sm font-medium text-foreground">
                        {formatCnpjDisplay(company.cnpjNumerico)}
                      </TableCell>

                      <TableCell className="align-top whitespace-normal text-sm text-foreground">
                        {company.municipio || "-"}
                      </TableCell>

                      <TableCell className="align-top whitespace-normal text-sm text-foreground">
                        {company.regimeTributario || "-"}
                      </TableCell>

                      <TableCell className="align-top">
                        <Button asChild size="sm" variant="outline" className="rounded-full">
                          <Link href={`/companies/${company.id}`}>Abrir</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="px-6 py-10 text-sm text-muted-foreground">
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
                href={buildHref({ q, status, municipio, sort, page: Math.max(1, currentPage - 1) })}
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
                href={buildHref({ q, status, municipio, sort, page: Math.min(totalPages, currentPage + 1) })}
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
