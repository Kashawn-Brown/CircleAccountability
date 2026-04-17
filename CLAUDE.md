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

## Off limits
The for_me/ folder contains personal notes and is not part of the
codebase. Never read, edit, or reference anything in it.

## My experience level
- TypeScript/JavaScript: some experience
- React Native/Expo: new to it, familiar with React concepts but
  never built a native mobile app
- Go: new to it — explain Go-specific concepts as they come up, never
  assume familiarity with Go patterns, interfaces, goroutines, defer,
  error handling style, structs, etc.

## Learning approach — important, read this carefully
I am building this to understand what I'm building, not just to have
it built. At every step:
- Before writing any code, explain what we are about to build, why it
  exists, and how it fits into what we have already built
- Explain Go-specific concepts the first time they appear — never assume
  prior knowledge
- Connect new concepts back to things we have already built when relevant
- Do not generate large amounts of code without explanation
- Some sessions will be more about understanding than building — that
  is completely fine and expected, do not push to keep building if I
  am still working through understanding something

## Definition of done
A piece of work is not done until:
1. The code is written and working
2. I understand what it does and why
3. Relevant .md files are updated
4. A commit has been suggested with a proper message

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

## When things break
Explain what the error means and why it happened before fixing it. I
want to understand the failure, not just have it disappear. If it is a
Go-specific error pattern I may not recognize, explain that too.

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

## Session checkpoints
At every commit point, before continuing:
1. Update any relevant .md files for what was just built
2. Confirm I understood what was just built before moving to the next piece
3. State clearly what the next piece is

If a session has been running long, proactively suggest a session wrap
before context gets stale — do not wait to be asked.

## Starting every session
Read CLAUDE.md and timeline.md before doing anything. Confirm what
branch we are on. Then confirm what was last completed and what the
logical next step is. Wait for me to confirm the plan before writing
any code.

## Wrapping a session
When asked to wrap up, or when the session has been running long:
1. Finalize any uncommitted work or note clearly what is in progress
2. Update timeline.md including the Current Status section
3. Update learnings.md, decisions.md, errors.md, challenges.md if
   anything is outstanding
4. Suggest a commit message for anything not yet committed
5. Write a short handoff note — what was done this session, what is
   next, anything to watch out for

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

### learnings.md
Concepts, patterns, and explanations encountered as we build. Written
in plain language connected to actual code in this repo — not generic
documentation. Updated as we go. I may also ask to add specific things.

Entry format:
  ## Concept Name
  *Where it lives in the codebase*

  Plain explanation of what it is, why it exists here, and how it
  connects to other parts of the project.

### decisions.md
Architectural and technical choices with reasoning. Prevents
relitigating things already decided. Add an entry whenever a meaningful
choice is made about structure, tooling, approach, or product direction.

### errors.md
Notable errors and issues hit during development — not every minor
typo, but anything meaningfully instructive.

Entry format:
  ## Error or issue title
  *Phase encountered*

  What the error was and what caused it.
  How we diagnosed it.
  How we fixed it.

### challenges.md
Bigger picture challenges — things that were conceptually difficult,
took multiple attempts, or required a real shift in understanding. Not
individual errors but meaningful obstacles and how they were overcome.
The kind of thing worth speaking to when explaining the project.

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