#!/bin/sh
# npm run n8n:export | n8n:import — n8n workflows <-> n8n/workflows/<id>.json
# Exported files reference credentials by id + name only (no secret); clean-export.cjs strips personal /
# instance-specific fields. A workflow deleted in n8n is not deleted from n8n/workflows/ — remove its file by hand.
set -eu
cd "$(dirname "$0")/../.."

compose() {
  docker compose -f docker-compose.dev.yml --profile n8n "$@"
}

if [ -z "$(compose ps --status running -q n8n 2>/dev/null)" ]; then
  echo "n8n is not running — run \`npm run n8n:up\` first" >&2
  exit 1
fi

case "${1:-}" in
  export)
    compose exec -T n8n n8n export:workflow --backup --output=/workflows/
    compose exec -T n8n node /setup/clean-export.cjs /workflows
    echo "Exported to n8n/workflows/ (owner, pinned data and timestamps removed)"
    ;;
  import)
    if ! ls n8n/workflows/*.json >/dev/null 2>&1; then
      echo "No workflow file in n8n/workflows/ — nothing to import"
      exit 0
    fi
    compose exec -T n8n n8n import:workflow --separate --input=/workflows/
    ;;
  *)
    echo "usage: $0 export|import" >&2
    exit 2
    ;;
esac
