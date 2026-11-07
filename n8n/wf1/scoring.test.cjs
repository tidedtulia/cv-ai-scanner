// npm run wf1:test — tests of the "Kiểm tra và tính điểm" Code node of WF-1 (AC-9, AC-10).
// It runs the code that is really inside n8n/workflows/cvScannerWf1.json, so the deployed logic is what is tested.
// No n8n, no database, no Claude: fast and free. Scenario: docs/features/n8n-evaluate-cv-workflow/requirements.md
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const workflow = JSON.parse(readFileSync(join(__dirname, '../workflows/cvScannerWf1.json'), 'utf8'));
const code = workflow.nodes.find((node) => node.name === 'Kiểm tra và tính điểm').parameters.jsCode;
const run = new Function('$json', '$', code);

const CONFIG = { model: 'claude-sonnet-5-5', prompt_version: 'v1' };
const LEVELS = ['INTERN', 'JUNIOR', 'MIDDLE', 'SENIOR'];
// 3 criteria with weights 3 / 2 / 1; the first is required (the example of AC-9)
const DB = [
  { id: 'c1', name: 'NestJS', type: 'TECHNICAL', weight: 3, is_required: true },
  { id: 'c2', name: 'PostgreSQL', type: 'TECHNICAL', weight: 2, is_required: false },
  { id: 'c3', name: 'English', type: 'LANGUAGE', weight: 1, is_required: false },
];
const answer = (scores, extra = {}) => ({
  criteria: DB.map((c, i) => ({ criterion_id: c.id, score: scores[i], reasoning: `r-${c.id}`, evidence: `e-${c.id}` })),
  summary: 'Tóm tắt',
  strengths: ['mạnh'],
  weaknesses: ['yếu'],
  estimated_years_experience: 3.46,
  estimated_level: 'MIDDLE',
  ...extra,
});
const evaluate = (result, { criteria = DB, levels = LEVELS } = {}) => {
  const stubs = {
    'Cấu hình': { first: () => ({ json: CONFIG }) },
    'Nhận lô đơn': { item: { json: { id: 'app-1', position_id: 'p-1' } } },
    'Chấm điểm (AI Agent)': { item: { json: { output: result } } },
  };
  return run({ criteria, levels }, (name) => stubs[name]).json;
};

test('AC-9: overall score and recommendation (weights 3/2/1, first criterion required)', () => {
  const rows = [
    [[9, 8, 7], 83.33, 'RECOMMENDED'],
    [[9, 8, 5], 80, 'RECOMMENDED'],
    [[4, 9, 9], 65, 'NOT_RECOMMENDED'], // required criterion < 5 although the total is high
    [[6, 6, 6], 60, 'CONSIDER'],
    [[3, 4, 5], 36.67, 'NOT_RECOMMENDED'],
    [[8, 9, 9], 85, 'RECOMMENDED'],
    [[7, 7, 8], 71.67, 'CONSIDER'],
  ];
  for (const [scores, overall, recommendation] of rows) {
    const out = evaluate(answer(scores));
    assert.equal(out.overall_score, overall, `scores ${scores}`);
    assert.equal(out.recommendation, recommendation, `scores ${scores}`);
  }
});

test('AC-9: thresholds are inclusive at 75 and exclusive below 50', () => {
  const only = [{ id: 'c1', name: 'A', type: 'TECHNICAL', weight: 1, is_required: false }];
  const one = (score) => evaluate({ ...answer([score]), criteria: [{ criterion_id: 'c1', score, reasoning: '', evidence: '' }] }, { criteria: only });
  assert.equal(one(7.5).recommendation, 'RECOMMENDED'); // 75
  assert.equal(one(7.4).recommendation, 'CONSIDER');
  assert.equal(one(5).recommendation, 'CONSIDER'); // 50 is not "below 50"
  assert.equal(one(4.9).recommendation, 'NOT_RECOMMENDED');
});

test('AC-9: a required criterion at exactly 5 is not a failure', () => {
  // (5*3 + 10*2 + 10*1) / 6 * 10 = 75 → RECOMMENDED: the required criterion is exactly at the limit (5), not below it
  const out = evaluate(answer([5, 10, 10]));
  assert.equal(out.overall_score, 75);
  assert.equal(out.recommendation, 'RECOMMENDED');
  assert.equal(evaluate(answer([4.9, 10, 10])).recommendation, 'NOT_RECOMMENDED'); // just below 5
});

