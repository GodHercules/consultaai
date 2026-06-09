"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { ArrowRightIcon, FileTextIcon, FileUpIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportErrorPayload } from "@/services/import/errors";

type ImportPreview = {
  fileName: string;
  rowsRead: number;
  created: number;
  updated: number;
  ignored: number;
  suspectedDuplicates: number;
  duplicateGroups?: Array<{
    identityKey: string;
    identityKind: string;
    duplicateRows: number;
    rowNumbers: number[];
    sheetNames: string[];
    conflict: boolean;
    conflictReason?: string;
  }>;
  issues?: Array<{
    sheet: string;
    row: number;
    severity: "warning" | "error";
    message: string;
  }>;
  message?: string | null;
  hasChanges?: boolean;
};

function humanFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImportErrorPayload(value: unknown): value is ImportErrorPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      "code" in value &&
      "message" in value &&
      "correlationId" in value,
  );
}

const stageLabels: Record<string, string> = {
  request: "recepção da requisição",
  form: "leitura do formulário",
  file: "validação do arquivo",
  hash: "leitura do arquivo",
  history_lookup: "consulta de duplicidade",
  preview: "pré-visualização",
  process: "processamento e gravação",
  failure_log: "registro da falha",
  unknown: "etapa interna",
};

function errorMessage(error?: string | ImportErrorPayload | null) {
  const code = isImportErrorPayload(error) ? error.code : error;
  const message = isImportErrorPayload(error) ? error.message : null;
  const correlationId = isImportErrorPayload(error) ? error.correlationId : null;
  const stage = isImportErrorPayload(error) ? error.stage : null;
  const hint = isImportErrorPayload(error) ? error.hint : null;
  const prismaCode = isImportErrorPayload(error) ? error.details?.prismaCode : null;

  const pieces = [
    message,
    stage ? `Etapa: ${stageLabels[stage] ?? stage}` : null,
    hint,
    prismaCode ? `Prisma: ${prismaCode}` : null,
    correlationId ? `Ref: ${correlationId}` : null,
  ].filter(Boolean);

  switch (code) {
    case "DATABASE_UNAVAILABLE":
      return {
        title: "Banco indisponível",
        description:
          pieces.join(" · ") ||
          "A importação foi interrompida porque o banco não respondeu. Verifique as variáveis de ambiente e a conexão do banco.",
      };
    case "INVALID_FORM":
      return {
        title: "Envio inválido",
        description:
          pieces.join(" · ") ||
          "O formulário não pôde ser lido. Recarregue a página e tente novamente.",
      };
    case "FILE_REQUIRED":
      return {
        title: "Selecione um arquivo",
        description: pieces.join(" · ") || "Envie um arquivo .xlsx ou .xls para continuar.",
      };
    case "IMPORT_FAILED":
      return {
        title: "Falha na importação",
        description: pieces.join(" · ") || "Verifique o arquivo e tente novamente.",
      };
    default:
      return {
        title: "Falha na importação",
        description:
          pieces.join(" · ") ||
          `${message || (typeof error === "string" ? error : "Verifique o arquivo e tente novamente.")}`,
      };
  }
}

