# Circle Accountability — Web

Next.js 15 App Router + TypeScript + Tailwind CSS v4. Dark theme (slate
background, emerald accent). Auth via Clerk (`@clerk/nextjs`).

## Prerequisites

- Node 20+
- The Go API running locally if you want to hit real endpoints
  (`cd apps/api && make dev`).
- A Clerk dev instance — same one the mobile app uses. Get the
  publishable key + secret from https://dashboard.clerk.com.

## Environment variables

Copy `.env.example` to `.env.local` in this directory. Next.js
auto-loads it. `NEXT_PUBLIC_`-prefixed vars are exposed to the browser
bundle; everything else stays server-side.

| var | what |
|---|---|
| `NEXT_PUBLIC_API_URL` | Go API URL (defaults to `http://localhost:8090` in dev). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (`pk_test_...`). Safe in the bundle. |
| `CLERK_SECRET_KEY` | Clerk secret (`sk_test_...`). Server-only. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` — tells middleware and prebuilts where our sign-in page lives so they don't redirect to Clerk's hosted portal. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` — same reason for sign-up. |

## Running

```
cd apps/web
npm run dev
```

Open http://localhost:3000. The root route redirects to `/home` if
signed in, or `/sign-in` if not.

## Routing

App Router with route groups. Folders in parentheses (`(auth)`,
`(app)`) share a layout but don't appear in the URL.

```
src/
  middleware.ts                      Clerk middleware — protects /home and /profile.
  app/
    layout.tsx                       Root — wraps everything in <ClerkProvider>.
    page.tsx                         "/" — server-side redirect based on auth().
    (auth)/
      sign-in/[[...rest]]/page.tsx   /sign-in — prebuilt <SignIn />.
      sign-up/[[...rest]]/page.tsx   /sign-up — prebuilt <SignUp />.
    (app)/
      home/page.tsx                  /home — landing after sign-in.
```

The `[[...rest]]` catch-all is what lets Clerk's prebuilt components
navigate to their own sub-paths (`/sign-in/factor-one`,
`/sign-up/verify-email-address`, etc.) without us hand-wiring them.

## Auth

Clerk via `@clerk/nextjs`. Session cookies are handled automatically by
Clerk's middleware and `<ClerkProvider>` — no token cache to maintain
on the web side.

Sign-in surface uses Clerk's **prebuilt `<SignIn>` and `<SignUp>`
components** rather than hand-rolled forms. The Figma export doesn't
include auth screens, so there's no design to match pixel-for-pixel.
The prebuilts are themed to our palette via a shared
`clerkAppearance` object at `src/lib/clerkAppearance.ts` (dark
baseTheme + explicit element classes for card, header, buttons, form
fields, dividers, OTP cells, etc.).

Protected routes (`/home`, `/profile`) are gated by
`clerkMiddleware` + `auth.protect()` in `src/middleware.ts`.
Unauthenticated visits redirect to `/sign-in` (local route, not
Clerk's hosted `accounts.dev` portal — that's what the
`NEXT_PUBLIC_CLERK_SIGN_IN_URL` env var is for).

## Scripts

```
npm run dev          # next dev --port 3000
npm run build        # next build
npm run start        # next start
npm run typecheck    # tsc --noEmit
npm run lint         # next lint (ESLint config deferred until Phase 1 CI)
```

## Tailwind v4 note

Tailwind v4 uses an explicit `@source` directive in `globals.css`
(`@source "../**/*.{ts,tsx}"`) because its auto-detection of source
files is unreliable in a Turborepo monorepo — `next dev` running from
`apps/web/` doesn't always find the `.tsx` files otherwise. Without
that directive, Tailwind processes CSS but emits no utility classes.
Don't remove it.
