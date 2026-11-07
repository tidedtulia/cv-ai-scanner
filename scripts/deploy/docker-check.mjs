// npm run docker:check [--keep] — smoke-check of docs/features/azure-deploy (AC-1 → AC-6, AC-8) with the real images.
// Builds the 3 images (packages/backend/Dockerfile, packages/frontend/Dockerfile, n8n/Dockerfile), starts a THROW-AWAY Postgres 17
// whose admin is NOT a superuser (like Azure's), then migrates + seeds, runs init-db.sh, starts backend + frontend + n8n on a private
// Docker network and checks them. Never touches your dev database or .env; random secrets; everything is removed at the end
// (even on failure). --keep leaves the containers for debugging.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const args = new Set(process.argv.slice(2));
const run = (cmd, argv, options = {}) => spawnSync(cmd, argv, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
const docker = (...argv) => run('docker', argv);

let fails = 0;
const ok = (message) => console.log(`  ✓ ${message}`);
const ko = (message, detail) => {
  fails += 1;
  console.log(`  ✗ ${message}${detail ? ` — ${detail}` : ''}`);
};
const check = (condition, message, detail) => (condition ? ok(message) : ko(message, detail));
const section = (title) => console.log(`\n${title}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (docker('version', '--format', '{{.Server.Version}}').status !== 0) {
  console.error('Docker is not available (is Docker Desktop running?) — docker:check needs it');
  process.exit(1);
}

const id = randomBytes(3).toString('hex');
const NET = `cvs-check-${id}`;
const name = (part) => `${NET}-${part}`;
const IMAGES = { backend: `cvs-check/backend:${id}`, frontend: `cvs-check/frontend:${id}`, n8n: `cvs-check/n8n:${id}` };
const secret = () => randomBytes(18).toString('hex');
const S = {
  adminPw: secret(), jwt: `${secret()}${secret()}`, n8nPw: secret(), appPw: secret(), mcpPw: secret(), mcpToken: `${secret()}${secret()}`,
  encKey: `${secret()}${secret()}`, ownerPw: `Aa1${secret()}`, hrPw: `Hr1!${secret()}`, anthropic: `sk-ant-${secret()}`, gid: `gid-${secret()}`, gsecret: `gsecret-${secret()}`,
  grefresh: `grefresh-${secret()}`, smtpPw: `smtp-${secret()}`,
};
const DB_URL = `postgresql://azadmin:${S.adminPw}@${name('pg')}:5432/app`;
const containers = [];
let cleaned = false;

function cleanup() {
  if (cleaned || args.has('--keep')) return;
  cleaned = true;
  for (const c of containers) docker('rm', '-f', '-v', c);
  docker('network', 'rm', NET);
  for (const image of Object.values(IMAGES)) docker('rmi', '-f', image);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { cleanup(); process.exit(130); });

const start = (part, image, { env = {}, extra = [], command = [], alias, publish } = {}) => {
  const container = name(part);
  const argv = ['run', '-d', '--name', container, '--network', NET];
  if (alias) argv.push('--network-alias', alias);
  if (publish) argv.push('-p', `127.0.0.1::${publish}`);
  for (const [key, value] of Object.entries(env)) argv.push('-e', `${key}=${value}`);
  argv.push(...extra, image, ...command);
  const result = docker(...argv);
  if (result.status !== 0) throw new Error(`cannot start ${part}: ${result.stderr.trim()}`);
  containers.push(container);
  return container;
};
const hostPort = (container, port) => docker('port', container, `${port}/tcp`).stdout.trim().split('\n')[0].split(':').pop();
const logs = (container) => { const r = docker('logs', container); return `${r.stdout}\n${r.stderr}`; };
const psql = (sql, { db = 'app', user = 'postgres' } = {}) =>
  docker('exec', '-i', name('pg'), 'psql', '-U', user, '-d', db, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql).stdout.trim();
async function waitFor(label, probe, { timeoutMs = 60000, everyMs = 1000 } = {}) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try { last = await probe(); if (last) return last; } catch { /* retry */ }
    await sleep(everyMs);
  }
  throw new Error(`timeout waiting for ${label}`);
}
const http = async (url, init = {}) => { const response = await fetch(url, { redirect: 'manual', ...init }); return { response, text: await response.text() }; };
const oneShot = (image, { env = {}, entrypoint, command = [], volumes = [] } = {}) => {
  const argv = ['run', '--rm', '--network', NET];
  if (entrypoint) argv.push('--entrypoint', entrypoint);
  for (const [key, value] of Object.entries(env)) argv.push('-e', `${key}=${value}`);
  for (const volume of volumes) argv.push('-v', volume);
  return docker(...argv, image, ...command);
};

