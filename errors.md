# Errors

Notable errors and issues hit during development. Not every minor typo
— only things that are meaningfully instructive.

Entry format:

```
## Error or issue title
*Phase encountered*

What the error was and what caused it.
How we diagnosed it.
How we fixed it.
```

---

### Makefile truncated `DATABASE_URL` at the first `=`
*Phase 0*

`make migrate-up` returned `pq: SSL is not enabled on the server` even
after adding `?sslmode=disable` to `DATABASE_URL` in `.env.local`.
Looking at the command Make actually executed, the URL ended at
`?sslmode` — the `=disable` part was missing.

The Makefile was extracting the URL with
`grep DATABASE_URL .env.local | cut -d '=' -f2`. `cut -f2` takes only
field 2. The value `postgres://...?sslmode=disable` contains two `=`
signs, so field 2 was just `postgres://...?sslmode` and the rest
dropped.

Fix: change `-f2` to `-f2-` (keep field 2 through end). Any future env
value containing `=` — tokens, query parameters, etc. — would have
hit the same bug.

---

### `pq: password authentication failed` from host, but `psql` inside the container worked
*Phase 0*

`make migrate-up` kept failing with password auth errors, but
`docker exec circle_db psql -U postgres ...` with the exact same
credentials worked fine inside the container. The credentials were
correct — the connection wasn't going where we thought.

Diagnosis: `netstat -ano -p TCP | grep :5432` showed two processes
listening on port 5432. One was Docker's port-forward; the other was
`postgresql-x64-17`, a native PostgreSQL Windows service installed
long before this project. Windows was routing host `localhost:5432` to
the native service (with different credentials), not to the Docker
container. Inside the container, `localhost` resolves to the
container's own network namespace, which is why `psql` there hit the
correct DB.

There was also a separate `postgresql-x64-18` service running on 5433,
unrelated to this conflict.

Fix: confirmed no other projects depended on the native x64-17 service
(Career-Tracker uses its own Docker Postgres on 5437/5438), then
`net stop postgresql-x64-17` + `sc config postgresql-x64-17 start= disabled`.
PG 18 on 5433 was left alone.

---

### API port 8080 already bound
*Phase 0*

`make run` printed "API listening addr=:8080" and immediately errored
with `bind: Only one usage of each socket address ... is normally
permitted.` — the server started its listen call but couldn't acquire
the port.

Diagnosis: `netstat -ano | grep :8080` → PID 5840, which
`Get-CimInstance Win32_Service` identified as `MTAgentService` from
MiniTool ShadowMaker (backup software in active use).

Fix: moved the API to port 8090 instead of stopping the backup agent.
Updated `.env.example`, `README.md`, `config.go`, and the mobile/web
`api.ts` fallbacks together so code defaults and env values stay
aligned — otherwise a fresh clone without `.env.local` would fail on
8080 again. Decision recorded in `decisions.md`.

---

### Tailwind v4 classes not applied at all (missing PostCSS config)
*Phase 0*

The web app rendered HTML with Tailwind class names attached
(`bg-slate-950`, `flex`, etc.) but no styles took effect — plain text
on a white background. Typecheck passed. Dev server started with no
errors. Only symptom was visual, so it would have been missed without
actually opening a browser.

Root cause: no `postcss.config.mjs` in `apps/web`. Tailwind v4 runs as
a PostCSS plugin (`@tailwindcss/postcss`). Next.js auto-detects a
PostCSS config when present; without one, it passes CSS through
untouched and `@import "tailwindcss"` becomes a silent no-op. No error
is ever thrown.

Fix: created `apps/web/postcss.config.mjs` registering
`@tailwindcss/postcss`. Lesson: frontend scaffold verification must
include a visual check — no automated signal catches missing CSS.

---

### Tailwind v4 ran but generated no utility classes (missing `@source`)
*Phase 0*

After fixing the PostCSS config, Tailwind was processing CSS (the
output contained theme variables like `--color-red-500`), but the
actual utility class selectors (`.bg-slate-950`, `.flex`) weren't in
the output. Page still unstyled.

Root cause: Tailwind v4's auto-detection of source files uses
heuristics based on the current working directory. In a Turborepo
monorepo, running `next dev` from `apps/web` doesn't reliably find the
`.tsx` files — Tailwind was scanning the wrong scope and finding
nothing.

Fix: added an explicit `@source "../**/*.{ts,tsx}"` directive in
`globals.css` (relative to the file, so `../` goes up from `src/app/`
to `src/`, then recursively). CSS size dropped from 32KB to 8KB
because Tailwind's JIT now generates only the classes we use.

---

### Expo Go cannot load SDK 53 project (supports 54)
*Phase 0*

The Expo scaffold was pinned to SDK 53 (`expo: ~53.0.0`). Modern
Expo Go only supports SDK 54 — attempting to connect from the iPhone
would find the dev server but refuse to load the bundle. Compounding
this: current Expo Go has removed the "Enter URL manually" option;
connections now go through Expo account discovery, so both the phone
and the machine's Expo CLI must be signed into the same account.

Fix: upgraded the mobile app from SDK 53 → 54:
1. `npx expo install expo@^54` to pin the SDK
2. `npx expo install --fix` to align Expo-managed deps — this cascaded
   React 18.3 → 19.1, React Native 0.76 → 0.81, expo-router 4 → 6,
   `@types/react` 18 → 19, `eslint-config-expo` 8 → 10
