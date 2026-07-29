import Link from "next/link";
import { redirect } from "next/navigation";
import { getBackendSession } from "@/lib/server-backend";
import { ImportUpload } from "@/components/import/import-upload";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await getBackendSession();
  if (!session) redirect("/login");
  if ((session as { role?: string }).role !== "ADMIN") redirect("/companies");

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Carga em lote"
        title="Importação Excel"
        description="Envie planilhas com leitura automática de abas, normalização e upsert da base."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Importação Excel" },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/import/history">Ver histórico</Link>
          </Button>
        }
      />
      <ImportUpload />
    </div>
  );
}
