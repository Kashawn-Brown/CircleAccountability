# Circle Accountability — Plan

The full living plan for Circle Accountability. This is the most detailed
document in the repo and the reference for what we are building and why.
timeline.md is the narrative of how it gets built. These are different
documents — do not conflate them.

---

## Product vision

Circle Accountability is a group accountability app for small groups of
people who already have a relationship and want shared accountability
around a goal. The core mechanic is a shared circle/ring that fills as
each member contributes progress. The group only completes the circle
when everyone does their part.

The value is not that the idea is unique. The value is:
- shared goals become visible
- progress is easy to understand at a glance
- everyone sees whether the group is on track
- check-ins create light pressure without heavy policing
- completing the circle feels collaborative

Positioned as a group accountability app, not a generic habit tracker.

### Who it's for
Small groups who already know each other:
- friends
- gym partners
- study/accountability groups
- roommates or families
- small communities doing a challenge together

Strongest early users: people motivated by not letting the group down,
not just by personal streaks.

### What it is not
- a solo habit tracker
- a generic goal tracker
- a social productivity app
- a stranger-discovery app

---

## MVP user stories

**Account and onboarding**
- [ ] As a new user, I can create an account and sign in so that I can
  join and use accountability circles.
- [ ] As a user, I see my circles from one home screen so that I know
  which groups I'm part of and where I need to check in.

**Circle creation and membership**
- [ ] As a user, I can create a circle to start a shared accountability
  goal with friends.
- [ ] As a circle creator, I can define the goal type, cadence, and
  target so that the circle has clear rules.
- [ ] As a circle creator, I can invite others so we can work toward
  the goal together.

**Progress and check-ins**
- [ ] As a circle member, I can log a check-in so that my progress
  counts toward the group goal.
- [ ] As a circle member, I can add an optional note to a check-in for
  context.
- [ ] As a circle member, my check-in is tied to the correct day/week.

**Visibility and accountability**
- [ ] As a user, I see a shared ring that fills based on each member's
  progress so that I understand group progress at a glance.
- [ ] As a user, I see which members are on track or behind so
  accountability is visible without asking.
- [ ] As a user, I can view member progress history inside a circle.

Photo proof is deferred past MVP — note-only check-ins first.

---

## Data model

### Core entities

**User** — person using the app.
- id, email, displayName, username/handle, avatarUrl (nullable),
  createdAt, updatedAt

**Circle** — shared accountability group and its rules.
- id, name, description (nullable), createdByUserId
- goalCategory (fitness, study, general)
- metricType (count, duration, amount)
- cadence (daily (start date-end date, endless), weekly (Sun-Mon, Mon-Sun, Mon-Fri, etc.))
- targetMode (per_member_equal, shared_total_split_evenly)
- targetValue
- status (active, paused, completed, archived)
- startDate, endDate (nullable)
- createdAt, updatedAt

**CircleMember** — join between a user and a circle.
- id, circleId, userId
- role (owner, leader, member)
- membershipStatus (invited, active, left, removed)
- joinedAt (nullable)
- sliceOrder (nullable) — deterministic ring rendering
- memberTargetOverride (nullable)
- createdAt, updatedAt

Membership is its own object, not a user list on Circle. It holds who
belongs, their role, their status, and any per-member configuration.

**Invitation** — pending invites before a user joins.
- id, circleId, invitedByUserId
- inviteToken / code
- inviteeEmail (nullable)
- status (pending, accepted, expired, revoked)
- expiresAt, createdAt

**CheckIn** — a member logging progress.
- id, circleId, userId, circleMemberId
- value, note (nullable)
- occurredAt, countsTowardDate, countsTowardPeriodKey
- source (manual for MVP)
- createdAt, updatedAt

**CirclePeriod** — immutable snapshot of a closed cadence period.
- id, circleId
- periodKey (deterministic string — e.g. `2026-04-18` daily,
  `2026-W16` weekly)
- startsAt, endsAt, closedAt
- status (open, completed, missed)
- aggregatedValue — total group progress at close
- targetValue — target in effect at close (snapshotted because circle
  rules can change)
- createdAt, updatedAt
- Unique (circleId, periodKey)

