export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAuth } from "@/services/auth/require";
import { rateLimit } from "@/lib/rateLimit";
import { lookupCnpj } from "@/services/company/cnpjLookup";

export async function GET(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;
  const limit = await rateLimit({ key: `cnpj-lookup:${auth.session.user.id}`, limit: 20, windowMs: 60 * 60_000 });
  if (!limit.ok) return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
  const cnpj = new URL(request.url).searchParams.get("cnpj") ?? "";
  try {
    return Response.json({ data: await lookupCnpj(cnpj) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PROVIDER_UNAVAILABLE";
    const status = code === "INVALID_CNPJ" ? 400 : code === "COMPANY_NOT_FOUND" ? 404 : code === "RATE_LIMITED" ? 429 : 503;
    return Response.json({ error: code }, { status });
  }
}
