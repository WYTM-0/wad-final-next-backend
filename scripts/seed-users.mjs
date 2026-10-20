// Run: npm run seed. Node 22 reads .env.local using --env-file.
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
if (!uri || !dbName) {
  console.error("Set MONGODB_URI and DB_NAME in .env.local first.");
  process.exit(1);
}
const password = "CourseDemo2026!";
const users = [
  { username: "teacher1", email: "teacher1@example.com", role: "Teacher" },
  { username: "teacher2", email: "teacher2@example.com", role: "Teacher" },
  { username: "teacher3", email: "teacher3@example.com", role: "Teacher" },
  { username: "student1", email: "student1@example.com", role: "Student" },
  { username: "student2", email: "student2@example.com", role: "Student" },
  { username: "student3", email: "student3@example.com", role: "Student" },
];
const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  await db.collection("user").createIndex({ email: 1 }, { unique: true });
  await db.collection("user").createIndex({ username: 1 }, { unique: true });
  await db.collection("course").createIndex({ teacherId: 1 });
  await db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const hash = await bcrypt.hash(password, 12);
  for (const user of users) {
    // Re-running seed restores the published exam credentials intentionally.
    await db.collection("user").updateOne({ email: user.email }, {
      $set: { ...user, password: hash }, $setOnInsert: { createdAt: new Date() },
    }, { upsert: true });
    console.log(`Prepared ${user.role}: ${user.email}`);
  }
  console.log(`Seed complete for database ${dbName}. Shared demo password: ${password}`);
} finally {
  await client.close();
}
