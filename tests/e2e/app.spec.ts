import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  test,
  expect,
  signIn,
  logRide,
  makeAdmin,
  newAccount,
} from "./fixtures";
import {
  localAdmin,
  localClient,
  localDatabase,
} from "../../scripts/local-context";

test("T03/T04/T16: three-action logging, correct re-rides, editable notes, and deletion", async ({
  page,
  account,
}) => {
  await signIn(page, account);
  await expect(page.getByTestId("total-credits")).toHaveText("0");
  for (const name of [
    "Stealth",
    "Stealth",
    "Nemesis Reborn",
    "Steel Vengeance",
  ])
    await logRide(page, name);
  await expect(page.getByTestId("total-credits")).toHaveText("3");
  await expect(page.getByTestId("total-rides")).toHaveText("4");
  await page.goto("/rides");
  await page
    .getByRole("button", { name: "Edit ride on Stealth", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Your note")
    .fill("<img src=x onerror=alert(1)> A real memory.");
  await page.getByLabel("Date ridden").fill("2026-08-15");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByText("<img src=x onerror=alert(1)> A real memory.", {
      exact: true,
    }),
  ).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Delete ride on Stealth", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Delete ride", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await page.goto("/dashboard");
  await expect(page.getByTestId("total-credits")).toHaveText("2");
  await expect(page.getByTestId("total-rides")).toHaveText("2");
});

test("T14/T26: a committed save with a lost response is retried without duplication", async ({
  page,
  account,
}) => {
  await signIn(page, account);
  let lost = false;
  await page.route("**/rest/v1/rides**", async (route) => {
    if (route.request().method() === "POST" && !lost) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByLabel("Find your coaster").fill("Stealth");
  await page.getByRole("button", { name: /^Select Stealth,/ }).click();
  await page
    .getByLabel("A little memory")
    .fill("Keep this memory through a retry.");
  await page.getByRole("button", { name: "Log this ride" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("A little memory")).toHaveValue(
    "Keep this memory through a retry.",
  );
  await expect(page.getByLabel("A little memory")).toBeDisabled();
  await page.getByRole("button", { name: "Log this ride" }).click();
  await expect(page.getByTestId("total-rides")).toHaveText("1");
  const result = await account.client
    .from("rides")
    .select("id", { count: "exact" });
  expect(result.count).toBe(1);
});

test("T10/T21/T23: an open anonymous browser follows opt-in/out and clears stale offline data", async ({
  page,
  browser,
  account,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL });
  const publicPage = await context.newPage();
  try {
    await publicPage.goto("/leaderboard");
    await expect(publicPage.getByText("Live", { exact: true })).toBeVisible();
    await signIn(page, account);
    await page.goto("/settings");
    await page
      .getByRole("checkbox", { name: "Show me on the leaderboard" })
      .check();
    const began = Date.now();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      publicPage.getByText(account.name, { exact: true }),
    ).toBeVisible();
    test.info().annotations.push({
      type: "live-opt-in-ms",
      description: String(Date.now() - began),
    });
    await page
      .getByRole("checkbox", { name: "Show me on the leaderboard" })
      .uncheck();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      publicPage.getByText(account.name, { exact: true }),
    ).toBeHidden();
    await context.setOffline(true);
    await publicPage.clock.install();
    await publicPage.clock.fastForward(31_000);
    await expect(publicPage.locator(".leaderboard-table")).toBeHidden();
    await context.setOffline(false);
    await publicPage.clock.fastForward(16_000);
    await publicPage.bringToFront();
    await expect(publicPage.getByText("Live", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await context.close();
  }
});

test("T10/T26: privacy confirmation matches a committed save with a delayed response", async ({
  page,
  account,
}) => {
  const anonymous = localClient();
  const publiclyListed = async () => {
    const result = await anonymous.rpc("get_leaderboard", { p_limit: 100 });
    expect(result.error).toBeNull();
    return result.data?.some((row) => row.display_name === account.name);
  };
  await signIn(page, account);
  await page.goto("/settings");
  const sharing = page.getByRole("checkbox", {
    name: "Show me on the leaderboard",
  });
  const success = page.getByRole("status");
  let releaseResponse = () => {};
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let delayed = false;
  await page.route("**/rest/v1/profiles**", async (route) => {
    if (route.request().method() !== "PATCH" || delayed) {
      await route.continue();
      return;
    }
    delayed = true;
    const response = await route.fetch();
    await responseGate;
    await route.fulfill({ response });
  });
  try {
    await sharing.check();
    await page.getByRole("button", { name: "Save settings" }).click();
    // The real write is public before its response reaches the settings form.
    await expect.poll(publiclyListed).toBe(true);
    await expect(success).toBeHidden();
    await expect(sharing).toBeDisabled();
    await expect(page.getByLabel("Display name")).toBeDisabled();
    await sharing.evaluate((input: HTMLInputElement) => input.click());
    await expect(sharing).toBeChecked();
    releaseResponse();
    await expect(success).toContainText(
      "Your name and credit count can appear on the leaderboard.",
    );
    await expect(success).not.toContainText("You are off");
    await expect(sharing).toBeEnabled();

    await sharing.uncheck();
    await expect(success).toBeHidden();
    expect(await publiclyListed()).toBe(true); // The unchecked draft is unsaved.
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(success).toContainText("You are off the public leaderboard.");
    await expect.poll(publiclyListed).toBe(false);
  } finally {
    releaseResponse();
  }
});

test("T02/T26: recovery failures clear old success and allow a successful retry", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("Email address")
    .fill("recovery-check@credit-count.test");
  const recover = page.getByRole("button", {
    name: "Forgot your password? Send a recovery link",
  });
  const recoveryError = page.locator("form").getByRole("alert");
  const success = page.getByRole("status");
  let outcome: number | "network" = 200;
  let releaseResponse = () => {};
  let responseGate = Promise.resolve();
  await page.route("**/auth/v1/recover**", async (route) => {
    await responseGate;
    if (outcome === "network") await route.abort("failed");
    else
      await route.fulfill({
        status: outcome,
        json: outcome === 200 ? {} : { message: "Private upstream diagnostic" },
      });
  });
  try {
    outcome = 503;
    await recover.click();
    await expect(recoveryError).toContainText(
      "We couldn’t request a recovery email. Please try again in a moment.",
    );
    await expect(success).toBeHidden();
    for (const failure of [503, 429, "network"] as const) {
      outcome = 200;
      await recover.click();
      await expect(success).toContainText("If that address has an account");

      outcome = failure;
      responseGate = new Promise<void>((resolve) => {
        releaseResponse = resolve;
      });
      await recover.click();
      await expect(recover).toBeDisabled();
      await expect(success).toBeHidden();
      releaseResponse();
      await expect(recoveryError).toContainText(
        "We couldn’t request a recovery email. Please try again in a moment.",
      );
      await expect(success).toBeHidden();
      await expect(page.getByText("Private upstream diagnostic")).toBeHidden();
      await expect(recover).toBeEnabled();
    }
    outcome = 200;
    await recover.click();
    await expect(success).toContainText("If that address has an account");
    await expect(recoveryError).toBeHidden();
  } finally {
    releaseResponse();
  }
});

test("T11/T12: admin archive/restore, add/edit/delete and duplicate merge work through the UI", async ({
  page,
  account,
}) => {
  await makeAdmin(account.id);
  const label = `Browser coaster ${randomUUID().slice(0, 8)}`;
  const admin = localAdmin();
  const ids: string[] = [];
  try {
    await signIn(page, account);
    await page.goto("/admin/coasters");
    await page
      .getByRole("button", { name: "Add coaster", exact: true })
      .click();
    await page.getByLabel("Coaster name", { exact: true }).fill(label);
    await page.getByLabel("Park", { exact: true }).fill("Browser Park");
    await page.getByLabel("Country code", { exact: true }).fill("GB");
    await page.getByLabel("Manufacturer", { exact: true }).fill("Test Maker");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add coaster", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const coaster = await account.client
      .from("coasters")
      .select("id")
      .eq("name", label)
      .single();
    expect(coaster.error).toBeNull();
    ids.push(coaster.data!.id);
    await page.getByLabel("Search managed coasters").fill(label);
    await page
      .getByRole("button", { name: `Edit ${label}`, exact: true })
      .click();
    await page.getByLabel("Park", { exact: true }).fill("Updated Browser Park");
    await page.getByRole("button", { name: "Save coaster" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByLabel("Search managed coasters").fill(label);
    await page
      .getByRole("button", { name: `Archive ${label}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Archive coaster", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByLabel("Catalogue status").selectOption("archived");
    await page.getByLabel("Search managed coasters").fill(label);
    await page
      .getByRole("button", { name: `Restore ${label}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Restore coaster", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const duplicate = await account.client
      .from("coasters")
      .insert({
        name: `${label} duplicate`,
        park: "Browser Park",
        country_code: "GB",
        manufacturer: "Test Maker",
        type: "steel",
      })
      .select("id")
      .single();
    expect(duplicate.error).toBeNull();
    ids.push(duplicate.data!.id);
    await page.reload();
    await page.getByLabel("Search managed coasters").fill(label);
    await page
      .getByRole("button", { name: `Merge ${label} duplicate`, exact: true })
      .click();
    await page
      .getByLabel("Canonical coaster to keep")
      .selectOption(coaster.data!.id);
    await page
      .getByRole("button", { name: "Merge and preserve rides" })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByLabel("Search managed coasters").fill(label);
    await page
      .getByRole("button", { name: `Delete ${label}`, exact: true })
      .click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(
      (await account.client.from("coasters").select("id").in("id", ids)).data,
    ).toEqual([]);
  } finally {
    await admin.from("coasters").delete().in("id", ids);
  }
});

test("T19/T25: stale edits show a conflict, and logout removes protected access", async ({
  page,
  account,
}) => {
  await signIn(page, account);
  await logRide(page);
  await page.goto("/rides");
  await page.getByRole("button", { name: "Edit ride on Stealth" }).click();
  const row = (await account.client.from("rides").select("id").single()).data!;
  await account.client
    .from("rides")
    .update({ note: "A newer edit from another tab" })
    .eq("id", row.id);
  await page.getByLabel("Your note").fill("Stale draft");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("changed in another tab");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/sign-in");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("A newer edit from another tab")).toBeHidden();
  await page.goto("/admin/coasters");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("T02/T27: signup confirmation uses real local email and unsafe callbacks are rejected", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const email = `signup-${suffix}@credit-count.test`;
  let createdId: string | undefined;
  try {
    await page.goto("/sign-up");
    await page
      .getByLabel("What should we call you?")
      .fill(`New Rider ${suffix}`);
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(`LongLocalPassword-${suffix}`);
    await page.getByRole("button", { name: "Start your collection" }).click();
    await expect(page.getByRole("status")).toContainText("Check your email");
    const db = await localDatabase();
    try {
      createdId = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0]?.id;
    } finally {
      await db.end();
    }
    expect(createdId).toBeTruthy();
    let messageId = "";
    await expect(async () => {
      const inbox = await (
        await fetch("http://127.0.0.1:55324/api/v1/messages")
      ).json();
      const item = inbox.messages.find((m: { To: { Address: string }[] }) =>
        m.To?.some((to) => to.Address === email),
      );
      expect(item).toBeTruthy();
      messageId = item.ID;
    }).toPass({ timeout: 10_000 });
    const message = await (
      await fetch(`http://127.0.0.1:55324/api/v1/message/${messageId}`)
    ).json();
    const link = String(message.HTML || message.Text).match(
      /https?:\/\/[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+/,
    );
    expect(link).toBeTruthy();
    await page.goto(link![0].replaceAll("&amp;", "&"));
    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("total-credits")).toHaveText("0");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page
      .getByRole("button", {
        name: "Forgot your password? Send a recovery link",
      })
      .click();
    await expect(page.getByRole("status")).toContainText("recovery link");
    let recoveryId = "";
    await expect(async () => {
      const inbox = await (
        await fetch("http://127.0.0.1:55324/api/v1/messages")
      ).json();
      const item = inbox.messages.find(
        (m: { ID: string; To: { Address: string }[] }) =>
          m.ID !== messageId && m.To?.some((to) => to.Address === email),
      );
      expect(item).toBeTruthy();
      recoveryId = item.ID;
    }).toPass({ timeout: 10_000 });
    const recovery = await (
      await fetch(`http://127.0.0.1:55324/api/v1/message/${recoveryId}`)
    ).json();
    const recoveryLink = String(recovery.HTML || recovery.Text).match(
      /https?:\/\/[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+/,
    );
    expect(recoveryLink).toBeTruthy();
    await page.goto(recoveryLink![0].replaceAll("&amp;", "&"));
    await page.waitForURL("**/reset-password");
    const changedPassword = `ChangedLocalPassword-${suffix}`;
    await page.getByLabel("New password").fill(changedPassword);
    await page
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Password updated");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/sign-in");
    await signIn(page, { email, password: changedPassword });
    await page.goto("/auth/callback?code=invalid&next=https://attacker.test");
    await expect(page).toHaveURL(/\/sign-in\?error=confirmation/);
  } finally {
    if (createdId) await localAdmin().auth.admin.deleteUser(createdId);
  }
});

test("T28/T29: desktop screen states have no automated accessibility violations", async ({
  page,
  account,
}) => {
  await makeAdmin(account.id);
  await signIn(page, account);
  mkdirSync("artifacts/accessibility", { recursive: true });
  mkdirSync("artifacts/screenshots", { recursive: true });
  const issues: unknown[] = [];
  for (const route of [
    "/dashboard",
    "/coasters",
    "/rides",
    "/settings",
    "/admin/coasters",
    "/leaderboard",
    "/sign-in",
    "/sign-up",
  ]) {
    await page.goto(route);
    if (route === "/leaderboard")
      await expect(page.getByText("Live", { exact: true })).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const name = route.replaceAll("/", "-").slice(1);
    writeFileSync(
      `artifacts/accessibility/${name}.json`,
      JSON.stringify(result.violations, null, 2),
    );
    await page.screenshot({
      path: `artifacts/screenshots/${name}-empty-desktop.png`,
      fullPage: true,
    });
    if (result.violations.length)
      issues.push({
        route,
        violations: result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      });
  }
  expect(issues).toEqual([]);
});

test("T15/T28: history pagination, keyboard logging, dialog focus and draft reload", async ({
  page,
  account,
}) => {
  await signIn(page, account);
  const search = page.getByLabel("Find your coaster");
  await search.focus();
  await page.keyboard.type("Stealth");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: /^Select Stealth,/ }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const save = page.getByRole("button", { name: "Log this ride" });
  for (
    let i = 0;
    i < 16 && !(await save.evaluate((e) => e === document.activeElement));
    i++
  )
    await page.keyboard.press("Tab");
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("total-rides")).toHaveText("1");
  const coaster = (
    await account.client.from("rides").select("coaster_id").single()
  ).data!;
  const inserted = await account.client.from("rides").insert(
    Array.from({ length: 12 }, (_, i) => ({
      coaster_id: coaster.coaster_id,
      ridden_on: "2026-01-01",
      note: "Page memory " + i,
    })),
  );
  expect(inserted.error).toBeNull();
  await page.goto("/rides");
  await expect(page.locator(".history-list > li")).toHaveCount(12);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page.locator(".history-list > li")).toHaveCount(1);
  const edit = page.getByRole("button", {
    name: "Edit ride on Stealth",
    exact: true,
  });
  await edit.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Coaster", { exact: true })).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((e) => e.contains(document.activeElement)),
    ).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(edit).toBeFocused();
  await edit.click();
  const row = (
    await account.client
      .from("rides")
      .select("id")
      .order("ridden_on", { ascending: false })
      .order("id", { ascending: false })
      .range(12, 12)
      .single()
  ).data!;
  await account.client
    .from("rides")
    .update({ note: "Latest competing memory" })
    .eq("id", row.id);
  await page.getByLabel("Your note").fill("An older draft");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByRole("button", { name: "Discard draft and reload latest" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByText("Latest competing memory", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete ride on Stealth", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete ride", exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.locator(".history-list > li")).toHaveCount(12);
});

test("T19: expired access cookies refresh and account switching cannot restore old private content", async ({
  page,
  account,
}) => {
  await signIn(page, account);
  await logRide(page);
  const cookies = await page.context().cookies();
  const chunks = cookies
    .filter((c) => /sb-.*-auth-token(?:\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  expect(chunks.length).toBeGreaterThan(0);
  const raw = chunks.map((c) => c.value).join("");
  const session = JSON.parse(
    Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString(),
  );
  const parts = session.access_token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.exp = Math.floor(Date.now() / 1000) - 60;
  parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
  session.access_token = parts.join(".");
  session.expires_at = payload.exp;
  const expired =
    "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const baseName = chunks[0].name.replace(/\.\d+$/, "");
  await page.context().clearCookies({ name: /sb-.*-auth-token/ });
  const chunkSize = 3000;
  for (let i = 0; i < expired.length; i += chunkSize)
    await page.context().addCookies([
      {
        ...chunks[0],
        name: baseName + "." + i / chunkSize,
        value: expired.slice(i, i + chunkSize),
      },
    ]);
  await page.goto("/dashboard");
  await expect(page.getByTestId("total-rides")).toHaveText("1");
  // The expired token's altered signature cannot authenticate a request. Only a real refresh grant can succeed.
  const after = (await page.context().cookies())
    .filter((c) => c.name.startsWith(baseName))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join("");
  expect(after).not.toBe(expired);
  await page.goto("/rides");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/sign-in");
  const second = await newAccount();
  try {
    await signIn(page, second);
    await expect(page.getByTestId("total-rides")).toHaveText("0");
    await page.goBack();
    await page.goto("/rides");
    await expect(page.locator(".history-list > li")).toHaveCount(0);
    await expect(page.getByText(account.name, { exact: true })).toBeHidden();
  } finally {
    await second.cleanup();
  }
});

test("T23/T27: delayed public reads cannot restore an opt-out and responses prohibit shared caching", async ({
  page,
  account,
}) => {
  await account.client
    .from("profiles")
    .update({ leaderboard_opt_in: true })
    .eq("user_id", account.id);
  let release: () => void = () => {};
  const barrier = new Promise<void>((r) => {
    release = r;
  });
  let captured = false;
  await page.route("**/rest/v1/rpc/get_leaderboard", async (route) => {
    if (!captured) {
      captured = true;
      const response = await route.fetch();
      await barrier;
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  const response = await page.goto("/leaderboard");
  expect(response!.headers()["cache-control"]).toMatch(
    process.env.E2E_PRODUCTION === "true" ? /no-store/ : /no-cache|no-store/,
  );
  expect(response!.headers()["x-frame-options"]).toBe("DENY");
  await expect.poll(() => captured).toBeTruthy();
  await account.client
    .from("profiles")
    .update({ leaderboard_opt_in: false })
    .eq("user_id", account.id);
  await expect(page.getByText(account.name, { exact: true })).toBeHidden();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  release();
  await page.waitForTimeout(400);
  await expect(page.getByText(account.name, { exact: true })).toBeHidden();
});
