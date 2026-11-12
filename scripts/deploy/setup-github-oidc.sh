#!/bin/sh
# One-time setup so that GitHub Actions can sign in to Azure WITHOUT a stored secret (OIDC federated credential),
# docs/features/auto-deploy AC-5. Run it from a machine where `az login` is done, as a user who may create app registrations
# and role assignments. Idempotent. It prints the three values to put in GitHub → Settings → Secrets and variables → Actions → Variables.
#   sh scripts/deploy/setup-github-oidc.sh [--dry-run]
# Environment: RG (cvs-rg), GITHUB_REPO (tidedtulia/cv-ai-scanner), APP_NAME (cv-ai-scanner-github-deploy), ENVIRONMENT (production).
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
SUBJECT="repo:$GITHUB_REPO:environment:$ENVIRONMENT"

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
CREDENTIAL_NAME="github-$ENVIRONMENT"
CREDENTIAL_JSON="{\"name\":\"$CREDENTIAL_NAME\",\"issuer\":\"https://token.actions.githubusercontent.com\",\"subject\":\"$SUBJECT\",\"audiences\":[\"api://AzureADTokenExchange\"]}"
if [ "$DRY_RUN" -eq 1 ]; then
  run az ad app federated-credential create --id "$APP_ID" --parameters "$CREDENTIAL_JSON"
elif [ -z "$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$CREDENTIAL_NAME'].name" -o tsv)" ]; then
  az ad app federated-credential create --id "$APP_ID" --parameters "$CREDENTIAL_JSON" >/dev/null
  echo "created federated credential for $SUBJECT"
else
  echo "federated credential $CREDENTIAL_NAME already exists"
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
