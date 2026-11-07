// npm run bicep:check — static check of infra/azure (docs/features/azure-deploy AC-7, AC-8). Needs the Azure CLI + Bicep
// (`az bicep install`); touches nothing in Azure. Compiles main.bicep + the example parameter file, then asserts the rules
// that must never silently change: who is public, replica limits, probes, no secret and no MAIL_REDIRECT_TO in the files.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MAIN = 'infra/azure/main.bicep';
const PARAMS = 'infra/azure/main.example.bicepparam';
const env = { ...process.env, PATH: `${process.env.PATH}:${process.env.HOME}/.azure/bin` };
const az = (...argv) => spawnSync('az', argv, { cwd: root, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });

let fails = 0;
const ok = (message) => console.log(`  ✓ ${message}`);
const ko = (message, detail) => {
  fails += 1;
  console.log(`  ✗ ${message}${detail ? ` — ${detail}` : ''}`);
};
const check = (condition, message, detail) => (condition ? ok(message) : ko(message, detail));
const section = (title) => console.log(`\n${title}`);

if (az('--version').status !== 0) {
  console.error('Azure CLI (az) is not installed — bicep:check needs it (and `az bicep install`)');
  process.exit(1);
}

section('Compile');
const build = az('bicep', 'build', '--file', MAIN, '--stdout');
check(build.status === 0, 'az bicep build main.bicep', build.stderr.trim().split('\n')[0]);
check(build.stderr.trim() === '', 'no warning while building', build.stderr.trim().split('\n')[0]);
const lint = az('bicep', 'lint', '--file', MAIN);
check(lint.status === 0 && `${lint.stdout}${lint.stderr}`.trim() === '', 'az bicep lint: no finding', `${lint.stdout}${lint.stderr}`.trim().split('\n')[0]);
const params = az('bicep', 'build-params', '--file', PARAMS, '--stdout');
check(params.status === 0, 'az bicep build-params main.example.bicepparam', params.stderr.trim().split('\n')[0]);
if (build.status !== 0) {
  console.log('\nCannot inspect a template that does not compile.');
  process.exit(1);
}

const arm = JSON.parse(build.stdout);
const resources = Object.values(arm.resources);
const byType = (type) => resources.filter((r) => r.type === type);
// names are ARM expressions: "[variables('backendName')]"
const app = (key) => byType('Microsoft.App/containerApps').find((r) => String(r.name).includes(`variables('${key}Name')`));
const container = (r) => r.properties.template.containers[0];
const probe = (r, kind) => container(r).probes.find((p) => p.type === kind);
const main = readFileSync(join(root, MAIN), 'utf8');
const paramFile = readFileSync(join(root, PARAMS), 'utf8');

section('AC-7 — resources and defaults');
const types = new Set(resources.map((r) => r.type));
for (const type of ['Microsoft.OperationalInsights/workspaces', 'Microsoft.ContainerRegistry/registries', 'Microsoft.App/managedEnvironments', 'Microsoft.DBforPostgreSQL/flexibleServers', 'Microsoft.App/jobs', 'Microsoft.Authorization/roleAssignments']) {
  check(types.has(type), `declares ${type}`);
}
check(byType('Microsoft.App/containerApps').length === 3, 'three container apps (frontend, backend, n8n)');
check(arm.parameters.location.defaultValue === 'southeastasia', 'default region is southeastasia');
const registry = byType('Microsoft.ContainerRegistry/registries')[0];
check(registry.sku.name === 'Basic' && registry.properties.adminUserEnabled === false, 'ACR is Basic with the admin account disabled (images are pulled with a managed identity)');
const pg = byType('Microsoft.DBforPostgreSQL/flexibleServers')[0];
check(pg.properties.version === '17' && pg.sku.tier === 'Burstable' && pg.properties.storage.storageSizeGB !== undefined, 'PostgreSQL 17, Burstable');
check(arm.parameters.postgresSku.defaultValue === 'Standard_B1ms' && arm.parameters.postgresStorageGb.defaultValue === 32 && arm.parameters.postgresBackupDays.defaultValue === 7, 'default Standard_B1ms, 32 GB, 7 days of backups');
const logs = byType('Microsoft.OperationalInsights/workspaces')[0];
check(arm.parameters.logRetentionDays.defaultValue === 30 && /0\.5/.test(String(arm.parameters.logDailyCapGb.defaultValue)) && logs.properties.workspaceCapping, 'logs: 30 days, 0.5 GB per day cap');
check(arm.parameters.deployApps.defaultValue === false, 'deployApps defaults to false (phase 1 = infrastructure only)');

