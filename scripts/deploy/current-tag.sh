#!/bin/sh
# Prints the image tag that is RUNNING on Azure (read-only), docs/features/auto-deploy AC-8.
#   sh scripts/deploy/current-tag.sh            → three lines: frontend / backend / n8n
#   sh scripts/deploy/current-tag.sh --backend  → only the tag of the backend (for IMAGE_TAG when you run Bicep by hand:
#                                                 IMAGE_TAG=$(sh scripts/deploy/current-tag.sh --backend), else Bicep puts the apps
#                                                 back on the tag of its parameters)
# Needs `az login`. RG (default cvs-rg) and CVS_PREFIX / NAME_PREFIX (default cvs) pick the apps.
set -eu
RG="${RG:-cvs-rg}"
PREFIX="${CVS_PREFIX:-${NAME_PREFIX:-cvs}}"

tag_of() {
  az containerapp show -g "$RG" -n "$PREFIX-$1" --query "properties.template.containers[0].image" -o tsv | sed 's/.*://'
}

case "${1:-}" in
  --backend|--frontend|--n8n) tag_of "${1#--}" ;;
  "") for app in frontend backend n8n; do printf '%-9s %s\n' "$app" "$(tag_of "$app")"; done ;;
  *) echo "usage: current-tag.sh [--backend|--frontend|--n8n]" >&2; exit 2 ;;
esac
