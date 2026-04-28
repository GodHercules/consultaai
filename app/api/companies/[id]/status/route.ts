export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { requireAuth } from "@/services/auth/require";

const schema = z.object({
  ativo: z.boolean(),
  motivo: z.string().min(3).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const old = await prisma.company.findUnique({ where: { id } });
  if (!old) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const company = await prisma.company.update({
    where: { id },
    data: { ativo: parsed.data.ativo },
  });

  await auditLog({
    userId: auth.session.user.id,
    action: parsed.data.ativo ? "COMPANY_REACTIVATED" : "COMPANY_DEACTIVATED",
    entity: "Company",
    entityId: id,
    oldValue: old,
    newValue: { ...company, motivo: parsed.data.motivo },
  });

  return Response.json({ company });
}

