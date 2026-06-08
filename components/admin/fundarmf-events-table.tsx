"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FundarmfEventListItem = {
  id: string;
  eventType: string;
  deliveryId: string;
  fundarmfCaseId: string | null;
  companyCnpj: string | null;
  status: "RECEIVED" | "PROCESSING" | "PROCESSED" | "REVIEW_REQUIRED" | "FAILED" | "DUPLICATE";
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
};

function statusVariant(status: FundarmfEventListItem["status"]) {
  if (status === "PROCESSED") return "default";
  if (status === "REVIEW_REQUIRED") return "secondary";
  if (status === "FAILED") return "destructive";
  if (status === "PROCESSING") return "outline";
  if (status === "DUPLICATE") return "outline";
  return "outline";
}

function statusLabel(status: FundarmfEventListItem["status"]) {
  if (status === "REVIEW_REQUIRED") return "Revisão";
  return status;
}

export function FundarmfEventsTable(props: { items: FundarmfEventListItem[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function retryEvent(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/integrations/fundarmf/events/${id}/retry`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error("Não foi possível reprocessar", {
          description: body?.error || "Tente novamente.",
        });
        return;
      }

      toast.success("Evento reprocessado com sucesso.");
      startTransition(() => router.refresh());
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/55">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Caso / entrega</TableHead>
              <TableHead>Atualizado</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.items.length ? (
              props.items.map((item) => {
                const retryable = item.status === "FAILED" || item.status === "REVIEW_REQUIRED";
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[20rem] whitespace-normal">
                      <div className="font-medium text-foreground">{item.companyCnpj || "-"}</div>
                      <div className="text-xs text-muted-foreground">{item.eventType}</div>
                    </TableCell>
                    <TableCell className="max-w-[20rem] whitespace-normal">
                      <div className="text-sm text-foreground">{item.fundarmfCaseId || "-"}</div>
                      <div className="text-xs text-muted-foreground break-all">{item.deliveryId}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                      {item.processedAt ? (
                        <div className="mt-1 text-xs">Processado em {new Date(item.processedAt).toLocaleString("pt-BR")}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[22rem] whitespace-normal text-sm text-muted-foreground">
                      {item.errorMessage || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!retryable || loadingId === item.id || isPending}
                        onClick={() => retryEvent(item.id)}
                      >
                        {loadingId === item.id ? "Reprocessando..." : "Retry"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum evento encontrado com os filtros atuais.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
