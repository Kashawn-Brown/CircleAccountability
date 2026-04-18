// Package middleware — Auth verifies Clerk session tokens on incoming requests.
package middleware

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2/jwt"
)

// ctxKey is a private type for context keys defined in this package. Using a
// private type prevents collisions with keys from other packages that might
// happen to use the same string.
type ctxKey string

const clerkUserIDKey ctxKey = "clerkUserID"

// Auth verifies the Clerk session JWT on the Authorization header. On success
// it attaches the authenticated Clerk user ID to the request context and calls
// the next handler. On failure it responds with 401 and stops the chain.
//
// The Clerk SDK must be initialized with clerk.SetKey() before this middleware
// is used — that happens once at startup in cmd/api/main.go.
func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r)
		if !ok {
			unauthorized(w, "missing or malformed Authorization header")
			return
		}

		claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{Token: token})
		if err != nil {
			// Log the specific verification error server-side so we can
			// debug token issues (clock skew, wrong Clerk instance, stale
			// JWT, etc.) without leaking details to the client.
			slog.Warn("jwt verify failed",
				"path", r.URL.Path,
				"error", err.Error(),
				"token_prefix", safePrefix(token),
			)
			unauthorized(w, "invalid or expired session token")
			return
		}

		ctx := context.WithValue(r.Context(), clerkUserIDKey, claims.Subject)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ClerkUserIDFromContext returns the Clerk user ID that Auth attached to the
// request context, or ("", false) if none was set. Handlers behind Auth should
// always see ok == true; ok == false means the middleware isn't mounted.
func ClerkUserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(clerkUserIDKey).(string)
	if !ok || id == "" {
		return "", false
	}
	return id, true
}

// safePrefix returns the first 12 characters of the token for log correlation.
// JWTs have a well-known "eyJ..." header prefix that's not secret; the signing
// secret is elsewhere in the token. We never log the whole JWT.
func safePrefix(token string) string {
	if len(token) > 12 {
		return token[:12] + "..."
	}
	return token
}

// bearerToken extracts the token from an `Authorization: Bearer <token>` header.
func bearerToken(r *http.Request) (string, bool) {
	h := r.Header.Get("Authorization")
	if h == "" {
		return "", false
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(h, prefix) {
		return "", false
	}
	token := strings.TrimSpace(h[len(prefix):])
	if token == "" {
		return "", false
	}
	return token, true
}

// unauthorized writes a 401 JSON response. Wrapped in { "error": msg } so
// clients can parse a consistent shape regardless of which check failed.
func unauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
