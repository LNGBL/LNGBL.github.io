import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const client = read('../assets/js/supabase-client.js');
const grammar = read('../assets/js/langblue-grammar-engine.js');
const vocab = read('../pages/vocab.html');
const deutsch = read('../pages/LangBlue-De.html');
const arabic = read('../assets/js/langdesert-bridge.js');
const japanese = read('../pages/Langjp.html');
const kazakh = read('../pages/LangKz.html');
const tajik = read('../pages/LangTj.html');
const learning = read('../pages/learning-engine.html');

test('Supabase user_state patch writes are serialized and preserve unrelated product keys', () => {
  assert.match(client, /let userStateWriteQueue=Promise\.resolve\(\)/);
  assert.match(client, /async function mergeUserState\(patch\)/);
  assert.match(client, /Object\.assign\(\{\},current&&current\.state\|\|\{},patch\|\|\{\}\)/);
  assert.match(client, /getUserState,saveUserState,mergeUserState/);
});

test('all seven product SRS implementations synchronize through product-scoped state', () => {
  assert.match(grammar, /mergeUserState\(\{\[KEY\]:all\(\)\}\)/);
  assert.match(vocab, /srs_vocabulary_v2/);
  assert.match(vocab, /SRS\.syncRemote\(\)/);
  assert.match(deutsch, /srs_deutsch_v2/);
  assert.match(deutsch, /DeutschSRS\.syncRemote/);
  assert.match(arabic, /mergeUserState\(\{langDesert:payload\}\)/);
  assert.match(japanese, /mergeUserState\(\{langjp:payload\}\)/);
  assert.match(kazakh, /mergeUserState\(\{\[PRODUCT_ID\]:payload\}\)/);
  assert.match(tajik, /mergeUserState\(\{\[PRODUCT\]:state\}\)/);
});

test('manual learning list never globally deletes product-owned SRS rows', () => {
  assert.match(learning, /Deliberately no global stale-row cleanup/);
  assert.doesNotMatch(learning, /from\('learning_review_items'\)\.delete\(\)\.eq\('user_id',user\.id\)\.neq\('product_id'/);
});
