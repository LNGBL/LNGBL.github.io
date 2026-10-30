import test from 'node:test';
import assert from 'node:assert/strict';
import { KzHarmony } from '../assets/js/langblue-kz-harmony.js';

test('back voiceless plural: kitap -> kitapтар', () => {
  assert.equal(KzHarmony.pluralSuffix('кітап'), 'тар');
});
test('front voiceless plural: mektep -> mekteптер', () => {
  assert.equal(KzHarmony.pluralSuffix('мектеп'), 'тер');
});
test('back vowel plural: бала -> балалар', () => {
  assert.equal(KzHarmony.pluralSuffix('бала'), 'лар');
});
test('front vowel plural: үй -> үйлер', () => {
  assert.equal(KzHarmony.pluralSuffix('үй'), 'лер');
});
test('voiced consonant plural: қыз -> қыздар', () => {
  assert.equal(KzHarmony.pluralSuffix('қыз'), 'дар');
});
test('nasal consonant plural: адам -> адамдар', () => {
  assert.equal(KzHarmony.pluralSuffix('адам'), 'дар');
});
test('plural + first person + locative: кітаптарымда', () => {
  assert.equal(KzHarmony.inflect('кітап', {plural:true, possessive:'1sg', caseName:'locative'}).form, 'кітаптарымда');
});
test('plural + locative: үйлерде', () => {
  assert.equal(KzHarmony.inflect('үй', {plural:true, caseName:'locative'}).form, 'үйлерде');
});
test('genitive: баланың', () => {
  assert.equal(KzHarmony.caseSuffix('бала', 'genitive'), 'ның');
});
test('dative: мектепке', () => {
  assert.equal(KzHarmony.caseSuffix('мектеп', 'dative'), 'ке');
});
test('accusative: кітапты', () => {
  assert.equal(KzHarmony.caseSuffix('кітап', 'accusative'), 'ты');
});
test('locative: қалада', () => {
  assert.equal(KzHarmony.caseSuffix('қала', 'locative'), 'да');
});
test('ablative: қаладан', () => {
  assert.equal(KzHarmony.caseSuffix('қала', 'ablative'), 'дан');
});
test('instrumental after voiceless consonant: кітаппен', () => {
  assert.equal(KzHarmony.caseSuffix('кітап', 'instrumental'), 'пен');
});
test('front harmony uses front vowels', () => {
  assert.equal(KzHarmony.harmonyOf('мектеп'), 'front');
});
test('back harmony uses back vowels', () => {
  assert.equal(KzHarmony.harmonyOf('қала'), 'back');
});
test('empty root returns empty form safely', () => {
  assert.equal(KzHarmony.inflect('').form, '');
});
test('first person possessive after vowel: балам', () => {
  assert.equal(KzHarmony.inflect('бала', {possessive:'1sg'}).form, 'балам');
});
test('third person possessive after consonant: кітабы', () => {
  assert.equal(KzHarmony.inflect('кітап', {possessive:'3sg'}).form, 'кітабы');
});
test('second person possessive after consonant: кітабың', () => {
  assert.equal(KzHarmony.inflect('кітап', {possessive:'2sg'}).form, 'кітапың');
});
test('third person possessive voices final p: кітабы', () => {
  assert.equal(KzHarmony.inflect('кітап', {possessive:'3sg'}).form, 'кітабы');
});
test('suffix chain remains ordered', () => {
  assert.deepEqual(KzHarmony.inflect('кітап', {plural:true, possessive:'1sg', caseName:'locative'}).chain, ['тар','ым','да']);
});
