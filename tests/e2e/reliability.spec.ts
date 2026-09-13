import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, signIn, makeAdmin } from "./fixtures";
import { localAdmin } from "../../scripts/local-context";

async function holdMutation(page: Page, table: string, method: string) {
  let release = () => {};
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  let committed = false;
  let delivered = false;
  await page.route(`**/rest/v1/${table}**`, async (route) => {
    if (route.request().method() !== method || held) return route.continue();
    held = true;
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    committed = true;
    await barrier;
    await route.fulfill({ response }).catch(() => {});
    delivered = true;
  });
  return {
    release,
    committed: () => committed,
    delivered: () => delivered,
  };
}

for (const reopenSameRide of [false, true]) {
  test(`R1: delayed history save preserves a ${reopenSameRide ? "reopened" : "different"} ride draft`, async ({
    page,
    account,
  }) => {
    const catalogue = await account.client
      .from("coasters")
      .select("id,name")
      .in("name", ["Stealth", "Nemesis Reborn"]);
    expect(catalogue.error).toBeNull();
    const first = catalogue.data!.find((c) => c.name === "Stealth")!;
    const second = reopenSameRide
      ? first
      : catalogue.data!.find((c) => c.name === "Nemesis Reborn")!;
    const inserted = await account.client
      .from("rides")
      .insert(
        catalogue.data!.map((c) => ({
          coaster_id: c.id,
          ridden_on: "2026-08-01",
          note: "Original note",
        })),
      );
    expect(inserted.error).toBeNull();
    await signIn(page, account);
    await page.goto("/rides");
    const held = await holdMutation(page, "rides", "PATCH");
    try {
      await page
        .getByRole("button", {
          name: `Edit ride on ${first.name}`,
          exact: true,
        })
        .click();
      await page.getByLabel("Your note").fill("First committed note");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect.poll(held.committed).toBeTruthy();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("button", {
          name: `Edit ride on ${second.name}`,
          exact: true,
        })
        .click();
      await page.getByLabel("Your note").fill("Keep this unsaved draft");
      held.release();
      await expect.poll(held.delivered).toBeTruthy();
      // Wait for the completion's authoritative refresh, not only the HTTP response.
      await expect(
        page
          .locator(".history-list")
          .getByText("First committed note", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByLabel("Your note")).toHaveValue(
        "Keep this unsaved draft",
      );
      await expect(page.getByLabel("Your note")).toBeFocused();
      const stored = await account.client
        .from("rides")
        .select("note")
        .eq("coaster_id", second.id)
        .single();
      expect(stored.data!.note).toBe(
        reopenSameRide ? "First committed note" : "Original note",
      );
    } finally {
      held.release();
    }
  });
}

test("R1: delayed catalogue logging preserves the next logging draft", async ({
  page,
  account,
}) => {
  await signIn(page, account);
  await page.goto("/coasters");
  const held = await holdMutation(page, "rides", "POST");
  try {
    await page
      .getByRole("button", { name: "Log a ride on Stealth", exact: true })
      .click();
    await page.getByLabel("A little memory").fill("First catalogue ride");
    await page.getByRole("button", { name: "Log this ride" }).click();
    await expect.poll(held.committed).toBeTruthy();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page
      .getByRole("button", {
        name: "Log a ride on Nemesis Reborn",
        exact: true,
      })
      .click();
    await page.getByLabel("A little memory").fill("Keep the next ride draft");
    const refresh = page.waitForResponse(
      (r) =>
        r.url().includes("/coasters?") && r.request().headers()["rsc"] === "1",
    );
    held.release();
    await refresh;
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("A little memory")).toHaveValue(
      "Keep the next ride draft",
    );
    await expect(page.getByLabel("A little memory")).toBeFocused();
    const stored = await account.client.from("rides").select("note");
    expect(stored.data).toEqual([{ note: "First catalogue ride" }]);
  } finally {
    held.release();
  }
});

