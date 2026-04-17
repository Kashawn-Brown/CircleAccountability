# Learnings

Concepts, patterns, and explanations encountered as we build. Written
in plain language connected to actual code in this repo — not generic
documentation.

Entry format:

```
## Concept Name
*Where it lives in the codebase*

Plain explanation of what it is, why it exists here, and how it
connects to other parts of the project.
```

---

## Go project layout: `cmd/` and `internal/`
*apps/api/cmd/api/main.go and apps/api/internal/*

`cmd/<name>/main.go` is where runnable Go binaries live. Each folder
under `cmd/` produces its own binary; ours is `cmd/api`. If we add a
CLI tool or worker later, it would go in `cmd/cli/main.go`, etc.

`internal/` is a Go compiler-enforced magic directory. Any package
under it can only be imported by code in the same module (for us,
anything under `github.com/circle-accountability/api/...`). This is
how we declare "private to this service, not a library." Business
logic lives here so it can't accidentally become a public dependency.

Pattern: `cmd/` wires things up; `internal/` holds the actual logic;
`main.go` stays thin.

---

## `go.mod` and `go.sum`
*apps/api/go.mod and apps/api/go.sum*

`go.mod` declares the module name and its required dependencies.
`go.sum` stores cryptographic checksums of the exact versions used.
Both are required to build — Go refuses to compile if any imported
package lacks a matching checksum in `go.sum`.

If you see `missing go.sum entry for module providing package X`, it
means `go.mod` says you depend on something but `go.sum` hasn't
recorded its checksum yet. Fix: `go mod tidy`, which downloads missing
checksums and removes unused entries.

This bit us during Phase 0 boot — the initial scaffold had `go.mod`
populated but `go.sum` was partial. `make tidy` resolved it.

---

## Error wrapping with `%w`
*apps/api/internal/db/db.go and throughout*

`fmt.Errorf("failed to ping database: %w", err)` wraps an original
error with added context. The `%w` verb preserves the error chain so
callers can use `errors.Is` or `errors.As` to inspect the original
cause, even after multiple layers of wrapping.

Without `%w` (e.g. `%v`) you'd get a string that reads the same but
loses the original error object, so callers can't programmatically
check what actually went wrong.

This is the required error style for the project per CLAUDE.md: every
error returned from internal code should add context via `%w`.

---

## Middleware in Go: `func(http.Handler) http.Handler`
*apps/api/internal/middleware/logger.go and cors.go*

Middleware in Go's `net/http` model is a function that takes an
`http.Handler` and returns a new `http.Handler`. Each middleware wraps
the next, so the order you register them in (`r.Use(A); r.Use(B)`)
determines the execution order — A runs first and wraps B.

Our `logger.go` wraps the response writer so it can capture the status
code (the stdlib's `ResponseWriter` doesn't expose the code after
`WriteHeader`). Our `cors.go` short-circuits `OPTIONS` preflight
requests before the handler sees them.

This pattern will come up again in Phase 1 when we add auth
middleware — same signature, same `r.Use(...)` registration.

---

## Monorepo package hoisting
*root `node_modules/` + per-workspace `node_modules/`*

In npm workspaces (and Turborepo's default setup), when multiple
workspaces depend on the same package, npm tries to hoist a single
compatible version to the root `node_modules`. Each workspace can
still have its own copy installed at `apps/<name>/node_modules` if
the hoisted version doesn't satisfy its declared range — but the
hoisted version often wins for tools that do module resolution
starting from a parent directory.

Metro (React Native), Next.js, and TypeScript all walk up the
directory tree looking for packages. They may find the root copy
before the workspace-local copy depending on config and call site.
That's the mechanism behind "my `package.json` says X but the runtime
sees Y."

Practical consequence: the workspace-local `node_modules` is not a
reliable way to control runtime behavior for shared packages. If a
version must be exact across all workspaces, you have to enforce it
at the root — which is what `overrides` is for (see below).

---

## npm `overrides` for cross-workspace version locking
*`package.json` at repo root*

The `overrides` field at root `package.json` tells npm "for any
package matching this name, use exactly this version, regardless of
what any sub-package or workspace asks for." It's npm's equivalent of
Yarn's `resolutions`.

```
"overrides": {
  "react": "19.1.0"
}
```

When to use it: any time a shared package has strict version coupling
and must not be allowed to drift via hoisting. Typical examples are
runtime-linked pairs like `react` + `react-native-renderer`, or type
packages like `@types/react` that have to match across workspaces.

Key gotcha: `overrides` only applies during fresh dependency
resolution. Adding or changing it without deleting `package-lock.json`
and re-running `npm install` may do nothing — the lockfile records the
resolution from the previous install, and npm won't rewrite a lock
that's still internally consistent. If an override doesn't seem to
take effect, nuke the lockfile and all `node_modules`, then reinstall.

---

## `context.Context` for request-scoped values
*apps/api/internal/middleware/auth.go*

Every `*http.Request` in Go carries a `context.Context`. It's the
idiomatic way to pass request-scoped data down the handler chain —
deadlines, cancellation, and values like "who is the authenticated
user." The Auth middleware uses it to hand the Clerk user ID off to
handlers without exposing a global or a custom request type.

Two rules that bit everyone learning this:

1. **Context keys should be a private type**, not a raw string. Pattern:
   `type ctxKey string; const clerkUserIDKey ctxKey = "clerkUserID"`.
   If two packages both used the string `"userID"` as a context key
   without this wrapping, they'd collide silently. Private types make
   the key unforgeable outside the package.
2. **`r.Context()` is read-only.** To attach a value you do
   `ctx := context.WithValue(r.Context(), key, val)` and then pass
   `next.ServeHTTP(w, r.WithContext(ctx))` — a *new* request carrying
   the updated context. The original request's context can't be
   mutated in place.

Handlers downstream pull the value via a small helper
(`ClerkUserIDFromContext(ctx) (string, bool)`) so they don't need to
import the key type or worry about the assertion shape.

---

## JWT verification with Clerk — why it's stateless
*apps/api/internal/middleware/auth.go + github.com/clerk/clerk-sdk-go/v2*

Clerk issues short-lived session tokens (JWTs) when users sign in.
A JWT is three base64 parts: header, payload (claims), signature.
The signature is produced with Clerk's private key; Clerk publishes
the matching public key at a well-known URL (their "JWKS" endpoint).

Any service with the public key can verify the signature **locally** —
no round-trip to Clerk per request. `jwt.Verify` in the Go SDK
transparently fetches and caches the JWKS on first use and does the
signature check for us. The Clerk secret key we load at startup
(`clerk.SetKey`) tells the SDK which Clerk instance to fetch JWKS for.

Once the signature is verified, the `sub` claim in the payload is the
Clerk user ID (`user_2abc...`). That's what we put in the request
context and what handlers use to identify the caller.

Stateless verification is what makes JWT auth fast and scale-friendly
— the API never has to call Clerk to answer "is this request
authorized." Trade-off is that a leaked token stays valid until it
expires, so Clerk keeps sessions short (minutes) and refreshes them
on the client.

**One real-world gotcha on the cache:** Clerk rotates the signing
keys in its JWKS periodically. The Go SDK caches what it fetched on
first use and refreshes on its own schedule. A long-lived dev process
can outlive a rotation — after which it holds a JWKS that no longer
contains the current signing key and rejects fresh JWTs as "invalid"
even though nothing is actually wrong with them. Killing and
restarting the API refetches a current JWKS and clears the issue.
This bit us once in step 5d (see `errors.md`) — diagnosed by logging
the specific `jwt.Verify` error server-side instead of the generic
"invalid or expired" message we send to the client.

---

## Hot-reload cwd matters for env loading
*apps/api/.air.toml + apps/api/cmd/api/main.go*

`main.go` calls `godotenv.Load("../../.env.local")` — a path relative
to the **process's current working directory**, not the binary's
location. With `make run` (plain `go run`), cwd is `apps/api/` and
the path resolves to the repo root.

When adding Air, the temptation is to put `.air.toml` somewhere else
or to have Air change directories before running the binary. Don't.
Keep `.air.toml` in `apps/api/` so Air runs from the same cwd as
`make run`, and `../../.env.local` keeps resolving correctly without
touching code.

General rule: when a process reads files via relative paths, any tool
that wraps or restarts that process must preserve the cwd the path
was written for.

---

## Repository pattern for database access
*apps/api/internal/repo/*

Handlers do not touch the database directly. Each domain entity has
a file under `internal/repo/` that owns the SQL and exposes Go methods.
Handlers call those methods, serialize the result, and write the
response.

The shape for a repo:

```go
type Users struct { pool *pgxpool.Pool }

func NewUsers(pool *pgxpool.Pool) *Users { return &Users{pool: pool} }

func (u *Users) GetByClerkID(ctx context.Context, id string) (User, error) { ... }
```

Constructed once in `main.go` and passed into the handlers that need
it. Keeps HTTP concerns (status codes, JSON encoding) and DB concerns
(SQL, scanning) independent. Makes it possible to swap in a fake repo
for tests later without pulling a database into the test setup — we
aren't building that this phase, but the structure supports it.

Related patterns used in the users repo:

- **`pool.QueryRow(ctx, sql, args...).Scan(&...)`** — pgx's shape for
  a single-row read. Takes the column values in SELECT order into
  pointers; returns `pgx.ErrNoRows` if no row matched.
- **Nullable columns as `*string`** — `username` and `avatar_url` are
  nullable. A pointer cleanly represents "value or null": `nil` means
  NULL, `&"alice"` means present. Scans and JSON-encodes both
  directions without the clunky `sql.NullString` wrapper.
- **Sentinel errors + `errors.Is`** — the repo exposes `ErrNotFound`
  as a package-level variable. Callers check with
  `errors.Is(err, repo.ErrNotFound)`, which walks the wrapped chain,
  so adding context via `fmt.Errorf("...: %w", err)` deeper doesn't
  break callers.

---

## Postgres upsert: `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
*apps/api/internal/repo/users.go*

The `/users/sync` endpoint needs to either insert a new row for a
first-time sign-in or update mirrored fields on an existing row.
Postgres does this in one statement:

```sql
INSERT INTO users (clerk_user_id, email, display_name, username, avatar_url)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (clerk_user_id) DO UPDATE SET
    email        = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    username     = EXCLUDED.username,
    avatar_url   = EXCLUDED.avatar_url
RETURNING id, clerk_user_id, email, display_name, username, avatar_url, created_at, updated_at;
```

Three things to know:

1. **`ON CONFLICT (<col>)` needs a unique constraint or index on that
   column.** `clerk_user_id` has `UNIQUE` from migration 000002, which
   is what this conflict clause points at. Without that, you get an
   error at plan time.
2. **`EXCLUDED.col` inside the DO UPDATE refers to the row the INSERT
   tried to add.** So `email = EXCLUDED.email` means "on conflict,
   overwrite email with the value that would have been inserted." You
   don't re-reference `$2` etc.
3. **`RETURNING` gives the final row state back in the same round
   trip** — including values set by triggers like our
   `updated_at = NOW()`. No second SELECT needed. On an UPDATE path
   you get the updated row; on an INSERT path you get the inserted
   row; on a do-nothing path you'd get nothing, but we never do-nothing
   here.

This shape — upsert + RETURNING — will come up for every mirror-style
table where the external system is authoritative and we cache locally.

---

## Go layering: thin by default, add layers as real logic arrives
*apps/api/internal/*

The backend currently has two layers under `internal/`: `handler/`
and `repo/`. A handler reads the request, orchestrates one or two
calls (Clerk SDK, repo), serializes the response. A repo owns SQL.
There is no service/domain layer in between. This is deliberate and
idiomatic for Go at this scale.

The Node / TypeScript convention is usually three layers from day
one: controller → service → repository, each its own class, often
assembled by a DI container. That shape is so standard that many TS
templates generate the full stack before any logic exists. The Go
community defaults to the opposite: start with as few layers as the
code actually needs, and add layers when real business logic appears
— not before.

What counts as "real business logic" in this project, i.e. what will
trigger a service-layer package when we get there:

- **Phase 4 progress calculation** — period math, cadence rules,
  per-member fill, circle completion. Too specific for a handler and
  has no SQL of its own; will live in an `internal/progress` or
  `internal/checkin` package that handlers and possibly other services
  call into.
- **Phase 3 invite state machine** — pending → accepted / expired /
  revoked with side effects on `circle_members`. Same reasoning.

Until that kind of rule arrives, routing handlers through a pass-
through service would produce two-line `service.Sync()` methods that
just forward to `repo.Upsert(...)`. Pure indirection, no logic
encapsulated. Go idiom is to skip that and grow into it.

Two related Go-isms worth naming:

- **Packages are organized by capability, not by layer-per-entity.**
  `handler/users.go` is a file exposing package-level functions, not
  a `UsersController` class. Adding a new entity means adding files
  to existing packages, not scaffolding a new trio of layer classes
  for every noun in the domain.
- **Constructor-style DI stays explicit.** `repo.NewUsers(pool)` is
  called in `main.go` and passed into the handlers that need it.
  No DI container, no annotations, no reflection. The wiring graph
  is whatever `main.go` says it is, readable top-to-bottom.

Concrete rule for this repo: the moment a handler contains an `if`
that isn't input validation or an error dispatch — a branch
expressing a product rule — that branch gets lifted into a service
package. Until then, two layers is the right number.

---

## Rule: pin loose peer deps of workspace apps in root `overrides`
*`package.json` (root)*

Three times in this monorepo, a package installed into a workspace app
has resolved to a version that didn't match the workspace's actual
framework constraint — because the package declared the dependency
as a **loose peer dep** and npm's hoist-and-dedupe picked the latest
compatible version instead of the one the workspace needed:

1. `@types/react` resolved to 19.2.x at the root when the mobile app
   needed 19.1.x exactly. (Phase 0)
2. `react` resolved to 19.2.5 when React Native's renderer was built
   against 19.1.0 exactly. (Phase 0)
3. `@clerk/clerk-expo`'s peers (`expo-crypto >=12`,
   `expo-auth-session >=5`, etc.) resolved to SDK 55 versions `55.x`
   when the mobile app was on SDK 54 and needed `15.x` / `7.x`.
   (Phase 1 step 5a)

The pattern every time: package A says "I need B, any version ≥ X."
npm picks the newest B that satisfies A. The workspace using A has a
stricter unstated requirement on B (exact version, framework-major
match, etc.). Neither `npm install` nor `npx expo install` check that
second constraint unless it's written down.

**Rule for this repo:** when a workspace app depends on a package
whose peer dependencies include anything the workspace also depends
on — runtime libraries, framework-aligned SDKs, types packages —
pin those peers in root `package.json` `overrides` to the workspace's
required version.

**How to check before installing a new package:**

```
npm view <package> peerDependencies
```

Any peer with a loose range (`>=X`, `^X`, `*`) that the workspace
also consumes is a candidate for a root override.

**Operational note:** `overrides` only applies on fresh dep
resolution. Changing the field without deleting `package-lock.json`
and all `node_modules` does nothing — the lockfile persists the old
resolution and npm won't rewrite a lock that's still internally
consistent. Always nuke-and-reinstall after editing `overrides`.

---

## Clerk's default password policy: length + breach check, not complexity
*apps/mobile/app/(auth)/sign-up.tsx — policy lives in Clerk dashboard*

Clerk's default password policy enforces:
- Minimum length (8 characters by default)
- Not present in HaveIBeenPwned's leaked-password database

It does **not** enforce the traditional "complexity" rules many
validators check — no required uppercase, lowercase, digit, special
character. A password like `correcthorsebatterystaple` passes;
`Password1!` fails the breach check because that exact string is in
the leaked dataset.

This surfaced during 5b testing: a password the user expected to be
"strong enough" came back as "this password has been found in an
online data breach" rather than the "too weak — must include..."
phrasing typical of complexity validators.

**Implication for our error UI.** Surface Clerk's `longMessage`
verbatim — don't invent friendly translations based on what we
*think* the password rules are. The policy is configurable per Clerk
instance from the dashboard; our UI shouldn't have to track which
knobs are on. The `clerkError` helper in our sign-in / sign-up
screens already does this, which is the right call.

If we ever want stricter rules (rotation, history, MFA-required for
admins, etc.), they're a Clerk dashboard setting — not app code.

---

## Mobile OAuth: the system-browser redirect dance
*apps/mobile/src/components/GoogleSSOButton.tsx*

Native OAuth on iOS/Android works very differently from web. There's
no `window.location.href = 'https://...'` — the app launches a system
browser (SafariViewController on iOS, Chrome Custom Tabs on Android),
the user authorizes there, and the browser redirects back to the app
via a **custom URL scheme** registered in `app.json` (ours is `circle`).

Three pieces have to line up for the round-trip to work:

1. **`app.json` declares the URL scheme** (`"scheme": "circle"`). The
   OS uses this to route `circle://...` URLs back to the app.

2. **`AuthSession.makeRedirectUri({ scheme: 'circle' })`** generates
   the exact redirect URI string Clerk needs (something like
   `circle://oauth-native-callback`). Don't hand-build it — the
   helper handles platform-specific differences.

3. **`WebBrowser.maybeCompleteAuthSession()` at module load.** This
   one is the strangest and the easiest to get wrong. It must run at
   the top of the file, not inside a hook or function. Reason: when
   the redirect fires, iOS or Android may spin up a *fresh* JS
   instance of the app to handle the URL. That instance needs to
   know "an auth session is in progress" *before* React even starts
   rendering — otherwise it boots cold and the original
   `startSSOFlow` promise never resolves. Calling it at module load
   in any file that initiates an auth session is enough.

**One implication that surprises web devs:** there's no separate
"sign in with Google" vs "sign up with Google" code path. Clerk
returns `createdSessionId` either way — if the Google account is
new, Clerk auto-creates a Clerk user; if it's already linked, Clerk
signs in to the existing user. Single hook, single button, single
result shape.

**A second implication:** cancellation is silent. If the user
dismisses the browser, `startSSOFlow` resolves with no
`createdSessionId` and no error thrown. Treat the absence of a
session as "user cancelled," not as failure.

---

## Token getter injection — `useAuth` can't live next to `ClerkProvider`
*apps/mobile/app/_layout.tsx and apps/mobile/src/lib/api.ts*

The API client attaches `Authorization: Bearer <jwt>` per request by
calling a `getToken()` function we hand it at app init. That function
comes from Clerk's `useAuth()` hook. The trick: a React hook can't run
in the same component that mounts its provider — `useAuth()` inside
the component that renders `<ClerkProvider>` would read the context
before the provider has supplied it.

Pattern used here:

```tsx
export default function RootLayout() {
  return (
    <ClerkProvider ...>
      <RootContent />  {/* inner component for hook access */}
    </ClerkProvider>
  );
}

