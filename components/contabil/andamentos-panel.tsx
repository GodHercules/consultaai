"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type CompanyOption = { id: string; label: string };

type ProgressItem = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  startDate: string;
  endDate: string;
  notes: string | null;
  createdAt: string;
  company: { id: string; razaoSocial: string | null; nomeFantasia: string | null; cnpjNumerico: string | null };
  createdByUser: { id: string; name: string; email: string };
};

export function AndamentosPanel(props: { companies: CompanyOption[]; initialItems: ProgressItem[] }) {
  const router = useRouter();
  const companies = useMemo(() => props.companies, [props.companies]);
  const items = useMemo(() => props.initialItems, [props.initialItems]);

  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ProgressItem["status"]>("TODO");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  async function create() {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/company-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId,
          title,
          status,
          startDate,
          endDate,
          notes: notes || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível enviar", { description: data?.error || "Tente novamente." });
        return;
      }
      toast.success("Andamento enviado.");
      setTitle("");
      setNotes("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo andamento</CardTitle>
          <CardDescription>Envie um andamento por empresa. Administradores acompanham em visão consolidada.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Fechamento 04/2026" />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) =>
                setStatus(v === "TODO" || v === "IN_PROGRESS" || v === "DONE" || v === "BLOCKED" ? v : "TODO")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODO">TODO</SelectItem>
                <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                <SelectItem value="DONE">DONE</SelectItem>
                <SelectItem value="BLOCKED">BLOCKED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fim</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes, bloqueios, dependências..." />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button disabled={loading || !companyId || title.trim().length < 2} onClick={create}>
            {loading ? "Enviando..." : "Enviar"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meus últimos andamentos</CardTitle>
          <CardDescription>Até 50 registros.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length ? (
            items.map((i) => (
              <div key={i.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{i.title}</div>
                    <div className="truncate text-muted-foreground">
                      {(i.company.razaoSocial || i.company.nomeFantasia || "(sem nome)") as string} •{" "}
                      {i.company.cnpjNumerico || "-"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i.status}</Badge>
                    <Badge variant="secondary">
                      {i.startDate.slice(0, 10)} → {i.endDate.slice(0, 10)}
                    </Badge>
                  </div>
                </div>
                {i.notes ? <div className="mt-2 text-muted-foreground">{i.notes}</div> : null}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum andamento enviado ainda.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
