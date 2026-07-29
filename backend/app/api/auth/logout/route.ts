export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { clearSessionCookie } from "@/services/auth/cookies";

export async function POST() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
