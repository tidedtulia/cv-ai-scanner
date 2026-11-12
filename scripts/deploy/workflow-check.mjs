// npm run workflow:check — static check of .github/workflows/deploy.yml and scripts/deploy/deploy.sh
// (docs/features/auto-deploy AC-1 → AC-6, AC-9, AC-10). No Azure, no network. It then runs the node tests of the deploy scripts
// (fake `az` / `curl`, n8n window). Fails (exit ≠ 0) when a rule that must never silently change is broken.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const WORKFLOW = '.github/workflows/deploy.yml';
const DEPLOY_SH = 'scripts/deploy/deploy.sh';

let fails = 0;
const ok = (message) => console.log(`  ✓ ${message}`);
const ko = (message, detail) => {
  fails += 1;
  console.log(`  ✗ ${message}${detail ? ` — ${detail}` : ''}`);
};
const check = (condition, message, detail) => (condition ? ok(message) : ko(message, detail));
const section = (title) => console.log(`\n${title}`);

const text = readFileSync(join(root, WORKFLOW), 'utf8');
const workflow = yaml.load(text);
const script = readFileSync(join(root, DEPLOY_SH), 'utf8');
const on = workflow.on ?? workflow[true] ?? {};
const { test, build, deploy } = workflow.jobs;
const runs = (job) => (job.steps ?? []).map((step) => step.run ?? '').join('\n');
const stepIndex = (job, predicate) => (job.steps ?? []).findIndex(predicate);

section('AC-1 — when it runs');
check(JSON.stringify(on.push?.branches) === '["main"]', 'push: only the branch main (a merge)');
check(['docs/**', '**/*.md'].every((p) => on.push?.['paths-ignore']?.includes(p)), 'push: docs/** and *.md alone do not run it (paths-ignore)');
check(JSON.stringify(on.pull_request?.branches) === '["main"]', 'pull_request into main runs the tests');
check(on.workflow_dispatch?.inputs?.tag !== undefined && on.workflow_dispatch.inputs.tag.required !== true, 'manual run with an optional `tag` (roll back)');
check(!('pull_request_target' in on), 'no pull_request_target (a fork can never reach secrets or Azure)');
check(Object.keys(on).sort().join() === 'pull_request,push,workflow_dispatch', 'no other trigger', Object.keys(on).join());
check(/github\.event_name != 'pull_request'/.test(build.if) && /github\.event_name != 'pull_request'/.test(deploy.if), 'a pull request never builds an image or deploys');
check(/refs\/heads\/main/.test(build.if) && /refs\/heads\/main/.test(deploy.if), 'build and deploy only from main');
check(/inputs\.tag == ''/.test(test.if) && /inputs\.tag == ''/.test(build.if) && /inputs\.tag != ''/.test(deploy.if), 'a manual run with a tag skips test and build and only deploys');

section('AC-2 — the gate (job test)');
const testRuns = runs(test);
for (const [label, needle] of [['npm ci', 'npm ci'], ['tests of shared / backend / frontend', 'nx run-many -t test'], ['wf1:test', 'npm run wf1:test'], ['workflow:check', 'npm run workflow:check'], ['build (type-check)', 'nx run-many -t build'], ['prisma generate', 'prisma generate']]) {
  check(testRuns.includes(needle), `test runs ${label}`);
}
const nonBlocking = (test.steps ?? []).filter((s) => s['continue-on-error'] === true);
check(nonBlocking.length === 1 && /lint/.test(nonBlocking[0].run), 'only lint is non-blocking (report only, old errors remain)', nonBlocking.map((s) => s.name).join(', '));
check(build.needs === 'test' && deploy.needs === 'build', 'build needs test; deploy needs build (a red test stops everything)', `${build.needs} / ${deploy.needs}`);

section('AC-3 — build');
const idx = {
  scan: stepIndex(build, (s) => /scan-image\.sh/.test(s.run ?? '')),
  login: stepIndex(build, (s) => /docker\/login-action/.test(s.uses ?? '')),
  push: stepIndex(build, (s) => /docker push/.test(s.run ?? '')),
  lastBuild: Math.max(...(build.steps ?? []).map((s, i) => (/build-push-action/.test(s.uses ?? '') ? i : -1))),
};
check(idx.lastBuild >= 0 && idx.lastBuild < idx.scan && idx.scan < idx.login && idx.login < idx.push, 'order: build all three → scan → log in → push', JSON.stringify(idx));
check((build.steps ?? []).filter((s) => /build-push-action/.test(s.uses ?? '')).every((s) => s.with.push === false && s.with.load === true), 'images are built locally (push: false); only the last step pushes');
check(/sha-/.test(runs(build)) && /github\.run_number/.test(runs(build)), 'tags: <date>.<run number> and sha-<commit>');
check(/BACKEND_URL=http:\/\/\$\{\{ env\.NAME_PREFIX \}\}-backend/.test(text), 'frontend gets BACKEND_URL=http://<NAME_PREFIX>-backend');
check(build.outputs?.tag !== undefined, 'build exposes the tag to deploy');

