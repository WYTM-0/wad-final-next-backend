import bcrypt from "bcrypt";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { OPTIONS, successResponse, errorResponse, printExceptionLog, publicUser } from "@/lib/utils";
export { OPTIONS };

export async function GET(request) {
  try {
    const { error } = await requireUser(request, ["Teacher"]);
    if (error) return error;
    const db = await getDb();
    const students = await db.collection("user").find({ role: "Student" },
      { projection: { password: 0 } }).sort({ username: 1 }).toArray();
    return successResponse({ users: students.map(publicUser) }, 200, request);
  } catch (err) {
    printExceptionLog("GET users", err);
    return errorResponse("Unable to load users", 500, request);
  }
}

// Safe self-registration: callers cannot create themselves as Teachers.
export async function POST(request) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = body.password;
    if (username.length < 3 || username.length > 40 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" || password.length < 8 || password.length > 128) {
      return errorResponse("Provide username (3–40 chars), valid email and password (8–128 chars)", 400, request);
    }
    const db = await getDb();
    const newUser = { username, email, password: await bcrypt.hash(password, 12), role: "Student", createdAt: new Date() };
    const result = await db.collection("user").insertOne(newUser);
    return successResponse({ message: "Student created", user: publicUser({ ...newUser, _id: result.insertedId }) }, 201, request);
  } catch (err) {
    if (err.code === 11000) return errorResponse("Username or email already exists", 409, request);
    printExceptionLog("POST user", err);
    return errorResponse("Unable to register", 500, request);
  }
}
