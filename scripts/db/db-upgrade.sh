#!/bin/sh
# npm run db:upgrade — moves the dev data from the old Postgres major to the one set in docker-compose.dev.yml
# (dump → copy of the old volume as <volume>-pg<old> → new empty volume → restore → compare row counts).
# A failed step puts the old volume back exactly as it was. Feature docs: docs/features/postgres-17-upgrade/
set -eu
. "$(dirname "$0")/lib.sh"
load_config

stage=checks
old_ver=""
vol=""
backup_vol=""
dump=""
tmp_container=cv-scanner-pg-upgrade-dump

copy_volume() { # <from> <to>
  docker run --rm -v "$1":/from:ro -v "$2":/to --entrypoint sh "$db_image" -c 'cp -a /from/. /to/' >/dev/null
}

wait_ready() { # <container>
  i=0
  until docker exec "$1" pg_isready -U "$pg_user" -q 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -lt 60 ] || return 1
    sleep 1
  done
}

on_exit() {
  status=$?
  docker rm -f "$tmp_container" >/dev/null 2>&1 || true
  [ "$status" -ne 0 ] || return 0
  [ "$stage" != checks ] || return 0 # refused before touching anything: die() already said why
  echo >&2
  echo "db:upgrade FAILED at step \"$stage\"." >&2
  case "$stage" in
    copy)
      docker volume rm "$backup_vol" >/dev/null 2>&1 || true # the original volume was not touched yet
      ;;
    switch | restore | verify)
      if [ -n "$backup_vol" ] && docker volume inspect "$backup_vol" >/dev/null 2>&1; then
        echo "Putting the Postgres $old_ver data back..." >&2
        dc rm -sf db >/dev/null 2>&1 || true
        docker volume rm "$vol" >/dev/null 2>&1 || true
        dc create db >/dev/null 2>&1 || true
        copy_volume "$backup_vol" "$vol" && docker volume rm "$backup_vol" >/dev/null 2>&1 &&
          echo "Volume $vol is back to Postgres $old_ver, as before." >&2
      fi
      ;;
  esac
  [ -z "$dump" ] || echo "The full dump is kept: $dump" >&2
  echo "Postgres $old_ver data: volume $vol (or $backup_vol if still present). Fix the cause, then run \`npm run db:upgrade\` again." >&2
  echo "(docker-compose.dev.yml already points to the new image; to run the old data meanwhile use image postgres:$old_ver-alpine.)" >&2
}
trap on_exit EXIT

vol=$(docker volume ls -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.volume=postgres_data" | head -n 1)
[ -n "$vol" ] || die "no Postgres data volume found for project $project — nothing to upgrade"
old_ver=$(docker run --rm -v "$vol":/d:ro --entrypoint cat "$db_image" /d/PG_VERSION 2>/dev/null | tr -d '\n') ||
  die "cannot read the version of volume $vol"
new_ver=${db_image#postgres:}
new_ver=${new_ver%%-*}
new_ver=${new_ver%%.*}
if [ "$old_ver" = "$new_ver" ]; then
  echo "Postgres is already $new_ver — nothing to upgrade"
  exit 0
fi
[ "$old_ver" -lt "$new_ver" ] 2>/dev/null || die "volume $vol is Postgres $old_ver, newer than $db_image"
backup_vol="$vol-pg$old_ver"
docker volume inspect "$backup_vol" >/dev/null 2>&1 &&
  die "volume $backup_vol already exists (a previous upgrade's backup) — remove it with \`docker volume rm $backup_vol\` if you no longer need it"
[ -z "$(dc ps --status running -q n8n 2>/dev/null)" ] || die "n8n is running — run \`npm run n8n:down\` first"

running=$(dc ps --status running -q db 2>/dev/null || true)
if [ -n "$running" ]; then
  clients=$(docker exec "$running" psql -X -U "$pg_user" -d postgres -At -c \
    "SELECT count(*) FROM pg_stat_activity WHERE backend_type = 'client backend' AND pid <> pg_backend_pid() AND datname NOT IN ('postgres')")
  [ "$clients" = 0 ] || die "$clients connection(s) still open — stop the backend / frontend (\`npm run dev\`) and anything else using the database, then retry"
fi

stage=dump
echo "Upgrading Postgres $old_ver -> $new_ver (volume $vol)"
umask 077
mkdir -p "$backup_dir"
dump="$backup_dir/dump-$timestamp-pg$old_ver.sql"

stage=dump
echo "[1/6] Dump with Postgres $old_ver"
dc stop db >/dev/null 2>&1 || true
docker run -d --rm --name "$tmp_container" -v "$vol":/var/lib/postgresql/data "postgres:$old_ver-alpine" >/dev/null
wait_ready "$tmp_container" || die "Postgres $old_ver did not start on volume $vol"
dump_cluster "$tmp_container" "$dump"
table_counts "$tmp_container" >"$backup_dir/counts-$timestamp-before.txt"
docker stop -t 60 "$tmp_container" >/dev/null
echo "      $dump ($(wc -c <"$dump" | tr -d ' ') bytes), $(wc -l <"$backup_dir/counts-$timestamp-before.txt" | tr -d ' ') tables counted"

stage=copy
echo "[2/6] Keep the old data as volume $backup_vol"
docker volume create "$backup_vol" >/dev/null
copy_volume "$vol" "$backup_vol"
docker run --rm -v "$backup_vol":/d:ro --entrypoint test "$db_image" -s /d/PG_VERSION || die "the copy $backup_vol is incomplete"

echo "[3/6] New empty volume for Postgres $new_ver"
stage=switch
dc rm -sf db >/dev/null
docker volume rm "$vol" >/dev/null
dc up -d --wait db >/dev/null 2>&1 || die "the new db container did not become healthy (\`docker compose logs db\`)"
new_container=$(dc ps --status running -q db)

stage=restore
echo "[4/6] Restore"
errors=$(docker exec -i "$new_container" psql -X -q -U "$pg_user" -d postgres <"$dump" 2>&1 >/dev/null |
  grep -E 'ERROR|FATAL' | grep -vE "role \"$pg_user\" already exists|database \"$pg_db\" already exists" || true)
[ -z "$errors" ] || die "restore reported errors:
$errors"
docker exec "$new_container" vacuumdb -U "$pg_user" --all --analyze-only -q

stage=verify
echo "[5/6] Compare row counts"
table_counts "$new_container" >"$backup_dir/counts-$timestamp-after.txt"
[ "${DB_UPGRADE_TEST_FAIL:-}" != verify ] || echo "test.injected_mismatch 1" >>"$backup_dir/counts-$timestamp-after.txt"
diff "$backup_dir/counts-$timestamp-before.txt" "$backup_dir/counts-$timestamp-after.txt" >&2 || die "row counts differ before / after the restore"
version=$(docker exec "$new_container" psql -X -U "$pg_user" -d postgres -At -c "SHOW server_version")

stage=done
echo "[6/6] Done: Postgres $version, all row counts equal"
echo
echo "Full dump:   $dump"
echo "Old data:    volume $backup_vol (Postgres $old_ver) — roll back by running the old image on it; delete when sure: docker volume rm $backup_vol"
echo "Next:        npm run n8n:up, npm run dev"
