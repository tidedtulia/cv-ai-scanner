#!/bin/sh
# Migrate + seed, for the Container Apps Job and `docker run` (azure-deploy AC-6). Needs DATABASE_URL; the seed also reads
# SEED_HR_EMAIL / SEED_HR_PASSWORD / SEED_HR_NAME (optional) and SEED_SAMPLE_DATA=false (no sample jobs). Idempotent.
set -eu
cd "$(dirname "$0")/.."
[ -n "${DATABASE_URL:-}" ] || { echo "migrate: DATABASE_URL is not set" >&2; exit 1; }
echo "migrate: applying migrations"
npx prisma migrate deploy
echo "migrate: seeding"
npx prisma db seed