test("R1: delayed admin save preserves a later catalogue draft", async ({
  page,
  account,
}) => {
  await makeAdmin(account.id);
  const admin = localAdmin();
  const fixtures = ["First", "Second"].map((label) => ({
    id: randomUUID(),
    name: `${label} ${randomUUID()}`,
    park: "Regression Park",
    country_code: "GB",
    manufacturer: "Test Maker",
    type: "steel" as const,
  }));
  expect((await admin.from("coasters").insert(fixtures)).error).toBeNull();
  let release = () => {};
  try {
    await signIn(page, account);
    await page.goto("/admin/coasters");
    const held = await holdMutation(page, "coasters", "PATCH");
    release = held.release;
    await page
      .getByRole("button", { name: `Edit ${fixtures[0].name}`, exact: true })
      .click();
    await page.getByLabel("Park", { exact: true }).fill("Committed Park");
    await page.getByRole("button", { name: "Save coaster" }).click();
    await expect.poll(held.committed).toBeTruthy();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: `Edit ${fixtures[1].name}`, exact: true })
      .click();
    await page.getByLabel("Park", { exact: true }).fill("Keep this park draft");
    held.release();
    await expect(
      page.locator(".admin-table").getByText("Committed Park", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Park", { exact: true })).toHaveValue(
      "Keep this park draft",
    );
    await expect(page.getByLabel("Park", { exact: true })).toBeFocused();
    const stored = await admin
      .from("coasters")
      .select("park")
      .eq("id", fixtures[1].id)
      .single();
    expect(stored.data!.park).toBe("Regression Park");
  } finally {
    release();
    await admin
      .from("coasters")
      .delete()
      .in(
        "id",
        fixtures.map((c) => c.id),
      );
  }
});

test("R2: public HTTP polling survives blocked WebSockets, opt-out and read failures", async ({
  page,
  account,
}) => {
  expect(
    (
      await account.client
        .from("profiles")
        .update({ leaderboard_opt_in: true })
        .eq("user_id", account.id)
    ).error,
  ).toBeNull();
  await page.routeWebSocket("**/realtime/v1/websocket**", (socket) =>
    socket.close(),
  );
  await page.clock.install();
  let rejectRead = false;
  await page.route("**/rest/v1/rpc/get_leaderboard", async (route) => {
    if (rejectRead)
      await route.fulfill({ status: 503, json: { message: "Unavailable" } });
    else await route.continue();
  });
  await page.goto("/leaderboard");
  await expect(
    page.getByText("Periodic updates", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(account.name, { exact: true })).toBeVisible();
  expect(
    (
      await account.client
        .from("profiles")
        .update({ leaderboard_opt_in: false })
        .eq("user_id", account.id)
    ).error,
  ).toBeNull();
  await page.clock.fastForward(16_000);
  await expect(page.getByText(account.name, { exact: true })).toBeHidden();
  await expect(page.locator(".leaderboard-table")).toBeVisible();
  rejectRead = true;
  await page.getByRole("button", { name: "Refresh now", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".leaderboard-table")).toBeHidden();
  rejectRead = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".leaderboard-table")).toBeVisible();
  await expect(
    page.getByText("Periodic updates", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(account.name, { exact: true })).toBeHidden();
});

test("R3: an archived coaster cannot turn a committed lost-response save into a rejection", async ({
  page,
  account,
}) => {
  const admin = localAdmin();
  const coaster = {
    id: randomUUID(),
    name: `Retry ${randomUUID()}`,
    park: "Retry Park",
    country_code: "GB",
    manufacturer: "Test Maker",
    type: "steel" as const,
  };
  expect((await admin.from("coasters").insert(coaster)).error).toBeNull();
  try {
    await signIn(page, account);
    let lost = false;
    await page.route("**/rest/v1/rides**", async (route) => {
      if (route.request().method() === "POST" && !lost) {
        lost = true;
        const response = await route.fetch();
        expect(response.ok()).toBeTruthy();
        await route.abort("failed");
      } else await route.continue();
    });
    await page.getByLabel("Find your coaster").fill(coaster.name);
    await page
      .getByRole("button", {
        name: `Select ${coaster.name}, ${coaster.park}`,
        exact: true,
      })
      .click();
    await page.getByLabel("A little memory").fill("Committed before archive");
    await page.getByRole("button", { name: "Log this ride" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    const before = await account.client
      .from("rides")
      .select("id,note")
      .single();
    expect(before.error).toBeNull();
    expect(
      (
        await admin
          .from("coasters")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", coaster.id)
      ).error,
    ).toBeNull();
    await page.getByRole("button", { name: "Log this ride" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "added to your journal" }),
    ).toBeVisible();
    await expect(page.getByTestId("total-rides")).toHaveText("1");
    await expect(page.getByTestId("total-credits")).toHaveText("1");
    const after = await account.client.from("rides").select("id,note");
    expect(after.data).toEqual([before.data]);
  } finally {
    await account.client.from("rides").delete().eq("coaster_id", coaster.id);
    await admin.from("coasters").delete().eq("id", coaster.id);
  }
});