export function ImportUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [lastError, setLastError] = useState<ImportErrorPayload | null>(null);

  function openPicker() {
    inputRef.current?.click();
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setFileName(file?.name ?? null);
    setFileSize(file ? humanFileSize(file.size) : null);
    setPreview(null);
    setLastError(null);
  }

  async function submitImport(form: HTMLFormElement, dryRun: boolean) {
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      const error = {
        code: "FILE_REQUIRED",
        message: "Selecione um arquivo .xlsx ou .xls.",
        correlationId: "client",
      } satisfies ImportErrorPayload;
      setLastError(error);
      toast.error(errorMessage(error).title, { description: errorMessage(error).description });
      return;
    }

    if (dryRun) {
      setPreviewLoading(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/admin/import${dryRun ? "?dryRun=1" : ""}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      const apiError = isImportErrorPayload(data?.error) ? (data.error as ImportErrorPayload) : null;

      if (!res.ok) {
        const fallbackError: ImportErrorPayload = {
          code: "IMPORT_FAILED",
          message: "O servidor respondeu sem um detalhe legível.",
          correlationId: "unknown",
          stage: "unknown",
        };
        const normalizedError = apiError ?? fallbackError;
        setLastError(normalizedError);
        const message = errorMessage(normalizedError);
        toast.error(message.title, { description: message.description });
        return;
      }

      setLastError(null);

      if (dryRun) {
        setPreview((data?.preview ?? null) as ImportPreview | null);
        toast.success("Pré-visualização pronta.");
        return;
      }

      if (data?.reused) {
        toast.success("Arquivo já importado anteriormente.", {
          description: "Nenhuma alteração nova foi aplicada.",
        });
      } else {
        const report = data?.import?.report ?? data?.import ?? null;
        const noChangesMessage =
          report && typeof report === "object" && "hasChanges" in report && (report as { hasChanges?: boolean }).hasChanges === false
            ? (report as { message?: string | null }).message
            : null;

        if (noChangesMessage) {
          toast.success(noChangesMessage);
        } else {
          toast.success("Importação concluída.");
        }
      }
      router.push("/import/history");
      router.refresh();
    } catch (error) {
      const normalizedError: ImportErrorPayload = {
        code: "IMPORT_FAILED",
        message: error instanceof Error ? error.message : "Erro inesperado no navegador.",
        correlationId: "client",
        stage: "request",
      };
      setLastError(normalizedError);
      const message = errorMessage(normalizedError);
      toast.error(message.title, { description: message.description });
    } finally {
      if (dryRun) {
        setPreviewLoading(false);
      } else {
        setLoading(false);
      }
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitImport(event.currentTarget, false);
  }

  async function onPreview(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const form = event.currentTarget.closest("form");
    if (!form) return;
    await submitImport(form as HTMLFormElement, true);
  }

  const activeErrorMessage = lastError ? errorMessage(lastError) : null;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <Card className="border-slate-200 bg-white/92 shadow-[0_20px_56px_-40px_rgba(15,23,42,0.18)]">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                <FileUpIcon className="size-3.5" />
                Carga em lote
              </div>
              <CardTitle className="text-2xl">Importação Excel</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6">
                Lê as abas, usa o nome da planilha como referência fiscal e importa linha a linha com as
                regras de ativo/inativo.
              </CardDescription>
            </div>
            <Badge variant="outline" className="hidden border-slate-200 bg-slate-50 text-slate-600 md:inline-flex">
              XLSX / XLS
            </Badge>
          </div>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-4">
              <input
                ref={inputRef}
                name="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileChange}
                className="sr-only"
                aria-label="Selecionar arquivo de planilha"
              />

              <button
                type="button"
                onClick={openPicker}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-8 text-center transition hover:border-sky-200 hover:bg-sky-50/60"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                  <UploadIcon className="size-5" />
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-slate-950">Selecionar arquivo</span>
                  <span className="block text-sm text-slate-500">
                    Arraste e solte aqui ou toque para escolher uma planilha.
                  </span>
                </span>
              </button>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-sky-50 text-sky-700">
                  Normalização automática
                </Badge>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                  Deduplicação
                </Badge>
                <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                  Auditoria
                </Badge>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {fileName ? (
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-950">{fileName}</div>
                      <div className="text-xs text-slate-500">{fileSize ?? "Arquivo pronto para envio"}</div>
                    </div>
                    <div className="text-xs uppercase tracking-[0.24em] text-sky-700">Pronto</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500">
                    <FileTextIcon className="size-4 text-sky-600" />
                    Nenhum arquivo selecionado ainda.
                  </div>
                )}
              </div>
            </div>

            {lastError && activeErrorMessage ? (
              <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50/75 p-4 text-sm text-rose-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
                      Último erro
                    </div>
                    <div className="mt-1 text-base font-medium text-rose-950">{activeErrorMessage.title}</div>
                  </div>
                  <Badge variant="secondary" className="bg-white text-rose-700">
                    {lastError.code}
                  </Badge>
                </div>
                <div className="mt-2 leading-6 text-rose-900">{activeErrorMessage.description}</div>
              </div>
            ) : null}

            {preview ? (
              <div className="rounded-[1.4rem] border border-sky-200 bg-sky-50/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                      Pré-visualização
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {preview.fileName} · {preview.rowsRead} linhas lidas
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary" className="bg-white text-sky-700">
                      +{preview.created}
                    </Badge>
                    <Badge variant="secondary" className="bg-white text-slate-700">
                      ~{preview.updated}
                    </Badge>
                    <Badge variant="secondary" className="bg-white text-amber-700">
                      ign {preview.ignored}
                    </Badge>
                    <Badge variant="secondary" className="bg-white text-rose-700">
                      dup {preview.suspectedDuplicates}
                    </Badge>
                  </div>
                </div>

                {preview.issues?.length ? (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Primeiras ocorrências
                    </div>
                    <div className="max-h-56 space-y-2 overflow-auto pr-1">
                      {preview.issues.slice(0, 8).map((issue, index) => (
                        <div
                          key={`${issue.sheet}-${issue.row}-${index}`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                        >
                          <div className="font-medium text-slate-950">
                            {issue.sheet} · linha {issue.row}
                          </div>
                          <div className="mt-1">{issue.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="flex-col gap-3 border-t border-slate-200 bg-slate-50/80 sm:flex-row sm:justify-between">
            <div className="text-xs text-slate-500">
              O arquivo ideal está no padrão XLSX com cabeçalhos claros por aba.
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="outline" disabled={loading || previewLoading} onClick={onPreview} className="w-full sm:w-auto">
                {previewLoading ? "Gerando prévia..." : "Pré-visualizar"}
              </Button>
              <Button type="submit" disabled={loading || previewLoading} className="w-full sm:w-auto">
                {loading ? "Importando..." : "Importar"}
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      <aside className="space-y-4">
        <Card className="border-slate-200 bg-white/92 shadow-[0_20px_56px_-40px_rgba(15,23,42,0.18)]">
          <CardHeader>
            <CardTitle className="text-xl">Como funciona</CardTitle>
            <CardDescription>Uma leitura simples do que acontece depois do envio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="font-medium text-slate-950">1. Validação</div>
              <div className="mt-1 leading-6">
                A planilha é lida, as abas são detectadas e os campos principais são normalizados.
              </div>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="font-medium text-slate-950">2. Processamento</div>
              <div className="mt-1 leading-6">
                As linhas são deduplicadas, classificadas e aplicadas como criação ou atualização.
              </div>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="font-medium text-slate-950">3. Auditoria</div>
              <div className="mt-1 leading-6">
                O resultado fica registrado no histórico para revisão e conferência posterior.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-br from-sky-50 to-white shadow-[0_20px_56px_-40px_rgba(15,23,42,0.18)]">
          <CardHeader>
            <CardTitle className="text-xl">Dica prática</CardTitle>
            <CardDescription>Se a base local estiver indisponível, a tela continua estável e o erro fica legível.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-slate-600">
            Se você quiser, eu também posso incluir um modo de pré-visualização do arquivo antes do envio.
          </CardContent>
          <CardFooter className="justify-between border-t border-slate-200 bg-white/60">
            <Button asChild variant="outline" className="border-slate-200 bg-white">
              <Link href="/import/history">Abrir histórico</Link>
            </Button>
            <Button asChild variant="ghost" className="text-sky-700 hover:bg-sky-50 hover:text-sky-800">
              <Link href="/companies">
                Consultar base
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </aside>
    </section>
  );
}
