-- Migration: 000002_users
-- Creates the users table — our app-side identity row, bridged to Clerk
-- via clerk_user_id. Every other table in the system (circles, members,
-- check-ins) will FK into users.id. Clerk owns authentication; this table
-- owns everything the app needs to know about a user.

-- Generic updated_at trigger function. Reused on every table that has an
-- updated_at column, so we don't rely on application code to keep it
-- accurate. CREATE OR REPLACE so re-running the migration is safe.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
    -- Our own primary key. FKs from other tables point here, not at Clerk.
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Stable pointer to the Clerk user. Matches the `sub` claim on the
    -- Clerk JWT. UNIQUE enforces the 1-to-1 bridge between systems.
    clerk_user_id   text        NOT NULL UNIQUE,

    -- Mirrored from Clerk so we can list/search without calling Clerk on
    -- every request. citext makes uniqueness case-insensitive.
    email           citext      NOT NULL UNIQUE,

    -- Shown in the ring UI. Defaulted from Clerk name fields on first sync.
    display_name    text        NOT NULL,

    -- Optional handle for mentions/invites. Not required at signup.
    username        citext,

    -- Mirror of Clerk's profile image URL. Nullable.
    avatar_url      text,

    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW()
);

-- Partial unique index: enforce username uniqueness only when a value is
-- set. Multiple users can have NULL username without colliding.
CREATE UNIQUE INDEX users_username_unique
    ON users (username)
    WHERE username IS NOT NULL;

-- Bump updated_at automatically on any UPDATE to a users row. Using a
-- trigger (not Go code) so no write path can forget to set it.
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
