import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { publicConfig } from "./config";

export function browserClient() {
  const { url, key } = publicConfig();
  return createBrowserClient<Database>(url, key);
}
