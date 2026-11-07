// Writes the credentials (2 Postgres + the MCP bearer token) (plain data) for `n8n import:credentials`, which encrypts them
// with N8N_ENCRYPTION_KEY and upserts by id. Called by entrypoint.sh with a temp file path, deleted right after.
// The ids are fixed so exported workflows point to the same credentials on every machine.
// Where the app database is comes from the environment (azure-deploy AC-4); the defaults are the Docker dev setup:
//   APP_DB_HOST (db) · APP_DB_PORT (5432) · APP_DB_SSL (true → TLS, default off) · APP_DB_SSL_ALLOW_UNAUTHORIZED (true only as a fallback)
const { writeFileSync } = require('node:fs');

function buildConnection(env) {
  const port = Number(env.APP_DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`APP_DB_PORT is not a port: ${env.APP_DB_PORT}`);
  return {
    host: env.APP_DB_HOST || 'db',
    port,
    database: env.POSTGRES_DB,
    ssl: env.APP_DB_SSL === 'true' ? 'require' : 'disable',
    allowUnauthorizedCerts: env.APP_DB_SSL_ALLOW_UNAUTHORIZED === 'true',
    maxConnections: 10,
    sshTunnel: false,
  };
}

function buildCredentials(env) {
  const connection = buildConnection(env);
  const credentials = [
    {
      id: 'cvScannerN8nApp',
      name: 'CV Scanner DB (n8n_app)',
      type: 'postgres',
      data: { ...connection, user: 'n8n_app', password: env.N8N_APP_DB_PASSWORD },
    },
    {
      id: 'cvScannerMcpRead',
      name: 'CV Scanner DB (mcp_readonly)',
      type: 'postgres',
      data: { ...connection, user: 'mcp_readonly', password: env.MCP_DB_PASSWORD },
    },
  ];

  credentials.push({
    id: 'cvScannerMcpToken',
    name: 'CV Scanner MCP token',
    type: 'httpBearerAuth',
    data: { token: env.MCP_AUTH_TOKEN },
  });

  credentials.push(
    {
      id: 'cvScannerAnthropic',
      name: 'CV Scanner Anthropic',
      type: 'anthropicApi',
      data: { apiKey: env.ANTHROPIC_API_KEY, url: 'https://api.anthropic.com', header: false },
    },
    {
      // The backend's OAuth client + refresh token (scope drive.file only sees files that client created).
      // n8n refuses to sign a request without an access token, so an already-expired placeholder is given:
      // the first request gets a 401 and n8n then fetches a real token with the refresh token.
      id: 'cvScannerGoogleDrive',
      name: 'CV Scanner Google Drive',
      type: 'googleDriveOAuth2Api',
      data: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        customScopes: true,
        enabledScopes: 'https://www.googleapis.com/auth/drive.file',
        scope: 'https://www.googleapis.com/auth/drive.file',
        oauthTokenData: { access_token: 'expired', token_type: 'Bearer', expires_at: 1, refresh_token: env.GOOGLE_REFRESH_TOKEN },
      },
    },
  );

  return credentials;
}

module.exports = { buildConnection, buildCredentials };

if (require.main === module) {
  writeFileSync(process.argv[2], JSON.stringify(buildCredentials(process.env)), { mode: 0o600 });
}
