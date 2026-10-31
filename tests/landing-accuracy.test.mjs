import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const landing = read('../index.html');
const commerce = read('../assets/js/langblue-commerce.js');
const eventScript = read('../assets/js/langblue-landing-events.js');

test('landing and checkout expose all seven active products', () => {
  assert.equal((landing.match(/<article class="product-card"/g) || []).length, 7);
  assert.equal((landing.match(/<input type="checkbox" value="/g) || []).length, 7);
  const ids = commerce.match(/var ALL_PRODUCT_IDS=\[([^\]]+)\]/)?.[1] || '';
  assert.equal(ids.split(',').length, 7);
  assert.match(landing, /اگر هر ۷ محصول را یک‌جا با مدت ۱۲ ماهه انتخاب کنی/);
});

test('the landing page provides one clear first step and a learning path', () => {
  assert.match(landing, /href="#products">انتخاب زبان و شروع یادگیری/);
  assert.match(landing, /id="learning-path"/);
  assert.match(landing, /نقشهٔ مسیر یادگیری \(Curriculum\)/);
  assert.match(landing, /تعیین سطح یکپارچه برای همهٔ زبان‌ها هنوز فراهم نیست/);
});

test('public vocabulary statistics describe the actual source', () => {
  assert.match(landing, /واژگان بانک تمرین/);
  assert.match(landing, /واژه‌های شخصی کاربران در آن محاسبه نمی‌شوند/);
});

test('festival banner matches the actual annual-plan discount calculation', () => {
  assert.match(eventScript, /shared\.discount\/2/);
  assert.match(eventScript, /اشتراک ۱۲ماههٔ محصولات LangBlue/);
  assert.doesNotMatch(eventScript, /هر سه محصول/);
});
