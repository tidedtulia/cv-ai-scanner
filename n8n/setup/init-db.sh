#!/bin/sh
# One-shot setup run by the `n8n-init` service on every `npm run n8n:up` (idempotent).
# - database `n8n` (n8n's own data) owned by role `n8n`
# - roles `n8n_app` (WF-1) and `mcp_readonly` (MCP tool) with exactly the privileges of docs/database.md §6
# Passwords come from the root .env; they are read with psql's \getenv, never put on a command line.
set -eu

missing=""
for name in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB N8N_DB_PASSWORD N8N_APP_DB_PASSWORD MCP_DB_PASSWORD; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || missing="$missing $name"
done
if [ -n "$missing" ]; then
  echo "n8n-init: missing required variable(s) in .env:$missing" >&2
  exit 1
fi

export PGHOST="${PGHOST:-db}" PGPORT="${PGPORT:-5432}" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD"

psql -X -q -v ON_ERROR_STOP=1 -d postgres <<'SQL'
\getenv app_db POSTGRES_DB
\getenv app_user POSTGRES_USER
\getenv n8n_pw N8N_DB_PASSWORD
\getenv n8n_app_pw N8N_APP_DB_PASSWORD
\getenv mcp_pw MCP_DB_PASSWORD

-- Roles: create when missing, then (re)apply attributes + the password from .env
SELECT format('CREATE ROLE %I', r) FROM unnest(ARRAY['n8n', 'n8n_app', 'mcp_readonly']) AS r
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r) \gexec

ALTER ROLE n8n          WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'n8n_pw';
ALTER ROLE n8n_app      WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'n8n_app_pw';
ALTER ROLE mcp_readonly WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'mcp_pw';

-- Database `n8n` (CREATE DATABASE cannot run inside a transaction / DO block → \gexec)
SELECT 'CREATE DATABASE n8n OWNER n8n'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n') \gexec
ALTER DATABASE n8n OWNER TO n8n;

-- By default PUBLIC may connect to every database: only the right roles may connect
REVOKE CONNECT, TEMPORARY ON DATABASE n8n FROM PUBLIC;
REVOKE ALL ON DATABASE n8n FROM n8n_app, mcp_readonly;
REVOKE CONNECT, TEMPORARY ON DATABASE :"app_db" FROM PUBLIC;
REVOKE ALL ON DATABASE :"app_db" FROM n8n, n8n_app, mcp_readonly;
GRANT CONNECT, TEMPORARY ON DATABASE :"app_db" TO :"app_user";
GRANT CONNECT ON DATABASE :"app_db" TO n8n_app, mcp_readonly;

\connect :"app_db"

DO $$
BEGIN
  IF to_regclass('public.applications') IS NULL THEN
    RAISE EXCEPTION 'n8n-init: app tables not found — run "cd packages/backend && npx prisma migrate deploy" first';
  END IF;
END $$;

-- Start from zero every run, so a GRANT removed from this file is also removed from the DB
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM n8n, n8n_app, mcp_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM n8n, n8n_app, mcp_readonly;
REVOKE ALL ON SCHEMA public FROM n8n, n8n_app, mcp_readonly;
GRANT USAGE ON SCHEMA public TO n8n_app, mcp_readonly;

-- WF-1 (docs/database.md §6)
GRANT SELECT ON job_levels, position_criteria, applications TO n8n_app;
GRANT UPDATE (status, updated_at) ON applications TO n8n_app;
GRANT SELECT, INSERT, UPDATE ON evaluations TO n8n_app;
GRANT INSERT ON application_status_history TO n8n_app;

-- MCP tool get_position_requirements: job data only, never candidates
GRANT SELECT ON job_categories, job_levels, positions, position_criteria TO mcp_readonly;
SQL

echo "n8n-init: database n8n + roles n8n / n8n_app / mcp_readonly are up to date"
