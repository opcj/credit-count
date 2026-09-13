import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const status = JSON.parse(
  execFileSync(
    process.execPath,
    ["node_modules/supabase/dist/supabase.js", "status", "--output", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost):55321$/.test(status.API_URL))
  throw new Error("Expected the local Credit Count API.");
if (existsSync(".env.local") && !process.argv.includes("--replace"))
  throw new Error(
    ".env.local exists. Use --replace intentionally to regenerate local configuration.",
  );
writeFileSync(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY || status.ANON_KEY}`,
    "NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000",
    `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
    `LOCAL_DATABASE_URL=${status.DB_URL}`,
    "CREDIT_COUNT_LOCAL_TESTS=true",
    "",
  ].join("\n"),
);
console.log(
  "Local configuration written to ignored .env.local. Credentials were not printed.",
);
