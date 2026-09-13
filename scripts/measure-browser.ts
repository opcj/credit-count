import { chromium, devices } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const baseURL = "http://127.0.0.1:3001";
const browser = await chromium.launch();
mkdirSync("artifacts/performance", { recursive: true });
mkdirSync("artifacts/screenshots", { recursive: true });
const results: unknown[] = [];
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      const metrics = { lcp: 0, cls: 0, longestEvent: 0 };
      Object.assign(window, { labMetrics: metrics });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) metrics.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const shift = e as PerformanceEntry & {
            hadRecentInput: boolean;
            value: number;
          };
          if (!shift.hadRecentInput) metrics.cls += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          metrics.longestEvent = Math.max(metrics.longestEvent, e.duration);
      }).observe({
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit);
    });
    for (const cache of ["cold", "warm"]) {
      await page.goto("/leaderboard");
      await page
        .getByText("Live", { exact: true })
        .waitFor({ timeout: 45_000 });
      await page.waitForTimeout(1000);
      const metrics = await page.evaluate(() => ({
        ...(window as unknown as { labMetrics: object }).labMetrics,
        domReady: performance.getEntriesByType("navigation")[0].toJSON()
          .domContentLoadedEventEnd,
        transferBytes: performance
          .getEntriesByType("resource")
          .reduce(
            (sum, e) => sum + (e as PerformanceResourceTiming).transferSize,
            0,
          ),
      }));
      results.push({ run: run + 1, cache, ...metrics });
    }
    await context.close();
  }
  const accounts = JSON.parse(
    readFileSync("credentials.local.json", "utf8"),
  ) as { role: string; email: string; password: string }[];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: 1000 },
    });
    const page = await context.newPage();
    const account = accounts.find((a) => a.role === "enthusiast")!;
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Welcome back" }).click();
    await page.waitForURL("**/dashboard");
    await page.getByTestId("total-credits").waitFor();
    await page.screenshot({
      path: `artifacts/screenshots/dashboard-populated-${width}.png`,
      fullPage: true,
    });
    if (width === 390) {
      await page.setViewportSize({ width: 320, height: 800 });
      for (const route of [
        "/dashboard",
        "/coasters",
        "/rides",
        "/settings",
        "/leaderboard",
      ]) {
        await page.goto(route);
        if (
          !(await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ))
        )
          throw Error(`320px overflow: ${route}`);
      }
    }
    await context.close();
  }
  writeFileSync(
    "artifacts/performance/browser.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        environment:
          "Chromium on Windows, local optimized Next.js + Docker Supabase, iPhone 13 viewport, 4x CPU slowdown, 150ms latency, 1.6Mbps down/0.75Mbps up",
        scope:
          "Three cold contexts and one warm navigation each. LCP in ms; CLS is cumulative lab shifts. No field INP claim; no input events measured for public navigation.",
        results,
        reflow320px: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
