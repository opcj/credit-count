import { spawnSync } from "node:child_process";
// --local is intentional: this command cannot use a linked hosted database.
const result = spawnSync(
  process.execPath,
  ["node_modules/supabase/dist/supabase.js", "db", "reset", "--local"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
