import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { OPTIONS, successResponse, errorResponse, printExceptionLog, safeId, publicUser } from "@/lib/utils";
export { OPTIONS };

async function self(request, params) {
  const { user_id } = await params;
  if (!safeId(user_id)) return { error: errorResponse("Invalid user ID", 400, request) };
  const auth = await requireUser(request);
  if (auth.error) return { error: auth.error };
  if (String(auth.user._id) !== user_id) {
    return { error: errorResponse("You can only manage your own account", 403, request) };
  }
  return auth;
}

export async function GET(request, { params }) {
  try {
    const { user, error } = await self(request, params);
    if (error) return error;
    return successResponse({ user: publicUser(user) }, 200, request);
  } catch (err) {
    printExceptionLog("GET user", err);
    return errorResponse("Unable to retrieve user", 500, request);
  }
}

// Profile editing is limited to the logged-in account; role cannot be modified.
export async function PUT(request, { params }) {
  try {
    const { user, error } = await self(request, params);
    if (error) return error;
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (username.length < 3 || username.length > 40) return errorResponse("Username must be 3–40 characters", 400, request);
    const db = await getDb();
    await db.collection("user").updateOne({ _id: new ObjectId(String(user._id)) }, { $set: { username } });
    return successResponse({ message: "Profile updated" }, 200, request);
  } catch (err) {
    if (err.code === 11000) return errorResponse("Username already in use", 409, request);
    printExceptionLog("PUT user", err);
    return errorResponse("Unable to update user", 500, request);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { user, error } = await self(request, params);
    if (error) return error;
    const { oldPassword, newPassword } = await request.json();
    if (typeof oldPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
      return errorResponse("Provide current and new password (8–128 characters)", 400, request);
    }
    if (!(await bcrypt.compare(oldPassword, user.password))) return errorResponse("Current password is incorrect", 403, request);
    const db = await getDb();
    await db.collection("user").updateOne({ _id: user._id }, { $set: { password: await bcrypt.hash(newPassword, 12) } });
    return successResponse({ message: "Password changed" }, 200, request);
  } catch (err) {
    printExceptionLog("PATCH user", err);
    return errorResponse("Unable to change password", 500, request);
  }
}
