import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { Client } from "pg";
import { localConfiguration, localDatabase } from "./local-context";

const configuration = localConfiguration();
const suffix = randomBytes(4).toString("hex");
const name = `credit_count_restore_${suffix}`;
const container = "supabase_db_credit-count";
const dump = `/tmp/credit-count-${suffix}.dump`;
if (
  !/^credit_count_restore_[a-f0-9]{8}$/.test(name) ||
  !/^\/tmp\/credit-count-[a-f0-9]{8}\.dump$/.test(dump)
)
  throw new Error("Unsafe rehearsal target.");
const db = await localDatabase();
let created = false;
const run = (args: string[]) =>
  execFileSync("docker", ["exec", container, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  });
try {
  const before = (
    await db.query(
      "select (select count(*) from public.coasters)::int coasters,(select count(*) from public.rides)::int rides,(select count(*) from public.profiles)::int profiles",
    )
  ).rows[0];
  run([
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "--format=custom",
    "--no-owner",
    "--file",
    dump,
  ]);
  run(["createdb", "-U", "supabase_admin", "--template=template0", name]);
  created = true;
  run([
    "pg_restore",
    "-U",
    "supabase_admin",
    "--dbname",
    name,
    "--no-owner",
    "--exit-on-error",
    dump,
  ]);
  const target = new URL(configuration.connectionString);
  target.username = "supabase_admin";
  target.pathname = `/${name}`;
  const restored = new Client({ connectionString: target.href });
  await restored.connect();
  try {
    const after = (
      await restored.query(
        "select (select count(*) from public.coasters)::int coasters,(select count(*) from public.rides)::int rides,(select count(*) from public.profiles)::int profiles",
      )
    ).rows[0];
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error("Restored table counts do not match.");
    const privacy = await restored.query(
      "select relrowsecurity from pg_class where oid='public.rides'::regclass",
    );
    if (!privacy.rows[0].relrowsecurity)
      throw new Error("Restore lost ride RLS.");
    // Recreate our application objects on the restored provider substrate only.
    // This target is unique and isolated; the source/demo database is never reset.
    assert.equal(
      (await restored.query("select current_database() as name")).rows[0].name,
      name,
    );
    await restored.query(`
      drop trigger if exists credit_count_signup on auth.users;
      drop function public.merge_coasters(uuid,uuid,integer,integer);
      drop function public.get_my_stats();
      drop function public.get_leaderboard(integer,integer);
      drop table public.rides, public.coasters, public.admin_users, public.profiles cascade;
      drop type public.coaster_type;
      drop schema private cascade;
    `);
    const migrations = readdirSync("supabase/migrations")
      .filter((n) => n.endsWith(".sql"))
      .sort();
    for (const migration of migrations)
      await restored.query(
        readFileSync(`supabase/migrations/${migration}`, "utf8"),
      );
    const seed = readFileSync("supabase/seed.sql", "utf8");
    // A failed seed must roll back receipts as well as catalogue rows.
    const invalidSeed = seed.replace("'GB'", "'INVALID'");
    assert.notEqual(invalidSeed, seed);
    await assert.rejects(restored.query(invalidSeed), { code: "23514" });
    assert.equal(
      (
        await restored.query(
          "select count(*)::int n from private.catalogue_seed_receipts",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await restored.query("select count(*)::int n from public.coasters"))
        .rows[0].n,
      0,
    );
    // Concurrent initial seeds claim each ID once on this isolated database.
    const concurrent = new Client({ connectionString: target.href });
    await concurrent.connect();
    try {
      await Promise.all([restored.query(seed), concurrent.query(seed)]);
    } finally {
      await concurrent.end();
    }
    assert.equal(
      (
        await restored.query(
          "select count(*)::int n from private.catalogue_seed_receipts",
        )
      ).rows[0].n,
      40,
    );
    assert.equal(
      (await restored.query("select count(*)::int n from public.coasters"))
        .rows[0].n,
      40,
    );
    assert.equal(
      (
        await restored.query(
          "select count(*)::int n from pg_policies where schemaname='public' and tablename in ('profiles','rides','coasters','admin_users')",
        )
      ).rows[0].n,
      11,
    );
    const uid = "00000000-0000-4000-8000-000000000091";
    const other = "00000000-0000-4000-8000-000000000092";
    await restored.query(
      'insert into auth.users(id,raw_user_meta_data) values($1,\'{"display_name":"Fresh rider","role":"admin"}\'),($2,\'{}\')',
      [uid, other],
    );
    await restored.query("set role authenticated");
    await restored.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    assert.equal(
      (await restored.query("select count(*)::int n from public.profiles"))
        .rows[0].n,
      1,
    );
    assert.equal(
      (await restored.query("select leaderboard_opt_in from public.profiles"))
        .rows[0].leaderboard_opt_in,
      false,
    );
    assert.equal(
      (await restored.query("select count(*)::int n from public.admin_users"))
        .rows[0].n,
      0,
    );
    await restored.query(
      "insert into public.rides(coaster_id,ridden_on) select id,date '2026-01-01' from public.coasters limit 1",
    );
    assert.equal(
      (await restored.query("select public.get_my_stats() stats")).rows[0].stats
        .total_credits,
      1,
    );
    await restored.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: other, role: "authenticated" }),
    ]);
    assert.equal(
      (await restored.query("select count(*)::int n from public.rides")).rows[0]
        .n,
      0,
    );
    await restored.query("reset role");
    mkdirSync("artifacts/recovery", { recursive: true });
    writeFileSync(
      "artifacts/recovery/rehearsal.json",
      JSON.stringify(
        {
          date: new Date().toISOString(),
          source: "local Credit Count",
          counts: after,
          rlsPreserved: true,
          target: "isolated temporary database",
          applicationRepointed: false,
          migrationRebuild: {
            migrations,
            seedRuns: 2,
            catalogueCount: 40,
            policies: 11,
            signupAndCrossUserIsolation: true,
            seedFailureAtomicity: true,
            concurrentSeedReceipts: true,
          },
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Isolated database restore succeeded; counts and ride RLS match. The running application was not repointed.",
    );
  } finally {
    await restored.end();
  }
} finally {
  if (created) run(["dropdb", "-U", "supabase_admin", "--if-exists", name]);
  run(["rm", "-f", "--", dump]);
  await db.end();
}
