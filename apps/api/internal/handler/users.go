package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	clerkuser "github.com/clerk/clerk-sdk-go/v2/user"

	"github.com/circle-accountability/api/internal/middleware"
	"github.com/circle-accountability/api/internal/repo"
)

// Sync handles POST /api/v1/users/sync. It reads the authenticated Clerk
// user ID from the request context, fetches that user's current profile from
// Clerk (the server is the source of truth — we never trust the client for
// identity), and upserts into the local users table. Idempotent.
func Sync(users *repo.Users) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clerkUserID, ok := middleware.ClerkUserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusInternalServerError, "no authenticated user in context")
			return
		}

		cu, err := clerkuser.Get(r.Context(), clerkUserID)
		if err != nil {
			// 502 rather than 500 — the failure is upstream (Clerk), not our bug.
			writeError(w, http.StatusBadGateway, "fetching Clerk user failed")
			return
		}

		email, ok := primaryEmail(cu)
		if !ok {
			writeError(w, http.StatusBadRequest, "Clerk user has no primary email address")
			return
		}
		displayName := chooseDisplayName(cu, email)
		if displayName == "" {
			writeError(w, http.StatusBadRequest, "Clerk user has no usable display name")
			return
		}

		row, err := users.UpsertByClerkID(
			r.Context(),
			clerkUserID,
			email,
			displayName,
			nilIfEmpty(cu.Username),
			nilIfEmpty(cu.ImageURL),
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "upsert failed")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"data": row})
	}
}

// Me handles GET /api/v1/users/me. Returns the local user row keyed off the
// authenticated Clerk user ID. 404 if the user hasn't synced yet.
func Me(users *repo.Users) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clerkUserID, ok := middleware.ClerkUserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusInternalServerError, "no authenticated user in context")
			return
		}

		row, err := users.GetByClerkID(r.Context(), clerkUserID)
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "user not synced yet; call POST /users/sync after sign-in")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "lookup failed")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"data": row})
	}
}

// primaryEmail pulls the user's primary email out of the Clerk user's
// EmailAddresses slice. Clerk guarantees exactly one primary when
// PrimaryEmailAddressID is set.
func primaryEmail(u *clerk.User) (string, bool) {
	if u.PrimaryEmailAddressID == nil {
		return "", false
	}
	for _, addr := range u.EmailAddresses {
		if addr.ID == *u.PrimaryEmailAddressID {
			return addr.EmailAddress, true
		}
	}
	return "", false
}

// chooseDisplayName picks the best available name from the Clerk user's
// profile, falling back to the email local-part. users.display_name is
// NOT NULL so we must always return something usable.
func chooseDisplayName(u *clerk.User, email string) string {
	name := strings.TrimSpace(derefOrEmpty(u.FirstName) + " " + derefOrEmpty(u.LastName))
	if name != "" {
		return name
	}
	if u.Username != nil && *u.Username != "" {
		return *u.Username
	}
	if at := strings.IndexByte(email, '@'); at > 0 {
		return email[:at]
	}
	return ""
}

// nilIfEmpty collapses nil or empty-string pointers to nil, so we store SQL
// NULL instead of "" for optional columns.
func nilIfEmpty(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}

// derefOrEmpty returns the pointed-to string, or "" if the pointer is nil.
func derefOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// writeJSON encodes v as JSON with the given HTTP status.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes a consistent { "error": msg } body with the given status.
// Matches the shape the Auth middleware uses so clients see one error format.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
