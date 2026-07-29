export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/services/auth/require";
import { retryFundarmfIntegrationEvent } from "@/services/integration/fundarmf";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const result = await retryFundarmfIntegrationEvent({
    eventId: id,
    actorUserId: auth.session.user.id,
    db: prisma,
  });

  return Response.json(result.body, { status: result.status });
}
