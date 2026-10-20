import { NextResponse } from "next/server";
import { verifyJWT } from "./lib/auth";
import { getCorsHeaders } from "./lib/cors";
import { X_HEADER_USER_EMAIL, X_HEADER_USER_ID, X_HEADER_USER_NAME } from "./lib/constant";

// The proxy checks JWT signatures. API handlers ALSO verify DB-backed sessions,
// roles, teacher ownership, course status, and enrollment conditions.
export function proxy(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }
  // Student self-registration is intentionally public. Teacher accounts are seeded.
  if (request.nextUrl.pathname === "/api/user" && request.method === "POST") {
    return NextResponse.next();
  }
  const user = verifyJWT(request);
  if (!user) {
    return NextResponse.json({ message: "Authentication required" }, {
      status: 401,
      headers: getCorsHeaders(request),
    });
  }
  // Replace any untrusted identity headers; never authorize based on client headers.
  const headers = new Headers(request.headers);
  headers.set(X_HEADER_USER_ID, String(user.id));
  headers.set(X_HEADER_USER_EMAIL, String(user.email));
  headers.set(X_HEADER_USER_NAME, String(user.username));
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/api/me", "/api/user/:path*", "/api/course/:path*"] };
