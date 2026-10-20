import { NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getCorsHeaders } from "@/lib/cors";
import { OPTIONS, printExceptionLog } from "@/lib/utils";
export { OPTIONS };
async function logout(request) {
  try {
    const payload = verifyJWT(request);
    if (payload?.sid) await (await getDb()).collection("session").deleteOne({ _id: payload.sid });
  } catch (err) {
    printExceptionLog("logout", err);
  }
  const response = NextResponse.json({ message: "Logged out" }, { headers: getCorsHeaders(request) });
  response.cookies.set("token", "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", path: "/", maxAge: 0,
  });
  return response;
}
export const GET = logout;
export const POST = logout;
