# Circle Accountability API — Makefile
# Run `make help` to see available commands.

.PHONY: help run build tidy migrate-up migrate-down test lint

DB_URL ?= $(shell grep DATABASE_URL ../../.env.local 2>/dev/null | cut -d '=' -f2)

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

run: ## Run the API server (development)
	go run ./cmd/api/...

build: ## Build the API binary
	go build -o bin/api ./cmd/api/...

tidy: ## Tidy go modules
	go mod tidy

migrate-up: ## Run all pending migrations
	migrate -path ./migrations -database "$(DB_URL)" up

migrate-down: ## Roll back the last migration
	migrate -path ./migrations -database "$(DB_URL)" down 1

migrate-status: ## Show current migration version
	migrate -path ./migrations -database "$(DB_URL)" version

test: ## Run all tests
	go test ./...

lint: ## Run go vet
	go vet ./...
