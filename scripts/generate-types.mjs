import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { format } from "prettier";
const types = execFileSync(
  process.execPath,
  [
    "node_modules/supabase/dist/supabase.js",
    "gen",
    "types",
    "typescript",
    "--local",
    "--schema",
    "public",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
const formatted = await format(types, { parser: "typescript", printWidth: 80 });
const target = "src/lib/database.types.ts";
if (process.argv.includes("--check")) {
  const current = await format(readFileSync(target, "utf8"), {
    parser: "typescript",
    printWidth: 80,
  });
  if (current !== formatted)
    throw new Error(
      "Database types drifted. Run npm run db:types and review the change.",
    );
  console.log("Generated database types match the local schema.");
} else {
  writeFileSync(target, formatted);
  console.log("Generated public database types from local migrations.");
}
