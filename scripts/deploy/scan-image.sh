#!/bin/sh
# Scan a built image BEFORE it is pushed to a public registry (azure-deploy AC-12): fails when it holds a .env file or something
# that looks like a secret. Usage: sh scripts/deploy/scan-image.sh <image> [<image> ...]   (needs Docker; images must exist locally)
set -u
[ $# -ge 1 ] || { echo "usage: scan-image.sh <image> ..." >&2; exit 2; }
status=0
for image in "$@"; do
  # 1) .env files anywhere outside node_modules
  envfiles=$(docker run --rm --entrypoint sh "$image" -c "find / -xdev \( -name '.env' -o -name '.env.*' \) -not -path '*/node_modules/*' -not -path '/proc/*' 2>/dev/null | head -5" 2>/dev/null)
  if [ -n "$envfiles" ]; then
    echo "scan: $image contains .env file(s):" >&2
    echo "$envfiles" >&2
    status=1
  fi
  # 2) key-looking strings in the application files (node_modules excluded: libraries ship test keys)
  secrets=$(docker run --rm --entrypoint sh "$image" -c "find /app /setup /workflows /usr/src/app -type f -not -path '*/node_modules/*' -exec grep -IlE 'sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|GOCSPX-[A-Za-z0-9_-]{20,}' {} + 2>/dev/null | head -5" 2>/dev/null)
  if [ -n "$secrets" ]; then
    echo "scan: $image has file(s) that look like they hold a secret:" >&2
    echo "$secrets" >&2
    status=1
  fi
  [ $status -eq 0 ] && echo "scan: $image is clean (no .env file, no key-looking string in the application files)"
done
exit $status
