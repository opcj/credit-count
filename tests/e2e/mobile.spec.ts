import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { test, expect, signIn, logRide } from "./fixtures";

test("T16/T28/T29: phone navigation, touch logging, reflow, and reduced motion", async ({
  page,
  account,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, account);
  await logRide(page);
  await expect(page.getByTestId("total-credits")).toHaveText("1");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Ride history", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Every ride has a story." }),
  ).toBeVisible();
  mkdirSync("artifacts/screenshots", { recursive: true });
  for (const route of [
    "/dashboard",
    "/coasters",
    "/rides",
    "/settings",
    "/leaderboard",
  ]) {
    await page.goto(route);
    if (route === "/leaderboard")
      await expect(page.getByText("Live", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBeTruthy();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/screenshots/${route.slice(1)}-mobile.png`,
      fullPage: true,
    });
  }
});
