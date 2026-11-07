// Run after `n8n export:workflow` (by workflows.sh, inside the n8n container): keeps the exported files portable
// and free of personal data before they are committed.
// - shared: the owner's project, whose name contains the owner's email + instance-specific ids
// - pinData / staticData: pinned sample data (could be candidate data) / trigger state of this instance
// - timestamps + version counters: change on every export, only noise in git diffs
const { readdirSync, readFileSync, writeFileSync } = require('node:fs');

const dir = process.argv[2] || '/workflows';
const DROP = ['shared', 'pinData', 'staticData', 'createdAt', 'updatedAt', 'activeVersionId', 'versionCounter', 'triggerCount'];

for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
  const path = `${dir}/${file}`;
  const workflow = JSON.parse(readFileSync(path, 'utf8'));
  for (const key of DROP) delete workflow[key];
  writeFileSync(path, `${JSON.stringify(workflow, null, 2)}\n`);
}
