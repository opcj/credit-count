import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import {
  localAdmin,
  localClient,
  localConfiguration,
  localDatabase,
} from "../../scripts/local-context";
import { statsSchema } from "../../src/lib/domain";

test(
  "real Supabase authorization, integrity, concurrency, and publication boundaries",
  { timeout: 120_000 },
  async (t) => {
    const admin = localAdmin();
    const sql = await localDatabase();
    const config = localConfiguration();
    const userIds: string[] = [];
    const coasterIds: string[] = [];
    const suffix = randomBytes(5).toString("hex");
    async function identity(label: string, catalogueAdmin = false) {
      const password = randomBytes(16).toString("hex");
      const email = `${label}-${suffix}@credit-count.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `${label}-${suffix}`,
          role: "admin",
          leaderboard_opt_in: true,
        },
      });
      assert.ifError(error);
      const id = data.user!.id;
      userIds.push(id);
      if (catalogueAdmin)
        await sql.query("insert into public.admin_users(user_id) values($1)", [
          id,
        ]);
      const client = localClient();
      const signed = await client.auth.signInWithPassword({ email, password });
      assert.ifError(signed.error);
      return {
        id,
        client,
        token: signed.data.session!.access_token,
        name: `${label}-${suffix}`,
      };
    }
    async function raw(
      path: string,
      token?: string,
      method = "GET",
      body?: unknown,
    ) {
      const result = await fetch(`${config.url}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: config.key,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: result.status,
        data: await result.json().catch(() => null),
      };
    }
    async function coaster(
      name: string,
      country = "GB",
      maker = "Maker One",
      type = "steel",
    ) {
      const id = randomUUID();
      coasterIds.push(id);
      await sql.query(
        "insert into public.coasters(id,name,park,country_code,manufacturer,type) values($1,$2,$3,$4,$5,$6)",
        [id, `${name}-${suffix}`, "Integration Park", country, maker, type],
      );
      return id;
    }
    try {
      const a = await identity("A");
      const b = await identity("B");
      const c = await identity("Admin", true);
      const ids = [
        await coaster("A"),
        await coaster("B", "GB", "Maker Two", "wooden"),
        await coaster("C", "US"),
      ];
      const rides = [ids[0], ids[0], ids[1], ids[2]].map((coaster_id, i) => ({
        id: randomUUID(),
        coaster_id,
        ridden_on: "2026-08-01",
        note: `private-note-${suffix}-${i}`,
      }));
      await t.test(
        "T02/T07: profile bootstrap ignores privileged metadata and defaults to private",
        async () => {
          const profile = await a.client.from("profiles").select("*").single();
          assert.ifError(profile.error);
          assert.equal(profile.data!.leaderboard_opt_in, false);
          assert.equal(profile.data!.display_name, a.name);
          assert.deepEqual(
            (await a.client.from("admin_users").select("*")).data,
            [],
          );
          assert.ok(
            (await raw("admin_users", a.token, "POST", { user_id: a.id }))
              .status >= 400,
          );
          assert.ok(
            (
              await raw(`profiles?user_id=eq.${a.id}`, a.token, "PATCH", {
                user_id: b.id,
              })
            ).status >= 400,
          );
          assert.ok(
            (
              await raw("profiles", a.token, "POST", {
                user_id: a.id,
                display_name: "Spoof",
              })
            ).status >= 400,
          );
        },
      );
      await t.test(
        "T03: four individual ride rows give three credits and correct distinct breakdowns",
        async () => {
          const inserted = await a.client.from("rides").insert(rides);
          assert.ifError(inserted.error);
          const result = await a.client.rpc("get_my_stats");
          assert.ifError(result.error);
          const stats = statsSchema.parse(result.data);
          assert.equal(stats.total_credits, 3);
          assert.equal(stats.total_rides, 4);
          assert.deepEqual(stats.by_country, [
            { label: "GB", count: 2 },
            { label: "US", count: 1 },
          ]);
          assert.deepEqual(stats.by_manufacturer, [
            { label: "Maker One", count: 2 },
            { label: "Maker Two", count: 1 },
          ]);
          assert.deepEqual(stats.by_type, [
            { label: "steel", count: 2 },
            { label: "wooden", count: 1 },
          ]);
          assert.equal(stats.most_ridden!.id, ids[0]);
          assert.equal(stats.most_ridden!.rides, 2);
        },
      );
      await t.test(
        "T05/T06/T08: anon, another user, and catalogue admin cannot read or mutate private rides",
        async () => {
          for (const principal of [b, c]) {
            const read = await principal.client
              .from("rides")
              .select("*, coasters(*)", { count: "exact" })
              .eq("user_id", a.id);
            assert.ifError(read.error);
            assert.deepEqual(read.data, []);
            assert.equal(read.count, 0);
            const patch = await principal.client
              .from("rides")
              .update({ note: "stolen" })
              .eq("id", rides[0].id)
              .select();
            assert.deepEqual(patch.data, []);
            const del = await principal.client
              .from("rides")
              .delete()
              .eq("id", rides[0].id)
              .select();
            assert.deepEqual(del.data, []);
            assert.equal(
              statsSchema.parse(
                (await principal.client.rpc("get_my_stats")).data,
              ).total_rides,
              0,
            );
            assert.deepEqual(
              (
                await principal.client
                  .from("profiles")
                  .select("*")
                  .eq("user_id", a.id)
              ).data,
              [],
            );
          }
          for (const table of [
            "profiles",
            "rides",
            "coasters",
            "admin_users",
          ]) {
            const result = await raw(`${table}?select=*`);
            assert.ok(result.status >= 400 || result.data.length === 0, table);
          }
          assert.ok(
            (await raw("rpc/get_my_stats", undefined, "POST", {})).status >=
              400,
          );
          const own = await a.client
            .from("rides")
            .select("note")
            .eq("id", rides[0].id)
            .single();
          assert.equal(own.data!.note, rides[0].note);
        },
      );
      await t.test(
        "T07: API callers cannot forge ownership or server-managed revisions",
        async () => {
          assert.ok(
            (
              await raw("rides", b.token, "POST", {
                coaster_id: ids[0],
                user_id: a.id,
                ridden_on: "2026-08-01",
              })
            ).status >= 400,
          );
          assert.ok(
            (
              await raw(`rides?id=eq.${rides[0].id}`, a.token, "PATCH", {
                user_id: b.id,
              })
            ).status >= 400,
          );
          assert.ok(
            (
              await raw(`rides?id=eq.${rides[0].id}`, a.token, "PATCH", {
                revision: 999,
              })
            ).status >= 400,
          );
        },
      );
      await t.test(
        "T09/T10: public aggregate has exactly two fields, includes zero, and excludes opt-outs immediately",
        async () => {
          await a.client
            .from("profiles")
            .update({ leaderboard_opt_in: true })
            .eq("user_id", a.id);
          await b.client
            .from("profiles")
            .update({ leaderboard_opt_in: true })
            .eq("user_id", b.id);
          const before = await raw("rpc/get_leaderboard", undefined, "POST", {
            p_limit: 100,
            p_offset: 0,
          });
          assert.equal(before.status, 200);
          for (const row of before.data)
            assert.deepEqual(Object.keys(row).sort(), [
              "credit_count",
              "display_name",
            ]);
          assert.equal(
            before.data.find(
              (r: { display_name: string }) => r.display_name === a.name,
            ).credit_count,
            3,
          );
          assert.equal(
            before.data.find(
              (r: { display_name: string }) => r.display_name === b.name,
            ).credit_count,
            0,
          );
          await a.client
            .from("profiles")
            .update({ leaderboard_opt_in: false })
            .eq("user_id", a.id);
          const after = await raw("rpc/get_leaderboard", undefined, "POST", {
            p_limit: 100,
          });
          assert.ok(
            !after.data.some(
              (r: { display_name: string }) => r.display_name === a.name,
            ),
          );
          assert.ok(
            (
              await raw("rpc/get_leaderboard", undefined, "POST", {
                p_limit: 10001,
              })
            ).status >= 400,
          );
          assert.ok(
            (
              await raw("rpc/get_leaderboard", undefined, "POST", {
                user_id: a.id,
              })
            ).status >= 400,
          );
        },
      );
      await t.test(
        "T11: database policies allow admin catalogue writes and deny enthusiast writes and merging",
        async () => {
          const newId = randomUUID();
          coasterIds.push(newId);
          const row = {
            id: newId,
            name: `Admin entry-${suffix}`,
            park: "Test Park",
            country_code: "GB",
            manufacturer: "Maker One",
            type: "steel",
          };
          assert.ok(
            (await raw("coasters", a.token, "POST", row)).status >= 400,
          );
          assert.equal(
            (await raw("coasters", c.token, "POST", row)).status,
            201,
          );
          assert.deepEqual(
            (
              await a.client
                .from("coasters")
                .update({ name: "unauthorized" })
                .eq("id", newId)
                .select()
            ).data,
            [],
          );
          assert.deepEqual(
            (await a.client.from("coasters").delete().eq("id", newId).select())
              .data,
            [],
          );
          assert.ifError(
            (
              await c.client
                .from("coasters")
                .update({ name: `Edited-${suffix}` })
                .eq("id", newId)
            ).error,
          );
          assert.ok(
            (
              await a.client.rpc("merge_coasters", {
                p_source_id: ids[0],
                p_target_id: ids[1],
                p_source_revision: 1,
                p_target_revision: 1,
              })
            ).error,
          );
          assert.ifError(
            (await c.client.from("coasters").delete().eq("id", newId)).error,
          );
          const ownAdminRides = await c.client
            .from("rides")
            .select("*")
            .eq("user_id", a.id);
          assert.deepEqual(ownAdminRides.data, []);
        },
      );
      await t.test(
        "T12/T20: archive preserves credits, rejects new selection, and permits editing existing notes",
        async () => {
          assert.ok(
            (await c.client.from("coasters").delete().eq("id", ids[2])).error,
          );
          assert.ifError(
            (
              await c.client
                .from("coasters")
                .update({ archived_at: new Date().toISOString() })
                .eq("id", ids[2])
            ).error,
          );
          assert.equal(
            statsSchema.parse((await a.client.rpc("get_my_stats")).data)
              .total_credits,
            3,
          );
          assert.ok(
            (
              await a.client
                .from("rides")
                .insert({ coaster_id: ids[2], ridden_on: "2026-08-02" })
            ).error,
          );
          assert.ok(
            (
              await a.client
                .from("rides")
                .update({ coaster_id: ids[2] })
                .eq("id", rides[0].id)
            ).error,
          );
          assert.ifError(
            (
              await a.client
                .from("rides")
                .update({ note: "Still my memory", ridden_on: "2026-08-03" })
                .eq("id", rides[3].id)
            ).error,
          );
          assert.ifError(
            (
              await c.client
                .from("coasters")
                .update({ archived_at: null })
                .eq("id", ids[2])
            ).error,
          );
        },
      );
      await t.test(
        "T13: an archive/logging race cannot insert against an already committed archive",
        async () => {
          await sql.query("begin");
          try {
            await sql.query(
              "update public.coasters set archived_at=now() where id=$1",
              [ids[2]],
            );
            const insertion = a.client
              .from("rides")
              .insert({ coaster_id: ids[2], ridden_on: "2026-08-03" })
              .then((r) => r);
            await delay(100);
            await sql.query("commit");
            assert.ok((await insertion).error);
          } catch (error) {
            await sql.query("rollback");
            throw error;
          }
          await c.client
            .from("coasters")
            .update({ archived_at: null })
            .eq("id", ids[2]);
        },
      );
      await t.test(
        "T12/T13/T24: duplicate merge is atomic, preserves private ride fields, and records catalogue-only audit",
        async () => {
          const before = (await a.client.from("rides").select("*").order("id"))
            .data!;
          const source = (
            await c.client
              .from("coasters")
              .select("*")
              .eq("id", ids[2])
              .single()
          ).data!;
          const target = (
            await c.client
              .from("coasters")
              .select("*")
              .eq("id", ids[1])
              .single()
          ).data!;
          assert.ok(
            (
              await c.client.rpc("merge_coasters", {
                p_source_id: source.id,
                p_target_id: source.id,
                p_source_revision: source.revision,
                p_target_revision: source.revision,
              })
            ).error,
          );
          assert.ok(
            (
              await c.client.rpc("merge_coasters", {
                p_source_id: source.id,
                p_target_id: randomUUID(),
                p_source_revision: source.revision,
                p_target_revision: 1,
              })
            ).error,
          );
          assert.ok(
            (
              await c.client.rpc("merge_coasters", {
                p_source_id: source.id,
                p_target_id: target.id,
                p_source_revision: 999,
                p_target_revision: target.revision,
              })
            ).error,
          );
          // Fail after references move and the source is deleted: the entire RPC must roll back.
          const auditBefore = (
            await sql.query(
              "select count(*)::int n from private.catalogue_audit where coaster_id=$1",
              [source.id],
            )
          ).rows[0].n;
          await sql.query(
            "alter table private.catalogue_audit add constraint cc_test_merge_failure check (operation <> 'merge') not valid",
          );
          try {
            assert.ok(
              (
                await c.client.rpc("merge_coasters", {
                  p_source_id: source.id,
                  p_target_id: target.id,
                  p_source_revision: source.revision,
                  p_target_revision: target.revision,
                })
              ).error,
            );
            assert.deepEqual(
              (await a.client.from("rides").select("*").order("id")).data,
              before,
            );
            assert.ok(
              (
                await c.client
                  .from("coasters")
                  .select("id")
                  .eq("id", source.id)
                  .maybeSingle()
              ).data,
            );
            assert.equal(
              (
                await sql.query(
                  "select count(*)::int n from private.catalogue_audit where coaster_id=$1",
                  [source.id],
                )
              ).rows[0].n,
              auditBefore,
            );
          } finally {
            await sql.query(
              "alter table private.catalogue_audit drop constraint cc_test_merge_failure",
            );
          }
          await sql.query("begin");
          try {
            await sql.query("set local role authenticated");
            await sql.query("select set_config('request.jwt.claims',$1,true)", [
              JSON.stringify({ sub: c.id, role: "authenticated" }),
            ]);
            await sql.query("select public.merge_coasters($1,$2,$3,$4)", [
              source.id,
              target.id,
              source.revision,
              target.revision,
            ]);
            const racingInsert = a.client
              .from("rides")
              .insert({ coaster_id: source.id, ridden_on: "2026-08-01" })
              .then((r) => r);
            await delay(100);
            await sql.query("commit");
            assert.ok(
              (await racingInsert).error,
              "A save waiting on the removed duplicate must fail after merge commits",
            );
          } catch (error) {
            await sql.query("rollback");
            throw error;
          }
          const after = (await a.client.from("rides").select("*").order("id"))
            .data!;
          assert.equal(after.length, before.length);
          before.forEach((r, i) => {
            for (const key of [
              "id",
              "user_id",
              "ridden_on",
              "note",
              "created_at",
            ] as const)
              assert.equal(after[i][key], r[key]);
            assert.equal(
              after[i].coaster_id,
              r.coaster_id === source.id ? target.id : r.coaster_id,
            );
          });
          assert.equal(
            statsSchema.parse((await a.client.rpc("get_my_stats")).data)
              .total_credits,
            2,
          );
          assert.equal(
            (await c.client.from("coasters").select("id").eq("id", source.id))
              .data!.length,
            0,
          );
          const audit = await sql.query(
            "select * from private.catalogue_audit where operation='merge' and coaster_id=$1",
            [source.id],
          );
          assert.equal(audit.rows.length, 1);
          const serialized = JSON.stringify(audit.rows);
          assert.ok(!serialized.includes(rides[0].note));
          assert.ok(!serialized.includes(a.id));
          assert.ok(!serialized.includes(rides[0].id));
          for (const token of [undefined, a.token, c.token])
            assert.ok((await raw("catalogue_audit", token)).status >= 400);
        },
      );
      await t.test(
        "T14/T25: a repeated UUID cannot duplicate a ride; revision predicates prevent stale edits",
        async () => {
          const repeat = {
            id: randomUUID(),
            coaster_id: ids[0],
            ridden_on: "2026-08-01",
            note: "repeat",
          };
          assert.ifError((await a.client.from("rides").insert(repeat)).error);
          assert.equal(
            (await a.client.from("rides").insert(repeat)).error!.code,
            "23505",
          );
          const row = (
            await a.client
              .from("rides")
              .select("*")
              .eq("id", repeat.id)
              .single()
          ).data!;
          assert.ifError(
            (
              await a.client
                .from("rides")
                .update({ note: "first edit" })
                .eq("id", row.id)
                .eq("revision", row.revision)
            ).error,
          );
          assert.deepEqual(
            (
              await a.client
                .from("rides")
                .update({ note: "stale edit" })
                .eq("id", row.id)
                .eq("revision", row.revision)
                .select()
            ).data,
            [],
          );
          assert.equal(
            (
              await a.client
                .from("rides")
                .select("note")
                .eq("id", row.id)
                .single()
            ).data!.note,
            "first edit",
          );
          assert.ifError(
            (
              await a.client
                .from("rides")
                .insert({ ...repeat, id: randomUUID() })
            ).error,
          );
        },
      );
      await t.test(
        "T04: deleting repeat rows preserves a credit until its final ride is deleted",
        async () => {
          const list = (
            await a.client.from("rides").select("id").eq("coaster_id", ids[0])
          ).data!;
          for (let i = 0; i < list.length; i++) {
            assert.ifError(
              (await a.client.from("rides").delete().eq("id", list[i].id))
                .error,
            );
            assert.equal(
              statsSchema.parse((await a.client.rpc("get_my_stats")).data)
                .total_credits,
              i === list.length - 1 ? 1 : 2,
            );
          }
        },
      );
      await t.test(
        "T15/T25: duplicate names, bounded public pages, and profile/catalogue conflicts",
        async () => {
          const zeroOne = await identity("ZeroOne");
          const zeroTwo = await identity("ZeroTwo");
          const repeatedName = "Identical " + suffix;
          for (const user of [zeroOne, zeroTwo])
            assert.ifError(
              (
                await user.client
                  .from("profiles")
                  .update({
                    display_name: repeatedName,
                    leaderboard_opt_in: true,
                  })
                  .eq("user_id", user.id)
              ).error,
            );
          const anon = localClient();
          const all = (
            await anon.rpc("get_leaderboard", { p_limit: 100, p_offset: 0 })
          ).data!;
          assert.equal(
            all.filter(
              (r) => r.display_name === repeatedName && r.credit_count === 0,
            ).length,
            2,
          );
          const first = await anon.rpc("get_leaderboard", {
            p_limit: 2,
            p_offset: 0,
          });
          const second = await anon.rpc("get_leaderboard", {
            p_limit: 2,
            p_offset: 2,
          });
          assert.deepEqual([...first.data!, ...second.data!], all.slice(0, 4));
          for (const args of [
            { p_limit: 101, p_offset: 0 },
            { p_limit: 0, p_offset: 0 },
            { p_limit: 20, p_offset: -1 },
            { p_limit: 20, p_offset: 100001 },
          ])
            assert.ok((await anon.rpc("get_leaderboard", args)).error);
          const profile = (await a.client.from("profiles").select("*").single())
            .data!;
          assert.ifError(
            (
              await a.client
                .from("profiles")
                .update({ display_name: "Latest " + suffix })
                .eq("user_id", a.id)
                .eq("revision", profile.revision)
            ).error,
          );
          assert.deepEqual(
            (
              await a.client
                .from("profiles")
                .update({ display_name: "Stale" })
                .eq("user_id", a.id)
                .eq("revision", profile.revision)
                .select()
            ).data,
            [],
          );
          const coaster = (
            await c.client
              .from("coasters")
              .select("*")
              .eq("id", ids[0])
              .single()
          ).data!;
          assert.ifError(
            (
              await c.client
                .from("coasters")
                .update({ park: "Latest Park" })
                .eq("id", coaster.id)
                .eq("revision", coaster.revision)
            ).error,
          );
          assert.deepEqual(
            (
              await c.client
                .from("coasters")
                .delete()
                .eq("id", coaster.id)
                .eq("revision", coaster.revision)
                .select()
            ).data,
            [],
          );
          await anon.realtime.disconnect();
        },
      );
      await t.test(
        "T21/T22: public-profile hints contain only a transport ID and private edits emit no events",
        async () => {
          const client = localClient();
          const messages: { payload: unknown }[] = [];
          const channel = client.channel("credit-count:leaderboard", {
            config: { private: false },
          });
          try {
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error("Realtime subscription timed out")),
                10_000,
              );
              channel
                .on("broadcast", { event: "leaderboard_changed" }, (message) =>
                  messages.push({ payload: message.payload }),
                )
                .subscribe((status) => {
                  if (status === "SUBSCRIBED") {
                    clearTimeout(timer);
                    resolve();
                  }
                });
            });
            const optedIn = await a.client
              .from("profiles")
              .update({ leaderboard_opt_in: true })
              .eq("user_id", a.id);
            assert.ifError(optedIn.error);
            for (let i = 0; i < 200 && messages.length === 0; i++)
              await delay(50);
            assert.ok(
              messages.length > 0,
              "No public-profile hint arrived within 10 seconds of a successful consent commit.",
            );
            // realtime.send adds its transport message ID to the empty application
            // payload. It is not a profile/coaster/ride identifier.
            const payload = messages[0].payload as { id: string };
            assert.deepEqual(Object.keys(payload), ["id"]);
            assert.match(payload.id, /^[0-9a-f-]{36}$/);
            assert.ok(
              ![...userIds, ...coasterIds, ...rides.map((r) => r.id)].includes(
                payload.id,
              ),
            );
            await a.client
              .from("profiles")
              .update({ leaderboard_opt_in: false })
              .eq("user_id", a.id);
            const before = await sql.query(
              "select count(*)::int as n from realtime.messages where topic='credit-count:leaderboard' and event='leaderboard_changed'",
            );
            await a.client
              .from("profiles")
              .update({ display_name: "Private new name" })
              .eq("user_id", a.id);
            await a.client
              .from("rides")
              .update({ note: "Never broadcast this", ridden_on: "2026-08-09" })
              .eq("id", rides[2].id);
            const after = await sql.query(
              "select count(*)::int as n from realtime.messages where topic='credit-count:leaderboard' and event='leaderboard_changed'",
            );
            assert.equal(after.rows[0].n, before.rows[0].n);
          } finally {
            await client.removeChannel(channel);
            client.realtime.disconnect();
          }
        },
      );
      await t.test(
        "T23: notification failure cannot prevent privacy withdrawal",
        async () => {
          const original = (
            await sql.query(
              "select pg_get_functiondef('private.notify_leaderboard()'::regprocedure) as definition",
            )
          ).rows[0].definition as string;
          const failing = original.replace(
            /perform realtime\.send\([^;]+;/,
            "raise exception 'Injected delivery failure';",
          );
          assert.notEqual(failing, original);
          await b.client
            .from("profiles")
            .update({ leaderboard_opt_in: true })
            .eq("user_id", b.id);
          try {
            await sql.query(failing);
            assert.ifError(
              (
                await b.client
                  .from("profiles")
                  .update({ leaderboard_opt_in: false })
                  .eq("user_id", b.id)
              ).error,
            );
            const result = await raw("rpc/get_leaderboard", undefined, "POST", {
              p_limit: 100,
            });
            assert.ok(
              !result.data.some(
                (r: { display_name: string }) => r.display_name === b.name,
              ),
            );
          } finally {
            await sql.query(original);
          }
        },
      );
      await t.test(
        "T01/T31/T33: reproducible catalogue and least-privilege schema expose no alternate private entry point",
        async () => {
          const manifest = JSON.parse(
            readFileSync("supabase/catalogue.json", "utf8"),
          ) as { id: string; verified_at: string }[];
          assert.equal(manifest.length, 40);
          assert.ok(manifest.every((c) => c.verified_at));
          await sql.query(readFileSync("supabase/seed.sql", "utf8"));
          await sql.query(readFileSync("supabase/seed.sql", "utf8"));
          assert.equal(
            (
              await sql.query(
                "select count(*)::int n from public.coasters where id=any($1::uuid[])",
                [manifest.map((c) => c.id)],
              )
            ).rows[0].n,
            40,
          );
          const policies = await sql.query(
            "select relname,relrowsecurity from pg_class where oid=any(array['public.profiles'::regclass,'public.admin_users'::regclass,'public.rides'::regclass,'public.coasters'::regclass])",
          );
          assert.ok(policies.rows.every((r) => r.relrowsecurity));
          const functions = await sql.query(
            "select proname,proconfig,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'",
          );
          assert.ok(
            functions.rows.every(
              (r) =>
                !r.anon_execute &&
                r.proconfig.some((v: string) => v.startsWith("search_path=")),
            ),
          );
          const publication = await sql.query(
            "select * from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('rides','profiles','admin_users')",
          );
          assert.equal(publication.rows.length, 0);
          const graphql = await fetch(`${config.url}/graphql/v1`, {
            method: "POST",
            headers: { apikey: config.key, "Content-Type": "application/json" },
            body: JSON.stringify({
              query: "{ ridesCollection { edges { node { note } } } }",
            }),
          });
          const body = await graphql.text();
          assert.ok(!body.includes(`private-note-${suffix}`));
          assert.ok(graphql.status >= 400 || !body.includes('"note":'));
        },
      );
    } finally {
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
      await sql.query("delete from public.coasters where id=any($1::uuid[])", [
        coasterIds,
      ]);
      await sql.end();
    }
  },
);
