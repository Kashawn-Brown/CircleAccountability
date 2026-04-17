package config

import (
	"fmt"
	"os"
)

// Config holds all application configuration loaded from environment variables.
// We load everything at startup so we fail fast if something is missing.
type Config struct {
	// Server
	Port string
	Env  string

	// Database
	DatabaseURL string

	// Auth — Clerk secret key, used by the Clerk Go SDK to fetch JWKS and
	// verify session tokens on incoming requests.
	ClerkSecretKey string
}

// Load reads config from environment variables.
// It returns an error if any required variable is missing.
func Load() (*Config, error) {
	cfg := &Config{
		Port:           getEnv("API_PORT", "8090"),
		Env:            getEnv("API_ENV", "development"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		ClerkSecretKey: os.Getenv("CLERK_SECRET_KEY"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.ClerkSecretKey == "" {
		return nil, fmt.Errorf("CLERK_SECRET_KEY is required")
	}

	return cfg, nil
}

// IsDevelopment returns true when running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

// getEnv returns the value of an environment variable, or a fallback if not set.
func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
