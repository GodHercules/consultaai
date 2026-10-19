"use client";

import { useState } from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

type SearchStatus = "all" | "active" | "inactive";
type CompanyExportItem = {
  id: string;
  codigoInterno?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpjNumerico?: string | null;
  municipio?: string | null;
  regimeTributario?: string | null;
  sistema?: string | null;
  certificado?: string | null;
  ativo: boolean;
  observacao?: string | null;
  importWarning?: string | null;
};

function safeCell(value: unknown) {
  const text = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown) {
  return `"${safeCell(value).replaceAll('"', '""')}"`;
}

export function CompanyExportButton(props: { q: string; municipio: string; status: SearchStatus; disabled?: boolean }) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleExport() {
    setExporting(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ pageSize: "50", sort: "name" });
      if (props.q.trim()) query.set("q", props.q.trim());
      if (props.municipio.trim()) query.set("municipio", props.municipio.trim());
      if (props.status === "active") query.set("ativo", "true");
      if (props.status === "inactive") query.set("ativo", "false");

      const firstResponse = await fetch(`/api/companies?${query.toString()}`, { credentials: "include" });
      if (!firstResponse.ok) throw new Error("export unavailable");
      const firstPage = (await firstResponse.json()) as { total?: number; items?: CompanyExportItem[]; pageSize?: number };
      const allItems = [...(firstPage.items ?? [])];
      const total = firstPage.total ?? allItems.length;
      const pageSize = firstPage.pageSize ?? 50;
      const pages = Math.ceil(total / pageSize);

      for (let page = 2; page <= pages; page += 1) {
        const params = new URLSearchParams(query);
        params.set("page", String(page));
        const response = await fetch(`/api/companies?${params.toString()}`, { credentials: "include" });
        if (!response.ok) throw new Error("export unavailable");
        const data = (await response.json()) as { items?: CompanyExportItem[] };
        allItems.push(...(data.items ?? []));
      }

      const headers = ["ID", "Código interno", "Razão social", "Nome fantasia", "CNPJ", "Município", "Regime tributário", "Sistema", "Certificado", "Status", "Observação", "Aviso de importação"];
      const rows = allItems.map((item) => [item.id, item.codigoInterno, item.razaoSocial, item.nomeFantasia, item.cnpjNumerico, item.municipio, item.regimeTributario, item.sistema, item.certificado, item.ativo ? "Ativa" : "Inativa", item.observacao, item.importWarning].map(csvCell).join(";"));
      const csv = `\uFEFF${headers.map(csvCell).join(";")}\n${rows.join("\n")}`;
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `consulta-empresas-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`${allItems.length} registro${allItems.length === 1 ? "" : "s"} exportado${allItems.length === 1 ? "" : "s"}.`);
    } catch {
      setMessage("Não foi possível exportar agora. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  return <div className="flex flex-wrap items-center justify-end gap-2"><Button type="button" variant="outline" onClick={handleExport} disabled={props.disabled || exporting} aria-describedby="company-export-status"><DownloadIcon className="size-4" />{exporting ? <><Loader2Icon className="size-4 animate-spin" />Preparando CSV</> : "Exportar CSV"}</Button><span id="company-export-status" className="sr-only" aria-live="polite">{message}</span></div>;
}
