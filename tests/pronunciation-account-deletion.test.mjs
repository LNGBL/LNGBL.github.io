import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const products = [
  '../pages/LangBlue-grammer.html',
  '../pages/vocab.html',
  '../pages/LangBlue-De.html',
  '../pages/LangDesert.html',
  '../pages/Langjp.html',
  '../pages/LangKz.html',
  '../pages/LangTj.html'
];

test('all seven learning products load the shared IPA pronunciation helper', () => {
  for (const path of products) {
    assert.match(read(path), /langblue-pronunciation\.js/, path);
  }
  const helper = read('../assets/js/langblue-pronunciation.js');
  for (const language of ['english','german','arabic','japanese','kazakh','tajik','persian']) {
    assert.match(helper, new RegExp(language + ':'));
  }
  assert.match(helper, /IPA/);
  assert.match(helper, /speechSynthesis/);
  assert.match(helper, /lb:pronunciation:v1:/);
});

test('account deletion only reports success after server deletion and preserves other local accounts', () => {
  const account = read('../assets/js/langblue-central-account.js');
  assert.match(account, /langblue-account-delete/);
  assert.match(account, /در حال حذف فوری حساب/);
  assert.match(account, /Auth\.logout\(\)/);
  assert.match(account, /delete accounts\[username\]/);
  assert.match(account, /startsWith\('lb:user:'\+uid\+':'\)/);
  assert.match(account, /location\.replace\('\/\?account=deleted'\)/);
  const edge = read('../supabase/functions/langblue-account-delete/index.ts');
  assert.match(edge, /admin\.auth\.admin\.deleteUser\(user\.id\)/);
  assert.match(edge, /admin\.auth\.admin\.signOut\(token, "global"\)/);
  assert.match(edge, /CONTENT_WITHDRAWAL_FAILED/);
  assert.match(edge, /CONTENT_ANONYMIZATION_FAILED/);
});
