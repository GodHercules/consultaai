export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSessionUser } from "@/services/auth/session";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return Response.json({ user: null }, { status: 200 });
  return Response.json({ user: session.user }, { status: 200 });
}

