# Circle Accountability — Claude Code Context

## What this is
A group accountability app where small groups share a visual ring that
fills as members log progress. The group only completes the circle when
everyone does their part. Built as a real product and a serious learning
project — not a toy, not a portfolio prop. The end goal is a real app
on the App Store and Google Play that me and others can actually use.

## Repo
- Name: CircleAccountability
- Structure: Turborepo monorepo with apps/ and packages/
- Visibility: Public
- Main branch is protected — never push directly to main

## Environment
- Editor: Cursor
- OS: Windows
- Package manager: npm
- Docker: running locally for PostgreSQL

## Locked stack
- Mobile: Expo + React Native + TypeScript
- Web: Next.js 15 App Router + TypeScript
- Backend: Go 1.23 + chi router + pgx
- Database: PostgreSQL
- Auth: Clerk
- Shared types: packages/types
- Hosting (later): GCP Cloud Run + Neon (serverless PostgreSQL)

## Phase plan
- Phase 0: Monorepo skeleton — all apps boot
- Phase 1: Auth + user foundation (Clerk)
- Phase 2: Circle creation + listing
- Phase 3: Invites + join flow + member targets
- Phase 4: Check-ins + progress engine + ring UI
- Phase 5: Member observability + management
- Phase 6: Hardening + beta prep

## Build approach
Mobile-first. Complete each phase on mobile first, then bring web up
to match before closing the phase. Web follows mobile, not the other
way around. Both iOS and Android are supported targets.

## How to run things
- API: cd apps/api && make run
- Web: cd apps/web && npm run dev
- Mobile: cd apps/mobile && npx expo start
- Database: docker compose up -d
- Migrations: cd apps/api && make migrate-up
- Load tests: cd tests/load && k6 run <script>

## Conventions
- Shared TypeScript types live in packages/types/src/index.ts
- API responses always wrap data: { data: T }
- Web env vars prefixed: NEXT_PUBLIC_
- Mobile env vars prefixed: EXPO_PUBLIC_
- Go business logic lives in internal/ — never imported outside module
- Migrations numbered 000001, 000002 with .up.sql and .down.sql pairs
- One backend, one database, no microservices

## Design
- Figma export is in docs/3.zip — match it closely when building screens
- Dark theme: slate-950 background, emerald-600 primary accent
- ProgressRing SVG is the core UI component of the whole app
- Both iOS and Android are supported targets

## Reference documents
- docs/Circle Accountability.docx — full product planning document,
  read this to understand the product vision, data model, user stories,
  MVP scope, and all key decisions made before development began
- docs/3.zip — Figma design export, contains all screen designs,
  components, and styles to match when building UI

## Scope discipline
Build one thing at a time. Before starting anything, state clearly what
we are about to build and what we are explicitly not building yet. If
something starts expanding in scope mid-build, stop and check with me
before continuing. Do not solve problems we do not have yet.

## Branching
Always work on a feature branch, never directly on main. Main is
protected and only receives merges via Pull Requests on GitHub.

Branch naming convention: phase-N/short-description
Examples:
  phase-0/skeleton
  phase-1/auth
  phase-1/user-profile
  phase-2/circle-creation
  phase-2/circle-listing

At the start of every session, confirm what branch we are on before
writing any code. If we are on main, stop and tell me — I will create
the correct branch first in GitHub Desktop before continuing.

When a phase is large enough to split, use multiple branches within
that phase. Split when the work is genuinely independent, not by default.

Never push directly to main. Never suggest force pushing. All changes
to main go through a PR. I handle branching and merging myself in
GitHub Desktop.

## CI/CD
Not set up yet — placeholder for Phase 1 completion. When added, it
will be a GitHub Actions workflow that runs on every PR targeting main:
- go vet and Go tests
- TypeScript typecheck
- Lint

Keep this in mind when structuring code so nothing makes CI harder to
add later.

## Commits
One phase is not one commit. Commit at every logical checkpoint — each
meaningful, working, standalone unit of work gets its own commit.
Commits should tell the story of how something was built, not just
that it was built.

A commit represents working state at the moment it is made — it is not
a retroactive narrative. If several changes were made together in one
session and all reached working state together, commit them together.
Do not split completed work into multiple commits after the fact just
because the changes feel conceptually distinct. The time to split is
during the work, by committing each logical unit as it reaches a
working state.

Format:
  type: short title describing what this commit does

  - bullet explaining what was done
  - bullet explaining another thing
  - bullet for anything non-obvious about the why

