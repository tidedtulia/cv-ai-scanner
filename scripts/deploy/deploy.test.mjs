// node --test scripts/deploy/deploy.test.mjs — scripts/deploy/deploy.sh against a FAKE `az` and `curl` (no Azure, no network):
// docs/features/auto-deploy AC-6 (order, migrate gate, n8n window) and AC-7 (health check and roll back).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('./deploy.sh', import.meta.url).pathname;

const AZ = `#!/bin/bash
echo "az $*" >> "$STUB_LOG"
args="$*"
app=$(echo "$args" | sed -n 's/.*-n cvs-\\([a-z0-9]*\\).*/\\1/p')
case "$args" in
  "containerapp show"*"containers[0].image"*) echo "ghcr.io/o/cv-$app:$(cat "$STUB_DIR/tag-$app" 2>/dev/null || echo old1)" ;;
  "containerapp show"*provisioningState*) echo Succeeded ;;
  "containerapp show"*ingress.fqdn*) echo web.example.test ;;
  "containerapp update"*)
    [ "$STUB_UPDATE_FAIL" = "$app" ] && { echo "update failed" >&2; exit 1; }
    echo "$args" | sed -n 's/.*--image [^ ]*:\\([^ ]*\\) .*/\\1/p' > "$STUB_DIR/tag-$app"; echo "cvs-$app--rev" ;;
  "containerapp job update"*) ;;
  "containerapp job start"*) echo exec-1 ;;
  "containerapp job execution show"*) echo "$STUB_MIGRATE_STATUS" ;;
  *) echo "unexpected az call: $args" >&2; exit 9 ;;
esac
`;

const CURL = `#!/bin/bash
echo "curl $*" >> "$STUB_LOG"
out=""; fmt=""; url=""
while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift ;; -w) fmt="$2"; shift ;; -H|--max-time) shift ;; -s) ;; *) url="$1" ;; esac; shift; done
body=""; code=200
case "$url" in
  https://ghcr.io/token*) body='{"token":"tok"}' ;;
  https://ghcr.io/v2/*) [ "$STUB_IMAGE_MISSING" = "1" ] && code=404 ;;
  */api/health/ready) if [ "$(cat "$STUB_DIR/tag-backend" 2>/dev/null)" = "$STUB_BAD_TAG" ] || [ "$(cat "$STUB_DIR/tag-frontend" 2>/dev/null)" = "$STUB_BAD_TAG" ]; then code=503; body='{"status":"error","database":"down"}'; else body='{"status":"ok","database":"up"}'; fi ;;
  *) ;;
esac
[ -n "$out" ] && [ "$out" != "/dev/null" ] && printf '%s' "$body" > "$out"
[ -z "$out" ] && printf '%s' "$body"
[ -n "$fmt" ] && printf '%s' "$code"
exit 0
`;

function deploy(tag, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-test-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  for (const [name, text] of [['az', AZ], ['curl', CURL]]) {
    writeFileSync(join(bin, name), text);
    chmodSync(join(bin, name), 0o755);
  }
  const log = join(dir, 'calls.log');
  writeFileSync(log, '');
  const summary = join(dir, 'summary.md');
  writeFileSync(summary, '');
  const result = spawnSync('bash', [SCRIPT, tag], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: process.env.HOME,
      IMAGE_REGISTRY: 'ghcr.io/o',
      STUB_DIR: dir,
      STUB_LOG: log,
      STUB_MIGRATE_STATUS: 'Succeeded',
      STUB_UPDATE_FAIL: '',
      STUB_IMAGE_MISSING: '0',
      STUB_BAD_TAG: '',
      POLL_INTERVAL: '0',
      VERIFY_TIMEOUT_SECONDS: '0',
      MIGRATE_TIMEOUT_SECONDS: '0',
      N8N_WINDOW_NOW: '2026-11-12T10:00:00Z', // 17:00 Vietnam: outside the n8n window
      N8N_WINDOW_NO_SLEEP: '1',
      GITHUB_STEP_SUMMARY: summary,
      ...env,
    },
  });
  const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const updates = calls.filter((c) => c.startsWith('az containerapp update')).map((c) => /-n cvs-([a-z0-9]+).*--image [^ ]*:([^ ]+)/.exec(c).slice(1, 3).join('='));
  return { ...result, calls, updates, summary: readFileSync(summary, 'utf8') };
}

