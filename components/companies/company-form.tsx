"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type CompanyFormData = {
  qtd?: string | null;
  codigoInterno?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  observacao?: string | null;
  cnpj?: string | null;
  ehGrupo?: boolean | null;
  grupo?: string | null;
  regimeTributario?: string | null;
  sistema?: string | null;
  certificado?: string | null;
  anexo?: string | null;
  das?: string | null;
  municipio?: string | null;
  telefoneContato?: string | null;
  emailContato?: string | null;
  contractStartedAt?: string | null;
  contractEndedAt?: string | null;
  contractPredictedEndedAt?: string | null;
  ativo?: boolean | null;
};

export function CompanyForm(props: {
  mode: "create" | "edit";
  companyId?: string;
  initial?: CompanyFormData;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CompanyFormData>({
    qtd: props.initial?.qtd ?? "",
    codigoInterno: props.initial?.codigoInterno ?? "",
    razaoSocial: props.initial?.razaoSocial ?? "",
    nomeFantasia: props.initial?.nomeFantasia ?? "",
    observacao: props.initial?.observacao ?? "",
    cnpj: props.initial?.cnpj ?? "",
    ehGrupo: props.initial?.ehGrupo ?? null,
    grupo: props.initial?.grupo ?? "",
    regimeTributario: props.initial?.regimeTributario ?? "",
    sistema: props.initial?.sistema ?? "",
    certificado: props.initial?.certificado ?? "",
    anexo: props.initial?.anexo ?? "",
    das: props.initial?.das ?? "",
    municipio: props.initial?.municipio ?? "",
    telefoneContato: props.initial?.telefoneContato ?? "",
    emailContato: props.initial?.emailContato ?? "",
    contractStartedAt: props.initial?.contractStartedAt ?? "",
    contractEndedAt: props.initial?.contractEndedAt ?? "",
    contractPredictedEndedAt: props.initial?.contractPredictedEndedAt ?? "",
  });

  function set<K extends keyof CompanyFormData>(key: K, value: CompanyFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const url =
        props.mode === "create"
          ? "/api/companies"
          : `/api/companies/${props.companyId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível salvar", {
          description: data?.error || "Verifique os dados.",
        });
        return;
      }
      toast.success("Empresa salva com sucesso.");
      router.replace(`/companies/${data.company.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.mode === "create" ? "Cadastro empresa" : "Editar empresa"}</CardTitle>
        <CardDescription>
          Preencha os dados base da empresa. Os campos foram organizados para facilitar leitura e revisão.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="qtd">QTD</Label>
            <Input id="qtd" inputMode="numeric" value={form.qtd ?? ""} onChange={(e) => set("qtd", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigoInterno">CÓD</Label>
            <Input id="codigoInterno" value={form.codigoInterno ?? ""} onChange={(e) => set("codigoInterno", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input id="cnpj" value={form.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="razaoSocial">Razão social</Label>
            <Input id="razaoSocial" value={form.razaoSocial ?? ""} onChange={(e) => set("razaoSocial", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="nomeFantasia">Nome fantasia</Label>
            <Input id="nomeFantasia" value={form.nomeFantasia ?? ""} onChange={(e) => set("nomeFantasia", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="municipio">Município</Label>
            <Input id="municipio" value={form.municipio ?? ""} onChange={(e) => set("municipio", e.target.value)} placeholder="Cidade/UF" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefoneContato">Telefone de contato</Label>
            <Input
              id="telefoneContato"
              value={form.telefoneContato ?? ""}
              onChange={(e) => set("telefoneContato", e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emailContato">E-mail de contato</Label>
            <Input
              id="emailContato"
              type="email"
              value={form.emailContato ?? ""}
              onChange={(e) => set("emailContato", e.target.value)}
              placeholder="contato@empresa.com"
            />
          </div>

          <div className="md:col-span-2 rounded-2xl border border-border/70 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Contrato</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Datas que ajudam a visualizar a jornada da empresa com a operação.
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="contractStartedAt">Início do contrato</Label>
                <Input
                  id="contractStartedAt"
                  type="date"
                  value={form.contractStartedAt ?? ""}
                  onChange={(e) => set("contractStartedAt", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractEndedAt">Fim do contrato</Label>
                <Input
                  id="contractEndedAt"
                  type="date"
                  value={form.contractEndedAt ?? ""}
                  onChange={(e) => set("contractEndedAt", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractPredictedEndedAt">Previsão de fim</Label>
                <Input
                  id="contractPredictedEndedAt"
                  type="date"
                  value={form.contractPredictedEndedAt ?? ""}
                  onChange={(e) => set("contractPredictedEndedAt", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grupo">Grupo</Label>
            <Input id="grupo" value={form.grupo ?? ""} onChange={(e) => set("grupo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regimeTributario">Regime tributário</Label>
            <Input id="regimeTributario" value={form.regimeTributario ?? ""} onChange={(e) => set("regimeTributario", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sistema">Sistema</Label>
            <Input id="sistema" value={form.sistema ?? ""} onChange={(e) => set("sistema", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="certificado">Certificado</Label>
            <Input id="certificado" value={form.certificado ?? ""} onChange={(e) => set("certificado", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anexo">Anexo</Label>
            <Input id="anexo" value={form.anexo ?? ""} onChange={(e) => set("anexo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="das">DAS</Label>
            <Input id="das" value={form.das ?? ""} onChange={(e) => set("das", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ehGrupo">É grupo?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={form.ehGrupo === true ? "default" : "outline"}
                onClick={() => set("ehGrupo", true)}
                className="flex-1"
              >
                Sim
              </Button>
              <Button
                type="button"
                variant={form.ehGrupo === false ? "default" : "outline"}
                onClick={() => set("ehGrupo", false)}
                className="flex-1"
              >
                Não
              </Button>
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="observacao">Observações</Label>
            <Textarea
              id="observacao"
              value={form.observacao ?? ""}
              onChange={(e) => set("observacao", e.target.value)}
              placeholder="Notas internas da empresa."
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
