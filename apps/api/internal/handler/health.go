package handler

import (
	"encoding/json"
	"net/http"
)

// HealthResponse is what GET /health returns.
type HealthResponse struct {
	Status string `json:"status"`
	Env    string `json:"env"`
}

// Health handles GET /health.
// This is used by load balancers, Cloud Run health checks, and developers
// to verify the service is running.
func Health(env string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HealthResponse{
			Status: "ok",
			Env:    env,
		})
	}
}
