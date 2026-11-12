#!/usr/bin/env bash
# Deploys an image tag that already exists on ghcr.io to Azure Container Apps (docs/features/auto-deploy AC-6, AC-7):
#   1. remember the tag that runs now      2. migrate (job cvs-migrate), stop if it fails
#   3. update backend, then frontend       4. check the site, put backend + frontend back if it is not healthy
#   5. update n8n, but only outside its window (it may be evaluating CVs)   6. summary
# Needs `az login` (the workflow does it with OIDC). Environment: RG (cvs-rg), NAME_PREFIX (cvs), IMAGE_REGISTRY (ghcr.io/<owner>, required).
# Tuning, for tests: MIGRATE_TIMEOUT_SECONDS (600), VERIFY_TIMEOUT_SECONDS (300), POLL_INTERVAL (10).
set -euo pipefail

TAG="${1:-}"
case "$TAG" in
  ''|*[!A-Za-z0-9_.-]*) echo "deploy: invalid or missing tag '$TAG' (letters, digits, . _ - only)" >&2; exit 2 ;;
esac
RG="${RG:-cvs-rg}"
PREFIX="${NAME_PREFIX:-cvs}"
REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY is required, e.g. ghcr.io/tidedtulia}"
MIGRATE_TIMEOUT_SECONDS="${MIGRATE_TIMEOUT_SECONDS:-600}"
VERIFY_TIMEOUT_SECONDS="${VERIFY_TIMEOUT_SECONDS:-300}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

say() { echo "$*"; }
note() { echo "$*" >> "$SUMMARY"; }
group() { echo "::group::$*"; }
endgroup() { echo "::endgroup::"; }
# a revision suffix: lowercase letters, digits and single dashes, starting with a letter
suffix_for() { echo "r$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-' | tr -s '-')-$(date +%H%M%S)"; }
tag_of() { az containerapp show -g "$RG" -n "$PREFIX-$1" --query "properties.template.containers[0].image" -o tsv | sed 's/.*://'; }
state_of() { az containerapp show -g "$RG" -n "$PREFIX-$1" --query "properties.provisioningState" -o tsv; }

update_app() { # app tag
  az containerapp update -g "$RG" -n "$PREFIX-$1" --image "$REGISTRY/cv-$1:$2" --revision-suffix "$(suffix_for "$2")" --query "properties.latestRevisionName" -o tsv
}

image_exists() { # image name
  local owner="${REGISTRY#*/}" token code
  token=$(curl -s "https://ghcr.io/token?scope=repository:$owner/$1:pull" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" \
    -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json' \
    "https://ghcr.io/v2/$owner/$1/manifests/$TAG")
  [ "$code" = "200" ]
}

note "### Deploy $TAG"

# ---- 0. the three images must exist (a manual run may name a tag that was never built)
group "Check the images"
for name in cv-backend cv-frontend cv-n8n; do
  image_exists "$name" || { say "image $REGISTRY/$name:$TAG does not exist (or is private): nothing was changed"; note "- ❌ image \`$name:$TAG\` not found, nothing changed"; exit 1; }
done
say "the three images exist"
endgroup

# ---- 1. what runs now
group "Record the tags that run now"
PREV_BACKEND=$(tag_of backend); PREV_FRONTEND=$(tag_of frontend); PREV_N8N=$(tag_of n8n)
say "backend $PREV_BACKEND · frontend $PREV_FRONTEND · n8n $PREV_N8N"
note "| app | before | after |"; note "|-----|--------|-------|"
endgroup

# ---- 2. migrate: if it fails no app is touched
group "Migrate database"
az containerapp job update -g "$RG" -n "$PREFIX-migrate" --image "$REGISTRY/cv-backend:$TAG" >/dev/null
EXECUTION=$(az containerapp job start -g "$RG" -n "$PREFIX-migrate" --query name -o tsv)
say "migration execution $EXECUTION"
deadline=$((SECONDS + MIGRATE_TIMEOUT_SECONDS)); STATUS=""
while :; do
  STATUS=$(az containerapp job execution show -n "$PREFIX-migrate" -g "$RG" --job-execution-name "$EXECUTION" --query properties.status -o tsv)
  case "$STATUS" in Succeeded|Failed|Stopped|Degraded) break ;; esac
  [ "$SECONDS" -ge "$deadline" ] && break
  sleep "$POLL_INTERVAL"