const backend = app('backend');
const frontend = app('frontend');
const n8n = app('n8n');
check(backend && frontend && n8n, 'the three apps are found');
section('AC-7 / AC-8 — who is public, replicas, probes');
check(backend.properties.configuration.ingress.external === false, 'backend ingress is INTERNAL (external: false)');
check(frontend.properties.configuration.ingress.external === true && frontend.properties.configuration.ingress.allowInsecure === false, 'frontend ingress is public, https only');
check(String(n8n.properties.configuration.ingress).includes('empty(parameters(') && /n8nAllowedCidr/.test(String(n8n.properties.configuration.ingress)), 'n8n has no ingress at all when n8nAllowedCidr is empty');
check(String(n8n.properties.configuration.ingress).includes('ipSecurityRestrictions') && JSON.stringify(arm.variables).includes('"action":"Allow"'), 'n8n ingress allows only the listed CIDR blocks (action Allow, nothing else)');
check(backend.properties.template.scale.maxReplicas === 1, 'backend max replicas = 1 (in-memory failed-login counter)');
check(n8n.properties.template.scale.minReplicas === 1 && n8n.properties.template.scale.maxReplicas === 1, 'n8n min = max = 1 (the 00:00 schedule)');
check(frontend.properties.template.scale.maxReplicas !== undefined && arm.parameters.frontendMinReplicas.defaultValue === 0 && arm.parameters.frontendMaxReplicas.defaultValue === 2, 'frontend scales 0 → 2');
check(arm.parameters.backendMinReplicas.defaultValue === 0, 'backend may scale to 0');
check(container(backend).resources.cpu !== undefined && container(n8n).resources.memory === '1Gi', 'n8n gets 1 GiB');
check(probe(backend, 'Liveness').httpGet.path === '/api/health' && probe(backend, 'Readiness').httpGet.path === '/api/health/ready' && probe(backend, 'Startup').httpGet.path === '/api/health', 'backend probes: /api/health (live, startup), /api/health/ready (ready)');
check(probe(frontend, 'Readiness').httpGet.path === '/' && probe(frontend, 'Liveness').httpGet.path === '/', 'frontend probes: GET /');
check(probe(n8n, 'Startup').httpGet.path === '/healthz/readiness' && probe(n8n, 'Readiness').httpGet.path === '/healthz/readiness', 'n8n probes: /healthz/readiness');
const job = byType('Microsoft.App/jobs')[0];
check(job.properties.configuration.triggerType === 'Manual' && container(job).args.join(' ').includes('migrate-and-seed.sh'), 'job migrate: manual trigger, runs migrate-and-seed.sh from the backend image');
check(/backendName/.test(main) && /BACKEND_URL/.test(main), 'the frontend gets BACKEND_URL (the internal address of the backend)');

section('AC-8 — no secret, no redirect');
const secureParams = Object.entries(arm.parameters).filter(([, p]) => p.type === 'securestring').map(([key]) => key);
const mustBeSecure = ['postgresAdminPassword', 'jwtSecret', 'n8nDbPassword', 'n8nAppDbPassword', 'mcpDbPassword', 'mcpAuthToken', 'n8nEncryptionKey', 'n8nOwnerPassword', 'anthropicApiKey', 'googleClientId', 'googleClientSecret', 'googleRefreshToken', 'smtpPassword', 'seedHrPassword'];
check(mustBeSecure.every((p) => secureParams.includes(p)), 'every secret is an @secure() parameter', mustBeSecure.filter((p) => !secureParams.includes(p)).join(', '));
const plainEnvOfSecrets = [backend, n8n, job].flatMap((r) => container(r).env).filter((e) => e.value !== undefined && /PASSWORD|SECRET|TOKEN|API_KEY|ENCRYPTION_KEY|DATABASE_URL|REFRESH/.test(e.name) && !/^(APP_DB_SSL|DB_POSTGRESDB_SSL|SEED_SAMPLE)/.test(e.name));
check(plainEnvOfSecrets.length === 0, 'no secret is a plain environment value (all secretRef)', plainEnvOfSecrets.map((e) => e.name).join(', '));
check(!/MAIL_REDIRECT_TO/.test(JSON.stringify(arm)) && !/MAIL_REDIRECT_TO/.test(paramFile), 'MAIL_REDIRECT_TO is neither in the compiled template nor in the parameter file (production emails go to the candidates)');
const literalSecrets = paramFile.split('\n').filter((line) => /^param\s+\w*(password|secret|key|token)\w*\s*=\s*'[^']+'/i.test(line.trim()));
check(literalSecrets.length === 0, 'the parameter file has no secret value (all readEnvironmentVariable)', literalSecrets.join(' | '));
const envReads = (paramFile.match(/readEnvironmentVariable\(/g) ?? []).length;
check(envReads === mustBeSecure.length + 2, `the parameter file reads ${mustBeSecure.length} secrets + DEPLOY_APPS + IMAGE_TAG from the environment`, `${envReads}`);
check(!/(postgresql|postgres):\/\/[^$'{\s]+:[^$'{\s]+@/.test(main.replace(/\$\{[^}]*\}/g, '')), 'no connection string with a literal password');

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) failed.`);
process.exit(fails === 0 ? 0 : 1);
