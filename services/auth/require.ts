import type { Role } from "@prisma/client";
import { getSessionUser } from "@/services/auth/session";

export async function requireAuth(options?: { role?: Role }) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, response: Response.json({ error: "UNAUTHORIZED" }, { status: 401 }) };

  if (options?.role && session.user.role !== options.role) {
    return { ok: false as const, response: Response.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { ok: true as const, session };
}