Written lazily: on check-in writes and circle reads, any past open
periods are detected and closed into a row. Immutable once closedAt is
set. Per-member breakdowns stay computed from CheckIn rows (via
countsTowardPeriodKey) — not denormalized on the period. UI label
will be "History" / "Past weeks" or similar — do not hard-code
"Period" into user-facing copy.

**CheckInAttachment** — optional photo proof (modeled for later, not MVP).
- id, checkInId, fileUrl, mimeType, createdAt

### Derived (not stored in MVP)

**Circle Progress** — ring fill %, per-slice fill %, on-track / behind
labels. Computed from circle rules, active members, current period,
and member check-ins.

**Active Period** — the currently open window a circle is tracking
against. Computed from cadence + now(). Once it ends, it is closed
into a CirclePeriod row (see Core entities).

### Relationships
- User 1→many CircleMember
- Circle 1→many CircleMember
- Circle 1→many Invitation
- Circle 1→many CheckIn
- Circle 1→many CirclePeriod
- User 1→many CheckIn
- CircleMember 1→many CheckIn
- CheckIn 1→many CheckInAttachment (effectively 0–1 in MVP)

Backbone: User ↔ CircleMember ↔ Circle ↔ CheckIn.

### Not modeled yet
Group chat, reactions, nudges/reminders, streaks, buddy confirmation,
health integrations, completion celebrations, alternate ring modes.

---

## MVP scope

### Included
- Auth (Clerk)
- Create/edit circle
- Invite/join flow
- Roles: owner, leader, member
- Visible per-member targets with (possible, if allowed by creator) override on join
- Cadence support (daily, weekly)
- Metric support (count, duration, amount)
- Note-based check-ins
- Progress calculation
- CirclePeriod snapshots on close (lazy write)
- Shared ring dashboard
- Member progress/history view

### Excluded from MVP
- Photo uploads
- Push notifications
- Group chat / feed
- Reactions / nudges
- Templates (Gym Circle, Study Circle, etc.)
- Circle history view (past periods dashboard — data foundation ships
  via CirclePeriod in Phase 4; the UI does not)
- Streaks / grace days
- Overall completion percentage display
- Apple Health / Google Fit
- Completion celebrations
- Weighted slices, pooled goals, advanced ring modes
- Stranger / discovery features

### Ruthless MVP statement
Users can create a circle, invite friends, assign visible personal
targets, log note-based progress, and see the shared ring plus who is
on track or behind. If that loop isn't compelling, extra features
won't save it.

---

## Phase plan

### Phase 0 — Project setup / skeleton
Goal: clean foundation before any feature work.

- [x] Monorepo structure (Turborepo, apps/ + packages/)
- [x] Scaffolds for Expo, Next.js, Go API, packages/types
- [x] docker-compose.yml for local Postgres
- [x] Doc files seeded (plan, timeline, learnings, decisions, errors,
  challenges)
- [x] API boots locally (`make run`, `GET /health` responds)
- [x] Web boots locally (`npm run dev`, Tailwind v4 rendering correctly)
- [x] Mobile boots locally (`npx expo start`, renders on iPhone via Expo Go)
- [x] API connects to local Postgres
- [x] golang-migrate works (`make migrate-up`)
- [x] Lint/format baseline working across apps (Go `go vet` works;
  ESLint flat configs added for web and mobile in Phase 1 step 7)
- [x] Root README accurate against real setup

Output: all apps boot locally, API connects to DB, no real features
yet. No deep infra work.

### Phase 1 — Auth + user foundation
Goal: real users in a real system.

- [x] Clerk integration (mobile, web, Go backend) — backend done;
  mobile done (5a/5b/5c/5d); web done (6a/6b/6c — provider,
  middleware, themed prebuilt sign-in/up, authenticated API client
  + sync + profile)
- [x] Signup / signin / signout flows on mobile (email/password and
  Google OAuth via Clerk SSO)
- [x] Signup / signin / signout flows on web (Clerk prebuilt
  `<SignIn>`/`<SignUp>` themed to the slate + emerald palette;
  Google OAuth included automatically)
