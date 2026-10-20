import { ObjectId } from "mongodb";

export function validateCourse(raw) {
  if (!raw || typeof raw !== "object") return { error: "Invalid course body" };
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const duration = Number(raw.duration);
  const price = Number(raw.price);
  const maxStudent = Number(raw.maxStudent);
  const topics = (Array.isArray(raw.topics) ? raw.topics : String(raw.topics || "").split(","))
    .map((t) => String(t).trim()).filter(Boolean);
  const status = raw.status || "Open";
  if (!name || name.length > 150) return { error: "Course name must contain 1–150 characters" };
  if (!Number.isInteger(duration) || duration < 1) return { error: "Duration must be at least one full day" };
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be zero or greater" };
  if (!Number.isInteger(maxStudent) || maxStudent < 1) return { error: "Max Student must be a positive integer" };
  if (!topics.length || topics.length > 30 || topics.some((t) => t.length > 100)) {
    return { error: "Provide 1–30 topics, each at most 100 characters" };
  }
  if (!["Open", "Close", "Cancel"].includes(status)) return { error: "Invalid course status" };
  return { value: { name, duration, topics: [...new Set(topics)], price, maxStudent, status } };
}

export function courseForClient(course, user) {
  const ids = course.enrolledStudentIds || [];
  const { enrolledStudentIds: _hidden, ...rest } = course;
  void _hidden;
  return {
    ...rest,
    _id: String(course._id), teacherId: String(course.teacherId),
    enrolledCount: ids.length,
    availableSeats: Math.max(0, course.maxStudent - ids.length),
    isEnrolled: user.role === "Student" && ids.some((id) => String(id) === String(user._id)),
  };
}

export function mongoId(value) { return new ObjectId(value); }
export function makeCourseSearch(query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { $or: [ { name: { $regex: escaped, $options: "i" } },
    { teacherName: { $regex: escaped, $options: "i" } } ] };
}
