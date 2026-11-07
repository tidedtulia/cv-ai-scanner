// npm run mcp:check — smoke-check of docs/features/n8n-mcp-server (AC-1, AC-4 → AC-10) against the running n8n.
// A tiny MCP client (Streamable HTTP, JSON-RPC). Needs MCP_AUTH_TOKEN, MCP_DB_PASSWORD, POSTGRES_* — read through
// `docker compose config`, so it sees the .env exactly as Compose does (a shell variable wins over .env).
// Writes: only one throw-away position without criteria (AC-7), deleted at the end. Never prints the token.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const COMPOSE = ['compose', '-f', 'docker-compose.dev.yml', '--profile', 'n8n'];
const run = (args, options = {}) => execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });

if (!run([...COMPOSE, 'ps', '--status', 'running', '-q', 'n8n']).trim()) {
  console.error('n8n is not running — run `npm run n8n:up` first');
  process.exit(1);
}

const services = JSON.parse(run([...COMPOSE, 'config', '--format', 'json'])).services;
const env = { ...services.db.environment, ...services.n8n.environment };
const TOKEN = env.MCP_AUTH_TOKEN;
const BASE = `http://127.0.0.1:${services.n8n.ports?.[0]?.published ?? 5678}`;
const MCP_URL = `${BASE}/mcp/cv-scanner`;
const app = { user: env.POSTGRES_USER, db: env.POSTGRES_DB };
if (!TOKEN || !env.MCP_DB_PASSWORD) {
  console.error('MCP_AUTH_TOKEN / MCP_DB_PASSWORD missing in .env');
  process.exit(1);
}

let fails = 0;
const ok = (message) => console.log(`  ✓ ${message}`);
const ko = (message) => {
  fails += 1;
  console.log(`  ✗ ${message}`);
};
const check = (condition, message, detail) => (condition ? ok(message) : ko(detail ? `${message} — ${detail}` : message));
const section = (title) => console.log(`\n${title}`);

// psql inside the db container; `role` null = the app superuser
const psql = (sql, { database = app.db, role = null } = {}) => {
  const args = [...COMPOSE, 'exec', '-T'];
  if (role) args.push('-e', 'PGPASSWORD');
  args.push('db', 'psql', '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1');
  if (role) args.push('-h', 'localhost', '-U', role);
  else args.push('-U', app.user);
  args.push('-d', database, '-c', sql);
  return run(args, role ? { env: { ...process.env, PGPASSWORD: env.MCP_DB_PASSWORD } } : {}).trim();
};

// ---- MCP client ----
const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
const parse = (text) => {
  const data = text.split('\n').find((line) => line.startsWith('data:'));
  const body = data ? data.slice(5).trim() : text.trim();
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};
async function post(body, { token = TOKEN, session } = {}) {
  const headers = { ...HEADERS };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (session) headers['Mcp-Session-Id'] = session;
  const response = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: response.status, session: response.headers.get('mcp-session-id'), json: parse(await response.text()) };
}
async function connect() {
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'mcp-check', version: '1' } } });
  if (init.status !== 200) throw new Error(`initialize → HTTP ${init.status}`);
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, { session: init.session });
  let id = 1;
  return {
    init,
    list: () => post({ jsonrpc: '2.0', id: ++id, method: 'tools/list' }, { session: init.session }).then((r) => r.json?.result),
    call: (args) =>
      post({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name: 'get_position_requirements', arguments: args } }, { session: init.session }).then((r) => r.json),
  };
}
// Tool result → { ok, value | message }: handles both a JSON-RPC error and an MCP isError result
function outcome(reply) {
  if (reply?.error) return { ok: false, message: String(reply.error.message) };
  const text = (reply?.result?.content ?? []).map((part) => part.text ?? '').join('\n');
  if (reply?.result?.isError) return { ok: false, message: text };
  try {
    const value = JSON.parse(text);
    // n8n returns the output items of the sub-workflow as an array: one item = our object
    return { ok: true, value: Array.isArray(value) && value.length === 1 ? value[0] : value };
  } catch {
    return { ok: false, message: `unreadable result: ${text.slice(0, 120)}` };
  }
}

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;
const positionCode = 'backend-dev';
let probeId = null;

