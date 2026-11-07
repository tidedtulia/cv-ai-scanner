// CV AI Scanner on Azure Container Apps + PostgreSQL Flexible Server (docs/features/azure-deploy, AC-7).
// Two phases, same file:
//   1) deployApps = false  → registry, logs, environment, identity, database server (no secrets besides the DB admin password)
//   2) build the images with `az acr build`, then deployApps = true (+ imageTag) → the 3 apps and the migrate job
// Secrets come in as @secure() parameters (main.example.bicepparam reads them from environment variables) and are stored as
// Container Apps secrets; nothing secret is written in this file. Runbook: docs/features/azure-deploy/runbook.md

targetScope = 'resourceGroup'

// ---------------------------------------------------------------- general
@description('Azure region. Southeast Asia is the closest to Vietnam.')
param location string = 'southeastasia'

@minLength(2)
@maxLength(8)
@description('Prefix of every resource name; also the names of the container apps (<prefix>-frontend, <prefix>-backend, <prefix>-n8n).')
param namePrefix string = 'cvs'

@description('false = infrastructure only; true = also the 3 apps and the migrate job (the images must exist in the registry).')
param deployApps bool = false

@description('Tag of the 3 images in the registry (backend, frontend, n8n), e.g. 2026-11-07.1.')
param imageTag string = 'latest'

// ---------------------------------------------------------------- sizing (all tunable)
param logRetentionDays int = 30

@description('Daily cap of ingested logs (GB), keeps the log bill bounded.')
param logDailyCapGb string = '0.5'

param postgresSku string = 'Standard_B1ms'
param postgresStorageGb int = 32
param postgresBackupDays int = 7

@description('Your public IP, to run init-db.sh from your machine (a firewall rule is created); empty = none.')
param adminIp string = ''

@minValue(0)
param frontendMinReplicas int = 0
@minValue(1)
param frontendMaxReplicas int = 2
@minValue(0)
@maxValue(1)
@description('Backend must stay at max 1: the failed-login counter lives in memory.')
param backendMinReplicas int = 0

@description('CIDR blocks allowed to reach the n8n editor, e.g. ["203.0.113.7/32"]. Empty = no ingress (n8n only runs its schedule).')
param n8nAllowedCidr array = []

@description('false only as a fallback when n8n cannot verify the PostgreSQL certificate.')
param verifyDatabaseCertificate bool = true

// ---------------------------------------------------------------- application settings (not secret)
param postgresAdminLogin string = 'cvsadmin'
param appDatabaseName string = 'cv_scanner'
@allowed(['google-drive', 'local'])
param cvStorage string = 'google-drive'
param googleDriveCvFolderId string = ''
param smtpHost string = 'smtp.gmail.com'
param smtpPort string = '465'
param smtpUser string = ''
@description('Sender, e.g. CV AI Scanner <hr@gmail.com>. No mail redirection setting exists in this template on purpose: production emails go to the candidates.')
param mailFrom string = ''
param mailReplyTo string = ''
param privacyContactEmail string = ''
param n8nOwnerEmail string = ''
param seedHrEmail string = ''
param seedHrName string = 'HR Admin'

// ---------------------------------------------------------------- secrets
@secure()
@description('Use hex (openssl rand -hex 24): it goes into a connection URL.')
param postgresAdminPassword string
@secure()
param jwtSecret string = ''
@secure()
param n8nDbPassword string = ''
@secure()
param n8nAppDbPassword string = ''
@secure()
param mcpDbPassword string = ''
@secure()
param mcpAuthToken string = ''
@secure()
param n8nEncryptionKey string = ''
@secure()
param n8nOwnerPassword string = ''
@secure()
param anthropicApiKey string = ''
@secure()
param googleClientId string = ''
@secure()
param googleClientSecret string = ''
@secure()
param googleRefreshToken string = ''
@secure()
param smtpPassword string = ''
@secure()
param seedHrPassword string = ''

