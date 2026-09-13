# Credit Count

A rollercoaster journal for keeping every ride and collecting unique coaster credits. Built with **Next.js, React, TypeScript and Supabase**.

**Live application: [credit-count-snowy.vercel.app](https://credit-count-snowy.vercel.app)**

Log a coaster, date and optional memory; the dashboard updates your credits, total rides, favourite coaster and country/manufacturer/type breakdowns. Riding A, A, B and C gives **4 rides and 3 credits**. Repeat rides, including multiple rides on the same day, remain separate journal entries.

Your journal is private. You can choose to publish only your display name and credit count on the community leaderboard. Catalogue administrators maintain the shared coaster list and correct duplicates without access to other people's journals.

The hosted app supports sign-in with prepared review accounts. Production email delivery is pending, so use those accounts for the live review; signup confirmation and password recovery require SMTP configuration before general registration. Local email flows work through Mailpit as described below.

The live leaderboard includes five synthetic demo riders with distinct credit totals and repeat rides. Their journals follow the same ownership rules as every account; the public ranking exposes only their display names and credit counts.

## Features

- Email/password accounts, email confirmation, password recovery and session renewal.
- Searchable catalogue of 40 real coasters, with country, manufacturer and type filters.
- Ride creation, editing, deletion and paginated history with revision conflict handling.
- Derived statistics, plus safe retry after a lost save response.
- Opt-in leaderboard with live refresh hints and HTTP polling when WebSockets are unavailable.
- Admin creation, correction, archive/restore, restricted deletion and atomic duplicate merging.
- Responsive layouts, keyboard navigation, visible focus and reduced-motion support.

## Architecture

Next.js App Router renders pages and reads data using the current user's Supabase identity. React components handle forms, dialogs and refreshes. Supabase provides Auth, PostgreSQL, its generated Data API and Realtime.

Authorization lives in PostgreSQL: Row Level Security protects owned profiles and rides, column grants restrict writable fields, and manually assigned membership controls catalogue mutations. Statistics derive from ride rows; the public ranking RPC exposes only opted-in names and distinct counts. Realtime carries generic refresh hints, never private journal rows. The application runtime uses no service-role credential.

```text
src/app/          Routes, layouts, styles and bundled fonts
src/components/   Forms, navigation, dialogs and interactive views
src/lib/          Domain validation, queries and Supabase adapters
supabase/         Configuration, versioned migrations and curated seed data
tests/            Unit, real API/database and browser tests
scripts/          Local setup, data generation and verification commands
```

## Local setup

Install **Node.js 22.13.1 or a compatible newer release**, npm, and **Docker Desktop with Linux containers**. Start Docker before continuing. Dependencies are pinned in `package-lock.json`; `.nvmrc` records the tested Node version. The Supabase CLI is included as a development dependency.

Run all commands from this repository's root:

```powershell
npm ci
npm run db:start
npm run setup:local
npx supabase migration up --local
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:3000**. The first database start downloads Docker images and can take several minutes. The `credit-count` stack starts real Auth, Postgres, REST, Realtime and local email capture. It stores database data in Docker volumes.

`setup:local` reads this stack's configuration and writes an ignored `.env.local` without printing credentials. If that file already exists, skip the command. To deliberately regenerate it for the current local stack, use `node scripts/local-env.mjs --replace`.

| Address                                | Service                                  |
| -------------------------------------- | ---------------------------------------- |
| `http://127.0.0.1:3000`                | Development app                          |
| `http://127.0.0.1:3001`                | Optimized preview and browser tests      |
| `http://127.0.0.1:55321`               | Supabase API/Auth/Realtime               |
| `127.0.0.1:55322`, database `postgres` | PostgreSQL                               |
| `http://127.0.0.1:55324`               | Mailpit confirmation and recovery emails |

Keep ports 3000/3001 and 55320–55324 available. Use `127.0.0.1` consistently: `localhost` has a separate cookie namespace. Sign up in the app, open Mailpit, then open the confirmation link in the same browser context used to sign up. Password recovery uses the same local email capture.

### Demo accounts

To explore populated journals and the admin interface:

```powershell
npm run demo:seed
```

Generated email addresses and passwords are saved in the ignored `credentials.local.json`. Ari Morgan is an enthusiast, initially with 15 credits/22 rides; Casey Lane is a catalogue admin, initially with 4 credits/6 rides. Both start private. Five synthetic community accounts populate the public leaderboard. No default password is embedded in source.

Run this once when preparing a fresh local demo or the full test suite. Subsequent runs preserve passwords, consent and existing notes but can recreate deleted deterministic **demo rides**. They do not remove extra rides you added. Catalogue seeding separately preserves administrative deletions and merges.

### Environment variables

`.env.example` lists the configuration. Only the first three variables belong in the deployed application:

| Variable                               | Purpose                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public Supabase API URL.                                                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key, or legacy anon key; permissions still depend on the caller and database policies. |
| `NEXT_PUBLIC_SITE_URL`                 | Canonical app origin, used for Auth callbacks.                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`            | Local setup/test tooling only.                                                                             |
| `LOCAL_DATABASE_URL`                   | Privileged local SQL connection for setup/tests.                                                           |
| `CREDIT_COUNT_LOCAL_TESTS`             | Must be `true` for local mutation/verification tooling.                                                    |

The local scripts enforce loopback addresses, this stack's ports and the expected database before modifying data. Environment files, generated passwords, traces, backups and build output are ignored. Never put a service key in a `NEXT_PUBLIC_*` variable.

## Build and test

For an optimized preview:

```powershell
npm run build
npm run start -- --port 3001
```

For the complete local verification gate, start Supabase and prepare demo accounts as above, install Chromium once, and stop any manually running app on port 3001:

```powershell
npx playwright install chromium
npm run verify
```

The gate runs lint, TypeScript, unit tests, generated database-type comparison, real API/database integration tests, an optimized build, browser scenarios and a source/browser-bundle secret scan. Playwright starts and stops its own production server. The current suite includes **7 unit tests, 18 integration tests including the parent suite, and 19 browser scenarios**, with desktop/mobile accessibility checks.

| Command                              | Use                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `npm run lint` / `npm run typecheck` | Static checks.                                                                        |
| `npm test`                           | Domain and redirect unit tests.                                                       |
| `npm run test:integration`           | Real local authorization, concurrency, privacy and seed-preservation checks.          |
| `npm run test:e2e`                   | Browser tests; starts or reuses development port 3000 by default.                     |
| `npm run verify:full`                | The complete gate plus database performance and isolated recovery/migration checks.   |
| `npm run test:browser-performance`   | Local browser measurements; requires the optimized preview on 3001 and demo accounts. |
| `npm run format`                     | Format application, tests, scripts and README.                                        |

To run browser tests alone against an optimized build in PowerShell, build first, then set `$env:E2E_PRODUCTION='true'` before `npm run test:e2e`. In a POSIX shell, use `E2E_PRODUCTION=true npm run test:e2e`. Port 3001 must be free for Playwright.

Run database integration, browser and recovery suites sequentially: failure-injection tests temporarily alter local database helpers. Local measurements and automated accessibility scans do not replace hosted smoke tests or human accessibility review.

## Database maintenance

Migrations are the source of truth for schema, permissions and transactional rules. To apply new migrations locally and update generated public types:

```powershell
npx supabase migration up --local
npm run db:types
npm run db:types:check
```

`supabase/catalogue.json` contains the curated records and source references. `npm run db:seed:build` validates it and regenerates `supabase/seed.sql`; `npm run db:seed` applies that SQL locally. Permanent private seed receipts preserve edits, archives, deletions and merged source removals. Apply migrations before seeding. Correct an already-installed record with an admin action or reviewed data migration; changing its manifest entry alone does not overwrite it.

Archive preserves existing rides and credits while preventing new selection. Delete works only for an unused coaster. Merge moves ride references to an active canonical entry in one transaction, retaining ride IDs, owners, dates and notes; the distinct credit count may decrease.

### Grant catalogue administration

Create and confirm a normal account, find its UUID in Supabase Auth, then run the following in an operator SQL session, replacing the placeholder with that exact UUID:

```sql
insert into public.admin_users (user_id)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid)
on conflict do nothing;
```

Revoke access with `delete from public.admin_users where user_id = 'REPLACE_WITH_AUTH_USER_UUID'::uuid;`. The user's next navigation or refresh updates the interface. Editable signup metadata cannot grant this role, and admins receive no access to other users' journals.

`npm run db:stop` stops the local stack while preserving its normal volumes. **`npm run db:reset` deletes local accounts and rides**, reapplies migrations and seeds the catalogue; use it only for an intentional reset. Routine upgrades and verification do not require it.

`npm run test:recovery` restores a backup into a uniquely named temporary database, checks data/RLS, rebuilds migrations and tests fresh/concurrent seeds and rollback. It cleans up that target without resetting or repointing the running app. For production recovery, restore separately, verify permissions and data, then deliberately repoint the application; rolling back application code cannot undo a catalogue merge.

## Deploy with Supabase and Vercel

1. Create the target Supabase project and a Vercel project. Connect the Git repository for automatic deployments, or authenticate the Vercel CLI with `npx vercel login` and deploy manually. Use separate Supabase data for previews and production. Select a supported Node 22 runtime in Vercel; the Next.js framework preset uses `npm ci` and `npm run build`. `vercel.json` places server execution in `sfo1`, near the current Supabase project in Oregon; adjust it if the database region changes.
2. Authenticate the Supabase CLI in a restricted operator environment, link the target project and apply migrations plus the catalogue seed:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push --include-seed
   ```

   Check the linked project before applying changes. The hosted database password/access token belongs in operator tooling. Local demo and test scripts deliberately refuse hosted targets.

