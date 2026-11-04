import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const landing = read('../index.html');
const commerce = read('../assets/js/langblue-commerce.js');

test('landing and checkout expose all seven active products', () => {
  assert.equal((landing.match(/<article class="product-card"/g) || []).length, 7);
  assert.equal((landing.match(/<input type="checkbox" value="/g) || []).length, 8);
  const ids = commerce.match(/var ALL_PRODUCT_IDS=\[([^\]]+)\]/)?.[1] || '';
  assert.equal(ids.split(',').length, 7);
  assert.match(landing, /اگر هر ۷ محصول فعال را یک‌جا با مدت ۱۲ ماهه انتخاب کنی/);
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

test('landing page contains no push-notification or occasion-banner UI', () => {
  assert.doesNotMatch(landing, /enableNotifications|enableCeremonies|notificationControl|ceremonyControl|occasionBanner/);
  assert.doesNotMatch(landing, /langblue-notifications\.js|langblue-landing-events\.js/);
});
