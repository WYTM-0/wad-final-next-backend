import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { courseForClient, makeCourseSearch, validateCourse } from "@/lib/course";
import { OPTIONS, successResponse, errorResponse, printExceptionLog } from "@/lib/utils";
export { OPTIONS };

export async function GET(request) {
  try {
    const { user, error } = await requireUser(request);
    if (error) return error;
    const q = (new URL(request.url)).searchParams.get("q")?.trim() || "";
    if (q.length > 100) return errorResponse("Search text is too long", 400, request);
    const filter = user.role === "Teacher" ? { teacherId: user._id } : { status: { $ne: "Cancel" } };
    if (q) Object.assign(filter, makeCourseSearch(q));
    const db = await getDb();
    const courses = await db.collection("course").find(filter).sort({ createdAt: -1, _id: -1 }).toArray();
    return successResponse({ courses: courses.map((c) => courseForClient(c, user)) }, 200, request);
  } catch (err) {
    printExceptionLog("GET courses", err);
    return errorResponse("Unable to load courses", 500, request);
  }
}

export async function POST(request) {
  try {
    const { user, error } = await requireUser(request, ["Teacher"]);
    if (error) return error;
    const { error: invalid, value } = validateCourse(await request.json());
    if (invalid) return errorResponse(invalid, 400, request);
    const now = new Date();
    const course = { ...value, teacherId: user._id, teacherName: user.username,
      enrolledStudentIds: [], createdAt: now, updatedAt: now };
    const db = await getDb();
    const result = await db.collection("course").insertOne(course);
    return successResponse({ id: String(result.insertedId), course: courseForClient({ ...course, _id: result.insertedId }, user) }, 201, request);
  } catch (err) {
    printExceptionLog("POST course", err);
    return errorResponse("Unable to create course", 500, request);
  }
}
