import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { AndamentosPanel } from "@/components/contabil/andamentos-panel";
import { PageHeader } from "@/components/app/page-header";
import { formatCnpjDisplay } from "@/utils/cnpj";

export const dynamic = "force-dynamic";

export default async function AndamentosContabilPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const allowed =
    session.user.role === "ADMIN" || session.user.department === "CONTABIL";
  if (!allowed) redirect("/companies");

  let companies: Array<{ id: string; razaoSocial: string | null; nomeFantasia: string | null; cnpjNumerico: string | null }> = [];
  let items: Array<{
    id: string;
    title: string;
    status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
    startDate: Date;
    endDate: Date;
    notes: string | null;
    createdAt: Date;
    company: { id: string; razaoSocial: string | null; nomeFantasia: string | null; cnpjNumerico: string | null };
    createdByUser: { id: string; name: string; email: string };
  }> = [];
  let dataUnavailable = false;

  try {
    [companies, items] = await Promise.all([
      prisma.company.findMany({
        where: { ativo: true },
        orderBy: [{ razaoSocial: "asc" }],
        take: 200,
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjNumerico: true },
      }),
      prisma.companyProgress.findMany({
        where: { createdByUserId: session.user.id },
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
  } catch {
    dataUnavailable = true;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Contábil"
        title="Andamentos"
        description="Envie andamentos por empresa com uma tela mais organizada e mais fácil de operar."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Andamentos (Contábil)" },
        ]}
      />

      <AndamentosPanel
        companies={companies.map((c) => ({
          id: c.id,
          label: `${c.razaoSocial || c.nomeFantasia || "(sem nome)"} • ${formatCnpjDisplay(c.cnpjNumerico)}`,
        }))}
          initialItems={items.map((i) => ({
            ...i,
            createdAt: i.createdAt.toISOString(),
            startDate: i.startDate.toISOString(),
            endDate: i.endDate.toISOString(),
          }))}
        />
      {dataUnavailable ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
          Dados temporariamente indisponíveis.
        </div>
      ) : null}
      </div>
  );
}
