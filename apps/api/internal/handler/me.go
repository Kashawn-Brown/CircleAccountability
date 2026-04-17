package handler

import (
	"encoding/json"
	"net/http"

	"github.com/circle-accountability/api/internal/middleware"
)

// Ping is a temporary step-3 endpoint that confirms the Auth middleware is
// wired up. It returns the Clerk user ID pulled from the request context.
// Replaced in step 4 by GET /users/me, which will be backed by the database.
func Ping() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clerkUserID, ok := middleware.ClerkUserIDFromContext(r.Context())
		if !ok {
			// Defensive — should never happen behind Auth middleware.
			http.Error(w, "no authenticated user in context", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]string{
				"clerkUserId": clerkUserID,
			},
		})
	}
}