3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` in Vercel. Use the project's public key and the canonical HTTPS application origin. Build after setting them: public environment values are embedded in browser assets. Vercel needs no service-role key or database password.
4. In Supabase Auth, set the same HTTPS Site URL and allow the exact `https://YOUR_DOMAIN/auth/callback` redirect. Enable email/password signup and email confirmation, configure production SMTP, and test confirmation and password recovery using real deliverable addresses. The permissive local mail limits in `supabase/config.toml` are for local development.
5. Deploy the configured build with `npx vercel deploy --prod` from a clean release checkout, or through the connected Git repository. Provision any administrator membership through SQL, and verify login/logout, email flows, journal ownership, catalogue roles, opt-in/out and mobile navigation against the hosted environment. Check cache/security headers, provider quotas, backup retention and a restore procedure before accepting production traffic.

The current site was deployed directly with the CLI; automatic Git deployments are not connected. `.vercelignore` excludes local credentials, internal documents, tests and database/operator tooling from application uploads. Migrations and seeds are applied separately through the Supabase CLI. Keep an existing local `.env.local` intact when linking projects: run `vercel link` in a clean checkout and provide production configuration through Vercel's environment settings.

When this folder is the Git repository root, leave Vercel's Root Directory at its default. If it is imported as part of a larger workspace instead, set Root Directory to `release`.

