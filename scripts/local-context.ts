import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import type { Database } from "../src/lib/database.types";

export function localConfiguration() {
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid");
  const database = new URL(
    process.env.LOCAL_DATABASE_URL ?? "postgresql://invalid",
  );
  if (
    process.env.CREDIT_COUNT_LOCAL_TESTS !== "true" ||
    !["127.0.0.1", "localhost"].includes(api.hostname) ||
    api.port !== "55321" ||
    !["127.0.0.1", "localhost"].includes(database.hostname) ||
    database.port !== "55322" ||
    database.pathname !== "/postgres"
  ) {
    throw new Error(
      "Refusing to modify a non-local database. Expected Credit Count on loopback ports 55321/55322 and CREDIT_COUNT_LOCAL_TESTS=true.",
    );
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !service) throw new Error("Run npm run setup:local first.");
  return { url: api.origin, key, service, connectionString: database.href };
}
export function localAdmin() {
  const { url, service } = localConfiguration();
  return createClient<Database>(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function localClient() {
  const { url, key } = localConfiguration();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function localDatabase() {
  const db = new Client({
    connectionString: localConfiguration().connectionString,
  });
  await db.connect();
  return db;
}
