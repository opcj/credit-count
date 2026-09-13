import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { localDatabase } from "./local-context";

const db = await localDatabase();
const prefix = `cc-perf-${randomUUID()}`;
const report: Record<string, unknown> = {
  measuredAt: new Date().toISOString(),
  environment:
    "Local Supabase Postgres 17 through Docker; SQL timing includes loopback client round trip",
  syntheticUsers: 1000,
  syntheticRides: 100000,
  heavyUserRides: 10000,
  transaction: "All synthetic data rolled back; no public event commits.",
};
try {
  await db.query("begin");
  await db.query(
    `insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    select md5($1||g::text)::uuid,'authenticated','authenticated',$1||g||'@performance.test','unused-no-login',now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('display_name','Performance '||g),now(),now() from generate_series(0,999) g`,
    [prefix],
  );
  await db.query(
    "update public.profiles set leaderboard_opt_in=true where user_id in (select md5($1||g::text)::uuid from generate_series(0,998,2) g)",
    [prefix],
  );
  const coasterIds = (
    await db.query(
      "select id from public.coasters where archived_at is null order by id limit 40",
    )
  ).rows.map((r) => r.id);
  await db.query(
    `insert into public.rides(id,user_id,coaster_id,ridden_on)
    select md5($1||'ride'||g)::uuid, md5($1||(case when g<=10000 then 0 else 1+g%999 end)::text)::uuid,
      ($2::uuid[])[1+g%array_length($2::uuid[],1)], date '2020-01-01'+(g%2000)
    from generate_series(1,100000) g`,
    [prefix, coasterIds],
  );
  await db.query("analyze public.rides");
  await db.query("analyze public.profiles");
  const userId = (await db.query("select md5($1||'0')::uuid id", [prefix]))
    .rows[0].id;
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  const queries = {
    statistics: "select public.get_my_stats()",
    history:
      "select id,coaster_id,ridden_on from public.rides where user_id=(select auth.uid()) order by ridden_on desc,id desc limit 12",
    catalogue:
      "select id,name,park from public.coasters where archived_at is null order by name limit 40",
    leaderboard: "select * from public.get_leaderboard(21,0)",
  };
  const measurements: Record<string, unknown> = {};
  for (const [name, query] of Object.entries(queries)) {
    await db.query(query);
    const samples: number[] = [];
    for (let i = 0; i < 12; i++) {
      const start = performance.now();
      await db.query(query);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const plan = await db.query(
      `explain (analyze,buffers,format json) ${query}`,
    );
    measurements[name] = {
      minMs: samples[0],
      medianMs: samples[6],
      p95Ms: samples[11],
      plan: plan.rows[0]["QUERY PLAN"],
    };
    console.log(
      `${name}: median ${samples[6].toFixed(2)} ms; p95 ${samples[11].toFixed(2)} ms`,
    );
  }
  const stats = (await db.query("select public.get_my_stats() as stats"))
    .rows[0].stats;
  if (stats.total_rides !== 10000 || stats.total_credits !== 40)
    throw new Error(
      "Performance role fixture did not isolate the heavy user correctly.",
    );
  report.measurements = measurements;
} finally {
  await db.query("rollback");
  await db.end();
}
mkdirSync("artifacts/performance", { recursive: true });
writeFileSync(
  "artifacts/performance/database.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log("Measurements saved. Synthetic dataset rolled back.");
