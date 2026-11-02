import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../pages/WesternGame.html');
const game = read('../assets/js/western-game.js');
const bridge = read('../assets/js/langblue-western-learning-bridge.js');
const migration = read('../supabase/migrations/20261102130000_western_access_and_learning_sync.sql');
const landing = read('../index.html');
const commerce = read('../assets/js/langblue-commerce.js');

test('Wild West is a standalone page with separate assets and existing learning engine bridge', () => {
  assert.match(page, /\.\.\/assets\/css\/western-game\.css/);
  assert.match(page, /\.\.\/assets\/js\/western-game\.js/);
  assert.match(page, /langblue-grammar-engine\.js/);
  assert.match(page, /langblue-western-learning-bridge\.js/);
});

test('game loads only the signed-in player vocabulary through server RPCs', () => {
  assert.match(game, /western_get_stage_pack/);
  assert.match(game, /western_start_challenge/);
  assert.match(game, /western_submit_challenge/);
  assert.doesNotMatch(game, /from\(['"]android_content_items['"]\)/);
  assert.match(page, /15 PERSONAL \+ 15 FRONTIER WORDS/);
});

test('mission outcomes feed existing personal vocabulary and grammar review engines', () => {
  assert.match(bridge, /LangBlue_srs_data/);
  assert.match(bridge, /LangBlue_repetition_data/);
  assert.match(bridge, /LangBlueGrammarEngine/);
  assert.match(bridge, /item\.source!=='personal'/);
  assert.match(game, /recordVocabularyOutcome/);
  assert.match(game, /recordGrammarOutcome/);
});

test('Wild West access inherits both English products without becoming a paid product', () => {
  assert.match(migration, /array\['grammar','vocabulary'\]::text\[\]/);
  assert.match(migration, /active = false where id = 'western'/);
  assert.doesNotMatch(commerce, /western:/);
  const ids = commerce.match(/var ALL_PRODUCT_IDS=\[([^\]]+)\]/)?.[1] || '';
  assert.equal(ids.split(',').length, 7);
});

test('landing page contains one independent link to the game outside product cards', () => {
  assert.match(landing, /id="wild-west"/);
  assert.equal((landing.match(/href="pages\/WesternGame\.html"/g)||[]).length, 1);
  assert.equal((landing.match(/<article class="product-card"/g)||[]).length, 7);
});

test('game scripts parse as JavaScript', () => {
  assert.doesNotThrow(() => new Function(game));
  assert.doesNotThrow(() => new Function(bridge));
});
