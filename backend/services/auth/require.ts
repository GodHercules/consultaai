import type { Department, Role } from "@prisma/client";
import { getSessionUser } from "@/services/auth/session";

export async function requireAuth(options?: { role?: Role; department?: Department | Department[] }) {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, response: Response.json({ error: "UNAUTHORIZED" }, { status: 401 }) };

  if (options?.role && session.user.role !== options.role) {
    return { ok: false as const, response: Response.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  if (options?.department) {
    const allowed = Array.isArray(options.department) ? options.department : [options.department];
    const userDept = session.user.department;
    const ok = session.user.role === "ADMIN" || (userDept && allowed.includes(userDept));
    if (!ok) return { ok: false as const, response: Response.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { ok: true as const, session };
}
