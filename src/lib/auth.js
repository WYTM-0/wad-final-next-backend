import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { errorResponse, publicUser, safeId } from "./utils";

export function verifyJWT(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const bearer = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];
    const token = bearer || req.cookies.get("token")?.value;
    if (!token || !process.env.JWT_SECRET) return null;
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

// JWT alone is insufficient for revocation: a MongoDB session record is checked
// on every protected operation, and logout deletes that record.
export async function currentUser(request) {
  const payload = verifyJWT(request);
  if (!payload || !safeId(payload.id) || !payload.sid) return null;
  const db = await getDb();
  const session = await db.collection("session").findOne({
    _id: payload.sid,
    userId: new ObjectId(payload.id),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  const user = await db.collection("user").findOne({
    _id: new ObjectId(payload.id),
    role: { $in: ["Student", "Teacher"] },
  });
  if (!user) return null;
  return user;
}

export async function requireUser(request, allowedRoles = []) {
  const user = await currentUser(request);
  if (!user) return { error: errorResponse("Authentication required", 401, request) };
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return { error: errorResponse("Not permitted for your role", 403, request) };
  }
  return { user, profile: publicUser(user) };
}
