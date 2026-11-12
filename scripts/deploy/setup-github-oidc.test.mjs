// node --test scripts/deploy/setup-github-oidc.test.mjs — the subject of the federated credential (docs/features/auto-deploy AC-5).
// GitHub presents the IMMUTABLE ids of owner and repository in the OIDC subject; a name-only subject never matches
// (AADSTS700213, seen on the first real run). Dry run: nothing is created, no Azure, no network.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const SCRIPT = new URL('./setup-github-oidc.sh', import.meta.url).pathname;
const run = (env = {}, args = ['--dry-run']) =>
  execFileSync('sh', [SCRIPT, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, GITHUB_OWNER_ID: '92788899', GITHUB_REPO_ID: '1445764401', ...env } });

test('AC-5: the credential subject carries the owner and repository ids (the one GitHub really sends)', () => {
  const out = run();
  assert.match(out, /"subject":"repo:tidedtulia@92788899\/cv-ai-scanner@1445764401:environment:production"/);
  assert.match(out, /"issuer":"https:\/\/token\.actions\.githubusercontent\.com"/);
  assert.match(out, /"audiences":\["api:\/\/AzureADTokenExchange"\]/);
});

test('AC-5: the name-only subject is not used any more', () => {
  assert.doesNotMatch(run(), /"subject":"repo:tidedtulia\/cv-ai-scanner:environment/);
});

test('AC-5: Contributor is granted on the resource group only, never on the subscription', () => {
  const out = run();
  assert.match(out, /role assignment create --assignee <app-id> --role Contributor --scope \/subscriptions\/<subscription-id>\/resourceGroups\/cvs-rg( |$)/m);
  assert.doesNotMatch(out, /--scope \/subscriptions\/<subscription-id>( |$)/m);
});

test('AC-5: another repository or environment changes the subject', () => {
  const out = run({ GITHUB_REPO: 'someone/other-repo', ENVIRONMENT: 'staging', GITHUB_OWNER_ID: '1', GITHUB_REPO_ID: '2' });
  assert.match(out, /"subject":"repo:someone@1\/other-repo@2:environment:staging"/);
});

test('AC-5: the three values are printed as VARIABLES and nothing secret is created or printed', () => {
  const out = run();
  assert.match(out, /AZURE_CLIENT_ID/);
  assert.match(out, /repository VARIABLES \(not secrets\)/);
  assert.doesNotMatch(out, /client-secret|password|--secret/i);
});
