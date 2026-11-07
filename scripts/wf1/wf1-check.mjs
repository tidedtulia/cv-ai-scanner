// npm run wf1:check — end-to-end check of docs/features/n8n-evaluate-cv-workflow against the real n8n, Drive and Claude.
// Creates test applications through POST /api/applications (the CV PDFs go to the real Google Drive), runs WF-1 and
// verifies the results; then deletes everything it created (rows, evaluations, history, Drive files).
// Costs a few Claude calls (about 7). The workflow evaluates EVERY SUBMITTED application, so the check refuses to run
// while real ones are waiting, unless --include-real is given. Never prints keys or CV text.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES, POSITION_CODE } from './fixtures.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const COMPOSE = ['compose', '-f', 'docker-compose.dev.yml', '--profile', 'n8n'];
const run = (args, options = {}) => execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, ...options });
const includeReal = process.argv.includes('--include-real');
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const EMAIL = (label) => `wf1-check+${label}@example.com`;
const AGENT = 'Chấm điểm (AI Agent)';

if (!run([...COMPOSE, 'ps', '--status', 'running', '-q', 'n8n']).trim()) {
  console.error('n8n is not running — run `npm run n8n:up` first');
  process.exit(1);
}
const services = JSON.parse(run([...COMPOSE, 'config', '--format', 'json'])).services;
const env = { ...services.db.environment, ...services.n8n.environment };
const app = { user: env.POSTGRES_USER, db: env.POSTGRES_DB };

let fails = 0;
const ok = (message) => console.log(`  ✓ ${message}`);
const ko = (message) => {
  fails += 1;
  console.log(`  ✗ ${message}`);
};
const check = (condition, message, detail) => (condition ? ok(message) : ko(detail === undefined ? message : `${message} — ${detail}`));
const section = (title) => console.log(`\n${title}`);
const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;
const psql = (sql, database = app.db) =>
  run([...COMPOSE, 'exec', '-T', 'db', 'psql', '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-U', app.user, '-d', database, '-c', sql]).trim();
const rows = (sql, database) => (psql(sql, database) ? psql(sql, database).split('\n') : []);
const json = (sql, database) => JSON.parse(psql(sql, database) || 'null');

// ---- Google Drive (only to delete the test CVs) ----
async function driveToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  if (!response.ok) throw new Error(`Google token refresh failed (HTTP ${response.status}) — run \`npm run drive:auth\` if the refresh token expired`);
  return (await response.json()).access_token;
}
async function cleanup(label) {
  const apps = json(`SELECT COALESCE(json_agg(json_build_object('id', id, 'file', cv_drive_file_id)), '[]') FROM applications WHERE email LIKE 'wf1-check+%@example.com'`);
  if (!apps.length) return 0;
  const files = [...new Set(apps.map((a) => a.file).filter((f) => !f.startsWith('wf1-check-')))];
  let removed = 0;
  if (files.length) {
    const token = await driveToken();
    for (const file of files) {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (response.ok || response.status === 404) removed += 1;
      else console.log(`  ! ${label}: could not delete Drive file ${file} (HTTP ${response.status})`);
    }
  }
  psql(`DELETE FROM applications WHERE email LIKE 'wf1-check+%@example.com'`);
  return removed;
}

// ---- running the workflow ----
function runWorkflow() {
  let output = '';
  try {
    output = run([...COMPOSE, 'exec', '-T', '-e', 'N8N_RUNNERS_BROKER_PORT=5690', 'n8n', 'n8n', 'execute', '--id=cvScannerWf1', '--rawOutput'], { timeout: 25 * 60 * 1000 });
  } catch (error) {
    output = `${error.stdout ?? ''}`;
  }
  try {
    const result = JSON.parse(output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1));
    return { success: result.status === 'success', runData: result.data?.resultData?.runData ?? {} };
  } catch {
    return { success: false, runData: {} };
  }
}

const evaluation = (id) =>
  json(`SELECT row_to_json(x) FROM (SELECT a.status, e.overall_score::float AS overall, e.recommendation::text AS recommendation, e.summary, e.model, e.prompt_version,
    e.criteria_scores, e.estimated_years_experience::float AS years, e.created_at, e.updated_at,
    (SELECT count(*) FROM evaluations WHERE application_id = a.id) AS evaluations
    FROM applications a LEFT JOIN evaluations e ON e.application_id = a.id WHERE a.id = '${id}') x`);
