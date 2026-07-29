export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { requireAuth } from "@/services/auth/require";

const schema = z.object({
  name: z.string().min(2),
});

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  let departmentLeader: { name: string; email: string } | null = null;
  if (auth.session.user.department) {
    departmentLeader = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true, department: auth.session.user.department, isDepartmentLeader: true },
      select: { name: true, email: true },
    });
  }
  const { id, name, email, role, department, isDepartmentLeader, isActive, mustChangePassword } = auth.session.user;
  return Response.json({
    user: { id, name, email, role, department, isDepartmentLeader, isActive, mustChangePassword },
    departmentLeader,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const old = await prisma.user.findUnique({
    where: { id: auth.session.user.id },
    select: { id: true, name: true },
  });
  if (!old) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const user = await prisma.user.update({
    where: { id: auth.session.user.id },
    data: { name: parsed.data.name.trim() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  await auditLog({
    userId: user.id,
    action: "PROFILE_UPDATED",
    entity: "User",
    entityId: user.id,
    oldValue: old,
    newValue: user,
  });

  return Response.json({ user });
}

