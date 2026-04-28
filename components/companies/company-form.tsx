"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type CompanyFormData = {
  codigoInterno?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  grupo?: string | null;
  regimeTributario?: string | null;
  sistema?: string | null;
  certificado?: string | null;
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
    codigoInterno: props.initial?.codigoInterno ?? "",
    razaoSocial: props.initial?.razaoSocial ?? "",
    nomeFantasia: props.initial?.nomeFantasia ?? "",
    cnpj: props.initial?.cnpj ?? "",
    grupo: props.initial?.grupo ?? "",
    regimeTributario: props.initial?.regimeTributario ?? "",
    sistema: props.initial?.sistema ?? "",
    certificado: props.initial?.certificado ?? "",
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
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="codigoInterno">Código interno</Label>
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
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" placeholder="(MVP) Campo livre para notas internas." disabled />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

