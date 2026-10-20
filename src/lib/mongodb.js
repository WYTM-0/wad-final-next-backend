// Keep the original shared MongoDB helper; reuse connections across requests.
import { MongoClient } from "mongodb";
let promise;
let cachedUri;
export function getClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGODB_URI in next-backend/.env.local or Vercel env variables");
  if (!promise || cachedUri !== uri) {
    cachedUri = uri;
    promise = new MongoClient(uri, { maxPoolSize: 10 }).connect().catch((err) => {
      promise = undefined;
      throw err;
    });
  }
  return promise;
}
export async function getDb() {
  if (!process.env.DB_NAME) throw new Error("Set DB_NAME in next-backend/.env.local");
  const client = await getClientPromise();
  return client.db(process.env.DB_NAME);
}
