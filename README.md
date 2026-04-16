# Circle Accountability

> Complete the circle together.

A group accountability app where small groups share a visual ring — each member owns a slice that fills as they log progress. The group only completes the circle when everyone does their part.

---

## Repository Structure

```
circle-accountability/
├── apps/
│   ├── mobile/      # Expo + React Native (iOS + Android)
│   ├── web/         # Next.js 15 (web client)
│   └── api/         # Go backend API
├── packages/
│   └── types/       # Shared TypeScript types (API contracts)
├── docker-compose.yml
└── turbo.json
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | https://nodejs.org |
| Go | ≥ 1.23 | https://go.dev/dl |
| Docker | any recent | https://docker.com |
| golang-migrate | latest | `brew install golang-migrate` or see below |
| Expo CLI | latest | installed via npm |

**Install golang-migrate (if not using brew):**
```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

---

## First-time Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd circle-accountability
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your values
# For local dev, the defaults match the docker-compose.yml setup
```

### 3. Start the local database

```bash
docker compose up -d
```

### 4. Run database migrations

```bash
cd apps/api
make migrate-up
```

### 5. Install Go dependencies

```bash
cd apps/api
go mod download
```

---

## Running the Apps

### API (Go)

```bash
cd apps/api
make run
# → Listening on :8080
# → GET http://localhost:8080/health
```

### Web (Next.js)

```bash
cd apps/web
npm run dev
# → http://localhost:3000
```

### Mobile (Expo)

```bash
# Install Expo CLI if you haven't
npm install -g expo-cli

cd apps/mobile
npm run start
# → Scan QR code with Expo Go app on your phone
# → Or press 'i' for iOS simulator, 'a' for Android emulator
```

---

## Development Commands

From the repo root (runs across all apps via Turborepo):

```bash
npm run dev      # Start all apps in dev mode
npm run build    # Build all apps
npm run lint     # Lint all apps
npm run format   # Format all files with Prettier
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 53 + React Native 0.76 + TypeScript |
| Web | Next.js 15 App Router + TypeScript |
| API | Go 1.23 + chi router |
| Database | PostgreSQL 17 |
| Auth | Clerk (Phase 1) |
| Hosting | GCP Cloud Run + Cloud SQL (later) |

---

## Build Phases

- **Phase 0** ✅ — Project skeleton, monorepo, all apps boot
- **Phase 1** — Auth + user foundation (Clerk)
- **Phase 2** — Circle creation + listing
- **Phase 3** — Invites + join flow + member targets
- **Phase 4** — Check-ins + progress engine + ring UI
- **Phase 5** — Member observability + management
- **Phase 6** — Hardening + beta prep
