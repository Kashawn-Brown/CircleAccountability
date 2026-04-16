-- Migration: 000001_init
-- Sets up PostgreSQL extensions and conventions used throughout the schema.

-- uuid-ossp: lets us generate UUIDs as primary keys (gen_random_uuid())
-- This is standard in modern PostgreSQL (built-in since PG 13 via pgcrypto).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- citext: case-insensitive text type, useful for emails and usernames
-- so 'Alice@example.com' and 'alice@example.com' match without lowercasing.
CREATE EXTENSION IF NOT EXISTS "citext";
