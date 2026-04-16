package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/circle-accountability/api/internal/config"
	"github.com/circle-accountability/api/internal/db"
	"github.com/circle-accountability/api/internal/handler"
	"github.com/circle-accountability/api/internal/middleware"
)

func main() {
	// Load .env file in development (ignored if not present — production uses real env vars).
	_ = godotenv.Load("../../.env.local")

	// Set up structured logging.
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	// Load and validate config from environment.
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	slog.Info("starting Circle Accountability API", "env", cfg.Env, "port", cfg.Port)

	// Connect to PostgreSQL.
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("connected to database")

	// Build the router.
	r := chi.NewRouter()

	// Global middleware — applied to every request.
	r.Use(middleware.Logger)
	r.Use(middleware.CORS([]string{"*"})) // tighten in production
	r.Use(chiMiddleware.Recoverer)        // recover from panics, return 500
	r.Use(chiMiddleware.RequestID)        // attach a unique ID to each request

	// Routes.
	r.Get("/health", handler.Health(cfg.Env))

	// Future route groups will be mounted here:
	// r.Route("/api/v1", func(r chi.Router) {
	//   r.Use(middleware.Auth)
	//   r.Mount("/users", userRoutes())
	//   r.Mount("/circles", circleRoutes())
	// })

	// Start the HTTP server with graceful shutdown.
	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Listen for OS signals to trigger graceful shutdown.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("API listening", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Block until we receive a shutdown signal.
	<-quit
	slog.Info("shutting down server...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}

	slog.Info("server stopped cleanly")
}