try {
  check(docker('network', 'create', NET).status === 0, 'private network created');
  section('Images');
  const builds = [
    ['backend', ['build', '-q', '-f', 'packages/backend/Dockerfile', '-t', IMAGES.backend, '.']],
    ['frontend', ['build', '-q', '-f', 'packages/frontend/Dockerfile', '--build-arg', 'BACKEND_URL=http://backend:3001', '-t', IMAGES.frontend, '.']],
    ['n8n', ['build', '-q', '-f', 'n8n/Dockerfile', '-t', IMAGES.n8n, '.']],
  ];
  for (const [label, argv] of builds) {
    const result = docker(...argv);
    check(result.status === 0, `${label} image builds from the repo root without a .env`, result.stderr.trim().split('\n').slice(-3).join(' | '));
    if (result.status !== 0) throw new Error('image build failed');
  }

  section('AC-2 / AC-3 / AC-4 — what is inside the images');
  for (const [label, image] of Object.entries(IMAGES)) {
    const who = oneShot(image, { entrypoint: 'id', command: ['-un'] }).stdout.trim();
    check(who !== '' && who !== 'root', `${label}: runs as a non-root user`, `user "${who}"`);
    const envFiles = oneShot(image, { entrypoint: 'sh', command: ['-c', "find / -xdev \\( -name '.env' -o -name '.env.*' \\) -not -path '*/node_modules/*' -not -path '/proc/*' 2>/dev/null | head -3"] }).stdout.trim();
    check(envFiles === '', `${label}: no .env file in the image`, envFiles);
  }
  const tmpDir = oneShot(IMAGES.backend, { entrypoint: 'sh', command: ['-c', 'ls -d /app/tmp /app/packages/backend/src/app/modules 2>/dev/null | wc -l'] }).stdout.trim();
  check(tmpDir === '0', 'backend: no tmp/ and no source of the modules (only the bundle + prisma + seed helper)');
  const next = oneShot(IMAGES.backend, { entrypoint: 'sh', command: ['-c', 'ls /app/node_modules | grep -cE "^(next|react)$"; true'] }).stdout.trim();
  check(next === '0', 'backend: the frontend-only packages (next, react) are not in it');
  check(oneShot(IMAGES.n8n, { entrypoint: 'sh', command: ['-c', 'ls /setup/entrypoint.sh /setup/credentials.cjs /setup/init-db.sh /workflows/cvScannerWf1.json'] }).status === 0, 'n8n: setup scripts and workflows are baked in');
  const noUrl = docker('build', '-q', '-f', 'packages/frontend/Dockerfile', '--target', 'build', '-t', `${IMAGES.frontend}-nourl`, '.');
  check(noUrl.status !== 0 && /BACKEND_URL build argument is required/.test(noUrl.stderr), 'frontend: refuses to build without the BACKEND_URL build argument');
  docker('rmi', '-f', `${IMAGES.frontend}-nourl`);

  section('Database (throw-away Postgres 17, admin is NOT a superuser)');
  start('pg', 'postgres:17-alpine', { env: { POSTGRES_PASSWORD: secret() }, alias: name('pg') });
  await waitFor('postgres', () => docker('exec', name('pg'), 'pg_isready', '-U', 'postgres').status === 0 && psql('SELECT 1', { db: 'postgres' }) === '1');
  psql(`CREATE ROLE azadmin LOGIN CREATEROLE CREATEDB PASSWORD '${S.adminPw}'`, { db: 'postgres' });
  psql('CREATE DATABASE app OWNER azadmin', { db: 'postgres' });
  check(psql("SELECT rolsuper FROM pg_roles WHERE rolname='azadmin'", { db: 'postgres' }) === 'f', 'the admin role is not a superuser');

  section('AC-6 — migrate + seed with the backend image (twice)');
  const migrateEnv = { DATABASE_URL: DB_URL, SEED_HR_EMAIL: 'hr-check@example.com', SEED_HR_PASSWORD: S.hrPw, SEED_SAMPLE_DATA: 'false' };
  const counts = () => psql("SELECT (SELECT count(*) FROM job_categories)||','||(SELECT count(*) FROM job_levels)||','||(SELECT count(*) FROM positions)||','||(SELECT count(*) FROM users)||','||(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)");
  const first = oneShot(IMAGES.backend, { env: migrateEnv, entrypoint: 'sh', command: ['packages/backend/scripts/migrate-and-seed.sh'] });
  check(first.status === 0, 'first run succeeds', (first.stderr || first.stdout).trim().split('\n').slice(-2).join(' | '));
  const after1 = counts();
  const [cat, lev, pos, usr, mig] = after1.split(',').map(Number);
  check(cat === 7 && lev === 7, 'categories and levels seeded', after1);
  check(pos === 0, 'SEED_SAMPLE_DATA=false: no sample positions', `positions ${pos}`);
  check(usr === 1, 'the first HR account is created from SEED_HR_*', `users ${usr}`);
  check(mig >= 1, 'migrations applied', `${mig} migration(s)`);
  const second = oneShot(IMAGES.backend, { env: migrateEnv, entrypoint: 'sh', command: ['packages/backend/scripts/migrate-and-seed.sh'] });
  check(second.status === 0 && counts() === after1, 'second run: no error, nothing changes, nothing duplicated', counts());
  const noDb = oneShot(IMAGES.backend, { env: { DATABASE_URL: '' }, entrypoint: 'sh', command: ['packages/backend/scripts/migrate-and-seed.sh'] });
  check(noDb.status !== 0 && /DATABASE_URL/.test(noDb.stderr), 'no DATABASE_URL → exits non-zero with the reason');
  const badDb = oneShot(IMAGES.backend, { env: { DATABASE_URL: `postgresql://azadmin:${S.adminPw}@${name('nowhere')}:5432/app` }, entrypoint: 'sh', command: ['-c', 'cd packages/backend && npx prisma db seed'] });
  check(badDb.status !== 0 && !`${badDb.stdout}${badDb.stderr}`.includes(S.adminPw), 'unreachable database → non-zero and the password is not printed');

  section('AC-5 — init-db.sh as a non-superuser admin (twice)');
  const initEnv = { PGHOST: name('pg'), PGSSLMODE: 'prefer', POSTGRES_USER: 'azadmin', POSTGRES_PASSWORD: S.adminPw, POSTGRES_DB: 'app', N8N_DB_PASSWORD: S.n8nPw, N8N_APP_DB_PASSWORD: S.appPw, MCP_DB_PASSWORD: S.mcpPw };
  const setup = join(root, 'n8n/setup');
  for (const attempt of [1, 2]) {
    const init = oneShot('postgres:17-alpine', { env: initEnv, entrypoint: 'sh', command: ['/setup/init-db.sh'], volumes: [`${setup}:/setup:ro`] });
    check(init.status === 0, `run ${attempt} succeeds`, (init.stderr || init.stdout).trim().split('\n').slice(-2).join(' | '));
  }
  const priv = (q) => psql(q);
  check(priv("SELECT has_table_privilege('n8n_app','applications','SELECT') AND has_column_privilege('n8n_app','applications','status','UPDATE') AND NOT has_column_privilege('n8n_app','applications','full_name','UPDATE')") === 't', 'n8n_app: reads applications, updates only status / updated_at');
  check(priv("SELECT has_table_privilege('n8n_app','evaluations','INSERT') AND has_table_privilege('n8n_app','application_status_history','INSERT')") === 't', 'n8n_app: writes evaluations and history');
  check(priv("SELECT has_table_privilege('mcp_readonly','positions','SELECT') AND NOT has_table_privilege('mcp_readonly','applications','SELECT') AND NOT has_table_privilege('mcp_readonly','users','SELECT')") === 't', 'mcp_readonly: job data only, never candidates or users');
  check(priv("SELECT NOT has_database_privilege('n8n_app','n8n','CONNECT') AND NOT has_database_privilege('n8n','app','CONNECT')") === 't', 'each role connects only to its own database');
  check(priv("SELECT bool_and(NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) FROM pg_roles WHERE rolname IN ('n8n','n8n_app','mcp_readonly')", { db: 'postgres' }) === 't', 'the three roles have no special attribute');
  check(psql("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='n8n'", { db: 'postgres' }) === 'n8n', 'database n8n is owned by role n8n');

  section('AC-1 / AC-2 — backend');
  const beEnv = { DATABASE_URL: DB_URL, JWT_SECRET: S.jwt, CV_STORAGE: 'local', NODE_ENV: 'production', SMTP_PASSWORD: S.smtpPw };
  const noJwt = oneShot(IMAGES.backend, { env: { ...beEnv, JWT_SECRET: '' } });
  check(noJwt.status !== 0 && /JWT_SECRET/.test(`${noJwt.stdout}${noJwt.stderr}`), 'no JWT_SECRET → the container exits and says why');
  const noStorage = oneShot(IMAGES.backend, { env: { ...beEnv, CV_STORAGE: '' } });
  check(noStorage.status !== 0 && /CV_STORAGE/.test(`${noStorage.stdout}${noStorage.stderr}`), 'no valid CV_STORAGE → the container exits and says why');
  const backend = start('backend', IMAGES.backend, { env: beEnv, alias: 'backend', publish: 3001 });
  const BE = `http://127.0.0.1:${hostPort(backend, 3001)}`;
  await waitFor('backend /api/health', async () => (await http(`${BE}/api/health`)).response.status === 200, { timeoutMs: 60000 });
  let r = await http(`${BE}/api/health`);
  check(r.response.status === 200 && JSON.parse(r.text).status === 'ok' && !r.response.headers.get('set-cookie'), 'GET /api/health → 200 {status: ok}, no cookie');
  r = await http(`${BE}/api/health/ready`);
  check(r.response.status === 200 && JSON.parse(r.text).database === 'up', 'GET /api/health/ready → 200 while the database answers', r.text);

  section('AC-3 — frontend');
  const frontend = start('frontend', IMAGES.frontend, { env: { BACKEND_URL: 'http://backend:3001' }, publish: 3000 });
  const FE = `http://127.0.0.1:${hostPort(frontend, 3000)}`;
  await waitFor('frontend', async () => (await http(`${FE}/`)).response.status === 200, { timeoutMs: 60000 });
  r = await http(`${FE}/`);
  check(r.response.status === 200, 'GET / → 200');
  r = await http(`${FE}/api/health`);
  check(r.response.status === 200 && JSON.parse(r.text).status === 'ok', '/api/health through the frontend proxy reaches the backend (BACKEND_URL baked at build)', r.text.slice(0, 80));
  r = await http(`${FE}/api/positions`);
  check(r.response.status === 200, '/api/positions through the proxy → 200 JSON', `${r.response.status}`);
  r = await http(`${FE}/hr`);
  check(r.response.status === 307 && (r.response.headers.get('location') ?? '').includes('/hr/login'), '/hr without a cookie → 307 to /hr/login');
  r = await http(`${FE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'hr-check@example.com', password: S.hrPw }) });
  const cookie = r.response.headers.get('set-cookie') ?? '';
  check(r.response.status === 200 && /HttpOnly/i.test(cookie) && /;\s*Secure/i.test(cookie), 'HR sign-in through the frontend: cookie is HttpOnly and Secure in production');
  const big = new FormData();
  big.append('name', 'Size Probe');
  big.append('email', 'size-probe@example.com');
  big.append('position', 'nowhere');
  big.append('consent', 'true');
  big.append('cv', new Blob(['%PDF-1.4\n', Buffer.alloc(9 * 1024 * 1024, 1)], { type: 'application/pdf' }), 'big.pdf');
  r = await http(`${FE}/api/applications`, { method: 'POST', body: big });
  check(r.response.status === 400 && JSON.parse(r.text).code === 'POSITION_NOT_OPEN', 'a 9 MB CV passes the proxy and the backend answers (POSITION_NOT_OPEN: no jobs in this DB)', `${r.response.status} ${r.text.slice(0, 80)}`);

  section('AC-4 — n8n');
  const n8n = start('n8n', IMAGES.n8n, {
    env: {
      DB_TYPE: 'postgresdb', DB_POSTGRESDB_HOST: name('pg'), DB_POSTGRESDB_PORT: '5432', DB_POSTGRESDB_DATABASE: 'n8n', DB_POSTGRESDB_USER: 'n8n', DB_POSTGRESDB_PASSWORD: S.n8nPw,
      APP_DB_HOST: name('pg'), APP_DB_PORT: '5432', POSTGRES_DB: 'app', N8N_APP_DB_PASSWORD: S.appPw, MCP_DB_PASSWORD: S.mcpPw, MCP_AUTH_TOKEN: S.mcpToken,
      N8N_ENCRYPTION_KEY: S.encKey, N8N_OWNER_EMAIL: 'owner-check@example.com', N8N_OWNER_PASSWORD: S.ownerPw,
      ANTHROPIC_API_KEY: S.anthropic, GOOGLE_CLIENT_ID: S.gid, GOOGLE_CLIENT_SECRET: S.gsecret, GOOGLE_REFRESH_TOKEN: S.grefresh,
      GENERIC_TIMEZONE: 'Asia/Ho_Chi_Minh', TZ: 'Asia/Ho_Chi_Minh', N8N_DIAGNOSTICS_ENABLED: 'false',
    },
    publish: 5678,
  });
  const N8N = `http://127.0.0.1:${hostPort(n8n, 5678)}`;
  try {
    await waitFor('n8n readiness', async () => (await http(`${N8N}/healthz/readiness`)).response.status === 200, { timeoutMs: 180000, everyMs: 3000 });
    ok('n8n starts against the database named by APP_DB_HOST / DB_POSTGRESDB_HOST and /healthz/readiness → 200');
  } catch {
    ko('n8n did not become ready', logs(n8n).trim().split('\n').slice(-4).join(' | '));
  }
  const n8nLog = logs(n8n);
  check(/importing credentials/.test(n8nLog) && /importing workflows/.test(n8nLog), 'credentials and workflows are imported at start');
  const active = psql("SELECT string_agg(name || '=' || active::text, ', ' ORDER BY name) FROM workflow_entity", { db: 'n8n' });
  check(/CV Scanner/.test(active) && /=true/.test(active), 'workflows exist in the n8n database and the exported-active ones are active', active);
  const host = psql("SELECT count(*) FROM credentials_entity WHERE id IN ('cvScannerN8nApp','cvScannerMcpRead','cvScannerMcpToken','cvScannerAnthropic','cvScannerGoogleDrive')", { db: 'n8n' });
  check(host === '5', 'the five credentials have their fixed ids', host);
  const tz = docker('exec', n8n, 'sh', '-c', 'echo $GENERIC_TIMEZONE').stdout.trim();
  check(tz === 'Asia/Ho_Chi_Minh', 'time zone Asia/Ho_Chi_Minh (the 00:00 schedule)', tz);

  section('AC-1 — readiness when the database is down');
  docker('stop', name('pg'));
  r = await http(`${BE}/api/health`);
  check(r.response.status === 200, 'GET /api/health → still 200 (liveness does not touch the database)');
  r = await http(`${BE}/api/health/ready`);
  const body = JSON.parse(r.text);
  check(r.response.status === 503 && body.status === 'error' && body.database === 'down', 'GET /api/health/ready → 503 {error, down}', `${r.response.status} ${r.text}`);
  check(!r.text.includes(name('pg')) && !r.text.includes(S.adminPw), 'the 503 body has no host and no password');
  docker('start', name('pg'));
  try {
    await waitFor('readiness back', async () => (await http(`${BE}/api/health/ready`)).response.status === 200, { timeoutMs: 60000 });
    ok('the database is back → /api/health/ready returns to 200 without restarting the backend');
  } catch {
    ko('readiness did not recover after the database came back');
  }

  section('AC-8 — no secret in any log');
  const all = [backend, frontend, n8n, name('pg')].map(logs).join('\n');
  const leaked = Object.entries(S).filter(([, value]) => all.includes(value)).map(([key]) => key);
  check(leaked.length === 0, 'none of the random secrets of this run appears in the logs of the 4 containers', leaked.join(', '));
} catch (error) {
  ko(`aborted: ${error.message}`);
} finally {
  cleanup();
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) failed.`);
process.exit(fails === 0 ? 0 : 1);
