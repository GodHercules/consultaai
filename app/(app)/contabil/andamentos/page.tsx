import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { AndamentosPanel } from "@/components/contabil/andamentos-panel";

export const dynamic = "force-dynamic";

export default async function AndamentosContabilPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const allowed =
    session.user.role === "ADMIN" || session.user.department === "CONTABIL";
  if (!allowed) redirect("/companies");

  const [companies, items] = await Promise.all([
    prisma.company.findMany({
      where: { ativo: true },
      orderBy: [{ razaoSocial: "asc" }],
      take: 200,
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjNumerico: true },
    }),
    prisma.companyProgress.findMany({
      where:
        session.user.role === "ADMIN"
          ? { createdByUserId: session.user.id }
          : { createdByUserId: session.user.id },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        notes: true,
        createdAt: true,
        company: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjNumerico: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Andamentos (Contábil)</h1>
        <p className="text-sm text-muted-foreground">
          Envio de andamento por empresa. Visível para administradores.
        </p>
      </div>

      <AndamentosPanel
        companies={companies.map((c) => ({
          id: c.id,
          label: `${c.razaoSocial || c.nomeFantasia || "(sem nome)"} • ${c.cnpjNumerico || "-"}`,
        }))}
        initialItems={items.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
          startDate: i.startDate.toISOString(),
          endDate: i.endDate.toISOString(),
        }))}
      />
    </div>
  );
}