// ---------------------------------------------------------------- names
var unique = uniqueString(resourceGroup().id)
var registryName = '${namePrefix}acr${unique}'
var postgresName = '${namePrefix}-pg-${unique}'
var frontendName = '${namePrefix}-frontend'
var backendName = '${namePrefix}-backend'
var n8nName = '${namePrefix}-n8n'
var migrateJobName = '${namePrefix}-migrate'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var tz = 'Asia/Ho_Chi_Minh'

// ---------------------------------------------------------------- logs, registry, identity, environment
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: logRetentionDays
    workspaceCapping: { dailyQuotaGb: json(logDailyCapGb) }
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-identity'
  location: location
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, acrPullRoleId)
  scope: registry
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

// ---------------------------------------------------------------- PostgreSQL Flexible Server
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  sku: { name: postgresSku, tier: 'Burstable' }
  properties: {
    version: '17'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: postgresStorageGb }
    backup: { backupRetentionDays: postgresBackupDays, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
    authConfig: { activeDirectoryAuth: 'Disabled', passwordAuth: 'Enabled' }
  }
}

resource appDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: appDatabaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// "Azure services" = the container apps (they have no fixed outbound IP)
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource allowAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (!empty(adminIp)) {
  parent: postgres
  name: 'AdminIp'
  properties: { startIpAddress: adminIp, endIpAddress: adminIp }
  dependsOn: [allowAzure]
}

// ---------------------------------------------------------------- shared values of the apps
var registryServer = registry.properties.loginServer
var databaseUrl = 'postgresql://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${appDatabaseName}?sslmode=require'
var registries = [{ server: registryServer, identity: identity.id }]
var appIdentity = {
  type: 'UserAssigned'
  userAssignedIdentities: { '${identity.id}': {} }
}
// Container Apps in one environment reach each other by app name; internal ingress listens on 80 → target port
var backendInternalUrl = 'http://${backendName}'
var n8nFqdn = '${n8nName}.${environment.properties.defaultDomain}'
var n8nUrl = 'https://${n8nFqdn}'
var n8nIpRestrictions = [for (cidr, i) in n8nAllowedCidr: {
  name: 'allow-${i}'
  action: 'Allow'
  ipAddressRange: cidr
}]

// ---------------------------------------------------------------- backend (internal ingress only)
resource backend 'Microsoft.App/containerApps@2024-03-01' = if (deployApps) {
  name: backendName
  location: location
  identity: appIdentity
  dependsOn: [acrPull, appDatabase, allowAzure]
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: registries
      ingress: {
        external: false
        targetPort: 3001
        transport: 'auto'
        allowInsecure: true // only the frontend, inside the environment, calls it over http
      }
      secrets: [
        { name: 'database-url', value: databaseUrl }
        { name: 'jwt-secret', value: jwtSecret }
        { name: 'smtp-password', value: smtpPassword }
        { name: 'google-client-id', value: googleClientId }
        { name: 'google-client-secret', value: googleClientSecret }
        { name: 'google-refresh-token', value: googleRefreshToken }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: '${registryServer}/backend:${imageTag}'
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3001' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'CV_STORAGE', value: cvStorage }
            { name: 'GOOGLE_DRIVE_CV_FOLDER_ID', value: googleDriveCvFolderId }
            { name: 'GOOGLE_CLIENT_ID', secretRef: 'google-client-id' }
            { name: 'GOOGLE_CLIENT_SECRET', secretRef: 'google-client-secret' }
            { name: 'GOOGLE_REFRESH_TOKEN', secretRef: 'google-refresh-token' }
            { name: 'SMTP_HOST', value: smtpHost }
            { name: 'SMTP_PORT', value: smtpPort }
            { name: 'SMTP_USER', value: smtpUser }
            { name: 'SMTP_PASSWORD', secretRef: 'smtp-password' }
            { name: 'MAIL_FROM', value: mailFrom }
            { name: 'MAIL_REPLY_TO', value: mailReplyTo }
            { name: 'NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL', value: privacyContactEmail }
          ]
          probes: [
            { type: 'Startup', httpGet: { path: '/api/health', port: 3001 }, periodSeconds: 5, failureThreshold: 24 }
            { type: 'Liveness', httpGet: { path: '/api/health', port: 3001 }, periodSeconds: 30, failureThreshold: 3 }
            { type: 'Readiness', httpGet: { path: '/api/health/ready', port: 3001 }, periodSeconds: 10, failureThreshold: 3 }
          ]
        }
      ]
      scale: { minReplicas: backendMinReplicas, maxReplicas: 1 }
    }
  }
}

