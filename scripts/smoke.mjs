// Run AFTER MongoDB integration, `npm run seed`, and `npm run dev`.
// Exercises role security, ownership, enrollment limits and course status.
// Created temporary courses are removed directly from the test DB in finally.
import { MongoClient, ObjectId } from "mongodb";
const base = (process.env.BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
const pass = "CourseDemo2026!";
let ok = 0;
let teacher1, teacher2, student1, student2;
const createdIds = [];

async function send(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  return { status: response.status, result };
}

function expect(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
  console.log(`PASS ${++ok}: ${label} (${actual})`);
}

async function login(email) {
  const result = await send("/api/auth/login", { method: "POST", body: { email, password: pass } });
  expect(result.status, 200, `Login ${email}`);
  if (!result.result.token) throw new Error("Missing JWT in login response");
  return result.result.token;
}

const courseData = (name, overrides = {}) => ({
  name, duration: 4, topics: ["Automation", "MongoDB"], price: 50, maxStudent: 1, status: "Open", ...overrides,
});

async function main() {
  // Read DB env from Node's --env-file=.env.local; no credentials in source.
  if (!process.env.MONGODB_URI || !process.env.DB_NAME) throw new Error("Set MongoDB environment variables");
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    expect((await send("/api/course")).status, 401, "Unauthenticated course list is denied");
    teacher1 = await login("teacher1@example.com");
    teacher2 = await login("teacher2@example.com");
    student1 = await login("student1@example.com");
    student2 = await login("student2@example.com");
    const name = `Smoke Course ${Date.now()}`;
    const created = await send("/api/course", { method: "POST", token: teacher1, body: courseData(name) });
    expect(created.status, 201, "Teacher creates course");
    const id = created.result.id;
    if (!id) throw new Error("Course ID missing");
    createdIds.push(id);
    expect((await send(`/api/course/${id}`, { token: teacher2 })).status, 403, "Other teacher blocked from details");
    expect((await send(`/api/course/${id}`, { method: "PUT", token: teacher2, body: courseData(name) })).status, 403, "Other teacher blocked from edit");
    expect((await send("/api/course", { method: "POST", token: student1, body: courseData("Forged") })).status, 403, "Student cannot create course");
    const search = await send(`/api/course?q=${encodeURIComponent(name)}`, { token: student1 });
    expect(search.status, 200, "Student search succeeds");
    if (!search.result.courses.some((c) => c._id === id)) throw new Error("Search omitted the created course");
    console.log(`PASS ${++ok}: Student can find course by partial name`);
    const byTeacher = await send("/api/course?q=teacher1", { token: student2 });
    if (!byTeacher.result.courses.some((c) => c._id === id)) throw new Error("Teacher search missed course");
    console.log(`PASS ${++ok}: Student can filter by teacher name`);
    expect((await send(`/api/course/${id}/enroll`, { method: "POST", token: student1 })).status, 201, "First student enrolls");
    expect((await send(`/api/course/${id}/enroll`, { method: "POST", token: student1 })).status, 409, "Duplicate enrollment rejected");
    expect((await send(`/api/course/${id}/enroll`, { method: "POST", token: student2 })).status, 409, "Full course rejects enrollment");
    expect((await send(`/api/course/${id}`, { method: "DELETE", token: teacher1 })).status, 409, "Delete blocked with students enrolled");
    const detail = await send(`/api/course/${id}`, { token: teacher1 });
    expect(detail.result.enrolledStudents.length, 1, "Teacher detail includes enrolled student");
    expect((await send(`/api/course/${id}`, { method: "PUT", token: teacher1, body: courseData(name, { status: "Close" }) })).status, 200, "Teacher closes course");
    expect((await send(`/api/course/${id}`, { token: student2 })).status, 200, "Closed course remains visible");
    expect((await send(`/api/course/${id}/enroll`, { method: "POST", token: student2 })).status, 409, "Closed course enrollment rejected");
    expect((await send(`/api/course/${id}`, { method: "PUT", token: teacher1, body: courseData(name, { status: "Cancel" }) })).status, 200, "Teacher cancels course");
    const hidden = await send(`/api/course?q=${encodeURIComponent(name)}`, { token: student2 });
    if (hidden.result.courses?.some((c) => c._id === id)) throw new Error("Canceled course appeared in discovery");
    console.log(`PASS ${++ok}: Canceled course hidden from Student catalog`);
    expect((await send(`/api/course/${id}/enroll`, { method: "POST", token: student2 })).status, 404, "Canceled course enrollment rejected");
    const mine = await send("/api/course/enrolled", { token: student1 });
    if (!mine.result.courses?.some((c) => c._id === id && c.status === "Cancel")) throw new Error("Missing canceled enrolled course");
    console.log(`PASS ${++ok}: Already enrolled Student sees canceled course in own list`);
    const own = await send("/api/course", { method: "POST", token: teacher2, body: courseData(`Empty Course ${Date.now()}`) });
    expect(own.status, 201, "Teacher 2 creates own empty course");
    createdIds.push(own.result.id);
    expect((await send(`/api/course/${own.result.id}`, { method: "DELETE", token: teacher1 })).status, 403, "Teacher 1 cannot delete Teacher 2 course");
    expect((await send(`/api/course/${own.result.id}`, { method: "DELETE", token: teacher2 })).status, 200, "Owner can delete empty course");
    expect((await send("/api/auth/logout", { method: "POST", token: student1 })).status, 200, "Student logout");
    expect((await send("/api/me", { token: student1 })).status, 401, "Revoked token is rejected");
    console.log(`\nAll ${ok} smoke checks passed.`);
  } finally {
    if (createdIds.length) {
      try {
        await client.connect();
        await client.db(process.env.DB_NAME).collection("course").deleteMany({ _id: { $in: createdIds.filter(Boolean).map((id) => new ObjectId(id)) } });
        console.log("Temporary smoke-test courses cleaned up.");
      } catch (error) { console.error("Cleanup failed. Delete temporary smoke courses manually:", createdIds, error); }
    }
    await client.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
