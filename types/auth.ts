import type { Role } from "@prisma/client";

export type SessionPayload = {
  sub: string;
  role: Role;
  mustChangePassword: boolean;
  passwordChecksum: string;
  email?: string;
  name?: string;
  bootstrap?: boolean;
};