done
endgroup
if [ "$STATUS" != "Succeeded" ]; then
  say "migration did not succeed (status '${STATUS:-timeout}'): no app was updated"
  note "- ❌ migration: ${STATUS:-timeout} — **no app was updated**; see \`az containerapp job execution list -g $RG -n $PREFIX-migrate\`"
  exit 1
fi
note "- ✅ migration succeeded"

# ---- 3. backend, then frontend
group "Update backend and frontend"
note "| backend | $PREV_BACKEND | $TAG |"; note "| frontend | $PREV_FRONTEND | $TAG |"
update_app backend "$TAG"
update_app frontend "$TAG"
endgroup

# ---- 4. is the site healthy? if not, back to the previous tags (the migration is NOT rolled back)
group "Check the site"
FQDN=$(az containerapp show -g "$RG" -n "$PREFIX-frontend" --query "properties.configuration.ingress.fqdn" -o tsv)
healthy() {
  local code
  code=$(curl -s -o "$WORK/ready" -w '%{http_code}' --max-time 30 "https://$FQDN/api/health/ready" || true)
  [ "$code" = "200" ] && grep -q '"database":"up"' "$WORK/ready" || return 1
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "https://$FQDN/" || true)
  [ "$code" = "200" ]
}
deadline=$((SECONDS + VERIFY_TIMEOUT_SECONDS)); OK=0
while :; do
  if [ "$(tag_of backend)" = "$TAG" ] && [ "$(tag_of frontend)" = "$TAG" ] && [ "$(state_of backend)" = "Succeeded" ] && [ "$(state_of frontend)" = "Succeeded" ] && healthy; then OK=1; break; fi
  [ "$SECONDS" -ge "$deadline" ] && break
  sleep "$POLL_INTERVAL"
done
endgroup
if [ "$OK" -ne 1 ]; then
  say "the site is not healthy after $VERIFY_TIMEOUT_SECONDS s: putting backend and frontend back"
  group "Roll back"
  [ "$PREV_BACKEND" != "$TAG" ] && update_app backend "$PREV_BACKEND"
  [ "$PREV_FRONTEND" != "$TAG" ] && update_app frontend "$PREV_FRONTEND"
  endgroup
  note "- ❌ health check failed: backend and frontend were put back on \`$PREV_BACKEND\` / \`$PREV_FRONTEND\`. **The migration of $TAG was already applied and is not rolled back** (restore the database if it is not compatible with the old version: runbook 6.3)."
  exit 1
fi
note "- ✅ site healthy (\`/\` and \`/api/health/ready\` with the database up)"

# ---- 5. n8n, only outside its window (nobody is evaluating CVs)
group "Update n8n"
N8N_FAILED=0
if node "$HERE/n8n-window.mjs" wait && update_app n8n "$TAG" && [ "$(tag_of n8n)" = "$TAG" ] && [ "$(state_of n8n)" = "Succeeded" ]; then
  note "| n8n | $PREV_N8N | $TAG |"; note "- ✅ n8n updated outside its window"
else
  N8N_FAILED=1
  note "| n8n | $PREV_N8N | **not updated** |"
  note "- ❌ n8n was not updated (backend and frontend stay on $TAG). Run the workflow again, or: \`az containerapp update -g $RG -n $PREFIX-n8n --image $REGISTRY/cv-n8n:$TAG\`"
fi
endgroup
[ "$N8N_FAILED" -eq 0 ] || exit 1
say "deployed $TAG"
