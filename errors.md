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
