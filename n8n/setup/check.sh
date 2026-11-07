#!/bin/sh
# npm run n8n:check — smoke-check of docs/features/n8n-docker-setup (AC-17). Read-only.
# Container checks here (AC-1, AC-12, AC-13); database checks in check-db.sh (AC-6 → AC-11).
set -u
cd "$(dirname "$0")/../.."

N8N_IMAGE=n8nio/n8n:2.46.6
fails=0

compose() {
  docker compose -f docker-compose.dev.yml --profile n8n "$@"
}
ok() { echo "  ✓ $1"; }
ko() {
  echo "  ✗ $1"
  fails=$((fails + 1))
}
expect_equal() {
  if [ "$2" = "$3" ]; then ok "$1"; else ko "$1 — expected [$2], got [$3]"; fi
}

n8n_id=$(compose ps --status running -q n8n 2>/dev/null)
if [ -z "$n8n_id" ]; then
  echo "n8n is not running — run \`npm run n8n:up\` first" >&2
  exit 1
fi
init_id=$(compose ps -a -q n8n-init 2>/dev/null)
bindings=$(docker port "$n8n_id" 5678/tcp)
first_binding=$(echo "$bindings" | head -n 1)

echo "AC-1 n8n is up"
expect_equal "image is $N8N_IMAGE" "$N8N_IMAGE" "$(docker inspect -f '{{.Config.Image}}' "$n8n_id")"
expect_equal "n8n-init finished with exit code 0" "exited 0" \
  "$(docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' "$init_id" 2>/dev/null)"
expect_equal "GET /healthz/readiness → 200" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' "http://$first_binding/healthz/readiness")"

echo "AC-12 timezone"
expect_equal "GENERIC_TIMEZONE / TZ = Asia/Ho_Chi_Minh" "Asia/Ho_Chi_Minh Asia/Ho_Chi_Minh" \
  "$(docker exec "$n8n_id" sh -c 'echo "$GENERIC_TIMEZONE $TZ"')"
expect_equal "container clock is UTC+7" "+0700" "$(docker exec "$n8n_id" date +%z)"

echo "AC-13 local only"
if [ -n "$bindings" ] && ! echo "$bindings" | grep -qv '^127\.0\.0\.1:'; then
  ok "port 5678 is bound to 127.0.0.1 only ($bindings)"
else
  ko "port 5678 is bound to 127.0.0.1 only — got: $(echo "$bindings" | tr '\n' ' ')"
fi
expect_equal "telemetry disabled (N8N_DIAGNOSTICS_ENABLED)" "false" \
  "$(docker exec "$n8n_id" sh -c 'echo "$N8N_DIAGNOSTICS_ENABLED"')"

compose run --rm --no-deps -T --entrypoint sh n8n-init /setup/check-db.sh
db_fails=$?

total=$((fails + db_fails))
echo
if [ "$total" -eq 0 ]; then
  echo "n8n:check passed"
else
  echo "n8n:check failed: $total check(s)"
fi
[ "$total" -eq 0 ]
