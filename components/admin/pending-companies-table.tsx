"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type PendingCompanyListItem = {
  id: string;
  source: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  receivedAt: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpjNumerico: string | null;
  codigoInterno: string | null;
  grupo: string | null;
  sistema: string | null;
};

export function PendingCompaniesTable(props: { initialItems: PendingCompanyListItem[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const items = useMemo(() => props.initialItems, [props.initialItems]);

  async function approve(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/pending-companies/${id}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível aprovar", { description: data?.error || "Tente novamente." });
        return;
      }
      toast.success("Empresa cadastrada com sucesso.");
      if (data?.companyId) router.push(`/companies/${data.companyId}`);
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function reject(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/pending-companies/${id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível rejeitar", { description: data?.error || "Tente novamente." });
        return;
      }
      toast.success("Recebimento rejeitado.");
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {items.length ? (
        items.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-2 rounded-md border p-3 text-sm md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">
                {c.razaoSocial || c.nomeFantasia || "(sem nome)"}
              </div>
              <div className="truncate text-muted-foreground">
                {c.cnpjNumerico || "-"} • {c.codigoInterno || "-"} • {c.grupo || "-"} • {c.sistema || "-"}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{c.source}</Badge>
                <span>{new Date(c.receivedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={c.status === "PENDING" ? "secondary" : "outline"}>{c.status}</Badge>
              <Button
                size="sm"
                disabled={loadingId === c.id || c.status !== "PENDING"}
                onClick={() => approve(c.id)}
              >
                {loadingId === c.id ? "Processando..." : "Cadastrar"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loadingId === c.id || c.status !== "PENDING"}
                onClick={() => reject(c.id)}
              >
                Rejeitar
              </Button>
              <Link href="/companies/new" className="text-sm underline">
                Abrir form
              </Link>
            </div>
          </div>
        ))
      ) : (
        <div className="text-sm text-muted-foreground">Nenhum recebimento pendente.</div>
      )}
    </div>
  );
}