test('AC-6: happy path — migrate first, then backend, frontend, n8n, each on the new tag', () => {
  const r = deploy('20261112.7');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.updates, ['backend=20261112.7', 'frontend=20261112.7', 'n8n=20261112.7']);
  const order = ['job update', 'job start', 'update -g cvs-rg -n cvs-backend', 'update -g cvs-rg -n cvs-frontend', 'update -g cvs-rg -n cvs-n8n'].map((needle) => r.calls.findIndex((c) => c.includes(needle)));
  assert.ok(order.every((i) => i >= 0) && order.every((v, i) => i === 0 || v > order[i - 1]), `order ${order}`);
  assert.match(r.summary, /Deploy 20261112\.7/);
  assert.match(r.summary, /migration succeeded/);
});

test('AC-6: the migration job runs the NEW backend image', () => {
  const r = deploy('20261112.7');
  assert.ok(r.calls.some((c) => c.includes('containerapp job update') && c.includes('--image ghcr.io/o/cv-backend:20261112.7')));
});

test('AC-6: a failed migration stops everything — no app is updated', () => {
  const r = deploy('20261112.8', { STUB_MIGRATE_STATUS: 'Failed' });
  assert.notEqual(r.status, 0);
  assert.deepEqual(r.updates, []);
  assert.match(r.summary, /no app was updated/);
});

test('AC-6: a tag that was never built stops before anything is changed', () => {
  const r = deploy('nope.1', { STUB_IMAGE_MISSING: '1' });
  assert.notEqual(r.status, 0);
  assert.equal(r.calls.filter((c) => c.startsWith('az containerapp update') || c.includes('job ')).length, 0);
  assert.match(r.stdout, /does not exist/);
});

test('AC-6: inside the n8n window n8n waits (here: reports the wait) and is updated afterwards, backend and frontend first', () => {
  const r = deploy('20261112.9', { N8N_WINDOW_NOW: '2026-11-12T17:00:00Z' }); // 00:00 Vietnam
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /inside it, n8n may be evaluating CVs; waiting 7500s/);
  assert.deepEqual(r.updates, ['backend=20261112.9', 'frontend=20261112.9', 'n8n=20261112.9']);
});

test('AC-6: n8n failing leaves backend and frontend on the new tag and makes the run red', () => {
  const r = deploy('20261112.10', { STUB_UPDATE_FAIL: 'n8n' });
  assert.notEqual(r.status, 0);
  // n8n was attempted (and failed); backend and frontend were not put back
  assert.deepEqual(r.updates, ['backend=20261112.10', 'frontend=20261112.10', 'n8n=20261112.10']);
  assert.match(r.summary, /n8n was not updated/);
  assert.match(r.summary, /backend and frontend stay on 20261112\.10/);
});

test('AC-7: an unhealthy site puts backend and frontend back on the previous tags and says the migration stays', () => {
  const r = deploy('bad.1', { STUB_BAD_TAG: 'bad.1' });
  assert.notEqual(r.status, 0);
  assert.deepEqual(r.updates, ['backend=bad.1', 'frontend=bad.1', 'backend=old1', 'frontend=old1']);
  assert.ok(!r.updates.some((u) => u.startsWith('n8n=')), 'n8n is not touched when the site is unhealthy');
  assert.match(r.summary, /put back on/);
  assert.match(r.summary, /not rolled back/);
});

test('AC-7: the health check reads /api/health/ready and wants the database up', () => {
  const r = deploy('20261112.11');
  assert.ok(r.calls.some((c) => c.includes('web.example.test/api/health/ready')));
  assert.ok(r.calls.some((c) => /https:\/\/web\.example\.test\/(\s|$)/.test(c)));
});

test('AC-9: an invalid tag (command injection attempt) is refused before any call', () => {
  for (const tag of ['x; rm -rf /', '$(id)', 'a b', '']) {
    const r = deploy(tag);
    assert.equal(r.status, 2, `tag "${tag}"`);
    assert.equal(r.calls.length, 0);
  }
});

test('AC-6: revision suffixes are lowercase letters, digits and single dashes', () => {
  const r = deploy('V1..Beta_2');
  const suffixes = r.calls.filter((c) => c.startsWith('az containerapp update')).map((c) => /--revision-suffix (\S+)/.exec(c)[1]);
  assert.equal(suffixes.length, 3);
  for (const suffix of suffixes) assert.match(suffix, /^r[a-z0-9]+(-[a-z0-9]+)*$/);
});
