const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('public/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('page script parses', () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

test('Pojok is the only floating-chat trigger; no in-tab compact panel remains', () => {
  assert.match(html, /id="compactToggle"/);
  assert.doesNotMatch(html, /body\.compact/);
  assert.doesNotMatch(html, /compactHandle|floatInTab|applyCompactMode|chatCompactMode|id="compactPip"/);
  assert.match(script, /compactToggle'\)\.addEventListener\('click', \(\) => \{ if \(pipOpen\(\)\) pipWindow\.close\(\); else openChatWindow\(\); \}\);/);
});

test('Pojok uses Document PiP when available and a pop-up window otherwise', () => {
  assert.match(script, /documentPictureInPicture\.requestWindow/);
  assert.match(script, /window\.open\('', 'chatPojok'/);
});

test('the chat panel moves into the floating window and is restored when it closes', () => {
  assert.match(script, /doc\.body\.appendChild\(main\)/);
  assert.match(script, /win\.addEventListener\('pagehide', restore/);
  assert.match(script, /placeholder\.parentNode\.replaceChild\(main, placeholder\)/);
});

test('element lookups also work while the chat lives in the floating window', () => {
  assert.match(script, /pipOpen\(\) \? pipWindow\.document\.getElementById\(id\)/);
  assert.match(html, /id="pipNote"/);
});

test('font size can go down to 6px and the floating window follows it', () => {
  assert.match(html, /id="setSize" min="6" max="24"/);
  assert.match(script, /doc\.body\.style\.fontSize = settings\.size \+ 'px'/);
});