// ---------------------------------------------------------------- frontend (the only public app)
resource frontend 'Microsoft.App/containerApps@2024-03-01' = if (deployApps) {
  name: frontendName
  location: location
  identity: appIdentity
  dependsOn: [acrPull, backend]
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: registries
      ingress: { external: true, targetPort: 3000, transport: 'auto', allowInsecure: false }
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: '${registryServer}/frontend:${imageTag}'
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'HOSTNAME', value: '0.0.0.0' }
            // the same value the image was built with (az acr build --build-arg BACKEND_URL=...)
            { name: 'BACKEND_URL', value: backendInternalUrl }
            { name: 'NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL', value: privacyContactEmail }
          ]
          probes: [
            { type: 'Startup', httpGet: { path: '/', port: 3000 }, periodSeconds: 5, failureThreshold: 24 }
            { type: 'Liveness', httpGet: { path: '/', port: 3000 }, periodSeconds: 30, failureThreshold: 3 }
            { type: 'Readiness', httpGet: { path: '/', port: 3000 }, periodSeconds: 10, failureThreshold: 3 }
          ]
        }
      ]
      scale: {
        minReplicas: frontendMinReplicas
        maxReplicas: frontendMaxReplicas
        rules: [{ name: 'http', http: { metadata: { concurrentRequests: '50' } } }]
      }
    }
  }
}

