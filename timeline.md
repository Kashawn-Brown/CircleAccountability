# Timeline

A running readable summary of development. Updated at the end of each
session or meaningful milestone. Short enough to read in two minutes.
Deep detail lives in plan.md.

---

## Current Status
*Last updated: 2026-04-16*

Phase 0 is progressing. The Go API boots end-to-end — `docker compose
up -d`, `make migrate-up`, `make run`, `GET /health` returns 200 on
port 8090. Getting there took six distinct fixes (documented in
errors.md and decisions.md). Next: verify the Next.js web and Expo
mobile apps boot the same way, then mark Phase 0 complete.

Branch: phase-0/skeleton

---

## Phase 0 — Project Setup
*April 2026*

Repo initialized as a Turborepo monorepo with apps/ (api, web, mobile)
and packages/ (types). Stack locked: Expo + RN + TS for mobile,
Next.js 15 App Router + TS for web, Go 1.23 + chi + pgx + Postgres for
the API, Clerk for auth (Phase 1), GCP Cloud Run + Neon for hosting
later.

Doc files seeded this session (plan, timeline, learnings, decisions,
errors, challenges). API boot verified after fixing: a Makefile shell
bug that truncated `DATABASE_URL` at the first `=`, a port collision
on 5432 with a native Postgres Windows service, a port collision on
8080 with MiniTool ShadowMaker's agent service, a partial `go.sum`
from the initial scaffold, and driver-specific SSL behavior (`pq`
requires SSL, `pgx` doesn't — both accept `sslmode=disable`). Web and
mobile verification still pending before this phase can be marked
complete.
