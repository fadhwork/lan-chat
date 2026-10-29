const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('public/index.html', 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const style = css.match(/body\.compact #main \{([^}]*)\}/)[1];

test('compact chat is a fixed, viewport-overlay panel above page content', () => {
  assert.match(style, /position:\s*fixed/);
  assert.match(style, /z-index:\s*(\d+)/);
  assert.ok(Number(style.match(/z-index:\s*(\d+)/)[1]) > 1000);
});

test('client script parses', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
});