3. Manual bumps to `devDependencies` (`@types/react`,
   `eslint-config-expo`) — `expo install --fix` only touches
   `dependencies`
4. `npx expo login` on the machine so the dev server advertises to
   the signed-in account

---

### Shared packages deduped to wrong versions across monorepo workspaces
*Phase 0*

After the SDK 54 upgrade, two symptoms:

1. TypeScript errors in mobile like `'View' cannot be used as a JSX
   component ... Property 'refs' is missing in type 'NativeMethods &
   ViewComponent'` — stale React 18 types bleeding into React 19 code.
2. A runtime error on the phone:
   `Incompatible React versions: react is 19.2.5 but
   react-native-renderer is 19.1.0 — they must match exactly.`

Same root cause for both: npm workspace hoisting. Packages shared
across workspaces get deduped to the root `node_modules`, and npm
picks the highest version satisfying all constraints. Mobile had
`react: 19.1.0` in its own `node_modules`, but the root had
`react: 19.2.5` (from web's `^19`), and Metro resolved the root copy
at runtime. Same pattern with `@types/react` — multiple versions in
the tree, wrong one picked up first.

Fix: added root `overrides`:
```
"overrides": {
  "@types/react": "19.1.17",
  "react": "19.1.0"
}
```

Critical gotcha: `overrides` only applies on a fresh resolve. Changing
it without deleting `package-lock.json` + all `node_modules` did
nothing — the lockfile persisted the old resolutions. Had to nuke
both and `npm install` from scratch before the overrides actually
took effect.

---

### Clerk's loose peer deps pulled SDK 55 expo-* packages into an SDK 54 app
*Phase 1 — step 5a*

Adding `@clerk/clerk-expo` to the mobile app made Expo Go throw
`Cannot find native module 'ExpoCryptoAES'` at module load. Import
chain: `@clerk/clerk-expo` → `useSSO` → `expo-auth-session` →
`expo-crypto/aes` → `requireNativeModule('ExpoCryptoAES')`.

Diagnosis: `npm ls expo-crypto expo-auth-session` showed both at
`55.0.14` — SDK 55 versions — even though `expo@54.0.33` was installed
and `node_modules/expo/bundledNativeModules.json` pinned them at
`~15.0.8` / `~7.0.10` for this SDK. Expo Go SDK 54 only ships the
native AES module that matches the SDK 54 JS version, so the SDK 55
JS called into a function that didn't exist in the Expo Go binary.

How they got installed: Clerk declares these as **very loose peer
dependencies** (`expo-crypto >=12`, `expo-auth-session >=5`). npm
satisfies peer deps by picking the latest compatible release, and
`npx expo install` only pins packages you pass to it explicitly — it
does not walk peer deps. So Clerk's peers quietly became SDK 55
without anything shouting.

Fix: added explicit pins to root `package.json` `overrides` for
`expo-crypto ~15.0.8`, `expo-auth-session ~7.0.10`, `expo-web-browser
~15.0.10`, `expo-application ~7.0.8`, `expo-constants ~18.0.13`,
`expo-linking ~8.0.11`. Also made them explicit direct deps in
`apps/mobile/package.json` so the contract is visible. Deleted
`node_modules` and `package-lock.json` before reinstalling — overrides
only apply on a fresh resolve.

Third time the "Metro/Next/TypeScript resolve a hoisted wrong-version
package" family has bitten this repo (after `@types/react` and `react`
in Phase 0). Promoted to a rule: see the learnings entry on peer-dep
overrides.

---

### Stale JWKS cache rejected valid Google SSO JWTs
*Phase 1 — step 5d*

After wiring `POST /users/sync` as a fire-and-forget effect in
`(app)/_layout.tsx`, email/password sign-in worked end-to-end but
Google SSO sign-in for a new user landed on the profile screen with
"user not synced yet" and retry never cleared it.

Diagnosis: Metro logs showed `Initial /users/sync failed: [Error:
invalid or expired session token]` — so the sync *was* firing but the
API was rejecting the JWT. The middleware was swallowing the
`jwt.Verify` error behind a generic message; we added a `slog.Warn`
in `auth.go` that logs the real error, path, and the token's first
12 characters. Restarted the API under a claude-managed background
process so we could read its logs.

On the retry, sync returned 200 cleanly. Row got created. The problem
was gone. The old `main.exe` had been running for hours — long enough
that its in-memory JWKS cache (fetched on first use by the Clerk Go
SDK) no longer contained the current signing key. Clerk rotates keys
on its end; the SDK caches the JWKS it fetched and doesn't proactively
re-poll. Email/password tokens happened to still be signed by a key
already in the cache; the fresh Google SSO token got a newer key that
wasn't cached, so verification failed.

Fix: restarting the API refetches JWKS. The bug was self-healing once
we killed the old `main.exe` and let Air rebuild. Left the improved
error logging in place — next time this shape of failure happens we'll
see the exact reason instead of the generic "invalid or expired" line.

Future-proof note: the Clerk Go SDK handles JWKS caching transparently
and does refresh on its own schedule, but a long-lived dev process can
drift far enough that keys rotate out from under it. In production on
Cloud Run, instances are short-lived enough that this is unlikely to
bite. Worth revisiting before we ship if we see any recurrence.
