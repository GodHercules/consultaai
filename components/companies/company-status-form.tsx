"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function CompanyStatusForm(props: { companyId: string; ativo: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [motivo, setMotivo] = useState("");
  const nextAtivo = !props.ativo;

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${props.companyId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ativo: nextAtivo, motivo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível atualizar status", { description: data?.error || "Tente novamente." });
        return;
      }
      toast.success("Status atualizado.");
      router.replace(`/companies/${props.companyId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inativar/Reativar</CardTitle>
        <CardDescription>
          Não deletamos empresas. Registramos motivo, usuário e data na auditoria.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obrigatório)" />
        <p className="text-xs leading-5 text-muted-foreground">
          Descreva o contexto com clareza para facilitar auditoria e reativação futura.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={loading || motivo.trim().length < 3} className="w-full sm:w-auto">
          {loading ? "Salvando..." : nextAtivo ? "Reativar" : "Inativar"}
        </Button>
      </CardFooter>
    </Card>
  );
}
