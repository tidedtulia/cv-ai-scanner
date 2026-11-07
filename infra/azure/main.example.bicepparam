// Copy to main.bicepparam (git-ignored) and fill in the plain values. NO secret is written here: every secret is read from an
// environment variable of the shell that runs `az deployment group create` (see docs/features/azure-deploy/runbook.md).
using './main.bicep'

param location = 'southeastasia'
param namePrefix = 'cvs'
// phase 1: infrastructure only (DEPLOY_APPS unset); phase 2: export DEPLOY_APPS=true IMAGE_TAG=<tag> after `az acr build`
param deployApps = readEnvironmentVariable('DEPLOY_APPS', 'false') == 'true'
param imageTag = readEnvironmentVariable('IMAGE_TAG', 'latest')

// where the public images are (the GitHub account that runs .github/workflows/images.yml, in lowercase)
param imageRegistry = 'ghcr.io/tidedtulia'

// n8n only runs from 23:50 to 02:00 Vietnam time (about 2 hours a day): saves ~10-15 USD a month.
// Set true to keep it always on (fallback if the 00:00 schedule is ever missed).
param n8nAlwaysOn = false
param n8nWindowStart = '50 23 * * *'
param n8nWindowEnd = '0 2 * * *'

param adminIp = '' // your public IP, to run init-db.sh from your machine
param n8nAllowedCidr = [] // e.g. ['203.0.113.7/32']; empty = no n8n editor

// plain settings
param googleDriveCvFolderId = ''
param smtpUser = ''
param mailFrom = '' // e.g. 'CV AI Scanner <hr@gmail.com>'
param mailReplyTo = ''
param privacyContactEmail = ''
param n8nOwnerEmail = ''
param seedHrEmail = ''

// secrets: from the environment, never from this file
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD', '')
param jwtSecret = readEnvironmentVariable('JWT_SECRET', '')
param n8nDbPassword = readEnvironmentVariable('N8N_DB_PASSWORD', '')
param n8nAppDbPassword = readEnvironmentVariable('N8N_APP_DB_PASSWORD', '')
param mcpDbPassword = readEnvironmentVariable('MCP_DB_PASSWORD', '')
param mcpAuthToken = readEnvironmentVariable('MCP_AUTH_TOKEN', '')
param n8nEncryptionKey = readEnvironmentVariable('N8N_ENCRYPTION_KEY', '')
param n8nOwnerPassword = readEnvironmentVariable('N8N_OWNER_PASSWORD', '')
param anthropicApiKey = readEnvironmentVariable('ANTHROPIC_API_KEY', '')
param googleClientId = readEnvironmentVariable('GOOGLE_CLIENT_ID', '')
param googleClientSecret = readEnvironmentVariable('GOOGLE_CLIENT_SECRET', '')
param googleRefreshToken = readEnvironmentVariable('GOOGLE_REFRESH_TOKEN', '')
param smtpPassword = readEnvironmentVariable('SMTP_PASSWORD', '')
param seedHrPassword = readEnvironmentVariable('SEED_HR_PASSWORD', '')
