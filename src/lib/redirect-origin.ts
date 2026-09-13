/** Trust the configured site, with explicit loopback aliases for local testing. */
export function redirectOrigin(host: string | null, configuredSite: string) {
  const canonical = new URL(configuredSite);
  if (!["http:", "https:"].includes(canonical.protocol))
    throw new Error("The site URL must use HTTP or HTTPS.");
  const local =
    canonical.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(canonical.hostname);
  if (local && host && /^(127\.0\.0\.1|localhost):(3000|3001)$/.test(host))
    return `http://${host}`;
  return canonical.origin;
}
