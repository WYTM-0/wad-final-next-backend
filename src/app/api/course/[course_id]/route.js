import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { courseForClient, validateCourse } from "@/lib/course";
import { OPTIONS, successResponse, errorResponse, printExceptionLog, safeId, publicUser } from "@/lib/utils";
export { OPTIONS };

async function target(request, params) {
  const { course_id } = await params;
  if (!safeId(course_id)) return { error: errorResponse("Invalid course ID", 400, request) };
  const auth = await requireUser(request);
  if (auth.error) return { error: auth.error };
  const db = await getDb();
  const course = await db.collection("course").findOne({ _id: new ObjectId(course_id) });
  if (!course) return { error: errorResponse("Course not found", 404, request) };
  if (auth.user.role === "Teacher" && String(course.teacherId) !== String(auth.user._id)) {
    return { error: errorResponse("You can only access your own courses", 403, request) };
  }
  if (auth.user.role === "Student" && course.status === "Cancel" &&
      !(course.enrolledStudentIds || []).some((id) => String(id) === String(auth.user._id))) {
    return { error: errorResponse("Course not found", 404, request) };
  }
  return { course, user: auth.user, db };
}

export async function GET(request, { params }) {
  try {
    const { error, course, user, db } = await target(request, params);
    if (error) return error;
    let enrolledStudents = [];
    if (user.role === "Teacher" && (course.enrolledStudentIds || []).length) {
      const students = await db.collection("user").find(
        { _id: { $in: course.enrolledStudentIds } },
        { projection: { password: 0 } },
      ).sort({ username: 1 }).toArray();
      enrolledStudents = students.map(publicUser);
    }
    return successResponse({ course: courseForClient(course, user), enrolledStudents }, 200, request);
  } catch (err) {
    printExceptionLog("GET course detail", err);
    return errorResponse("Unable to load course details", 500, request);
  }
}

export async function PUT(request, { params }) {
  try {
    const { error, course, user, db } = await target(request, params);
    if (error) return error;
    if (user.role !== "Teacher") return errorResponse("Teachers only", 403, request);
    const { error: invalid, value } = validateCourse(await request.json());
    if (invalid) return errorResponse(invalid, 400, request);
    // Atomically prevent lowering capacity below the current enrollment count.
    const result = await db.collection("course").updateOne({
      _id: course._id, teacherId: user._id,
      $expr: { $lte: [{ $size: { $ifNull: ["$enrolledStudentIds", []] } }, value.maxStudent] },
    }, { $set: { ...value, updatedAt: new Date() } });
    if (!result.matchedCount) return errorResponse("Max Student is below the number enrolled", 409, request);
    const changed = await db.collection("course").findOne({ _id: course._id });
    return successResponse({ message: "Course updated", course: courseForClient(changed, user) }, 200, request);
  } catch (err) {
    printExceptionLog("PUT course", err);
    return errorResponse("Unable to update course", 500, request);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { error, course, user, db } = await target(request, params);
    if (error) return error;
    if (user.role !== "Teacher") return errorResponse("Teachers only", 403, request);
    const result = await db.collection("course").deleteOne({
      _id: course._id, teacherId: user._id,
      $expr: { $eq: [{ $size: { $ifNull: ["$enrolledStudentIds", []] } }, 0] },
    });
    if (!result.deletedCount) return errorResponse("Cannot delete: students are enrolled", 409, request);
    return successResponse({ message: "Course deleted" }, 200, request);
  } catch (err) {
    printExceptionLog("DELETE course", err);
    return errorResponse("Unable to delete course", 500, request);
  }
}
