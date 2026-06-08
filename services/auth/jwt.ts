import { SignJWT, jwtVerify } from "jose";
import type { SessionPayload } from "@/types/auth";
import { getEnv } from "@/lib/env";
import { sha256Base64Url } from "@/utils/crypto";

const COOKIE_NAME = "cc_session";

function secretKey() {
  const env = getEnv();
  if (!env.AUTH_JWT_SECRET) throw new Error("AUTH_JWT_SECRET_MISSING");
  return new TextEncoder().encode(env.AUTH_JWT_SECRET);
}

export function sessionCookieName() {
  return COOKIE_NAME;
}

export async function passwordChecksumFromHash(passwordHash: string) {
  return sha256Base64Url(passwordHash);
}

export async function signSession(payload: SessionPayload) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    role: payload.role,
    mustChangePassword: payload.mustChangePassword,
    passwordChecksum: payload.passwordChecksum,
    ...(payload.email ? { email: payload.email } : {}),
    ...(payload.name ? { name: payload.name } : {}),
    ...(payload.bootstrap ? { bootstrap: payload.bootstrap } : {}),
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
  const passwordChecksum = payload.passwordChecksum;
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const name = typeof payload.name === "string" ? payload.name : undefined;
  const bootstrap = typeof payload.bootstrap === "boolean" ? payload.bootstrap : undefined;
  if (typeof payload.sub !== "string") throw new Error("Invalid token sub");
  if (role !== "ADMIN" && role !== "USER") throw new Error("Invalid token role");
  if (typeof mustChangePassword !== "boolean")
    throw new Error("Invalid token mustChangePassword");
  if (typeof passwordChecksum !== "string")
    throw new Error("Invalid token passwordChecksum");

  return {
    sub: payload.sub,
    role,
    mustChangePassword,
    passwordChecksum,
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(bootstrap !== undefined ? { bootstrap } : {}),
  } satisfies SessionPayload;
}
