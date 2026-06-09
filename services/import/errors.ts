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
  if (
    message.includes("DATABASE_URL or DIRECT_URL is required") ||
    message.includes("DATABASE_URL is required") ||
    message.includes("DIRECT_URL is required") ||
    message.includes("Authentication failed") ||
    message.includes("P1000") ||
    message.includes("P1001") ||
    message.includes("Can't reach database server") ||
    message.includes("Connection terminated unexpectedly") ||
    message.includes("Server has closed the connection")
  ) {
    return {
      code: "DATABASE_UNAVAILABLE",
      status: 503,
      message: "A importação foi interrompida porque o banco de dados não respondeu.",
    };
  }

  return {
    code: "IMPORT_FAILED",
    status: 500,
    message: "Verifique o arquivo e tente novamente.",
  };
}
