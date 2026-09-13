import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { publicConfig } from "./config";

export async function serverClient() {
  const jar = await cookies();
  const { url, key } = publicConfig();
  return createServerClient<Database>(url, key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Server Components cannot set cookies. The proxy performs session refresh;
        // route handlers can write this same cookie adapter directly.
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {}
      },
    },
  });
}
