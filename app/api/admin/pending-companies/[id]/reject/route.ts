export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { requireAuth } from "@/services/auth/require";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  const pending = await prisma.pendingCompany.findUnique({
    where: { id },
    select: { id: true, status: true, deliveryId: true },
  });
  if (!pending) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (pending.status !== "PENDING") {
    return Response.json({ error: "ALREADY_DECIDED" }, { status: 400 });
  }

  await prisma.pendingCompany.update({
    where: { id: pending.id },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedByUserId: auth.session.user.id,
    },
  });

  if (pending.deliveryId) {
    await prisma.webhookDelivery.update({
      where: { id: pending.deliveryId },
      data: { processedAt: new Date() },
    }).catch(() => null);
  }

  await auditLog({
    userId: auth.session.user.id,
    action: "PENDING_COMPANY_REJECTED",
    entity: "PendingCompany",
    entityId: pending.id,
    newValue: { reason },
  });

  return Response.json({ ok: true });
}