## Troubleshooting

- **Docker or port errors:** start Docker Desktop in Linux-container mode and check the ports listed above. `npx supabase status` reports the local services; its output includes credentials, so keep it private.
- **Local configuration already exists:** skip `setup:local`; only use `--replace` when intentionally updating it for the current local stack.
- **Confirmation/recovery link fails:** use the same browser and origin as the request, request a fresh email, and check the configured callback allowlist.
- **Stale catalogue or schema:** apply pending migrations, regenerate types if needed, and restart the app. Repeated catalogue seeding intentionally retains administrative corrections.
- **Browser suite cannot start:** stop the manual server on 3001, ensure Chromium is installed, and run tests from this repository root with the local stack running.
- **Leaderboard shows “Periodic updates”:** HTTP polling is working while WebSockets are unavailable. “Unable to refresh” indicates a failed HTTP read; use retry after restoring connectivity.

## Data and font attribution

The 40-coaster manifest includes RCDB and supplementary source URLs and verification dates. It is a static curated dataset; the app does not call a live RCDB API.

Fredoka and Nunito are bundled as unmodified Latin variable WOFF2 files under the SIL Open Font License 1.1. Their copyright notices and full licenses remain in [fredoka-OFL.txt](src/app/fonts/fredoka-OFL.txt) and [nunito-OFL.txt](src/app/fonts/nunito-OFL.txt). Upstream sources: [Fredoka](https://github.com/google/fonts/tree/main/ofl/fredoka), [Nunito](https://github.com/google/fonts/tree/main/ofl/nunito). Fonts are served by the application without a runtime Google Fonts request.
