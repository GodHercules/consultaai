import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CompaniesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1"));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const where = q
    ? {
        OR: [
          { razaoSocial: { contains: q, mode: "insensitive" as const } },
          { nomeFantasia: { contains: q, mode: "insensitive" as const } },
          { codigoInterno: { contains: q, mode: "insensitive" as const } },
          { cnpjNumerico: { startsWith: q.replace(/\D+/g, "") } },
        ],
      }
    : {};

  const [total, items] = await Promise.all([
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
        cnpj: true,
        cnpjNumerico: true,
        grupo: true,
        sistema: true,
        certificado: true,
        ativo: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Consulta avançada</h1>
          <p className="text-sm text-muted-foreground">
            Busca rápida por CNPJ, razão social, fantasia, grupo e mais.
          </p>
        </div>
        {session.user.role === "ADMIN" ? (
          <Link href="/companies/new" className="text-sm underline">
            Cadastrar empresa
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Use texto livre ou CNPJ parcial.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" action="/companies" method="get">
            <Input name="q" defaultValue={q} placeholder="CNPJ, razão social, fantasia..." />
            <Button type="submit">Buscar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>
            {total} registros • página {page} de {totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length ? (
            items.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-1 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.razaoSocial || c.nomeFantasia || "(sem nome)"}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.cnpjNumerico || c.cnpj || "-"} • {c.codigoInterno || "-"} • {c.grupo || "-"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.ativo ? "secondary" : "outline"}>{c.ativo ? "Ativa" : "Inativa"}</Badge>
                  <Link href={`/companies/${c.id}`} className="text-sm underline">
                    Detalhes
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum registro encontrado.</div>
          )}

          <div className="flex items-center justify-between pt-4 text-sm">
            <Link
              href={`/companies?q=${encodeURIComponent(q)}&page=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none text-muted-foreground" : "underline"}
            >
              Anterior
            </Link>
            <Link
              href={`/companies?q=${encodeURIComponent(q)}&page=${Math.min(totalPages, page + 1)}`}
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? "pointer-events-none text-muted-foreground" : "underline"}
            >
              Próxima
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

