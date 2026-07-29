import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function auditLog(input: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  db?: Prisma.TransactionClient | typeof prisma;
}) {
  const db = input.db ?? prisma;
  const data = {
    userId: input.userId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    oldValue: input.oldValue as never,
    newValue: input.newValue as never,
  };

  try {
    return await db.auditLog.create({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isUserFkError = message.includes("AuditLog_userId_fkey") || message.includes("Foreign key constraint violated");
    if (!isUserFkError) throw error;

    return db.auditLog.create({
      data: {
        ...data,
        userId: null,
      },
    });
  }
}
