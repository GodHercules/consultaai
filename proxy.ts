import { NextRequest, NextResponse } from "next/server";

function allowedOrigin(request: NextRequest) {
  const configured = process.env.FRONTEND_ORIGIN?.trim();
  if (configured) return configured;

  const origin = request.headers.get("origin");
  if (origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    return origin;
  }

  return null;
}

export function proxy(request: NextRequest) {
  const origin = allowedOrigin(request);

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    }
    return response;
  }

  const response = NextResponse.next();
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
