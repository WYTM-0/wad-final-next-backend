import { NextResponse } from "next/server";
import { getCorsHeaders } from "./cors";

export function printExceptionLog(message, error) {
  console.error(`==> ${message} Exception`, error);
}

export function errorResponse(message, status = 400, request) {
  return NextResponse.json({ message }, { status, headers: getCorsHeaders(request) });
}

export function successResponse(data, status = 200, request) {
  return NextResponse.json(data, { status, headers: getCorsHeaders(request) });
}

export function OPTIONS(request) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

export function safeId(id) {
  return /^[a-f\d]{24}$/i.test(String(id || ""));
}

export function publicUser(user) {
  return { _id: String(user._id), username: user.username, email: user.email, role: user.role };
}
