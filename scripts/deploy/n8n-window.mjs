// n8n only runs from n8nWindowStart to n8nWindowEnd (Vietnam time, KEDA cron "M H * * *", infra/azure/main.bicep).
// The deploy workflow must not replace n8n while it is evaluating CVs (docs/features/auto-deploy AC-6):
//   node scripts/deploy/n8n-window.mjs status   → prints `in-window <seconds-to-end>` or `outside-window`
//   node scripts/deploy/n8n-window.mjs wait     → returns at once outside the window, else waits for its end + 5 minutes (max 3 h)
// Window values: N8N_WINDOW_START / N8N_WINDOW_END, else the defaults of main.bicep. N8N_WINDOW_NOW (ISO date) fixes "now"
// (tests); N8N_WINDOW_NO_SLEEP=1 prints what it would wait instead of waiting.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VIETNAM_OFFSET_MINUTES = 7 * 60; // no daylight saving
const GRACE_SECONDS = 5 * 60;
const MAX_WAIT_SECONDS = 3 * 60 * 60;

/** "50 23 * * *" → minutes after midnight (23 * 60 + 50). Only the daily "M H * * *" form is supported. */
export function cronMinutes(cron) {
  const match = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(String(cron).trim());
  if (!match) throw new Error(`unsupported cron "${cron}" (only "M H * * *")`);
  const [minute, hour] = [Number(match[1]), Number(match[2])];
  if (minute > 59 || hour > 23) throw new Error(`invalid cron "${cron}"`);
  return hour * 60 + minute;
}

/** Minutes after midnight, Vietnam time, plus the seconds into that minute */
function vietnamClock(date) {
  const utcSeconds = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
  const seconds = (utcSeconds + VIETNAM_OFFSET_MINUTES * 60) % 86400;
  return seconds;
}

/**
 * Whether `date` is inside [start, end) and, if so, the seconds left until the end. The window may pass midnight
 * (23:50 → 02:00); start === end is an empty window.
 */
export function windowState(date, startCron, endCron) {
  const start = cronMinutes(startCron) * 60;
  const end = cronMinutes(endCron) * 60;
  const now = vietnamClock(date);
  if (start === end) return { inWindow: false, secondsToEnd: 0 };
  const inWindow = start < end ? now >= start && now < end : now >= start || now < end;
  if (!inWindow) return { inWindow: false, secondsToEnd: 0 };
  const secondsToEnd = end > now ? end - now : end + 86400 - now;
  return { inWindow: true, secondsToEnd };
}

/** Defaults of the Bicep parameters, so that the workflow follows the infrastructure */
export function bicepWindow(bicepPath = join(dirname(fileURLToPath(import.meta.url)), '../../infra/azure/main.bicep')) {
  const text = readFileSync(bicepPath, 'utf8');
  const read = (name) => new RegExp(`param ${name} string = '([^']+)'`).exec(text)?.[1];
  return { start: read('n8nWindowStart'), end: read('n8nWindowEnd') };
}

function configuredWindow(env) {
  const fromBicep = bicepWindow();
  return { start: env.N8N_WINDOW_START || fromBicep.start, end: env.N8N_WINDOW_END || fromBicep.end };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const [command = 'status'] = process.argv.slice(2);
  const { start, end } = configuredWindow(process.env);
  const now = process.env.N8N_WINDOW_NOW ? new Date(process.env.N8N_WINDOW_NOW) : new Date();
  const state = windowState(now, start, end);

  if (command === 'status') {
    console.log(state.inWindow ? `in-window ${state.secondsToEnd}` : 'outside-window');
  } else if (command === 'wait') {
    if (!state.inWindow) {
      console.log(`n8n window (${start} → ${end}, Vietnam time): outside it, no wait`);
    } else {
      const seconds = state.secondsToEnd + GRACE_SECONDS;
      console.log(`n8n window (${start} → ${end}, Vietnam time): inside it, n8n may be evaluating CVs; waiting ${seconds}s for it to end`);
      if (seconds > MAX_WAIT_SECONDS) {
        console.error(`the wait of ${seconds}s is over the limit of ${MAX_WAIT_SECONDS}s`);
        process.exit(1);
      }
      if (process.env.N8N_WINDOW_NO_SLEEP !== '1') await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }
  } else {
    console.error('usage: n8n-window.mjs status|wait');
    process.exit(2);
  }
}
