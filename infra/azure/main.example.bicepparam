// Copy to main.bicepparam (git-ignored) and fill in the plain values. NO secret is written here: every secret is read from an
// environment variable of the shell that runs `az deployment group create` (see docs/features/azure-deploy/runbook.md).
using './main.bicep'

param location = 'southeastasia'
param namePrefix = 'cvs'
// phase 1: infrastructure only (DEPLOY_APPS unset); phase 2: export DEPLOY_APPS=true IMAGE_TAG=<tag> after `az acr build`
param deployApps = readEnvironmentVariable('DEPLOY_APPS', 'false') == 'true'
param imageTag = readEnvironmentVariable('IMAGE_TAG', 'latest')

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
