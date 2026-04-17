# Circle Accountability — Mobile

Expo SDK 54 + React Native 0.81 + TypeScript. File-based routing via
[expo-router](https://docs.expo.dev/router/introduction/). Dark theme
(slate background, emerald accent). Auth via Clerk.

## Prerequisites

- Node 20+
- Expo Go on your phone — must be SDK 54 compatible
- An Expo account signed in both on the machine (`npx expo login`) and
  in Expo Go. Current Expo Go no longer supports manual URL entry;
  project discovery goes through the account.
- The Go API running locally if you want to hit real endpoints
  (`cd apps/api && make dev`).

## Environment variables

Copy `.env.example` to `.env.local` in this directory. Expo auto-loads
it. Only `EXPO_PUBLIC_`-prefixed vars reach the runtime bundle.

| var | what |
|---|---|
| `EXPO_PUBLIC_API_URL` | Go API URL. Use your computer's LAN IP (not `localhost`) when testing against a local API from a real device. |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (`pk_test_...`). Safe to ship in the bundle — identifies the Clerk app, not a secret. |

## Running

```
cd apps/mobile
npx expo start --clear
```

`--clear` flushes Metro's bundler cache; use it after changing deps
or native modules. Open Expo Go on your phone — the project appears
in Recently Used when both devices are signed in to the same Expo
account.

## Routing

File-based: every file under `app/` becomes a route. Folders in
parentheses (`(auth)`, `(app)`) are **route groups** — they share
a layout but don't appear in the URL.

```
app/
  _layout.tsx         Root — wraps everything in <ClerkProvider>.
  index.tsx           "/" — reads auth state; redirects to /sign-in or /home.
  (auth)/
    _layout.tsx       Public stack. Redirects to /home if signed in.
    sign-in.tsx       Sign-in screen.
  (app)/
    _layout.tsx       Protected stack. Redirects to /sign-in if signed out.
    home.tsx          Home screen.
```

## Auth

Clerk via `@clerk/clerk-expo`. Session tokens persist in
`expo-secure-store` (iOS Keychain / Android Keystore) — never
`AsyncStorage`, which is not encrypted. The token cache implementation
lives at `src/lib/tokenCache.ts`.

Sign-in methods:
- **Email + password** with email verification (Clerk's `useSignIn` /
  `useSignUp` hooks).
- **Continue with Google** via Clerk's `useSSO` hook + `expo-auth-
  session`. The OAuth redirect comes back to the app through the
  `circle://` URL scheme declared in `app.json`. The shared button
  component lives at `src/components/GoogleSSOButton.tsx`.

## Scripts

```
npm run start       # expo start
npm run ios         # expo start --ios
npm run android     # expo start --android
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (config deferred until Phase 1 CI)
```

## A note on peer dependencies

Any time you install an Expo-adjacent package (Clerk, Sentry,
anything that depends on `expo-*` packages), check its
`peerDependencies` for loose ranges on `expo-*` packages. If any are
loose, pin them explicitly in the root `package.json` `overrides`
to SDK-matching versions — otherwise npm's hoist-and-dedupe can
install SDK-mismatched native modules and Expo Go will fail at
runtime with `Cannot find native module '...'`. See `learnings.md`
for the full rule.
