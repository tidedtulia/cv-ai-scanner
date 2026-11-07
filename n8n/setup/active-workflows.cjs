// Prints the ids of the workflows of a folder that are exported as published ("active": true), one per line.
// Used by entrypoint.sh to publish them after `n8n import:workflow` (which imports every workflow unpublished).
const { readdirSync, readFileSync } = require('node:fs');

const dir = process.argv[2] || '/workflows';
for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
  const workflow = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
  if (workflow.active === true && workflow.id) console.log(workflow.id);
}
