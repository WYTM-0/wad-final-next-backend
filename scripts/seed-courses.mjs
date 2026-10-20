// Run: npm run seed:courses (Node.js 22+ reads .env.local via --env-file).
// Adds sample course records to an existing database without deleting or editing any courses.
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
if (!uri || !dbName) {
  console.error("Set MONGODB_URI and DB_NAME in .env.local first.");
  process.exit(1);
}

// Stable keys make this script safe to run again. These values are unique only
// to exam demo courses; teacher-created courses never need a seedKey.
const examples = [
  {
    seedKey: "wad26-t1-web-foundations",
    teacherEmail: "teacher1@example.com",
    name: "Full-Stack Web Foundations",
    duration: 21,
    topics: ["HTML", "CSS", "JavaScript", "HTTP"],
    price: 1990,
    maxStudent: 20,
    status: "Open",
    studentEmails: ["student1@example.com"],
  },
  {
    seedKey: "wad26-t1-react-workshop",
    teacherEmail: "teacher1@example.com",
    name: "React Component Workshop",
    duration: 14,
    topics: ["React", "Components", "Hooks", "React Router"],
    price: 2490,
    maxStudent: 2,
    status: "Open",
    studentEmails: ["student1@example.com", "student2@example.com"], // Full course example
  },
  {
    seedKey: "wad26-t1-javascript-deep-dive",
    teacherEmail: "teacher1@example.com",
    name: "JavaScript Deep Dive",
    duration: 10,
    topics: ["ES6", "Promises", "Async/Await", "DOM"],
    price: 990,
    maxStudent: 15,
    status: "Close",
    studentEmails: ["student3@example.com"], // Previously enrolled, then closed
  },
  {
    seedKey: "wad26-t2-nextjs-api",
    teacherEmail: "teacher2@example.com",
    name: "Next.js API Development",
    duration: 18,
    topics: ["Next.js", "App Router", "REST API", "JWT"],
    price: 2790,
    maxStudent: 12,
    status: "Open",
    studentEmails: ["student1@example.com"],
  },
  {
    seedKey: "wad26-t2-mongodb",
    teacherEmail: "teacher2@example.com",
    name: "MongoDB for Applications",
    duration: 12,
    topics: ["MongoDB", "Collections", "Indexes", "CRUD"],
    price: 1790,
    maxStudent: 10,
    status: "Open",
    studentEmails: [], // Empty course: teacher can delete it
  },
  {
    seedKey: "wad26-t2-cloud-deployment",
    teacherEmail: "teacher2@example.com",
    name: "Cloud Deployment Essentials",
    duration: 8,
    topics: ["Vercel", "Environment Variables", "CI/CD"],
    price: 890,
    maxStudent: 18,
    status: "Cancel",
    studentEmails: ["student2@example.com"], // Previously enrolled, then canceled
  },
  {
    seedKey: "wad26-t3-ui-ux",
    teacherEmail: "teacher3@example.com",
    name: "UI/UX Design Basics",
    duration: 10,
    topics: ["Wireframes", "Prototyping", "Accessibility"],
    price: 1290,
    maxStudent: 15,
    status: "Open",
    studentEmails: ["student2@example.com"],
  },
  {
    seedKey: "wad26-t3-software-testing",
    teacherEmail: "teacher3@example.com",
    name: "Software Testing Practice",
    duration: 7,
    topics: ["Unit Tests", "API Testing", "Integration Tests"],
    price: 890,
    maxStudent: 10,
    status: "Close",
    studentEmails: [],
  },
  {
    seedKey: "wad26-t3-data-analysis",
    teacherEmail: "teacher3@example.com",
    name: "Introduction to Data Analysis",
    duration: 16,
    topics: ["Python", "Data Cleaning", "Charts", "Statistics"],
    price: 2590,
    maxStudent: 20,
    status: "Cancel",
    studentEmails: [],
  },
];

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  const userCollection = db.collection("user");
  const courses = db.collection("course");

  // Verify we are seeding into the intended DB and the 6 user accounts exist.
  // Do not silently create incorrect owner/student references.
  const requiredEmails = [...new Set(examples.flatMap((c) => [c.teacherEmail, ...c.studentEmails]))];
  // Also ensure all six original test users exist even if the templates change.
  for (const email of ["teacher1@example.com", "teacher2@example.com", "teacher3@example.com",
    "student1@example.com", "student2@example.com", "student3@example.com"]) {
    if (!requiredEmails.includes(email)) requiredEmails.push(email);
  }
  const people = await userCollection.find({ email: { $in: requiredEmails } }).toArray();
  const byEmail = new Map(people.map((user) => [user.email, user]));
  for (const email of requiredEmails) {
    const person = byEmail.get(email);
    const expectedRole = email.startsWith("teacher") ? "Teacher" : "Student";
    if (!person || person.role !== expectedRole) {
      throw new Error(`Missing ${expectedRole} account: ${email}. Run 'npm run seed:users' first.`);
    }
  }

  await courses.createIndex({ teacherId: 1 });
  // Partial unique index permits old courses (without seedKey) to stay unchanged.
  await courses.createIndex(
    { seedKey: 1 },
    { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
  );

  let created = 0;
  let preserved = 0;
  for (const example of examples) {
    const { teacherEmail, studentEmails, seedKey, ...fields } = example;
    const teacher = byEmail.get(teacherEmail);
    const studentIds = studentEmails.map((email) => byEmail.get(email)._id);
    if (studentIds.length > fields.maxStudent) throw new Error(`${seedKey} exceeds Max Student`);

    const now = new Date();
    const course = {
      ...fields,
      seedKey,
      teacherId: teacher._id,
      teacherName: teacher.username,
      enrolledStudentIds: studentIds,
      createdAt: now,
      updatedAt: now,
    };
    // Insert only: preserve existing course edits and enrollments on re-run.
    // A seeded course that is manually deleted will be recreated on the next run.
    const result = await courses.updateOne(
      { seedKey },
      { $setOnInsert: course },
      { upsert: true },
    );
    if (result.upsertedCount) created += 1;
    else preserved += 1;
    console.log(`${result.upsertedCount ? "Created" : "Kept"} [${fields.status}] ${fields.name} (${teacher.username}, ${studentIds.length} initial students)`);
  }
  console.log(`Course seed complete in '${dbName}': ${created} new, ${preserved} existing left unchanged.`);
} catch (error) {
  console.error("Course seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