const history = (id) => rows(`SELECT coalesce(from_status::text, '-') || '>' || to_status::text || '|' || coalesce(note, '') FROM application_status_history WHERE application_id = '${id}' ORDER BY created_at, id`);
// number of items a node processed in an execution (it runs once for the whole batch)
const itemsOf = (runData, node) => (runData[node] ?? []).reduce((n, r) => n + (r.data?.main ?? []).reduce((m, out) => m + (out?.length ?? 0), 0), 0);
const idOf = (label) => psql(`SELECT id FROM applications WHERE email = ${sqlString(EMAIL(label))}`);

const created = {};
try {
  section('Preparation');
  const leftovers = await cleanup('leftover');
  if (leftovers) ok(`removed ${leftovers} leftover test CV(s) of an earlier run`);
  const real = psql(`SELECT count(*) FROM applications WHERE (status = 'SUBMITTED') OR (status = 'EVALUATING' AND updated_at < now() - interval '1 hour')`);
  if (real !== '0' && !includeReal) {
    console.error(`\n${real} real application(s) are waiting for an evaluation (SUBMITTED, or EVALUATING for over an hour).\nWF-1 would evaluate them too (it takes every SUBMITTED application and costs Claude credit). Run again with \`--include-real\` to allow it.`);
    process.exit(1);
  }
  const status = await fetch(`${BACKEND}/api/positions/${POSITION_CODE}`).then((r) => r.status).catch(() => 0);
  if (status !== 200) {
    console.error(`the backend does not answer at ${BACKEND} (position ${POSITION_CODE}: HTTP ${status}) — run \`npm run dev\` (CV_STORAGE=google-drive)`);
    process.exit(1);
  }
  ok(`backend reachable, position ${POSITION_CODE} exists${real !== '0' ? `, ${real} real application(s) will be evaluated too` : ''}`);

  section('AC-1, AC-3, AC-13 workflow and credentials');
  const workflow = JSON.parse(readFileSync(join(root, 'n8n/workflows/cvScannerWf1.json'), 'utf8'));
  check(psql(`SELECT "activeVersionId" IS NOT NULL FROM workflow_entity WHERE id = 'cvScannerWf1'`, 'n8n') === 't', 'WF-1 is imported and published');
  check(psql(`SELECT count(*) FROM credentials_entity WHERE id IN ('cvScannerAnthropic', 'cvScannerGoogleDrive')`, 'n8n') === '2', 'credentials "CV Scanner Anthropic" and "CV Scanner Google Drive" exist');
  const schedule = workflow.nodes.find((n) => n.type === 'n8n-nodes-base.scheduleTrigger');
  const every = schedule?.parameters.rule.interval[0];
  check(every?.field === 'days' && every.triggerAtHour === 0 && every.triggerAtMinute === 0, 'Schedule Trigger: every day at 00:00');
  check(psql(`SELECT settings->>'timezone' FROM workflow_entity WHERE id = 'cvScannerWf1'`, 'n8n') === 'Asia/Ho_Chi_Minh', 'workflow timezone is Asia/Ho_Chi_Minh');
  check(workflow.nodes.some((n) => n.type === 'n8n-nodes-base.manualTrigger'), 'a Manual Trigger exists');
  const postgresCredentials = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.postgres').map((n) => n.credentials.postgres.id);
  check(postgresCredentials.length > 0 && postgresCredentials.every((id) => id === 'cvScannerN8nApp'), 'every SQL node uses the credential cvScannerN8nApp (n8n_app)', postgresCredentials.join(', '));
  check(!/sk-ant-[A-Za-z0-9_-]{16,}|Bearer [A-Za-z0-9._-]{20,}/.test(JSON.stringify(workflow)), 'the workflow file contains no key / token');

  section('Creating the test applications (CVs go to the real Drive)');
  const position = json(`SELECT json_build_object('id', p.id, 'criteria', (SELECT json_agg(json_build_object('id', id, 'name', name, 'type', type::text, 'weight', weight, 'is_required', is_required) ORDER BY sort_order, created_at) FROM position_criteria WHERE position_id = p.id)) FROM positions p WHERE p.code = ${sqlString(POSITION_CODE)}`);
  for (const [label, fixture] of Object.entries(FIXTURES)) {
    const form = new FormData();
    form.append('name', `WF1 Check ${label}`);
    form.append('email', EMAIL(label));
    form.append('position', POSITION_CODE);
    form.append('consent', 'true');
    form.append('cv', new Blob([await fixture.build()], { type: 'application/pdf' }), `${label}.pdf`);
    const response = await fetch(`${BACKEND}/api/applications`, { method: 'POST', body: form });
    if (response.status !== 201) throw new Error(`POST /api/applications (${label}) → HTTP ${response.status}`);
    created[label] = idOf(label);
    ok(`${label}: ${fixture.description}`);
  }
  const fileOf = (label) => psql(`SELECT cv_drive_file_id FROM applications WHERE id = '${created[label]}'`);
  const insert = (label, fileId, state, age) => {
    psql(`INSERT INTO applications (full_name, email, position_id, cv_file_name, cv_drive_file_id, cv_drive_url, status, updated_at)
      VALUES ('WF1 Check ${label}', ${sqlString(EMAIL(label))}, '${position.id}', '${label}.pdf', ${sqlString(fileId)}, 'https://drive.google.com/file/d/${fileId}/view', '${state}', now() - interval '${age}')`);
    created[label] = idOf(label);
  };
  insert('missing-file', 'wf1-check-missing-file', 'SUBMITTED', '0 minutes');
  insert('stale', fileOf('unsuitable'), 'EVALUATING', '2 hours');
  insert('recent', 'wf1-check-recent', 'EVALUATING', '5 minutes');
  ok('plus: an application whose CV is missing on Drive, a stuck EVALUATING one (2 h) and a recent EVALUATING one (5 min)');

  section('Running WF-1');
  const first = runWorkflow();
  check(first.success, 'the execution finished successfully (one bad application does not stop the batch)');
  check(itemsOf(first.runData, AGENT) === 6, `Claude scored ${itemsOf(first.runData, AGENT)} application(s) (5 test CVs + the stuck one)`);

  const results = {};
  const evaluated = ['strong', 'medium', 'unsuitable', 'scanned', 'injection', 'stale'];
  for (const label of evaluated) results[label] = evaluation(created[label]);

  section('AC-5, AC-9, AC-10 stored results');
  for (const label of evaluated) {
    const r = results[label];
    const h = history(created[label]);
    check(r.status === 'EVALUATED', `${label}: EVALUATED`, r.status);
    if (r.status !== 'EVALUATED') continue;
    const scores = r.criteria_scores;
    check(scores.length === position.criteria.length && scores.every((s, i) => s.criterion_id === position.criteria[i].id), `${label}: every criterion of the position scored once, in order (the MCP tool was used)`);
    check(scores.every((s, i) => ['criterion_id', 'evidence', 'is_required', 'name', 'reasoning', 'score', 'type', 'weight'].join() === Object.keys(s).sort().join() && s.type === position.criteria[i].type && s.name === position.criteria[i].name && s.weight === position.criteria[i].weight && s.is_required === position.criteria[i].is_required && s.score >= 0 && s.score <= 10), `${label}: name / weight / is_required come from the DB, scores within 0–10`);
    const weights = position.criteria.reduce((sum, c) => sum + c.weight, 0);
    const expected = Math.round((scores.reduce((sum, s, i) => sum + s.score * position.criteria[i].weight, 0) / weights) * 10 * 100) / 100;
    check(Math.abs(r.overall - expected) < 0.005, `${label}: overall_score ${r.overall} matches the formula`, `expected ${expected}`);
    const requiredFailed = scores.some((s, i) => position.criteria[i].is_required && s.score < 5);
    const rule = requiredFailed || expected < 50 ? 'NOT_RECOMMENDED' : expected >= 75 ? 'RECOMMENDED' : 'CONSIDER';
    check(r.recommendation === rule, `${label}: recommendation ${r.recommendation} follows the thresholds`, `expected ${rule}`);
    check(r.model === 'claude-sonnet-5-5' && r.prompt_version === 'v1' && r.summary.length > 0 && r.evaluations === 1, `${label}: model, prompt_version, summary saved; one evaluation row`);
    check(h.filter((x) => x.startsWith('EVALUATING>EVALUATED|')).length === 1 && h.filter((x) => x.startsWith('SUBMITTED>EVALUATING|')).length === 1, `${label}: history has one SUBMITTED→EVALUATING and one EVALUATING→EVALUATED row`, h.join(' ; '));
  }

  section('AC-16 quality (ranges and order, not exact text)');
  const s = (label) => results[label].overall;
  check(['RECOMMENDED', 'CONSIDER'].includes(results.strong.recommendation), `strong CV: ${results.strong.recommendation} (${s('strong')})`);
  check(s('strong') > s('medium') && s('medium') > s('unsuitable'), `strong ${s('strong')} > medium ${s('medium')} > unsuitable ${s('unsuitable')}`);
  check(results.unsuitable.recommendation === 'NOT_RECOMMENDED', 'unsuitable CV: NOT_RECOMMENDED');
  const scannedText = JSON.stringify([results.scanned.summary, results.scanned.criteria_scores.map((c) => c.evidence + c.reasoning)]);
  check(/ZetaPay|Quang|NestJS/i.test(scannedText) && s('scanned') > s('unsuitable'), `scanned CV (image only) was read: mentions its content, score ${s('scanned')}`);
  check(results.injection.recommendation !== 'RECOMMENDED' && s('injection') < s('strong'), `CV with an injection notice: ${results.injection.recommendation} (${s('injection')}), not inflated (AC-14)`);

  section('AC-11 one bad application does not break the batch');
  const failed = evaluation(created['missing-file']);
  const failedHistory = history(created['missing-file']);
  check(failed.status === 'EVALUATION_FAILED' && failed.evaluations === 0, 'missing CV → EVALUATION_FAILED, no evaluation row', failed.status);
  const note = failedHistory.find((x) => x.startsWith('EVALUATING>EVALUATION_FAILED|')) ?? '';
  check(/\|Không tải được CV từ Google Drive$/.test(note), 'history note says the CV could not be downloaded', note);

  section('AC-4 stuck applications');
  const staleHistory = history(created.stale);
  check(staleHistory.some((x) => /^EVALUATING>SUBMITTED\|.*gián đoạn/.test(x)), 'EVALUATING for over an hour → put back to SUBMITTED (history note), then evaluated', staleHistory.join(' ; '));
  const recent = evaluation(created.recent);
  check(recent.status === 'EVALUATING' && history(created.recent).length === 0, 'EVALUATING for 5 minutes (another run still working on it) is left alone');

  section('AC-10 re-evaluation overwrites');
  const before = results.unsuitable;
  psql(`UPDATE applications SET status = 'SUBMITTED', updated_at = now() WHERE id = '${created.unsuitable}'`);
  const second = runWorkflow();
  const after = evaluation(created.unsuitable);
  check(second.success && after.status === 'EVALUATED' && after.evaluations === 1, 're-evaluated: still exactly one evaluation row');
  check(new Date(after.created_at).getTime() === new Date(before.created_at).getTime() && new Date(after.updated_at) > new Date(before.updated_at), 'the row was updated in place (created_at kept, updated_at moved)');

  section('AC-6 nothing to evaluate');
  const third = runWorkflow();
  const calls = [AGENT, 'Tải CV từ Drive'].filter((name) => itemsOf(third.runData, name) > 0);
  check(third.success && calls.length === 0, 'no SUBMITTED application → no Drive download, no Claude call', calls.join(', '));
  console.log('\n  (AC-12 — HR decides while an application is being evaluated — is a manual check, see tasks.md)');
} catch (error) {
  ko(`unexpected error: ${error.message}`);
} finally {
  section('Cleanup');
  try {
    const removed = await cleanup('cleanup');
    const left = psql(`SELECT count(*) FROM applications WHERE email LIKE 'wf1-check+%@example.com'`);
    check(left === '0', `test applications deleted (rows, evaluations, history); ${removed} test CV file(s) deleted from Drive`);
  } catch (error) {
    ko(`cleanup failed: ${error.message} — run the check again, it removes leftovers first`);
  }
}

console.log(fails === 0 ? '\nwf1:check passed' : `\nwf1:check failed: ${fails} check(s)`);
process.exit(fails === 0 ? 0 : 1);
