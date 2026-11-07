#!/bin/sh
# npm run db:backup — full dump of the running dev Postgres (read-only, the container keeps running).
set -eu
. "$(dirname "$0")/lib.sh"
load_config

container=$(dc ps --status running -q db 2>/dev/null || true)
[ -n "$container" ] || die "the db container is not running — run \`npm run db:up\` first"

umask 077
mkdir -p "$backup_dir"
major=$(docker exec "$container" sh -c 'echo "${PG_MAJOR:-?}"')
file="$backup_dir/dump-$timestamp-pg$major.sql"
dump_cluster "$container" "$file"
echo "Backup written: $file ($(wc -c <"$file" | tr -d ' ') bytes, all databases + roles)"
echo "Restore into an empty server: psql -U <superuser> -d postgres < $file"
