import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('LangKz page module parses', () => {
  const html = fs.readFileSync('pages/LangKz.html', 'utf8');
  const match = html.match(/<script type="module">([\\s\\S]*?)<\\/script>/);
  assert.ok(match, 'module script exists');
  const source = match[1].replace(/^\\s*import\\s+\\{\\s*KzHarmony\\s*\\}\\s+from\\s+['"][^'"]+['"];?\\s*/, '');
  assert.doesNotThrow(() => new Function('KzHarmony', source));
});
