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
    select: { id: true, name: true, role: true, isActive: true, email: true },
  });
  if (!old) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.isActive === undefined ? {} : { isActive: parsed.data.isActive }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
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

