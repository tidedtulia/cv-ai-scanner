// node --test scripts/deploy/n8n-window.test.mjs — the n8n window logic of the deploy workflow (docs/features/auto-deploy AC-6)
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { bicepWindow, cronMinutes, windowState } from './n8n-window.mjs';

const START = '50 23 * * *';
const END = '0 2 * * *';
// Vietnam time → UTC: subtract 7 hours (no daylight saving)
const vn = (hh, mm, ss = 0) => new Date(Date.UTC(2026, 10, 12, hh - 7, mm, ss));
const at = (hh, mm, ss = 0) => windowState(vn(hh, mm, ss), START, END);

test('AC-6: cronMinutes reads the daily form and refuses anything else', () => {
  assert.equal(cronMinutes('50 23 * * *'), 23 * 60 + 50);
  assert.equal(cronMinutes('0 2 * * *'), 120);
  for (const bad of ['*/5 * * * *', '60 1 * * *', '0 24 * * *', '0 2 * * 1', 'x']) assert.throws(() => cronMinutes(bad), /cron/);
});

test('AC-6: inside the window 23:50 → 02:00 (it passes midnight), outside everywhere else', () => {
  const inside = [[23, 50], [23, 59], [0, 0], [0, 30], [1, 59, 59]];
  const outside = [[23, 49, 59], [2, 0], [2, 4], [12, 0], [6, 0], [22, 0]];
  for (const [h, m, s] of inside) assert.equal(at(h, m, s).inWindow, true, `${h}:${m}`);
  for (const [h, m, s] of outside) assert.equal(at(h, m, s).inWindow, false, `${h}:${m}`);
});

test('AC-6: seconds to the end of the window are counted across midnight', () => {
  assert.equal(at(23, 50).secondsToEnd, 2 * 3600 + 10 * 60);
  assert.equal(at(0, 0).secondsToEnd, 2 * 3600);
  assert.equal(at(1, 59, 30).secondsToEnd, 30);
});

test('AC-6: the time zone is Vietnam, not UTC (23:50 in Hanoi is 16:50 UTC)', () => {
  assert.equal(windowState(new Date('2026-11-12T16:50:00Z'), START, END).inWindow, true);
  assert.equal(windowState(new Date('2026-11-12T23:50:00Z'), START, END).inWindow, false);
});

test('AC-6: a window inside one day and an empty window work too', () => {
  assert.equal(windowState(vn(9, 0), '0 8 * * *', '0 10 * * *').inWindow, true);
  assert.equal(windowState(vn(10, 0), '0 8 * * *', '0 10 * * *').inWindow, false);
  assert.equal(windowState(vn(9, 0), '0 8 * * *', '0 8 * * *').inWindow, false);
});

test('AC-6: the defaults are the ones of main.bicep', () => {
  assert.deepEqual(bicepWindow(), { start: START, end: END });
  const bicep = readFileSync(new URL('../../infra/azure/main.bicep', import.meta.url), 'utf8');
  assert.match(bicep, /param n8nWindowStart string = '50 23 \* \* \*'/);
});

const run = (args, now) =>
  execFileSync('node', [new URL('./n8n-window.mjs', import.meta.url).pathname, ...args], {
    encoding: 'utf8',
    env: { ...process.env, N8N_WINDOW_NOW: now, N8N_WINDOW_NO_SLEEP: '1' },
  }).trim();

test('AC-6: the CLI reports the state and says how long it would wait (without sleeping)', () => {
  assert.equal(run(['status'], '2026-11-12T10:00:00Z'), 'outside-window'); // 17:00 Vietnam
  assert.equal(run(['status'], '2026-11-12T17:00:00Z'), 'in-window 7200'); // 00:00 Vietnam, 2 h to 02:00
  assert.match(run(['wait'], '2026-11-12T10:00:00Z'), /outside it, no wait/);
  assert.match(run(['wait'], '2026-11-12T17:00:00Z'), /waiting 7500s/); // 2 h + 5 min grace
  assert.match(run(['wait'], '2026-11-12T16:50:00Z'), /waiting 8100s/); // 23:50 Vietnam: 2 h 10 min + 5 min
});
