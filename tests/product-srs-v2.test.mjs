import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const grammar = read('../assets/js/langblue-grammar-engine.js');
const vocab = read('../pages/vocab.html');
const deutsch = read('../pages/LangBlue-De.html');
const arabic = read('../pages/LangDesert.html');
const japanese = read('../pages/Langjp.html');
const kazakh = read('../pages/LangKz.html');
const tajik = read('../assets/js/langblue-tj-srs.js');

test('Grammar SRS models stability, difficulty and retrievability', () => {
  assert.match(grammar, /stabilityHours/);
  assert.match(grammar, /difficulty/);
  assert.match(grammar, /retrievability/);
  assert.match(grammar, /const pool=dueItems/);
});

test('Vocabulary SRS uses elapsed-time scheduling and strict due queues', () => {
  assert.match(vocab, /stabilityHours/);
  assert.match(vocab, /nextReview=now\+old\.intervalHours\*3600000/);
  assert.match(vocab, /getDueWords:function\(words\)/);
  assert.match(vocab, /Number\(x\.nextReview\|\|0\)<=now/);
  assert.match(vocab, /MAX_SAFE_INTEGER\/2/);
  assert.match(vocab, /x\.interval==='every_2_visits'/);
  assert.doesNotMatch(vocab, /var exploratory = AdaptiveBrain\.rank/);
});

test('Deutsch SRS gates normal and Sextant questions by due time and backs up state', () => {
  assert.match(deutsch, /DeutschSRS\.due\(w\.id,now\)/);
  assert.match(deutsch, /DeutschSRS\.review\(q\.correctId,ok,_state\.mode\)/);
  assert.match(deutsch, /srs:DeutschSRS\.all\(\)/);
});

test('Arabic SRS schedules morphology-sensitive reviews', () => {
  assert.match(arabic, /word\.srs=s/);
  assert.match(arabic, /morphLoad/);
  assert.match(arabic, /nextReviewAt/);
  assert.match(arabic, /Number\(w\.srs\?\.nextReviewAt/);
});

test('Japanese SRS uses nextReviewAt and does not pull early reviews', () => {
  assert.match(japanese, /return Number\(w\.nextReviewAt\|\|0\)<=t/);
  assert.match(japanese, /w\.stabilityHours/);
  assert.doesNotMatch(japanese, /function evaluateWeeklyResult/);
  assert.doesNotMatch(japanese, /nextFlash\(remaining\[0\], words\)/);
});

test('Kazakh SRS uses due filtering and task-specific mode weights', () => {
  assert.match(kazakh, /\)&&due\(x\)/);
  assert.match(kazakh, /modeWeight/);
  assert.match(kazakh, /Number\(s\.intervalHours\)\|\|intervals/);
});

test('Tajik SRS has independent stability-based relearning', async () => {
  globalThis.window = {};
  const { TjSrs } = await import('../assets/js/langblue-tj-srs.js');
  const item = { srs: { stage: 3, totalCorrect: 3, totalWrong: 0, intervalHours: 72, stabilityHours: 72 } };
  TjSrs.apply(item, false, 'audio');
  assert.equal(item.srs.stage, 1);
  assert.ok(item.srs.nextReviewAt > Date.now());
  assert.ok(item.srs.intervalHours > 0);
  const stage = item.srs.stage;
  TjSrs.apply(item, true, 'word');
  assert.equal(item.srs.stage, stage + 1);
});
