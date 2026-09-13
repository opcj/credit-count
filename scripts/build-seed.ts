import { readFileSync, writeFileSync } from "node:fs";
import { coasterSchema } from "../src/lib/domain";
const records = JSON.parse(
  readFileSync("supabase/catalogue.json", "utf8"),
) as Record<string, string>[];
if (records.length !== 40)
  throw new Error("Expected exactly 40 curated coasters.");
const quote = (value: string | null) =>
  value === null ? "null" : `'${value.replaceAll("'", "''")}'`;
const ids = new Set<string>();
const keys = new Set<string>();
const lines = records.map((record) => {
  const values = coasterSchema.parse(record);
  if (!record.verified_at || record.verification_error)
    throw new Error(`Unverified source: ${record.name}`);
  const identity = `${values.name.toLowerCase()}|${values.park.toLowerCase()}|${values.country_code}`;
  if (ids.has(record.id) || keys.has(identity))
    throw new Error("Duplicate seed identity.");
  ids.add(record.id);
  keys.add(identity);
  return `(${[record.id, values.name, values.park, values.country_code, values.manufacturer, values.type, values.source_url].map(quote).join(", ")})`;
});
writeFileSync(
  "supabase/seed.sql",
  "-- Generated from catalogue.json. Seed receipts preserve edits, archives, deletions and merges.\nwith catalogue_seed (id, name, park, country_code, manufacturer, type, source_url) as (\nvalues\n" +
    lines.join(",\n") +
    `
), claimed as (
  insert into private.catalogue_seed_receipts(coaster_id)
  select id::uuid from catalogue_seed
  on conflict do nothing
  returning coaster_id
)
insert into public.coasters (id, name, park, country_code, manufacturer, type, source_url)
select s.id::uuid, s.name, s.park, s.country_code, s.manufacturer, s.type::public.coaster_type, s.source_url
from catalogue_seed s
join claimed c on c.coaster_id = s.id::uuid
on conflict do nothing;
`,
);
console.log(
  `Built seed for ${records.length} real coasters with durable application receipts.`,
);
