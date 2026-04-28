import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "cc_session";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password") ||
    pathname === "/api/health" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/forgot-password" ||
    pathname === "/api/auth/reset-password"
  );
}

function isAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/public")
  );
}

function requiresAdmin(pathname: string) {
  if (pathname === "/dashboard") return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname === "/companies/new") return true;
  if (pathname.startsWith("/companies/") && pathname.endsWith("/edit")) return true;
  if (pathname.startsWith("/companies/") && pathname.endsWith("/status"))
    return true;
  if (pathname.startsWith("/import")) return true;
  return false;
}

async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) return null;

  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ["HS256"],
  });

  const role = payload.role;
  const mustChangePassword = payload.mustChangePassword;
  if (typeof payload.sub !== "string") return null;
  if (role !== "ADMIN" && role !== "USER") return null;
  if (typeof mustChangePassword !== "boolean") return null;
  return { sub: payload.sub, role, mustChangePassword };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAssetPath(pathname)) return NextResponse.next();

  if (isPublicPath(pathname)) return NextResponse.next();

  const session = await getSessionFromRequest(request);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (
    session.mustChangePassword &&
    pathname !== "/force-password-change" &&
    pathname !== "/api/auth/change-password" &&
    pathname !== "/api/auth/logout"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/force-password-change";
    return NextResponse.redirect(url);
  }

  if (requiresAdmin(pathname) && session.role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/companies";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
