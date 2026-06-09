export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/services/auth/require";
import {
  importCompaniesFromExcel,
  previewImportCompaniesFromExcel,
} from "@/services/import/importExcel";
import { classifyImportFailure, type ImportErrorPayload } from "@/services/import/errors";
import { randomToken, sha256Base64UrlBytes } from "@/utils/crypto";

function jsonImportError(payload: ImportErrorPayload, status: number) {
  return Response.json({ error: payload }, { status });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  let fileName: string | null = null;
  let fileHash: string | null = null;

  try {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return jsonImportError(
        {
          code: "INVALID_FORM",
          message: "O formulário não pôde ser lido. Recarregue a página e tente novamente.",
          correlationId: randomToken(10),
        },
        400,
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonImportError(
        {
          code: "FILE_REQUIRED",
          message: "Envie um arquivo .xlsx ou .xls para continuar.",
          correlationId: randomToken(10),
        },
        400,
      );
    }

    fileName = file.name;
    const buffer = await file.arrayBuffer();
    fileHash = await sha256Base64UrlBytes(buffer);

    if (!dryRun) {
      const existingImport = await prisma.importHistory.findFirst({
        where: { fileHash },
        orderBy: { createdAt: "desc" },
      });
      if (existingImport) {
        return Response.json({ import: existingImport, reused: true });
      }
    }

    const result = dryRun
      ? await previewImportCompaniesFromExcel({
          actorUserId: auth.session.user.id,
          fileName: file.name,
          buffer,
        })
      : await importCompaniesFromExcel({
          actorUserId: auth.session.user.id,
          fileName: file.name,
          buffer,
          fileHash,
        });

    if (dryRun) {
      return Response.json({ preview: result });
    }

    return Response.json({ import: result, reused: false });
  } catch (error) {
    const failure = classifyImportFailure(error);
    const correlationId = randomToken(10);
    console.error(`[import:${correlationId}] ${failure.code}`, error);
    const debug =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined;

    if (!dryRun && fileName) {
      const failureError = {
        code: failure.code,
        message: failure.message,
        correlationId,
      };

      try {
        await prisma.importHistory.create({
          data: {
            fileName,
            fileHash: null,
            status: "FAILED",
            total: 0,
            created: 0,
            updated: 0,
            ignored: 0,
            suspectedDuplicates: 0,
            errors: [failureError],
            report: {
              status: "FAILED",
              error: failureError,
            },
          },
        });
      } catch {
        // Se o banco estiver indisponível, não deixamos o log de falha derrubar a resposta.
      }
    }

    return jsonImportError(
      {
        code: failure.code,
        message: failure.message,
        correlationId,
        ...(debug ? { debug } : {}),
      },
      failure.status,
    );
  }
}