test('AC-9: criteria_scores take name, type, weight, is_required from the DB, in DB order', () => {
  const lying = answer([9, 8, 7]);
  lying.criteria.reverse();
  lying.criteria.forEach((c) => Object.assign(c, { name: 'LIES', weight: 99, type: 'X', is_required: false }));
  const { criteria_scores: json } = evaluate(lying);
  const scores = JSON.parse(json);
  assert.deepEqual(scores.map((s) => s.criterion_id), ['c1', 'c2', 'c3']);
  assert.deepEqual(Object.keys(scores[0]), ['criterion_id', 'name', 'type', 'weight', 'is_required', 'score', 'reasoning', 'evidence']);
  assert.deepEqual(scores[0], { criterion_id: 'c1', name: 'NestJS', type: 'TECHNICAL', weight: 3, is_required: true, score: 9, reasoning: 'r-c1', evidence: 'e-c1' });
});

test('AC-9: invalid answers are rejected with a clear message', () => {
  const bad = [
    ['missing criterion', { ...answer([9, 8, 7]), criteria: answer([9, 8, 7]).criteria.slice(0, 2) }, /missing criteria: English/],
    ['unknown criterion id', (() => { const a = answer([9, 8, 7]); a.criteria[2].criterion_id = 'zzz'; return a; })(), /missing criteria: English/],
    ['extra criterion', (() => { const a = answer([9, 8, 7]); a.criteria.push({ criterion_id: 'zzz', score: 5 }); return a; })(), /unknown criterion ids: zzz/],
    ['duplicate criterion', (() => { const a = answer([9, 8, 7]); a.criteria.push({ ...a.criteria[0] }); return a; })(), /scored more than once/],
    ['score above 10', answer([11, 8, 7]), /"NestJS" must be a number from 0 to 10/],
    ['negative score', answer([9, -1, 7]), /"PostgreSQL" must be a number from 0 to 10/],
    ['score as text', answer(['9', 8, 7]), /"NestJS" must be a number/],
    ['NaN score', answer([9, NaN, 7]), /"PostgreSQL" must be a number/],
    ['no criteria list', { summary: 'x' }, /no criteria list/],
    ['empty answer', undefined, /no criteria list/],
    ['no summary', answer([9, 8, 7], { summary: '  ' }), /no summary/],
    ['criterion without id', (() => { const a = answer([9, 8, 7]); delete a.criteria[0].criterion_id; return a; })(), /no criterion_id/],
  ];
  for (const [label, result, message] of bad) assert.throws(() => evaluate(result), message, label);
});

test('AC-9: a position without criteria cannot be scored', () => {
  assert.throws(() => evaluate({ criteria: [], summary: 'x' }, { criteria: [] }), /the position has no criteria/);
});

test('AC-9: scores 0 and 10 are valid, decimals are kept', () => {
  assert.equal(evaluate(answer([0, 0, 0])).overall_score, 0);
  assert.equal(evaluate(answer([10, 10, 10])).overall_score, 100);
  assert.equal(JSON.parse(evaluate(answer([7.5, 8, 7])).criteria_scores)[0].score, 7.5);
});

test('AC-9/AC-10: estimated level and years', () => {
  const ok = evaluate(answer([9, 8, 7]));
  assert.equal(ok.estimated_level, 'MIDDLE');
  assert.equal(ok.estimated_years_experience, 3.5); // rounded to 1 decimal (numeric(4,1))
  assert.equal(evaluate(answer([9, 8, 7], { estimated_level: 'GURU' })).estimated_level, null); // not a level → NULL, no error
  assert.equal(evaluate(answer([9, 8, 7], { estimated_level: undefined })).estimated_level, null);
  assert.equal(evaluate(answer([9, 8, 7], { estimated_years_experience: 'a lot' })).estimated_years_experience, null);
  assert.equal(evaluate(answer([9, 8, 7], { estimated_years_experience: -2 })).estimated_years_experience, null);
});

test('D12: the estimated level / years do not change the recommendation', () => {
  const base = evaluate(answer([9, 8, 7]));
  const other = evaluate(answer([9, 8, 7], { estimated_level: 'INTERN', estimated_years_experience: 0 }));
  assert.equal(other.recommendation, base.recommendation);
  assert.equal(other.overall_score, base.overall_score);
});

test('AC-10: the item handed to the save query', () => {
  const out = evaluate(answer([9, 8, 7]));
  assert.equal(out.application_id, 'app-1');
  assert.equal(out.model, 'claude-sonnet-5-5');
  assert.equal(out.prompt_version, 'v1');
  assert.equal(out.summary, 'Tóm tắt');
  assert.deepEqual(JSON.parse(out.strengths), ['mạnh']);
  assert.deepEqual(JSON.parse(out.weaknesses), ['yếu']);
  assert.equal(typeof out.criteria_scores, 'string'); // sent as jsonb text
});

test('AC-10: blank strengths / weaknesses are dropped, non-lists become empty', () => {
  const out = evaluate(answer([9, 8, 7], { strengths: ['a', '  ', 3], weaknesses: 'not a list' }));
  assert.deepEqual(JSON.parse(out.strengths), ['a']);
  assert.deepEqual(JSON.parse(out.weaknesses), []);
});
