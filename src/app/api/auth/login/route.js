import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCorsHeaders } from "@/lib/cors";
import { errorResponse, OPTIONS, printExceptionLog, publicUser } from "@/lib/utils";

export { OPTIONS };

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return errorResponse("Email/username and password are required", 400, request);
    }
    const db = await getDb();
    const value = email.trim();
    const user = await db.collection("user").findOne({
      $or: [{ email: value.toLowerCase() }, { username: value }],
    });
    // Use bcrypt even when a user is missing to avoid returning different error details.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return errorResponse("Invalid username/email or password", 401, request);
    }
    if (!["Teacher", "Student"].includes(user.role)) {
      return errorResponse("Invalid account role", 403, request);
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters");
    }
    const sid = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.collection("session").insertOne({ _id: sid, userId: user._id, expiresAt });
    const token = jwt.sign({
      id: String(user._id), email: user.email, username: user.username, role: user.role, sid,
    }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "7d" });
    const response = NextResponse.json({
      message: "Login successful", user: publicUser(user),
      // Cross-site Vercel deployments can block third-party cookies. The React
      // app keeps this bearer token in sessionStorage as a fallback.
      token,
    }, { headers: getCorsHeaders(request) });
    response.cookies.set("token", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/", maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    printExceptionLog("POST auth/login", error);
    return errorResponse("Login failed due to a server error", 500, request);
  }
}
