# Shared helpers for db-backup.sh / db-upgrade.sh (sourced; POSIX sh).
cd "$(dirname "$0")/../.." || exit 1
COMPOSE_FILE=docker-compose.dev.yml

dc() { docker compose -f "$COMPOSE_FILE" --profile n8n "$@"; }
die() {
  echo "db: $*" >&2
  exit 1
}

# Reads the resolved compose config (same .env parsing as `docker compose`) into shell variables.
load_config() {
  docker info >/dev/null 2>&1 || die "Docker is not running"
  cfg=$(dc config --format json 2>/dev/null) || die "cannot read $COMPOSE_FILE (is .env present?)"
  cfg_get() {
    printf '%s' "$cfg" | node -e '
      const c = JSON.parse(require("fs").readFileSync(0, "utf8"));
      const [path, key] = process.argv.slice(1);
      process.stdout.write(String(path === "name" ? c.name : path === "image" ? c.services.db.image : (c.services.db.environment[key] ?? "")));
    ' "$@"
  }
  project=$(cfg_get name)
  db_image=$(cfg_get image)
  pg_user=$(cfg_get env POSTGRES_USER)
  pg_db=$(cfg_get env POSTGRES_DB)
  pg_password=$(cfg_get env POSTGRES_PASSWORD)
  for pair in "POSTGRES_USER=$pg_user" "POSTGRES_PASSWORD=$pg_password" "POSTGRES_DB=$pg_db"; do
    [ -n "${pair#*=}" ] || die "missing ${pair%%=*} in .env"
  done
}

# Full dump (all databases + roles + password hashes) of the server in container $1 → file $2
dump_cluster() {
  docker exec "$1" pg_dumpall -U "$pg_user" >"$2" || die "pg_dumpall failed"
  tail -n 3 "$2" | grep -q "PostgreSQL database cluster dump complete" || die "the dump $2 is incomplete"
}

# Row count of every public table of every database, as "<database>.<table> <rows>" (container $1)
table_counts() {
  for database in $(docker exec "$1" psql -X -U "$pg_user" -d postgres -At -c \
    "SELECT datname FROM pg_database WHERE datname NOT IN ('template0', 'template1', 'postgres') ORDER BY 1"); do
    docker exec "$1" psql -X -U "$pg_user" -d "$database" -At -F ' ' -c \
      "SELECT '$database.' || table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
       FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1"
  done
}

backup_dir=tmp/db-backups
timestamp=$(date +%Y%m%d-%H%M%S)