// ---------------------------------------------------------------- n8n (always 1 replica: the 00:00 schedule)
resource n8n 'Microsoft.App/containerApps@2024-03-01' = if (deployApps) {
  name: n8nName
  location: location
  identity: appIdentity
  dependsOn: [acrPull, appDatabase, allowAzure]
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: registries
      // No allowed address → no ingress at all: n8n still runs its schedule, nobody can open the editor
      ingress: empty(n8nAllowedCidr) ? null : {
        external: true
        targetPort: 5678
        transport: 'auto'
        allowInsecure: false
        ipSecurityRestrictions: n8nIpRestrictions
      }
      secrets: [
        { name: 'n8n-db-password', value: n8nDbPassword }
        { name: 'n8n-app-db-password', value: n8nAppDbPassword }
        { name: 'mcp-db-password', value: mcpDbPassword }
        { name: 'mcp-auth-token', value: mcpAuthToken }
        { name: 'n8n-encryption-key', value: n8nEncryptionKey }
        { name: 'n8n-owner-password', value: n8nOwnerPassword }
        { name: 'anthropic-api-key', value: anthropicApiKey }
        { name: 'google-client-id', value: googleClientId }
        { name: 'google-client-secret', value: googleClientSecret }
        { name: 'google-refresh-token', value: googleRefreshToken }
      ]
    }
    template: {
      containers: [
        {
          name: 'n8n'
          image: '${registryServer}/n8n:${imageTag}'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            // n8n's own data → database n8n (role n8n), created by init-db.sh
            { name: 'DB_TYPE', value: 'postgresdb' }
            { name: 'DB_POSTGRESDB_HOST', value: postgres.properties.fullyQualifiedDomainName }
            { name: 'DB_POSTGRESDB_PORT', value: '5432' }
            { name: 'DB_POSTGRESDB_DATABASE', value: 'n8n' }
            { name: 'DB_POSTGRESDB_USER', value: 'n8n' }
            { name: 'DB_POSTGRESDB_PASSWORD', secretRef: 'n8n-db-password' }
            { name: 'DB_POSTGRESDB_SSL_ENABLED', value: 'true' }
            { name: 'DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED', value: string(verifyDatabaseCertificate) }
            // the application database of the two Postgres credentials (credentials.cjs)
            { name: 'APP_DB_HOST', value: postgres.properties.fullyQualifiedDomainName }
            { name: 'APP_DB_PORT', value: '5432' }
            { name: 'APP_DB_SSL', value: 'true' }
            { name: 'APP_DB_SSL_ALLOW_UNAUTHORIZED', value: string(!verifyDatabaseCertificate) }
            { name: 'POSTGRES_DB', value: appDatabaseName }
            { name: 'N8N_APP_DB_PASSWORD', secretRef: 'n8n-app-db-password' }
            { name: 'MCP_DB_PASSWORD', secretRef: 'mcp-db-password' }
            { name: 'MCP_AUTH_TOKEN', secretRef: 'mcp-auth-token' }
            { name: 'N8N_ENCRYPTION_KEY', secretRef: 'n8n-encryption-key' }
            { name: 'ANTHROPIC_API_KEY', secretRef: 'anthropic-api-key' }
            { name: 'GOOGLE_CLIENT_ID', secretRef: 'google-client-id' }
            { name: 'GOOGLE_CLIENT_SECRET', secretRef: 'google-client-secret' }
            { name: 'GOOGLE_REFRESH_TOKEN', secretRef: 'google-refresh-token' }
            { name: 'N8N_OWNER_EMAIL', value: n8nOwnerEmail }
            { name: 'N8N_OWNER_PASSWORD', secretRef: 'n8n-owner-password' }
            { name: 'GENERIC_TIMEZONE', value: tz }
            { name: 'TZ', value: tz }
            { name: 'N8N_HOST', value: n8nFqdn }
            { name: 'N8N_PROTOCOL', value: 'https' }
            { name: 'N8N_EDITOR_BASE_URL', value: '${n8nUrl}/' }
            { name: 'N8N_WEBHOOK_URL', value: '${n8nUrl}/' }
            { name: 'N8N_PROXY_HOPS', value: '1' }
            { name: 'N8N_DIAGNOSTICS_ENABLED', value: 'false' }
            { name: 'N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS', value: 'true' }
          ]
          probes: [
            // the entrypoint imports credentials + workflows first: up to 5 minutes to become ready
            { type: 'Startup', httpGet: { path: '/healthz/readiness', port: 5678 }, periodSeconds: 10, failureThreshold: 30 }
            { type: 'Liveness', httpGet: { path: '/healthz', port: 5678 }, periodSeconds: 30, failureThreshold: 3 }
            { type: 'Readiness', httpGet: { path: '/healthz/readiness', port: 5678 }, periodSeconds: 10, failureThreshold: 3 }
          ]
        }
      ]
      // min 1: scaled to zero, the 00:00 schedule would not run
      scale: { minReplicas: 1, maxReplicas: 1 }
    }
  }
}

// ---------------------------------------------------------------- migrate + seed (manual job)
resource migrateJob 'Microsoft.App/jobs@2024-03-01' = if (deployApps) {
  name: migrateJobName
  location: location
  identity: appIdentity
  dependsOn: [acrPull, appDatabase, allowAzure]
  properties: {
    environmentId: environment.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 600
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      registries: registries
      secrets: [
        { name: 'database-url', value: databaseUrl }
        { name: 'seed-hr-password', value: seedHrPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: '${registryServer}/backend:${imageTag}'
          command: ['sh']
          args: ['packages/backend/scripts/migrate-and-seed.sh']
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'SEED_SAMPLE_DATA', value: 'false' }
            { name: 'SEED_HR_EMAIL', value: seedHrEmail }
            { name: 'SEED_HR_NAME', value: seedHrName }
            { name: 'SEED_HR_PASSWORD', secretRef: 'seed-hr-password' }
          ]
        }
      ]
    }
  }
}

// ---------------------------------------------------------------- outputs
output frontendUrl string = deployApps ? 'https://${frontendName}.${environment.properties.defaultDomain}' : ''
output n8nUrl string = (deployApps && !empty(n8nAllowedCidr)) ? n8nUrl : ''
output backendInternalUrl string = backendInternalUrl
output registryName string = registry.name
output registryLoginServer string = registryServer
output postgresName string = postgres.name
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output appDatabaseName string = appDatabaseName
output migrateJobName string = migrateJobName
