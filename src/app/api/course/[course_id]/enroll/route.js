import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { OPTIONS, errorResponse, successResponse, safeId, printExceptionLog } from "@/lib/utils";
export { OPTIONS };

export async function POST(request, { params }) {
  try {
    const { user, error } = await requireUser(request, ["Student"]);
    if (error) return error;
    const { course_id } = await params;
    if (!safeId(course_id)) return errorResponse("Invalid course ID", 400, request);
    const db = await getDb();
    const id = new ObjectId(course_id);
    // One atomic document update guards status, duplicate enrollment and seats.
    // Simultaneous submissions cannot overfill a course.
    const result = await db.collection("course").updateOne({
      _id: id, status: "Open", enrolledStudentIds: { $ne: user._id },
      $expr: { $lt: [{ $size: { $ifNull: ["$enrolledStudentIds", []] } }, "$maxStudent"] },
    }, { $addToSet: { enrolledStudentIds: user._id }, $set: { updatedAt: new Date() } });
    if (result.modifiedCount) return successResponse({ message: "Enrollment successful" }, 201, request);
    const course = await db.collection("course").findOne({ _id: id });
    if (!course || course.status === "Cancel") return errorResponse("Course not available", 404, request);
    if (course.enrolledStudentIds?.some((x) => String(x) === String(user._id))) {
      return errorResponse("You have already enrolled", 409, request);
    }
    if (course.status !== "Open") return errorResponse("This course is not open for enrollment", 409, request);
    return errorResponse("This course is full", 409, request);
  } catch (err) {
    printExceptionLog("POST enroll", err);
    return errorResponse("Unable to enroll", 500, request);
  }
}
