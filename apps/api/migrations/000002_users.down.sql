-- Rollback: 000002_users
-- Drops the users table. The trigger on users is dropped automatically
-- when the table is dropped, so we don't drop it explicitly.
-- set_updated_at() is intentionally left in place — future tables depend
-- on it, so it's treated as a shared schema utility. The `up` migration
-- uses CREATE OR REPLACE, so re-applying is safe either way.

DROP TABLE IF EXISTS users;
