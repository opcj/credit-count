import test from "node:test";
import assert from "node:assert/strict";
import { redirectOrigin } from "../../src/lib/redirect-origin";

test("callbacks preserve only explicit local development origins", () => {
  const site = "http://127.0.0.1:3000";
  for (const host of ["127.0.0.1:3000", "localhost:3000", "127.0.0.1:3001"])
    assert.equal(redirectOrigin(host, site), `http://${host}`);
  for (const host of [
    null,
    "evil.test",
    "localhost:3000@evil.test",
    "127.0.0.1:9999",
    "localhost:3000/evil",
    "localhost:3000\r\nX:evil",
  ])
    assert.equal(redirectOrigin(host, site), site);
});
test("production callbacks use the configured site despite hostile host headers", () => {
  for (const host of ["evil.test", "localhost:3000", "example.test", null])
    assert.equal(
      redirectOrigin(host, "https://example.test"),
      "https://example.test",
    );
  assert.throws(() => redirectOrigin(null, "javascript:alert(1)"));
});
