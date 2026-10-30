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

const server = fs.readFileSync('server.js', 'utf8');

test('floating window: no Tutup/sound buttons; delete is a symbol button; Pojok hidden inside the window', () => {
  assert.doesNotMatch(html, /id="sound"/);
  assert.doesNotMatch(script, /'Tutup'/);
  assert.match(html, /id="compactClear"[^>]*class="ghost"[^>]*>🗑️<\/button>/);
  assert.match(script, /#gear,#compactToggle\{display:none!important\}/);
  assert.match(html, /id="setSound"/);
});

test('admin can change how long messages stay after being read', () => {
  assert.match(script, /type: 'setDuration'/);
  assert.match(server, /m\.type === 'setDuration'/);
  assert.match(server, /if \(!ws\.isAdmin\) return;\n      const sec = /);
  assert.doesNotMatch(server, /SECONDS_PER_MESSAGE/);
});

test('no System messages in the chat', () => {
  assert.doesNotMatch(server, /user: 'System'/);
  assert.doesNotMatch(server, /'system'/);
  assert.doesNotMatch(script, /'System'/);
});
