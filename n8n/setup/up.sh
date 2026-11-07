#!/bin/sh
# npm run n8n:up — Postgres → n8n-init (database, roles, grants) → n8n, always re-running the setup:
# the n8n container is recreated on every run, so its entrypoint re-applies .env (owner, credentials)
# and the workflows of n8n/workflows/ (the repo is the source of truth). Postgres is left alone.
set -eu
cd "$(dirname "$0")/../.."

dc() { docker compose -f docker-compose.dev.yml --profile n8n "$@"; }

dc up -d --wait db
dc up --no-deps --exit-code-from n8n-init n8n-init
dc up -d --wait --no-deps --force-recreate n8n
