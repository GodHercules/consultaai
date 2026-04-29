import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingCompaniesTable } from "@/components/admin/pending-companies-table";

export const dynamic = "force-dynamic";

export default async function PendingCompaniesPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const items = await prisma.pendingCompany.findMany({
    where: { status: "PENDING" },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      source: true,
      status: true,
      receivedAt: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpjNumerico: true,
      codigoInterno: true,
      grupo: true,
      sistema: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas recebidas (webhook)</h1>
        <p className="text-sm text-muted-foreground">
          Itens recebidos via webhook aguardando cadastro pelos administradores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendentes</CardTitle>
          <CardDescription>Até 50 registros (MVP).</CardDescription>
        </CardHeader>
        <CardContent>
          <PendingCompaniesTable
            initialItems={items.map((i) => ({ ...i, receivedAt: i.receivedAt.toISOString() }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

