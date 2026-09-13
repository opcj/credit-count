import { test as base, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import {
  localAdmin,
  localClient,
  localDatabase,
} from "../../scripts/local-context";

export async function newAccount() {
  const suffix = randomBytes(5).toString("hex");
  const password = randomBytes(18).toString("hex");
  const email = `browser-${suffix}@credit-count.test`;
  const name = `Rider ${suffix}`;
  const admin = localAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;
  const client = localClient();
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return {
    id: data.user.id,
    name,
    email,
    password,
    client,
    cleanup: async () => {
      await admin.auth.admin.deleteUser(data.user.id);
      await client.realtime.disconnect();
    },
  };
}
export const test = base.extend<{
  account: Awaited<ReturnType<typeof newAccount>>;
}>({
  account: async ({}, provide) => {
    const account = await newAccount();
    try {
      await provide(account);
    } finally {
      await account.cleanup();
    }
  },
});
export { expect };
export async function signIn(
  page: Page,
  account: { email: string; password: string },
) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Welcome back" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("total-credits")).toBeVisible();
}
export async function logRide(page: Page, name = "Stealth") {
  await page.getByLabel("Find your coaster").fill(name);
  await page
    .getByRole("button", {
      name: new RegExp(
        `^Select ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`,
      ),
    })
    .click();
  await page.getByRole("button", { name: "Log this ride" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "added to your journal" }),
  ).toBeVisible();
}
export async function makeAdmin(id: string) {
  const db = await localDatabase();
  try {
    await db.query("insert into public.admin_users(user_id) values($1)", [id]);
  } finally {
    await db.end();
  }
}
