import { execFileSync } from "node:child_process";
import { localConfiguration } from "./local-context";
localConfiguration();
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run through npm run verify.");
for (const command of [
  "lint",
  "typecheck",
  "test",
  "db:types:check",
  "test:integration",
  "build",
  "test:e2e",
  "test:secrets",
]) {
  console.log(`Verifying ${command}`);
  execFileSync(process.execPath, [npm, "run", command], {
    stdio: "inherit",
    env: { ...process.env, E2E_PRODUCTION: "true" },
  });
}
if (process.argv.includes("--full"))
  for (const command of ["test:performance", "test:recovery"]) {
    execFileSync(process.execPath, [npm, "run", command], { stdio: "inherit" });
  }
console.log(
  "Local verification completed. Hosted release and human review are separate.",
);
