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

test('PIP opens a supported PiP window with live main UI and restore handler', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
  assert.match(html, /id="compactPip"/);
  assert.match(html, /documentPictureInPicture\.requestWindow/);
  assert.match(html, /pip\.document\.body\.appendChild\(main\)/);
  assert.match(html, /pip\.document\.getElementById\('compactPip'\)/);
  assert.match(html, /pip\.addEventListener\('pagehide'/);
});

test('compact mode exposes native PiP and restores the page DOM on close', () => {
  assert.match(html, /id="compactPip"/);
  assert.match(html, /documentPictureInPicture\.requestWindow/);
  assert.match(html, /pip\.addEventListener\('pagehide'/);
  assert.match(html, /placeholder\.parentNode\.replaceChild\(main, placeholder\)/);
});