export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handleFundarmfCompanyCreatedWebhook } from "@/services/integration/fundarmf";

export async function POST(request: Request) {
  const result = await handleFundarmfCompanyCreatedWebhook(request, prisma);
  return Response.json(result.body, { status: result.status });
}