section('AC-4 — concurrency');
for (const [name, job] of [['test', test], ['build', build]]) {
  check(/^ci-/.test(job.concurrency?.group ?? '') && job.concurrency['cancel-in-progress'] === true, `${name}: newer run cancels the older one (group ci-…, cancel-in-progress)`);
}
check(test.concurrency.group === build.concurrency.group, 'test and build share one group (a newer merge stops whichever of them is running)');
check(deploy.concurrency?.group === 'deploy-production' && deploy.concurrency['cancel-in-progress'] === false, 'deploy: fixed group, cancel-in-progress FALSE (a running deploy is never interrupted; the newest waiting one is kept)');
check(!text.split('\n').some((l) => /^concurrency:/.test(l)), 'no workflow-level concurrency (it would cancel the deploy too)');

section('AC-5 / AC-9 — Azure sign-in and permissions');
check(workflow.permissions?.contents === 'read' && Object.keys(workflow.permissions).length === 1, 'default permissions: contents: read only');
check(build.permissions?.packages === 'write' && !('id-token' in build.permissions), 'packages: write only in build');
check(deploy.permissions?.['id-token'] === 'write' && !('packages' in deploy.permissions), 'id-token: write only in deploy');
check(!('id-token' in (test.permissions ?? {})) && !('packages' in (test.permissions ?? {})), 'test has no extra permission');
check(deploy.environment === 'production', 'deploy runs in the environment `production` (branch-restricted, the OIDC subject)');
const login = (deploy.steps ?? []).find((s) => /azure\/login/.test(s.uses ?? ''));
check(login && ['client-id', 'tenant-id', 'subscription-id'].every((k) => /\$\{\{ vars\.AZURE_/.test(login.with?.[k] ?? '')), 'azure/login with the three AZURE_* repository variables (no secret)');
check(!(login?.with && 'client-secret' in login.with) && !/creds:/.test(text), 'no client secret, no creds JSON');
const secrets = [...text.matchAll(/secrets\.([A-Za-z_]+)/g)].map((m) => m[1]);
check(secrets.length > 0 && secrets.every((s) => s === 'GITHUB_TOKEN'), 'the only secret used is GITHUB_TOKEN', secrets.join(', '));
check((text.match(/uses:\s*\S+/g) ?? []).every((u) => /@v\d/.test(u)), 'every action is pinned to a major version');
const allRun = [test, build, deploy].map(runs).join('\n');
check(!/\$\{\{\s*(github\.event\.(pull_request|inputs|head_commit|issue|comment)|github\.head_ref|inputs\.)/.test(allRun), 'no untrusted value (PR title, branch, input) inside a run script');
check(/TAG: \$\{\{ inputs\.tag/.test(text) && /deploy\.sh "\$TAG"/.test(runs(deploy)), 'the tag reaches deploy.sh through an environment variable, quoted');
check(!/echo .*AZURE_|set-output|add-mask/i.test(allRun), 'nothing prints the Azure ids');

section('AC-6 — order of the deploy script');
const at = (needle) => script.indexOf(needle);
const order = ['image_exists "$name"', 'tag_of backend)', 'containerapp job update', 'containerapp job start', 'update_app backend "$TAG"', 'update_app frontend "$TAG"', 'healthy()', 'n8n-window.mjs" wait', 'update_app n8n "$TAG"'].map(at);
check(order.every((i) => i >= 0) && order.every((v, i) => i === 0 || v > order[i - 1]), 'images exist → record tags → migrate → backend → frontend → health → n8n window → n8n', JSON.stringify(order));
check(/\[ "\$STATUS" != "Succeeded" \][\s\S]{0,300}exit 1/.test(script) && at('exit 1') < at('update_app backend "$TAG"'), 'a migration that does not succeed exits before any app is updated');
check(/update_app backend "\$PREV_BACKEND"/.test(script) && /update_app frontend "\$PREV_FRONTEND"/.test(script), 'an unhealthy site puts backend and frontend back');
check(!/update_app n8n "\$PREV/.test(script), 'n8n is not rolled back automatically');
check(/case "\$TAG" in/.test(script) && /\*\[!A-Za-z0-9_\.-\]\*/.test(script), 'the tag is validated (letters, digits, . _ - only)');

section('AC-10 — tests of the deploy scripts (fake az / curl, n8n window)');
const result = spawnSync('node', ['--test', '--test-timeout=60000', 'scripts/deploy/n8n-window.test.mjs', 'scripts/deploy/deploy.test.mjs'], { cwd: root, encoding: 'utf8' });
const passed = /# pass (\d+)/.exec(result.stdout)?.[1];
const failed = /# fail (\d+)/.exec(result.stdout)?.[1];
check(result.status === 0 && failed === '0', `node --test: ${passed} passed, ${failed} failed`, result.stdout.split('\n').filter((l) => l.startsWith('not ok')).join(' | '));

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) failed.`);
process.exit(fails === 0 ? 0 : 1);
