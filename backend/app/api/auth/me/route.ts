export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSessionUser } from "@/services/auth/session";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return Response.json({ user: null }, { status: 200 });
  const user = { ...session.user } as Record<string, unknown>;
  delete user.passwordHash;
  delete user.tempPassword;
  return Response.json({ user }, { status: 200 });
}

