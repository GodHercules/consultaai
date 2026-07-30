"use client";

import { apiFetch } from "@/lib/api-client";
import { useState } from "react";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCnpjDisplay } from "@/utils/cnpj";
import { isBlank, TAXATION_LABELS, TAXATION_TYPES, TAX_REGIME_LABELS, TAX_REGIMES, type CnaeActivity } from "@/utils/company";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CompanyFormData = {
  qtd?: string | null;
  codigoInterno?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  observacao?: string | null;
  cnpj?: string | null;
  inscricaoMunicipal?: string | null;
  ehGrupo?: boolean | null;
  grupo?: string | null;
  regimeTributario?: string | null;
  sistema?: string | null;
  certificado?: string | null;
  anexo?: string | null;
  das?: string | null;
  municipio?: string | null;
  uf?: string | null;
  telefoneContato?: string | null;
  emailContato?: string | null;
  atividadesCnae?: CnaeActivity[] | null;
  ativo?: boolean | null;
};

function normalizeDigits(value: string) {
  return value.replace(/\D+/g, "");
}

function formatCnpjInput(value: string) {
  const digits = normalizeDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function CompanyForm(props: {
  mode: "create" | "edit";
  companyId?: string;
  initial?: CompanyFormData;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const automaticLookupDone = useRef(false);
  const [form, setForm] = useState<CompanyFormData>({
    qtd: props.initial?.qtd ?? "",
    codigoInterno: props.initial?.codigoInterno ?? "",
    razaoSocial: props.initial?.razaoSocial ?? "",
    nomeFantasia: props.initial?.nomeFantasia ?? "",
    observacao: props.initial?.observacao ?? "",
    cnpj: props.initial?.cnpj ? formatCnpjDisplay(props.initial.cnpj) : "",
    inscricaoMunicipal: props.initial?.inscricaoMunicipal ?? "",
    ehGrupo: props.initial?.ehGrupo ?? null,
    grupo: props.initial?.grupo ?? "",
    regimeTributario: props.initial?.regimeTributario ?? "",
    sistema: props.initial?.sistema ?? "",
    certificado: props.initial?.certificado ?? "",
    anexo: props.initial?.anexo ?? "",
    das: props.initial?.das ?? "",
    municipio: props.initial?.municipio ?? "",
    uf: props.initial?.uf ?? "",
    telefoneContato: props.initial?.telefoneContato ?? "",
    emailContato: props.initial?.emailContato ?? "",
    atividadesCnae: props.initial?.atividadesCnae ?? [],
  });

  function set<K extends keyof CompanyFormData>(key: K, value: CompanyFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const lookupByCnpj = useCallback(async function lookupByCnpj() {
    if (lookupLoading) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const response = await apiFetch(`/api/companies/cnpj-lookup?cnpj=${encodeURIComponent(form.cnpj ?? "")}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "PROVIDER_UNAVAILABLE");
      const data = payload.data;
      setForm((current) => ({
        ...current,
        razaoSocial: isBlank(current.razaoSocial) ? data.razaoSocial ?? current.razaoSocial : current.razaoSocial,
        municipio: isBlank(current.municipio) ? data.municipio ?? current.municipio : current.municipio,
        uf: isBlank(current.uf) ? data.uf ?? current.uf : current.uf,
        telefoneContato: isBlank(current.telefoneContato) ? data.telefones?.[0] ?? current.telefoneContato : current.telefoneContato,
        emailContato: isBlank(current.emailContato) ? data.email ?? current.emailContato : current.emailContato,
        atividadesCnae: !current.atividadesCnae?.length && data.atividades?.length ? data.atividades : current.atividadesCnae,
      }));
      toast.success("Dados encontrados", { description: "Revise as sugestões antes de salvar." });
    } catch (error) {
      const code = error instanceof Error ? error.message : "PROVIDER_UNAVAILABLE";
      const messages: Record<string, string> = {
        INVALID_CNPJ: "CNPJ inválido. Confira os dígitos antes de consultar.",
        COMPANY_NOT_FOUND: "Empresa não encontrada para este CNPJ.",
        RATE_LIMITED: "Limite de consultas atingido. Tente novamente mais tarde.",
        PROVIDER_TIMEOUT: "A consulta excedeu o tempo limite.",
        INCOMPLETE_RESPONSE: "O provedor retornou dados incompletos.",
        PROVIDER_UNAVAILABLE: "Não foi possível consultar o provedor agora.",
      };
      setLookupError(messages[code] ?? "Falha na consulta. Você pode continuar editando manualmente.");
    } finally {
      setLookupLoading(false);
    }
  }, [form.cnpj, lookupLoading]);

  useEffect(() => {
    if (props.mode !== "edit" || automaticLookupDone.current) return;
    automaticLookupDone.current = true;
    const missing = [form.municipio, form.telefoneContato, form.emailContato].some(isBlank) || !form.atividadesCnae?.length;
    if (missing && form.cnpj) {
      const timer = window.setTimeout(() => void lookupByCnpj(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [form.atividadesCnae?.length, form.cnpj, form.emailContato, form.municipio, form.telefoneContato, lookupByCnpj, props.mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.regimeTributario || !form.certificado) {
      toast.error("Selecione o tipo de tributação e o regime.");
      return;
    }
    setLoading(true);
    try {
      const url = props.mode === "create" ? "/api/companies" : `/api/companies/${props.companyId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await apiFetch(url, {
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
            <Label htmlFor="inscricaoMunicipal">Inscrição Municipal (CGA)</Label>
            <Input id="inscricaoMunicipal" value={form.inscricaoMunicipal ?? ""} onChange={(e) => set("inscricaoMunicipal", e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={form.cnpj ?? ""}
              onChange={(e) => set("cnpj", formatCnpjInput(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="razaoSocial">Razão social</Label>
            <Input id="razaoSocial" value={form.razaoSocial ?? ""} onChange={(e) => set("razaoSocial", e.target.value)} />
          </div>
          {props.mode === "edit" ? (
            <div className="md:col-span-2 rounded-2xl border border-dashed border-border/70 bg-background/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label>Consulta cadastral pelo CNPJ</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Preenche somente campos vazios e sempre permite revisão manual.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => void lookupByCnpj()} disabled={lookupLoading || loading}>
                  {lookupLoading ? "Consultando..." : "Atualizar dados pelo CNPJ"}
                </Button>
              </div>
              {lookupError ? <p role="alert" className="mt-3 text-sm text-destructive">{lookupError}</p> : null}
            </div>
          ) : null}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="nomeFantasia">Nome fantasia</Label>
            <Input id="nomeFantasia" value={form.nomeFantasia ?? ""} onChange={(e) => set("nomeFantasia", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="municipio">Município</Label>
            <Input id="municipio" value={form.municipio ?? ""} onChange={(e) => set("municipio", e.target.value)} placeholder="Cidade/UF" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uf">UF</Label>
            <Input id="uf" value={form.uf ?? ""} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
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

          <div className="space-y-2">
            <Label htmlFor="grupo">Grupo</Label>
            <Input id="grupo" value={form.grupo ?? ""} onChange={(e) => set("grupo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regimeTributario">Tipo de tributação</Label>
            <Select value={form.regimeTributario ?? undefined} onValueChange={(value) => set("regimeTributario", value)}>
              <SelectTrigger id="regimeTributario"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{TAXATION_TYPES.map((value) => <SelectItem key={value} value={value}>{TAXATION_LABELS[value]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sistema">Sistema</Label>
            <Input id="sistema" value={form.sistema ?? ""} onChange={(e) => set("sistema", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="certificado">Regime</Label>
            <Select value={form.certificado ?? undefined} onValueChange={(value) => set("certificado", value)}>
              <SelectTrigger id="certificado"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{TAX_REGIMES.map((value) => <SelectItem key={value} value={value}>{TAX_REGIME_LABELS[value]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div><Label>Atividades — CNAEs</Label><p className="mt-1 text-xs text-muted-foreground">Informe código e descrição; a primeira atividade é principal.</p></div>
              <Button type="button" variant="outline" onClick={() => set("atividadesCnae", [...(form.atividadesCnae ?? []), { codigo: "", descricao: "", principal: !(form.atividadesCnae?.length) }])}>Adicionar CNAE</Button>
            </div>
            {(form.atividadesCnae ?? []).map((activity, index) => (
              <div key={`${index}-${activity.codigo}`} className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-[140px_1fr_auto]">
                <Input aria-label={`Código CNAE ${index + 1}`} value={activity.codigo} onChange={(e) => { const next = [...(form.atividadesCnae ?? [])]; next[index] = { ...activity, codigo: e.target.value }; set("atividadesCnae", next); }} placeholder="0000-0/00" />
                <Input aria-label={`Descrição CNAE ${index + 1}`} value={activity.descricao} onChange={(e) => { const next = [...(form.atividadesCnae ?? [])]; next[index] = { ...activity, descricao: e.target.value }; set("atividadesCnae", next); }} placeholder="Descrição da atividade" />
                <Button type="button" variant="ghost" onClick={() => set("atividadesCnae", (form.atividadesCnae ?? []).filter((_, itemIndex) => itemIndex !== index))}>Remover</Button>
              </div>
            ))}
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
              <Button type="submit" disabled={loading || lookupLoading} className="w-full sm:w-auto">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
