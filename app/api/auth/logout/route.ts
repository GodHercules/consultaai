export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { clearSessionCookie } from "@/services/auth/cookies";

export async function POST() {
  clearSessionCookie();
  return Response.json({ ok: true });
}

