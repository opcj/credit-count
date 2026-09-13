import test from "node:test";
import assert from "node:assert/strict";
import {
  coasterSchema,
  displayNameSchema,
  isCalendarDate,
  localToday,
  rideSchema,
  safeNext,
} from "../../src/lib/domain";
import { ConflictError, friendlyError } from "../../src/lib/errors";

test("calendar dates preserve leap days, years, and local-day semantics", () => {
  for (const date of ["2024-02-29", "2026-09-09", "0001-01-01", "9999-12-31"])
    assert.equal(isCalendarDate(date), true, date);
  for (const date of [
    "2025-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-9-09",
    "0000-01-01",
    "not-a-date",
  ])
    assert.equal(isCalendarDate(date), false, date);
  assert.equal(localToday(new Date(2026, 0, 2, 0, 1)), "2026-01-02");
});
test("callback return destinations cannot become an open redirect", () => {
  for (const value of [
    "https://attacker.test",
    "//attacker.test",
    "/\\attacker.test",
    "/dashboard\r\nX: bad",
    "/dashboard?next=//evil",
    "javascript:alert(1)",
    null,
  ])
    assert.equal(safeNext(value), "/dashboard");
  assert.equal(safeNext("/settings"), "/settings");
  assert.equal(safeNext("/reset-password"), "/reset-password");
});
test("text constraints use Unicode characters and normalize optional notes", () => {
  assert.equal(displayNameSchema.parse("  Ari  "), "Ari");
  assert.ok(displayNameSchema.safeParse("🎢".repeat(50)).success);
  assert.ok(!displayNameSchema.safeParse("🎢".repeat(51)).success);
  const base = {
    coaster_id: "6a693a17-d29e-4d2f-b758-b7701db9a228",
    ridden_on: "2026-09-09",
    note: " ",
  };
  assert.equal(rideSchema.parse(base).note, null);
  assert.ok(rideSchema.safeParse({ ...base, note: "🎢".repeat(500) }).success);
  assert.ok(!rideSchema.safeParse({ ...base, note: "a".repeat(501) }).success);
});
test("catalogue input rejects script URLs and canonicalizes countries", () => {
  const base = {
    name: " Ride ",
    park: "Park",
    manufacturer: "Maker",
    type: "steel",
    country_code: "gb",
    source_url: "",
  };
  const value = coasterSchema.parse(base);
  assert.equal(value.country_code, "GB");
  assert.equal(value.name, "Ride");
  assert.equal(value.source_url, null);
  assert.ok(
    !coasterSchema.safeParse({ ...base, source_url: "javascript:alert(1)" })
      .success,
  );
});
test("user-facing errors never reveal raw database payloads", () => {
  assert.ok(
    !friendlyError({
      message: "PRIVATE NOTE + secret",
      details: "PRIVATE DATE",
      code: "unknown",
    }).includes("PRIVATE"),
  );
  assert.match(friendlyError(new ConflictError()), /another tab/);
  assert.match(friendlyError({ code: "23503" }), /Archive/);
});
