import { redirect } from "next/navigation";
import { backendFetch, getBackendSession } from "@/lib/server-backend";
import { AndamentosPanel } from "@/components/contabil/andamentos-panel";
import { PageHeader } from "@/components/app/page-header";
import { formatCnpjDisplay } from "@/utils/cnpj";

export const dynamic = "force-dynamic";

export default async function AndamentosContabilPage() {
  const session = await getBackendSession() as { id?: string; role?: string; department?: string | null } | null;
  if (!session) redirect("/login");

  const allowed =
    session.role === "ADMIN" || session.department === "CONTABIL";
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
      backendFetch("/api/companies?ativo=true&page=1&pageSize=200").then(async (response) => (await response.json()).items ?? []),
      backendFetch("/api/company-progress?take=50").then(async (response) => (await response.json()).items ?? []),
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
            createdAt: new Date(i.createdAt).toISOString(),
            startDate: new Date(i.startDate).toISOString(),
            endDate: new Date(i.endDate).toISOString(),
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