Types: feat, fix, chore, refactor, docs, migration, test

Always suggest the full commit message — do not just say "you should
commit now." The message should be ready to copy and paste into
GitHub Desktop. One summary line, then bullets that are clear but
not dense. I handle the actual commit and push myself.

Each bullet must be a single line — no line breaks mid-bullet, no soft
wrapping inside a bullet. One clear idea per bullet. I paste the
message directly into GitHub Desktop and wrapped bullets create
manual cleanup. If an idea is too long to fit on one line, split it
into multiple bullets instead.

## Code comments
- Brief purpose comment at the top of each file stating what it does
- Comments on key functions, key structs, and non-obvious logic
- Explain the why, not the what — do not comment obvious things
- No over-commenting, clean readable code is the goal
- Go-specific patterns should always have a comment since I am learning
  the language and want to understand what I am reading at a glance

## Go error handling
Handle errors explicitly — no ignored errors. Wrap errors with context
using fmt.Errorf("doing X: %w", err) so the origin is always clear.
No panic() except for startup failures in main(). When we hit an error,
explain what it means before fixing it.

## Testing
Do not skip tests on these — they are critical to the product working:
- Progress calculation logic
- Invite and join flow
- Role and permission checks
- Period and cadence math

Manual testing is acceptable for everything else in early phases. We
will add broader coverage before beta.

## Load testing and metrics
Use k6 for load testing the API. Load tests live in tests/load/ and
have their own README.md explaining what each test covers, how to run
them, and what the results mean. Real numbers matter — response times,
throughput, error rates. These are worth having and worth being able
to speak to. Add load tests for core endpoints once the API is stable
(Phase 4 onwards is the right time).

## READMEs
Every major part of the project needs a README. Maintain these and keep
them accurate as the project evolves:
- README.md (root) — project overview, full setup instructions, how to
  run all three apps, tech stack table, phase plan summary
- apps/api/README.md — Go API specifics, endpoints, migration commands,
  environment variables, how to run tests
- apps/web/README.md — Next.js app setup, environment variables, how
  to run, deployment notes
- apps/mobile/README.md — Expo app setup, how to run on iOS and Android,
  EAS build notes, environment variables
- tests/load/README.md — what load tests exist, how to run them, how to
  interpret results, real numbers from past runs

READMEs should be written so that someone picking up the project cold
can get running without asking questions.

## Future considerations — not building yet, but inform decisions
- App Store and Google Play submission via Expo EAS
- GCP Cloud Run + Neon deployment
- Photo proof uploads via Google Cloud Storage
- Push notifications via Firebase Cloud Messaging
- Do not make choices now that create problems for these later

## Environment variables
Manage .env.local directly — never generate or overwrite it. When new
variables are needed, tell me exactly what to add, where to get the
values, and wait for confirmation before continuing. Keep .env.example
fully up to date with every variable the project needs, using placeholder
values and a comment explaining what each one is for.

---

## Documentation files — maintain these throughout the project

### plan.md
The full living plan for the product. Starts as a cleaned up version
of the original planning document — includes the product vision, user
stories, full data model, MVP scope, phase breakdown with detailed
tasks, and technical decisions. This is the most detailed document
in the repo.

As we build:
- Check off completed tasks using [x]
- Update sections to reflect reality if plans change
- Add detail as it becomes clearer
- Note anything that was descoped and why

This is the complete reference for what we are building and why.
timeline.md is the narrative of how it was built. These are different
things — do not conflate them.

### decisions.md
Architectural and technical choices with reasoning. Prevents
relitigating things already decided. Add an entry whenever a meaningful
choice is made about structure, tooling, approach, or product direction.

### timeline.md
A running readable summary of development. Updated at the end of each
session or meaningful milestone. Should be short enough to read in two
minutes and give a clear picture of what has been built and where things
are headed. Does not go into deep detail — that lives in plan.md.

Always keep a Current Status section at the top reflecting right now —
not history, just the present state and immediate next step.

Format:
  ## Current Status
  *Last updated: (date)*
  One short paragraph on where we are right now and what is next.

  ---

  ## Phase 0 — Project Setup
  *Month Year*
  Short narrative of what was built and any notable decisions made.

  ## Phase 1 — Auth
  *Month Year*
  ...

---

Personal workflow notes — pacing, learning orientation, session
behavior, and the entry formats for the local-only docs
(`learnings.md`, `errors.md`, `challenges.md`) — live in
`CLAUDE.local.md` (gitignored).
