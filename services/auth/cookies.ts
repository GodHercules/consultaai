import { cookies } from "next/headers";
import { sessionCookieName } from "@/services/auth/jwt";

export function setSessionCookie(token: string) {
  cookies().set(sessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  cookies().set(sessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getSessionCookie() {
  return cookies().get(sessionCookieName())?.value ?? null;
}

