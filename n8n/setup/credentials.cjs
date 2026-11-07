// Writes the 2 Postgres credentials (plain data) for `n8n import:credentials`, which encrypts them
// with N8N_ENCRYPTION_KEY and upserts by id. Called by entrypoint.sh with a temp file path, deleted right after.
// The ids are fixed so exported workflows point to the same credentials on every machine.
const { writeFileSync } = require('node:fs');

const env = process.env;
const connection = {
  host: 'db',
  port: 5432,
  database: env.POSTGRES_DB,
  ssl: 'disable',
  allowUnauthorizedCerts: false,
  maxConnections: 10,
  sshTunnel: false,
};

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

writeFileSync(process.argv[2], JSON.stringify(credentials), { mode: 0o600 });
