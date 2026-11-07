#!/bin/sh
# Database part of `npm run n8n:check` (AC-6 → AC-11). Runs inside the n8n-init image (psql + .env values).
# Read-only: privileges are read with has_*_privilege(); the only "write" (CREATE TABLE) is rolled back.
set -u
export PGHOST="${PGHOST:-db}" PGPORT="${PGPORT:-5432}"
APP_DB=$POSTGRES_DB
fails=0

ok() { echo "  ✓ $1"; }
ko() {
  echo "  ✗ $1"
  fails=$((fails + 1))
}

# psql as <role> <password> on <database>; SQL comes from stdin so psql variables (-v) are interpolated
psql_as() {
  role=$1 password=$2 db=$3
  shift 3
  PGUSER=$role PGPASSWORD=$password psql -X -A -t -q -v ON_ERROR_STOP=1 -d "$db" "$@"
}
admin() {
  db=$1
  shift
  psql_as "$POSTGRES_USER" "$POSTGRES_PASSWORD" "$db" "$@"
}

# expect_equal <description> <expected> <actual>
expect_equal() {
  if [ "$2" = "$3" ]; then ok "$1"; else ko "$1 — expected [$2], got [$3]"; fi
}
# can <description> <role> <password> <db> <sql>
can() {
  if out=$(echo "$5" | psql_as "$2" "$3" "$4" 2>&1); then ok "$1"; else ko "$1 — $out"; fi
}
# cannot <description> <role> <password> <db> <sql>: must fail with a privilege error
cannot() {
  if out=$(echo "$5" | psql_as "$2" "$3" "$4" 2>&1); then
    ko "$1 — was allowed"
  elif echo "$out" | grep -qiE 'permission denied|CONNECT privilege'; then
    ok "$1"
  else
    ko "$1 — unexpected error: $out"
  fi
}

# Table privileges of <role> in the app database, as "table:PRIVILEGE ..." (C collation for a stable order)
table_privileges() {
  admin "$APP_DB" -v role="$1" <<'SQL'
SELECT coalesce(string_agg(c.relname || ':' || p, ' ' ORDER BY c.relname COLLATE "C", p COLLATE "C"), '')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS p
WHERE c.relkind IN ('r', 'p', 'v', 'm') AND has_table_privilege(:'role', c.oid, p);
SQL
}

echo "AC-6 database n8n"
expect_equal "database n8n is owned by role n8n" "n8n" \
  "$(echo "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'n8n'" | admin postgres)"
expect_equal "n8n tables live in database n8n" "t" \
  "$(echo "SELECT to_regclass('public.workflow_entity') IS NOT NULL" | admin n8n)"
expect_equal "no n8n table in the app database" "t" \
  "$(echo "SELECT to_regclass('public.workflow_entity') IS NULL AND to_regclass('public.credentials_entity') IS NULL" | admin "$APP_DB")"
can "role n8n logs in to database n8n (N8N_DB_PASSWORD)" n8n "$N8N_DB_PASSWORD" n8n "SELECT 1"
cannot "role n8n cannot connect to the app database" n8n "$N8N_DB_PASSWORD" "$APP_DB" "SELECT 1"

echo "AC-7 role n8n_app"
can "n8n_app logs in (N8N_APP_DB_PASSWORD)" n8n_app "$N8N_APP_DB_PASSWORD" "$APP_DB" "SELECT 1"
expect_equal "n8n_app has exactly the table privileges of database.md §6" \
  "application_status_history:INSERT applications:SELECT evaluations:INSERT evaluations:SELECT evaluations:UPDATE job_levels:SELECT position_criteria:SELECT" \
  "$(table_privileges n8n_app)"
expect_equal "n8n_app may update only applications.status / updated_at" "status updated_at" \
  "$(echo "SELECT string_agg(attname, ' ' ORDER BY attname COLLATE \"C\") FROM pg_attribute WHERE attrelid = 'applications'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('n8n_app', attrelid, attnum, 'UPDATE')" | admin "$APP_DB")"
can "n8n_app reads applications, position_criteria, job_levels" n8n_app "$N8N_APP_DB_PASSWORD" "$APP_DB" \
  "SELECT FROM applications LIMIT 0; SELECT FROM position_criteria LIMIT 0; SELECT FROM job_levels LIMIT 0;"
