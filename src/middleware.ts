import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/slack/callback", "/api/slack/command", "/api/slack/interactions", "/api/widget", "/widget", "/api/media"];
const publicExactPaths = new Set(["/"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow root (redirects to /login) and public paths
  if (publicExactPaths.has(pathname) || publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("token")?.value;

  if (!token) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("token");
    return response;
  }

  // Redirect authenticated users away from auth/landing pages
  if (pathname === "/" || pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(new URL("/boards", req.url));
  }

  // Add user info to headers for API routes
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-email", payload.email);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
