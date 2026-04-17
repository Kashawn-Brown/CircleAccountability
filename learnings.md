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