can "n8n_app updates applications.status" n8n_app "$N8N_APP_DB_PASSWORD" "$APP_DB" \
  "UPDATE applications SET status = status, updated_at = updated_at WHERE false"
cannot "n8n_app cannot update applications.full_name" n8n_app "$N8N_APP_DB_PASSWORD" "$APP_DB" \
  "UPDATE applications SET full_name = 'x' WHERE false"
cannot "n8n_app cannot delete evaluations" n8n_app "$N8N_APP_DB_PASSWORD" "$APP_DB" "DELETE FROM evaluations WHERE false"
cannot "n8n_app cannot read positions" n8n_app "$N8N_APP_DB_PASSWORD" "$APP_DB" "SELECT FROM positions LIMIT 0"
cannot "n8n_app cannot read users" n8n_app "$N8N_APP_DB_PASSWORD" "$APP_DB" "SELECT FROM users LIMIT 0"
cannot "n8n_app cannot create tables" n8n_app "$N8N_APP_DB_PASSWORD" "$APP_DB" \
  "BEGIN; CREATE TABLE n8n_check_probe (x int); ROLLBACK;"
cannot "n8n_app cannot connect to database n8n" n8n_app "$N8N_APP_DB_PASSWORD" n8n "SELECT 1"

echo "AC-8 role mcp_readonly"
can "mcp_readonly logs in (MCP_DB_PASSWORD)" mcp_readonly "$MCP_DB_PASSWORD" "$APP_DB" "SELECT 1"
expect_equal "mcp_readonly can only SELECT the 4 job tables" \
  "job_categories:SELECT job_levels:SELECT position_criteria:SELECT positions:SELECT" \
  "$(table_privileges mcp_readonly)"
can "mcp_readonly reads job_categories, job_levels, positions, position_criteria" mcp_readonly "$MCP_DB_PASSWORD" "$APP_DB" \
  "SELECT FROM job_categories LIMIT 0; SELECT FROM job_levels LIMIT 0; SELECT FROM positions LIMIT 0; SELECT FROM position_criteria LIMIT 0;"
for table in applications evaluations application_status_history users; do
  cannot "mcp_readonly cannot read $table" mcp_readonly "$MCP_DB_PASSWORD" "$APP_DB" "SELECT FROM $table LIMIT 0"
done
cannot "mcp_readonly cannot write positions" mcp_readonly "$MCP_DB_PASSWORD" "$APP_DB" "DELETE FROM positions WHERE false"
cannot "mcp_readonly cannot connect to database n8n" mcp_readonly "$MCP_DB_PASSWORD" n8n "SELECT 1"

echo "AC-9 nothing extra"
expect_equal "role n8n has no privilege in the app database" "" "$(table_privileges n8n)"
expect_equal "no role may CREATE in schema public" "false false false" \
  "$(echo "SELECT string_agg(has_schema_privilege(r, 'public', 'CREATE')::text, ' ') FROM unnest(ARRAY['n8n', 'n8n_app', 'mcp_readonly']) AS r" | admin "$APP_DB")"

echo "AC-10 owner"
expect_equal "the n8n owner is N8N_OWNER_EMAIL" "1" \
  "$(admin n8n -v email="$N8N_OWNER_EMAIL" <<'SQL'
SELECT count(*) FROM "user" WHERE email = :'email' AND "roleSlug" = 'global:owner';
SQL
)"

echo "AC-11 credentials"
expect_equal "credentials cvScannerMcpRead + cvScannerN8nApp exist" \
  "cvScannerMcpRead|CV Scanner DB (mcp_readonly)|postgres cvScannerN8nApp|CV Scanner DB (n8n_app)|postgres" \
  "$(echo "SELECT string_agg(id || '|' || name || '|' || type, ' ' ORDER BY id COLLATE \"C\") FROM credentials_entity WHERE id IN ('cvScannerN8nApp', 'cvScannerMcpRead')" | admin n8n)"
expect_equal "credential passwords are stored encrypted" "0" \
  "$(admin n8n -v p1="$N8N_APP_DB_PASSWORD" -v p2="$MCP_DB_PASSWORD" <<'SQL'
SELECT count(*) FROM credentials_entity WHERE strpos(data, :'p1') > 0 OR strpos(data, :'p2') > 0;
SQL
)"

exit "$fails"
