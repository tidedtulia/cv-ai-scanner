#!/bin/sh
# Entrypoint of the `n8n` service (replaces the image's /docker-entrypoint.sh, then calls it):
# 1. check the .env variables
# 2. owner managed by env: hash N8N_OWNER_PASSWORD (bcrypt) — the hash never touches a file
# 3. import the credentials (2 Postgres + MCP bearer token; fixed ids, upsert, encrypted with N8N_ENCRYPTION_KEY)
#    and the workflows of n8n/workflows/ (published when marked active)
# 4. drop the plain passwords from the environment and start n8n
set -eu

fail() {
  echo "n8n-setup: $*" >&2
  exit 1
}

missing=""
for name in N8N_ENCRYPTION_KEY N8N_OWNER_EMAIL N8N_OWNER_PASSWORD DB_POSTGRESDB_PASSWORD POSTGRES_DB N8N_APP_DB_PASSWORD MCP_DB_PASSWORD MCP_AUTH_TOKEN ANTHROPIC_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || missing="$missing $name"
done
# DB_POSTGRESDB_PASSWORD is N8N_DB_PASSWORD in .env
missing=$(echo "$missing" | sed 's/DB_POSTGRESDB_PASSWORD/N8N_DB_PASSWORD/')
[ -z "$missing" ] || fail "missing required variable(s) in .env:$missing"

password_length=${#N8N_OWNER_PASSWORD}
if [ "$password_length" -lt 8 ] || [ "$password_length" -gt 64 ] ||
  ! printf '%s' "$N8N_OWNER_PASSWORD" | grep -q '[0-9]' ||
  ! printf '%s' "$N8N_OWNER_PASSWORD" | grep -q '[A-Z]'; then
  fail "N8N_OWNER_PASSWORD must be 8-64 characters with at least 1 number and 1 uppercase letter"
fi

[ ${#MCP_AUTH_TOKEN} -ge 32 ] || fail "MCP_AUTH_TOKEN must be at least 32 characters (generate one: openssl rand -hex 32)"

N8N_MODULES=/usr/local/lib/node_modules/n8n/node_modules

N8N_INSTANCE_OWNER_PASSWORD_HASH=$(node -e "
  const bcrypt = require('$N8N_MODULES/bcryptjs');
  process.stdout.write(bcrypt.hashSync(process.env.N8N_OWNER_PASSWORD, 10));
")
export N8N_INSTANCE_OWNER_MANAGED_BY_ENV=true
export N8N_INSTANCE_OWNER_EMAIL="$N8N_OWNER_EMAIL"
export N8N_INSTANCE_OWNER_FIRST_NAME="${N8N_OWNER_FIRST_NAME:-Instance}"
export N8N_INSTANCE_OWNER_LAST_NAME="${N8N_OWNER_LAST_NAME:-Owner}"
export N8N_INSTANCE_OWNER_PASSWORD_HASH

umask 077
credentials_file=$(mktemp)
trap 'rm -f "$credentials_file"' EXIT INT TERM
node /setup/credentials.cjs "$credentials_file"
echo "n8n-setup: importing credentials (Postgres n8n_app / mcp_readonly, MCP token, Anthropic, Google Drive)"
n8n import:credentials --input="$credentials_file"
rm -f "$credentials_file"
trap - EXIT INT TERM

# Workflows in the repo are the source of truth: import them, then publish the ones exported with "active": true
# (the publish takes effect when n8n starts below).
if ls /workflows/*.json >/dev/null 2>&1; then
  echo "n8n-setup: importing workflows from n8n/workflows/"
  n8n import:workflow --separate --input=/workflows/
  for id in $(node /setup/active-workflows.cjs /workflows); do
    n8n publish:workflow --id="$id"
  done
fi

unset N8N_OWNER_PASSWORD N8N_APP_DB_PASSWORD MCP_DB_PASSWORD MCP_AUTH_TOKEN ANTHROPIC_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN
exec /docker-entrypoint.sh start