function RootContent() {
  const { getToken } = useAuth();
  useEffect(() => {
    api.setTokenGetter(async () => await getToken());
  }, [getToken]);
  // ...render children...
}
```

`setTokenGetter` hands the API client a **lazy** source of tokens
rather than a token value. Every request re-pulls via the getter so
we never cache a stale JWT — Clerk session tokens are short-lived
(minutes) and Clerk refreshes them in the background, so a cached
copy would go stale within the hour.

This pattern will show up again on the web side with `@clerk/nextjs`'s
equivalent hook — different hook, same split: provider at the top,
hook in an inner component, API client bound from that inner
component's effect.

---

## Fire-and-forget mutation in a route-group layout
*apps/mobile/app/(app)/_layout.tsx*

The first time an authenticated user reaches the app, we want the
local `users` row materialized in Postgres via `POST /users/sync`.
That has to happen *after* auth state flips but *before* any screen
queries `/users/me` expecting a row. The natural seam is the `(app)`
group's layout — it renders only when signed in, and wraps every
protected screen.

```tsx
const syncedRef = useRef<string | null>(null);

useEffect(() => {
  if (!isSignedIn || !userId) return;
  if (syncedRef.current === userId) return;  // dedupe for this user
  syncedRef.current = userId;                 // claim immediately
  api.post('/api/v1/users/sync', {}).catch((err) => {
    console.warn('Initial /users/sync failed:', err);
    syncedRef.current = null;                 // allow retry next render
  });
}, [isSignedIn, userId]);
```

Three things going on:

1. **Fire-and-forget** — we don't `await` sync before rendering. Sync
   is ~200ms and idempotent; blocking the whole protected tree on it
   would be a visible pause for every sign-in. The profile screen
   surfaces "not synced yet" with a retry button for the rare race
   where the user navigates there before sync lands.
2. **`useRef` as a "did I do this once" flag.** Storing the synced
   user ID in a ref (not state) dedupes across re-renders without
   triggering another render itself. Key of the map is the user ID —
   so if the session flips to a different user, we sync again.
3. **Ref cleared on error.** If the request fails, we reset the ref so
   the next render attempt will retry. React Native effects don't
   auto-retry; without this reset we'd silently stay unsynced.

The group layout unmounts on sign-out (because `(app)/_layout` redirects
to `/sign-in` when `!isSignedIn`), so the ref is naturally reset
between user sessions. No cross-user leakage to worry about.
