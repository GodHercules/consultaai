export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAuth } from "@/services/auth/require";
import { importCompaniesFromExcel } from "@/services/import/importExcel";

export async function POST(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "INVALID_FORM" }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const result = await importCompaniesFromExcel({
    actorUserId: auth.session.user.id,
    fileName: file.name,
    buffer,
  });

  return Response.json({ import: result });
}

