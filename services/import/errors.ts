export type ImportErrorCode =
  | "INVALID_FORM"
  | "FILE_REQUIRED"
  | "DATABASE_UNAVAILABLE"
  | "IMPORT_FAILED";

export type ImportStage =
  | "request"
  | "form"
  | "file"
  | "hash"
  | "history_lookup"
  | "preview"
  | "process"
  | "failure_log"
  | "unknown";

export type ImportErrorPayload = {
  code: ImportErrorCode;
  message: string;
  correlationId: string;
  stage?: ImportStage;
  hint?: string;
  details?: {
    prismaCode?: string;
    source?: string;
  };
  debug?: {
    name?: string;
    message?: string;
    stack?: string;
  };
};

export type ImportFailureMeta = {
  code: ImportErrorCode;
  status: number;
  message: string;
  hint?: string;
  details?: {
    prismaCode?: string;
    source?: string;
  };
};

function extractPrismaCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

function stageHint(stage: ImportStage) {
  switch (stage) {
    case "history_lookup":
      return "A falha aconteceu ao consultar o histórico para evitar importação duplicada.";
    case "preview":
      return "A falha aconteceu durante a pré-visualização da planilha.";
    case "process":
      return "A falha aconteceu ao processar e gravar as linhas da planilha.";
    case "failure_log":
      return "A importação falhou e o log de falha também não pôde ser salvo.";
    case "hash":
      return "A falha aconteceu ao ler ou resumir o arquivo enviado.";
    case "form":
      return "A falha aconteceu ao ler o formulário enviado.";
    case "file":
      return "A falha aconteceu ao validar o arquivo anexado.";
    default:
      return "A falha aconteceu em uma etapa interna da importação.";
  }
}

export function classifyImportFailure(error: unknown, stage: ImportStage = "unknown"): ImportFailureMeta {
  const message = error instanceof Error ? `${error.message} ${error.name}` : String(error);
  const prismaCode = extractPrismaCode(error);

  if (prismaCode) {
    if (["P1000", "P1001", "P1008", "P1017"].includes(prismaCode)) {
      return {
        code: "DATABASE_UNAVAILABLE",
        status: 503,
        message: "A importação foi interrompida porque o banco de dados não respondeu.",
        hint: stageHint(stage),
        details: { prismaCode, source: "prisma" },
      };
    }

    if (prismaCode === "P2028") {
      return {
        code: "IMPORT_FAILED",
        status: 500,
        message: "A importação excedeu o tempo permitido pela transação do banco.",
        hint: stageHint(stage),
        details: { prismaCode, source: "prisma" },
      };
    }

    if (["P2002", "P2003", "P2025", "P2034"].includes(prismaCode)) {
      return {
        code: "IMPORT_FAILED",
        status: 409,
        message: "A importação encontrou um conflito ao gravar os dados.",
        hint: stageHint(stage),
        details: { prismaCode, source: "prisma" },
      };
    }
  }

  if (
    message.includes("DATABASE_URL or DIRECT_URL is required") ||
    message.includes("DATABASE_URL is required") ||
    message.includes("DIRECT_URL is required") ||
    message.includes("Authentication failed") ||
    message.includes("P1000") ||
    message.includes("P1001") ||
    message.includes("P1008") ||
    message.includes("P1017") ||
    message.includes("Can't reach database server") ||
    message.includes("Connection terminated unexpectedly") ||
    message.includes("Server has closed the connection") ||
    message.includes("Connection closed")
  ) {
    return {
      code: "DATABASE_UNAVAILABLE",
      status: 503,
      message: "A importação foi interrompida porque o banco de dados não respondeu.",
      hint: stageHint(stage),
      details: prismaCode ? { prismaCode, source: "message" } : { source: "message" },
    };
  }

  if (
    message.includes("Workbook") ||
    message.includes("worksheet") ||
    message.includes("sheet") ||
    message.includes("XLSX") ||
    message.includes("Invalid file") ||
    message.includes("Unsupported") ||
    message.includes("Corrupt")
  ) {
    return {
      code: "INVALID_FORM",
      status: 400,
      message: "A planilha enviada não pôde ser lida. Confirme se o arquivo é um XLSX/XLS válido.",
      hint: stageHint(stage),
      details: { source: "xlsx" },
    };
  }

  return {
    code: "IMPORT_FAILED",
    status: 500,
    message: stage === "unknown" ? "Verifique o arquivo e tente novamente." : `Falha na etapa "${stage}".`,
    hint: stageHint(stage),
    details: prismaCode ? { prismaCode, source: "unknown" } : { source: "unknown" },
  };
}
