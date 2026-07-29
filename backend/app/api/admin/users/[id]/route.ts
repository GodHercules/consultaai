export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { requireAuth } from "@/services/auth/require";

const schema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
  department: z.enum(["DP", "FISCAL", "CONTABIL"]).nullable().optional(),
  isDepartmentLeader: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  if (id === auth.session.user.id && parsed.data.isActive === false) {
    return Response.json({ error: "CANNOT_DEACTIVATE_SELF" }, { status: 400 });
  }

  const old = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, department: true, isDepartmentLeader: true, isActive: true, email: true },
  });
  if (!old) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const nextRole = parsed.data.role ?? old.role;
  const nextDepartment =
    parsed.data.department === undefined ? old.department : parsed.data.department;
  const nextLeader =
    parsed.data.isDepartmentLeader === undefined
      ? old.isDepartmentLeader
      : parsed.data.isDepartmentLeader;

  if (nextLeader && (nextRole !== "ADMIN" || !nextDepartment)) {
    return Response.json({ error: "INVALID_DEPARTMENT_LEADER" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.isActive === undefined ? {} : { isActive: parsed.data.isActive }),
      ...(parsed.data.department === undefined ? {} : { department: parsed.data.department }),
      ...(parsed.data.isDepartmentLeader === undefined ? {} : { isDepartmentLeader: parsed.data.isDepartmentLeader }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isDepartmentLeader: true,
      isActive: true,
      mustChangePassword: true,
      updatedAt: true,
    },
  });

  await auditLog({
    userId: auth.session.user.id,
    action: "USER_UPDATED",
    entity: "User",
    entityId: id,
    oldValue: old,
    newValue: updated,
  });

  return Response.json({ user: updated });
}
