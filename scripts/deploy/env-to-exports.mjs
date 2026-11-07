// eval "$(node scripts/deploy/env-to-exports.mjs [file])" — loads the deployment secrets of docs/features/azure-deploy/runbook.md (step 1.4)
// from the root .env into the CURRENT shell, without printing a value: only `export` lines go to stdout (for eval); the
// summary on stderr has names only. The .env names are the dev ones (POSTGRES_PASSWORD becomes POSTGRES_ADMIN_PASSWORD).
// Reusing the dev values on Azure is allowed but means that whoever holds the dev .env holds production too.
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const arg = process.argv[2] ?? '.env';
const file = isAbsolute(arg) ? arg : join(root, arg);

// name used by the runbook / Bicep parameter file → name in .env
const MAP = {
  POSTGRES_ADMIN_PASSWORD: 'POSTGRES_PASSWORD',
  JWT_SECRET: 'JWT_SECRET',
  N8N_DB_PASSWORD: 'N8N_DB_PASSWORD',
  N8N_APP_DB_PASSWORD: 'N8N_APP_DB_PASSWORD',
  MCP_DB_PASSWORD: 'MCP_DB_PASSWORD',
  MCP_AUTH_TOKEN: 'MCP_AUTH_TOKEN',
  N8N_ENCRYPTION_KEY: 'N8N_ENCRYPTION_KEY',
  N8N_OWNER_PASSWORD: 'N8N_OWNER_PASSWORD',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
  GOOGLE_CLIENT_SECRET: 'GOOGLE_CLIENT_SECRET',
  GOOGLE_REFRESH_TOKEN: 'GOOGLE_REFRESH_TOKEN',
  SMTP_PASSWORD: 'SMTP_PASSWORD',
  SEED_HR_PASSWORD: 'SEED_HR_PASSWORD',
};

// Azure refuses an admin password with fewer than 3 of the 4 character kinds (8-128 characters)
const kinds = (v) => [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v)).length;
const azureAdminOk = (v) => v.length >= 8 && v.length <= 128 && kinds(v) >= 3;

let parsed;
try {
  parsed = parseEnv(readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`env-to-exports: cannot read ${file}: ${error.code ?? error.message}`);
  process.exit(1);
}

const quote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;
const exported = [];
const missing = [];
const warnings = [];
for (const [target, source] of Object.entries(MAP)) {
  const value = parsed[source];
  if (!value) {
    missing.push(source);
    continue;
  }
  if (target === 'POSTGRES_ADMIN_PASSWORD' && !azureAdminOk(value)) {
    warnings.push('POSTGRES_PASSWORD is not complex enough for the Azure admin (needs 3 of: upper, lower, digit, symbol; 8-128 characters): NOT exported, make a new one: export POSTGRES_ADMIN_PASSWORD="Aa1-$(openssl rand -hex 16)"');
    continue;
  }
  if (/[\r\n]/.test(value)) {
    warnings.push(`${source} has a line break: skipped`);
    continue;
  }
  console.log(`export ${target}=${quote(value)}`);
  exported.push(target);
}

// the rules the runbook / n8n apply; a dev value that breaks them would fail on Azure
const rule = (name, ok, message) => parsed[name] && !ok(parsed[name]) && warnings.push(`${name}: ${message}`);
rule('JWT_SECRET', (v) => v.length >= 32, 'shorter than 32 characters (the backend refuses to start)');
rule('MCP_AUTH_TOKEN', (v) => v.length >= 32, 'shorter than 32 characters');
rule('N8N_OWNER_PASSWORD', (v) => v.length >= 8 && v.length <= 64 && /\d/.test(v) && /[A-Z]/.test(v), 'needs 8-64 characters with a digit and an uppercase letter');

console.error(`env-to-exports: exported ${exported.length}/${Object.keys(MAP).length} variables from ${file}: ${exported.join(', ')}`);
if (missing.length) console.error(`env-to-exports: not set in .env (set them yourself): ${missing.join(', ')}`);
for (const warning of warnings) console.error(`env-to-exports: WARNING ${warning}`);
