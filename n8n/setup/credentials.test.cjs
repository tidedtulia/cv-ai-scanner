// npm run wf1:test — the n8n credentials file (azure-deploy AC-4): the app database comes from the environment,
// and the defaults are exactly the Docker dev setup (so `npm run n8n:check` keeps passing). No n8n, no database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildConnection, buildCredentials } = require('./credentials.cjs');

const SECRETS = {
  POSTGRES_DB: 'cv_scanner',
  N8N_APP_DB_PASSWORD: 'app-pw',
  MCP_DB_PASSWORD: 'mcp-pw',
  MCP_AUTH_TOKEN: 'token',
  ANTHROPIC_API_KEY: 'anthropic',
  GOOGLE_CLIENT_ID: 'gid',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  GOOGLE_REFRESH_TOKEN: 'grefresh',
};

test('AC-4: with no APP_DB_* variable the connection is the Docker dev one (host db, 5432, no TLS)', () => {
  assert.deepEqual(buildConnection(SECRETS), {
    host: 'db',
    port: 5432,
    database: 'cv_scanner',
    ssl: 'disable',
    allowUnauthorizedCerts: false,
    maxConnections: 10,
    sshTunnel: false,
  });
});

test('AC-4: APP_DB_HOST / APP_DB_PORT / APP_DB_SSL point both Postgres credentials at a managed server over TLS', () => {
  const env = { ...SECRETS, APP_DB_HOST: 'cvs-pg.postgres.database.azure.com', APP_DB_PORT: '5432', APP_DB_SSL: 'true' };
  const credentials = buildCredentials(env);
  for (const id of ['cvScannerN8nApp', 'cvScannerMcpRead']) {
    const { data } = credentials.find((c) => c.id === id);
    assert.equal(data.host, 'cvs-pg.postgres.database.azure.com');
    assert.equal(data.ssl, 'require');
    assert.equal(data.allowUnauthorizedCerts, false);
  }
});

test('AC-4: certificate checks are only relaxed when APP_DB_SSL_ALLOW_UNAUTHORIZED=true is asked for explicitly', () => {
  assert.equal(buildConnection({ ...SECRETS, APP_DB_SSL: 'true' }).allowUnauthorizedCerts, false);
  assert.equal(buildConnection({ ...SECRETS, APP_DB_SSL: 'true', APP_DB_SSL_ALLOW_UNAUTHORIZED: 'true' }).allowUnauthorizedCerts, true);
  assert.equal(buildConnection({ ...SECRETS, APP_DB_SSL: 'false' }).ssl, 'disable');
});

test('AC-4: a port that is not a port is refused', () => {
  for (const port of ['abc', '0', '70000', '5432.5']) assert.throws(() => buildConnection({ ...SECRETS, APP_DB_PORT: port }), /APP_DB_PORT/);
});

test('AC-4: the five credentials keep their fixed ids and users, secrets only from the environment', () => {
  const credentials = buildCredentials(SECRETS);
  assert.deepEqual(
    credentials.map((c) => c.id),
    ['cvScannerN8nApp', 'cvScannerMcpRead', 'cvScannerMcpToken', 'cvScannerAnthropic', 'cvScannerGoogleDrive'],
  );
  assert.equal(credentials[0].data.user, 'n8n_app');
  assert.equal(credentials[0].data.password, 'app-pw');
  assert.equal(credentials[1].data.user, 'mcp_readonly');
  assert.equal(credentials[1].data.password, 'mcp-pw');
  assert.equal(credentials[2].data.token, 'token');
  assert.equal(credentials[3].data.apiKey, 'anthropic');
  assert.equal(credentials[4].data.oauthTokenData.refresh_token, 'grefresh');
});
