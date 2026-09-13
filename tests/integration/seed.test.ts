import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { localDatabase } from "../../scripts/local-context";

const seed = readFileSync("supabase/seed.sql", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260912000100_catalogue_seed_receipts.sql",
  "utf8",
);
const manifest = JSON.parse(
  readFileSync("supabase/catalogue.json", "utf8"),
) as { id: string }[];

for (const upgrade of [false, true]) {
  test(`R4: reseeding preserves edits, archives, deletes and merges ${upgrade ? "made before the receipts migration" : "with existing receipts"}`, async () => {
    const db = await localDatabase();
    try {
      // All catalogue changes and fixture data are rolled back, including audit rows.
      await db.query("begin");
      if (upgrade) await db.query("drop table private.catalogue_seed_receipts");
      const records = (
        await db.query(
          "select id, revision from public.coasters where id=any($1::uuid[]) and archived_at is null order by id limit 5",
          [manifest.map((c) => c.id)],
        )
      ).rows;
      assert.equal(records.length, 5);
      const [edited, archived, deleted, source, target] = records;
      const uid = randomUUID(),
        ride = randomUUID();
      await db.query(
        "insert into auth.users(id,raw_user_meta_data) values($1,'{}')",
        [uid],
      );
      await db.query("insert into public.admin_users(user_id) values($1)", [
        uid,
      ]);
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
      const name = `Admin correction ${randomUUID()}`;
      await db.query("update public.coasters set name=$2 where id=$1", [
        edited.id,
        name,
      ]);
      await db.query(
        "update public.coasters set archived_at=now() where id=$1",
        [archived.id],
      );
      await db.query("delete from public.rides where coaster_id=$1", [
        deleted.id,
      ]);
      await db.query("delete from public.coasters where id=$1", [deleted.id]);
      await db.query(
        "insert into public.rides(id,coaster_id,ridden_on,note) values($1,$2,'2026-08-01','Preserve merged ride')",
        [ride, source.id],
      );
      await db.query("select public.merge_coasters($1,$2,$3,$4)", [
        source.id,
        target.id,
        source.revision,
        target.revision,
      ]);
      if (upgrade) await db.query(migration);
      const before = (
        await db.query("select * from public.coasters order by id")
      ).rows;
      const auditCount = (
        await db.query("select count(*)::int n from private.catalogue_audit")
      ).rows[0].n;
      await db.query(seed);
      await db.query(seed);
      assert.deepEqual(
        (await db.query("select * from public.coasters order by id")).rows,
        before,
      );
      assert.equal(
        (await db.query("select count(*)::int n from private.catalogue_audit"))
          .rows[0].n,
        auditCount,
      );
      assert.deepEqual(
        (
          await db.query(
            "select coaster_id,note from public.rides where id=$1",
            [ride],
          )
        ).rows,
        [{ coaster_id: target.id, note: "Preserve merged ride" }],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from private.catalogue_seed_receipts where coaster_id=any($1::uuid[])",
            [[deleted.id, source.id]],
          )
        ).rows[0].n,
        2,
      );
      const access = (
        await db.query(`
        select relrowsecurity,
          has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
          has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') as user_access
        from pg_class where oid='private.catalogue_seed_receipts'::regclass
      `)
      ).rows[0];
      assert.deepEqual(access, {
        relrowsecurity: true,
        anon_access: false,
        user_access: false,
      });
    } finally {
      await db.query("rollback");
      await db.end();
    }
  });
}
