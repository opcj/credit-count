import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { localConfiguration } from "./local-context";

const config = localConfiguration();
const accounts = JSON.parse(readFileSync("credentials.local.json", "utf8")) as {
  password: string;
}[];
const secrets = [config.service, ...accounts.map((a) => a.password)];
const ignored = new Set([
  "node_modules",
  ".next",
  ".git",
  ".tools",
  "artifacts",
  "test-results",
  "playwright-report",
  ".temp",
  ".branches",
]);
function files(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    if (
      ignored.has(name) ||
      name.startsWith(".env") ||
      name.startsWith("credentials.local.") ||
      name.endsWith(".log")
    )
      return [];
    const path = join(root, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const source = files(".");
function allFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const p = join(root, name);
    return statSync(p).isDirectory() ? allFiles(p) : [p];
  });
}
const targets = [...source, ...allFiles(".next/static")];
const hits: string[] = [];
for (const path of targets) {
  const data = readFileSync(path);
  if (secrets.some((secret) => data.includes(Buffer.from(secret))))
    hits.push(path);
}
if (hits.length)
  throw new Error(
    `Privileged credentials found in these files (values suppressed): ${hits.join(", ")}`,
  );
const runtime = files("src");
for (const path of runtime)
  if (
    /SUPABASE_SERVICE_ROLE_KEY|LOCAL_DATABASE_URL|credentials\.local|scripts\/local-context/.test(
      readFileSync(path, "utf8"),
    )
  )
    throw new Error(`Privileged setup import/reference in runtime: ${path}`);
console.log(
  `Secret scan passed: ${source.length} source/document files and production browser assets. No actual local service key or generated password found; no privileged setup references in src.`,
);
