export type ImportErrorCode =
  | "INVALID_FORM"
  | "FILE_REQUIRED"
  | "DATABASE_UNAVAILABLE"
  | "IMPORT_FAILED";

export type ImportErrorPayload = {
  code: ImportErrorCode;
  message: string;
  correlationId: string;
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
};

export function classifyImportFailure(error: unknown): ImportFailureMeta {
  const message = error instanceof Error ? `${error.message} ${error.name}` : String(error);
  if (message.includes("Authentication failed") || message.includes("P1000")) {
    return {
      code: "DATABASE_UNAVAILABLE",
      status: 503,
      message: "A importação foi interrompida porque o banco local não respondeu.",
    };
  }

  return {
    code: "IMPORT_FAILED",
    status: 500,
    message: "Verifique o arquivo e tente novamente.",
  };
}
