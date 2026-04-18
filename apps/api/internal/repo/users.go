// Package repo holds database access for each domain entity. Handlers call
// into repo methods; repo methods own SQL. This split keeps HTTP and DB
// concerns independent and makes handlers testable against a fake repo later.
package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a lookup finds no matching row. Callers check
// with errors.Is so wrapping deeper in the chain doesn't break the check.
var ErrNotFound = errors.New("not found")

// User mirrors a row in the users table. Nullable columns are pointers so a
// SQL NULL cleanly round-trips through both pgx scanning and JSON encoding.
type User struct {
	ID          string    `json:"id"`
	ClerkUserID string    `json:"clerkUserId"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	Username    *string   `json:"username,omitempty"`
	AvatarURL   *string   `json:"avatarUrl,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Users is the repository for the users table. Handlers call methods on this
// struct; it holds the DB connection pool.
type Users struct {
	pool *pgxpool.Pool
}

// NewUsers constructs a Users repository. Called once at startup and passed
// into every handler that needs it.
func NewUsers(pool *pgxpool.Pool) *Users {
	return &Users{pool: pool}
}

// UpsertByClerkID inserts a new users row or updates an existing one matched
// by clerk_user_id. Postgres handles the upsert natively via ON CONFLICT;
// the RETURNING clause gives back the final row state in one round trip
// (including the updated_at value the trigger just set on the UPDATE path).
func (u *Users) UpsertByClerkID(
	ctx context.Context,
	clerkUserID, email, displayName string,
	username, avatarURL *string,
) (User, error) {
	const query = `
		INSERT INTO users (clerk_user_id, email, display_name, username, avatar_url)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (clerk_user_id) DO UPDATE SET
			email        = EXCLUDED.email,
			display_name = EXCLUDED.display_name,
			username     = EXCLUDED.username,
			avatar_url   = EXCLUDED.avatar_url
		RETURNING id, clerk_user_id, email, display_name, username, avatar_url, created_at, updated_at
	`

	var row User
	err := u.pool.QueryRow(ctx, query, clerkUserID, email, displayName, username, avatarURL).Scan(
		&row.ID,
		&row.ClerkUserID,
		&row.Email,
		&row.DisplayName,
		&row.Username,
		&row.AvatarURL,
		&row.CreatedAt,
		&row.UpdatedAt,
	)
	if err != nil {
		return User{}, fmt.Errorf("upserting user by clerk id: %w", err)
	}
	return row, nil
}

// GetByClerkID looks up a users row by clerk_user_id. Returns ErrNotFound if
// no row exists — expected when an authenticated endpoint is called before
// the client has synced via POST /users/sync.
func (u *Users) GetByClerkID(ctx context.Context, clerkUserID string) (User, error) {
	const query = `
		SELECT id, clerk_user_id, email, display_name, username, avatar_url, created_at, updated_at
		FROM users
		WHERE clerk_user_id = $1
	`

	var row User
	err := u.pool.QueryRow(ctx, query, clerkUserID).Scan(
		&row.ID,
		&row.ClerkUserID,
		&row.Email,
		&row.DisplayName,
		&row.Username,
		&row.AvatarURL,
		&row.CreatedAt,
		&row.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("looking up user by clerk id: %w", err)
	}
	return row, nil
}
