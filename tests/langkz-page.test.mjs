import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('LangKz page module parses', () => {
  const html = fs.readFileSync('pages/LangKz.html', 'utf8');
  const startTag = '<script type="module">';
  const start = html.indexOf(startTag);
  const end = html.indexOf('</script>', start);
  assert.ok(start >= 0 && end > start, 'module script exists');
  const moduleSource = html.slice(start + startTag.length, end);
  const importStart = moduleSource.indexOf('import ');
  const importEnd = moduleSource.indexOf('\n', importStart);
  assert.ok(importStart >= 0 && importEnd > importStart, 'module import exists');
  const source = moduleSource.slice(0, importStart) + moduleSource.slice(importEnd + 1);
  assert.doesNotThrow(() => new Function('KzHarmony', source));
});
