#!/bin/sh
# One-time setup so that GitHub Actions can sign in to Azure WITHOUT a stored secret (OIDC federated credential),
# docs/features/auto-deploy AC-5. Run it from a machine where `az login` is done, as a user who may create app registrations
# and role assignments. Idempotent. It prints the three values to put in GitHub → Settings → Secrets and variables → Actions → Variables.
#   sh scripts/deploy/setup-github-oidc.sh [--dry-run]
# Environment: RG (cvs-rg), GITHUB_REPO (tidedtulia/cv-ai-scanner), APP_NAME (cv-ai-scanner-github-deploy), ENVIRONMENT (production).
# The subject GitHub presents contains the IMMUTABLE ids of the owner and the repository, not their names:
#   repo:<owner>@<owner id>/<repo>@<repo id>:environment:<environment>
# (found out the hard way: AADSTS700213 "No matching federated identity record" with a name-only subject). The ids are read from the
# public GitHub API; GITHUB_OWNER_ID / GITHUB_REPO_ID override them (offline, tests). The immutable form also protects against someone
# re-creating a repository under a name you gave up.
set -eu
RG="${RG:-cvs-rg}"
GITHUB_REPO="${GITHUB_REPO:-tidedtulia/cv-ai-scanner}"
APP_NAME="${APP_NAME:-cv-ai-scanner-github-deploy}"
ENVIRONMENT="${ENVIRONMENT:-production}"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

if [ "$DRY_RUN" -eq 1 ]; then
  SUBSCRIPTION_ID="<subscription-id>"
  TENANT_ID="<tenant-id>"
  run() { echo "+ $*"; }
else
  SUBSCRIPTION_ID=$(az account show --query id -o tsv)
  TENANT_ID=$(az account show --query tenantId -o tsv)
  run() { "$@"; }
fi
SCOPE="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG"
GITHUB_OWNER="${GITHUB_REPO%%/*}"
GITHUB_NAME="${GITHUB_REPO#*/}"
if [ -z "${GITHUB_OWNER_ID:-}" ] || [ -z "${GITHUB_REPO_ID:-}" ]; then
  REPO_JSON=$(curl -fsS "https://api.github.com/repos/$GITHUB_REPO") || { echo "cannot read https://api.github.com/repos/$GITHUB_REPO (is the repository public and the name right?); set GITHUB_OWNER_ID and GITHUB_REPO_ID by hand" >&2; exit 1; }
  GITHUB_REPO_ID=$(printf '%s' "$REPO_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
  GITHUB_OWNER_ID=$(printf '%s' "$REPO_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["owner"]["id"])')
fi
SUBJECT="repo:$GITHUB_OWNER@$GITHUB_OWNER_ID/$GITHUB_NAME@$GITHUB_REPO_ID:environment:$ENVIRONMENT"

echo "Subscription $SUBSCRIPTION_ID · resource group $RG · repository $GITHUB_REPO · environment $ENVIRONMENT"

# 1) app registration (reuse the one that already has this name)
if [ "$DRY_RUN" -eq 1 ]; then
  APP_ID="<app-id>"
  run az ad app create --display-name "$APP_NAME"
else
  APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
  if [ -z "$APP_ID" ]; then
    APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
    echo "created app registration $APP_NAME"
  else
    echo "app registration $APP_NAME already exists"
  fi
fi

# 2) service principal of that app
if [ "$DRY_RUN" -eq 1 ]; then
  run az ad sp create --id "$APP_ID"
elif [ -z "$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)" ]; then
  az ad sp create --id "$APP_ID" >/dev/null
  echo "created service principal"
else
  echo "service principal already exists"
fi

# 3) federated credential: only workflow runs of THIS repository in THIS environment can sign in
CREDENTIAL_NAME="github-$ENVIRONMENT-id"
CREDENTIAL_JSON="{\"name\":\"$CREDENTIAL_NAME\",\"issuer\":\"https://token.actions.githubusercontent.com\",\"subject\":\"$SUBJECT\",\"audiences\":[\"api://AzureADTokenExchange\"]}"
if [ "$DRY_RUN" -eq 1 ]; then
  run az ad app federated-credential create --id "$APP_ID" --parameters "$CREDENTIAL_JSON"
elif [ -z "$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$CREDENTIAL_NAME'].name" -o tsv)" ]; then
  az ad app federated-credential create --id "$APP_ID" --parameters "$CREDENTIAL_JSON" >/dev/null
  echo "created federated credential for $SUBJECT"
else
  echo "federated credential $CREDENTIAL_NAME already exists"
fi
# the name-only credential of the first version of this script never matches what GitHub sends: it can go
OLD_CREDENTIAL="github-$ENVIRONMENT"
if [ "$DRY_RUN" -eq 0 ] && [ -n "$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$OLD_CREDENTIAL'].name" -o tsv)" ]; then
  echo "NOTE: the old credential $OLD_CREDENTIAL (name-only subject, never matches) still exists. Remove it:"
  echo "  az ad app federated-credential delete --id $APP_ID --federated-credential-id $OLD_CREDENTIAL"
fi

# 4) Contributor on the resource group ONLY (not the subscription)
if [ "$DRY_RUN" -eq 1 ]; then
  run az role assignment create --assignee "$APP_ID" --role Contributor --scope "$SCOPE"
elif [ -z "$(az role assignment list --assignee "$APP_ID" --role Contributor --scope "$SCOPE" --query "[0].id" -o tsv)" ]; then
  az role assignment create --assignee "$APP_ID" --role Contributor --scope "$SCOPE" >/dev/null
  echo "granted Contributor on $RG"
else
  echo "Contributor on $RG already granted"
fi

cat <<OUT

Put these three as repository VARIABLES (not secrets) in GitHub → Settings → Secrets and variables → Actions → Variables:
  AZURE_CLIENT_ID        $APP_ID
  AZURE_TENANT_ID        $TENANT_ID
  AZURE_SUBSCRIPTION_ID  $SUBSCRIPTION_ID
Optional variables: NAME_PREFIX (default cvs), AZURE_RESOURCE_GROUP (default $RG).
Then GitHub → Settings → Environments → $ENVIRONMENT → Deployment branches → "Selected branches" → main.
No secret is created or printed: the sign-in uses the OIDC token of each workflow run.
OUT