- [x] User record creation/sync in Postgres (backend
  `POST /users/sync` upserts; mobile `(app)/_layout` and web
  `(app)/layout` both fire it fire-and-forget on sign-in)
- [x] Basic profile screen (mobile — `/profile` reads
  `GET /users/me` with loading / error-retry / fields layout;
  web — `/profile` matches the same feature set)
- [x] Protected routes/screens (mobile — `(auth)` and `(app)` route
  groups with auth-state-aware layouts; web — `clerkMiddleware` +
  `auth.protect()` on `/home` and `/profile`)
- [x] Session handling across clients (mobile — Secure Store token
  cache + lazy `getToken` injection into API client; web — Clerk
  cookie sessions via middleware/provider + `ApiAuthBridge` that
  lazy-binds `useAuth().getToken` to the API client)
- [x] /users endpoints (backend)
- [x] Auth middleware (backend)
- [x] User table migration
- [x] Web catches up with mobile (6a/6b/6c done)
- [x] CI/CD baseline added (GitHub Actions: `go vet`, `go test`,
  `go mod tidy` drift check, TS typecheck and ESLint across all
  workspaces — runs on every PR to main)

### Phase 2 — Circle creation + listing
Goal: users can create circles and see them.

- [ ] Circle migration + model
- [ ] Create-circle flow (mobile)
- [ ] Home screen listing real circles
- [ ] Circle detail shell
- [ ] Owner role assignment on creation
- [ ] Backend: create/list/get circle endpoints with validation and
  ownership checks
- [ ] Web catches up

### Phase 3 — Invites + join + member targets
Goal: circles become group products, not solo shells.

- [ ] Invite token logic
- [ ] Accept-invite endpoint
- [ ] Membership records
- [ ] Owner/leader/member roles enforced
- [ ] Default circle target + per-member override on join
- [ ] Invite / add-members / accept-invite / member-list UIs (mobile)
- [ ] Tests for invite lifecycle, permission checks, target overrides
- [ ] Web catches up

### Phase 4 — Check-ins + progress engine + ring v1
Goal: the actual product loop works.

- [ ] Check-in creation endpoint (count / duration / amount)
- [ ] Period calculation logic
- [ ] CirclePeriod migration + model
- [ ] Lazy close-of-period logic (snapshot row written when a past open
  period is detected on check-in writes or circle reads)
- [ ] Per-member progress calculation
- [ ] Circle completion calculation
- [ ] On-track / behind logic
- [ ] Ring data response for UI
- [ ] Check-in screen (mobile)
- [ ] Updated dashboard with ring v1
- [ ] Tests: progress math, period/cadence edge cases, target overrides, period close correctness, lazy-close idempotency
- [ ] Load tests in tests/load/ for check-in + dashboard endpoints
- [ ] Web catches up

### Phase 5 — Member observability + management + contacts
Goal: the app feels usable by real groups.

- [ ] Members screen + member detail
- [ ] Progress history view
- [ ] Add/remove members
- [ ] Profile contacts list + add-from-contacts
- [ ] Role-based manage-member permissions
- [ ] Web catches up

### Phase 6 — Hardening + beta prep
Goal: safe enough for real users.

- [ ] Analytics events
- [ ] Error logging / monitoring
- [ ] Rate limiting where needed
- [ ] Validation hardening
- [ ] Empty / error / loading states polished
- [ ] Seed / demo data tools
- [ ] Deployment cleanup (Cloud Run + Neon)
- [ ] Environment separation
- [ ] Smoke tests for main flows
- [ ] E2E happy paths (sign up, create circle, invite/join, check in,
  view progress)

---

## Testing strategy

Tests that are not optional:
- Progress calculation logic
- Invite and join flow
- Role and permission checks
- Period and cadence math

Everything else can be manual in early phases; broader coverage before
beta.

Load testing via k6 once the API is stable (Phase 4 onwards). Tests
live in tests/load/ with their own README.

---

## Definition of MVP complete
A real user can:
- sign in
- create a circle
- invite another user
- join with default or overridden target
- check in
- see their progress
- see the shared circle progress
- view members and statuses
- manage the circle at a basic level

If that works cleanly, there is a real product.
