import { prisma } from "@/lib/prisma";

export async function auditLog(input: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldValue: input.oldValue as never,
      newValue: input.newValue as never,
    },
  });
}