try {
  section('AC-1 server is up');
  const workflows = psql(`SELECT id || ':' || ("activeVersionId" IS NOT NULL) FROM workflow_entity WHERE id IN ('cvScannerMcpServer', 'cvScannerToolPositionRequirements') ORDER BY id`, { database: 'n8n' }).split('\n');
  check(isDeepStrictEqual(workflows, ['cvScannerMcpServer:true', 'cvScannerToolPositionRequirements:true']), 'both workflows imported and published (n8n only runs a published sub-workflow)', workflows.join(' '));
  check(psql(`SELECT count(*) FROM credentials_entity WHERE id = 'cvScannerMcpToken' AND type = 'httpBearerAuth'`, { database: 'n8n' }) === '1', 'credential "CV Scanner MCP token" exists');
  const client = await connect();
  ok(`initialize → ${client.init.json?.result?.serverInfo?.name ?? '?'} ${client.init.json?.result?.protocolVersion ?? ''}`);

  section('AC-4 authentication');
  const initBody = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '1' } } };
  for (const [label, token] of [['no token', ''], ['wrong token', 'x'.repeat(40)]]) {
    const { status } = await post(initBody, { token });
    check(status === 401 || status === 403, `${label} → rejected`, `HTTP ${status}`);
  }

  section('AC-5 tools/list');
  const { tools = [] } = (await client.list()) ?? {};
  check(tools.length === 1 && tools[0].name === 'get_position_requirements', 'exactly one tool: get_position_requirements', tools.map((t) => t.name).join(', '));
  const schema = tools[0]?.inputSchema ?? {};
  check(isDeepStrictEqual(Object.keys(schema.properties ?? {}), ['position_id']) && (schema.required ?? []).includes('position_id'), 'input schema: only position_id, required', JSON.stringify(schema));
  check(/job description|JD/i.test(tools[0]?.description ?? '') && /criteria/i.test(tools[0]?.description ?? ''), 'description tells Claude what the tool returns');

  section('AC-6 requirements of a position');
  const positionId = psql(`SELECT id FROM positions WHERE code = ${sqlString(positionCode)}`);
  const result = outcome(await client.call({ position_id: positionId }));
  check(result.ok, `get_position_requirements(${positionCode})`, result.message);
  if (result.ok) {
    const got = result.value;
    const expected = JSON.parse(
      psql(`SELECT json_build_object(
        'title', p.title, 'description', p.description, 'category', c.name, 'level', json_build_object('code', l.code, 'name', l.name),
        'min_years_experience', p.min_years_experience,
        'criteria', (SELECT COALESCE(json_agg(json_build_object('id', id, 'name', name, 'type', type::text, 'description', description, 'weight', weight, 'is_required', is_required) ORDER BY sort_order, created_at), '[]'::json) FROM position_criteria WHERE position_id = p.id),
        'levels', (SELECT COALESCE(json_agg(json_build_object('code', code, 'name', name) ORDER BY sort_order), '[]'::json) FROM job_levels WHERE is_active))
        FROM positions p JOIN job_categories c ON c.id = p.category_id JOIN job_levels l ON l.id = p.level_id WHERE p.id = '${positionId}'`),
    );
    const { position_id: returnedId, ...rest } = got;
    check(returnedId === positionId, 'position_id echoed');
    check(isDeepStrictEqual(rest, expected), 'title, JD, category, level, years, criteria (order, weights, guidance) and levels match the database', 'differs from a direct query');
    check(got.criteria?.length > 0, `${got.criteria?.length} criteria returned`);
  }

  section('AC-7 position without criteria');
  probeId = psql(`INSERT INTO positions (code, title, category_id, level_id, description, status)
    SELECT 'mcp-check-probe', 'MCP check probe', (SELECT id FROM job_categories LIMIT 1), (SELECT id FROM job_levels LIMIT 1), 'probe', 'DRAFT' RETURNING id`).split('\n')[0];
  const empty = outcome(await client.call({ position_id: probeId }));
  check(empty.ok && Array.isArray(empty.value.criteria) && empty.value.criteria.length === 0 && empty.value.title === 'MCP check probe', 'criteria is an empty array, the rest is returned', empty.message ?? JSON.stringify(empty.value)?.slice(0, 120));

  section('AC-8 invalid position_id');
  const positionsBefore = psql('SELECT count(*) FROM positions');
  const cases = [
    ['unknown uuid', { position_id: '00000000-0000-4000-8000-000000000000' }, /not found/i],
    ['not a uuid', { position_id: 'abc' }, /UUID/],
    ['missing position_id', {}, /position_id|required/i],
  ];
  for (const [label, args, pattern] of cases) {
    const failed = outcome(await (await connect()).call(args));
    check(!failed.ok && pattern.test(failed.message) && !/invalid input syntax|syntax error|relation "|column "/i.test(failed.message), `${label} → clear error`, failed.ok ? 'no error' : failed.message.slice(0, 160));
  }

  section('AC-9 SQL injection');
  for (const payload of ["' OR 1=1; DROP TABLE positions; --", `${positionId}'; DELETE FROM positions; --`, '1 OR 1=1']) {
    const failed = outcome(await (await connect()).call({ position_id: payload }));
    check(!failed.ok && /UUID/.test(failed.message), `rejected: ${payload.slice(0, 40)}`, failed.ok ? 'was accepted' : failed.message.slice(0, 120));
  }
  check(psql('SELECT count(*) FROM positions') === positionsBefore, 'positions table untouched');

  section('AC-10 no candidate data');
  let denied = false;
  try {
    psql('SELECT 1 FROM applications LIMIT 1', { role: 'mcp_readonly' });
  } catch (error) {
    denied = /permission denied/.test(String(error.stderr));
  }
  check(denied, 'credential mcp_readonly cannot read applications (permission denied)');
  const workflowFile = JSON.parse(readFileSync(join(root, 'n8n/workflows/cvScannerToolPositionRequirements.json'), 'utf8'));
  const postgresIds = workflowFile.nodes.filter((node) => node.type === 'n8n-nodes-base.postgres').map((node) => node.credentials.postgres.id);
  check(postgresIds.length > 0 && postgresIds.every((id) => id === 'cvScannerMcpRead'), 'the tool workflow only uses credential cvScannerMcpRead', postgresIds.join(', '));
  if (result.ok) {
    const text = JSON.stringify(result.value);
    const people = psql('SELECT full_name || E\'\\n\' || email FROM applications').split('\n').filter(Boolean);
    check(!Object.keys(result.value).some((key) => /email|full_name|candidate|cv_/i.test(key)) && people.every((value) => !text.includes(value)), 'the result has no candidate name, email or CV link');
  }
} catch (error) {
  ko(`unexpected error: ${error.message}`);
} finally {
  if (probeId) {
    try {
      psql(`DELETE FROM positions WHERE code = 'mcp-check-probe'`);
    } catch (error) {
      ko(`could not delete the probe position (code mcp-check-probe): ${error.message}`);
    }
  }
}

console.log(fails === 0 ? '\nmcp:check passed' : `\nmcp:check failed: ${fails} check(s)`);
process.exit(fails === 0 ? 0 : 1);
