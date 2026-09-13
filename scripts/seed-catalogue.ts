import { readFileSync } from "node:fs";
import { localDatabase } from "./local-context";
const db = await localDatabase();
try {
  await db.query(readFileSync("supabase/seed.sql", "utf8"));
  console.log(
    "Local catalogue seeded; prior edits, archives, deletions and merges preserved.",
  );
} finally {
  await db.end();
}
