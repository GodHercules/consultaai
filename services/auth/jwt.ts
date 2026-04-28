import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";
import type { SessionPayload } from "@/types/auth";

const COOKIE_NAME = "cc_session";

function secretKey() {
  return new TextEncoder().encode(env.AUTH_JWT_SECRET);
}

export function sessionCookieName() {
  return COOKIE_NAME;
}

export async function signSession(payload: SessionPayload) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    role: payload.role,
    mustChangePassword: payload.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 7)
    .setSubject(payload.sub)
    .sign(secretKey());
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: ["HS256"],
  });

  const role = payload.role;
  const mustChangePassword = payload.mustChangePassword;
  if (typeof payload.sub !== "string") throw new Error("Invalid token sub");
  if (role !== "ADMIN" && role !== "USER") throw new Error("Invalid token role");
  if (typeof mustChangePassword !== "boolean")
    throw new Error("Invalid token mustChangePassword");

  return {
    sub: payload.sub,
    role,
    mustChangePassword,
  } satisfies SessionPayload;
}

