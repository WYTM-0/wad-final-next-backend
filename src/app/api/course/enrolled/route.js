import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { courseForClient } from "@/lib/course";
import { OPTIONS, errorResponse, successResponse, printExceptionLog } from "@/lib/utils";
export { OPTIONS };
export async function GET(request) {
  try {
    const { user, error } = await requireUser(request, ["Student"]);
    if (error) return error;
    const db = await getDb();
    const courses = await db.collection("course")
      .find({ enrolledStudentIds: user._id }).sort({ createdAt: -1 }).toArray();
    // Canceled courses remain in an already-enrolled student's personal list,
    // but are hidden from discovery and cannot accept new enrollment.
    return successResponse({ courses: courses.map((c) => courseForClient(c, user)) }, 200, request);
  } catch (err) {
    printExceptionLog("GET enrolled", err);
    return errorResponse("Unable to load enrollments", 500, request);
  }
}
