// Run with: node --test src/utils/safeHtml.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, safeHtml } from './safeHtml.js';

test('escapeHtml neutralises markup and attribute breakouts', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml('"><img src=x onerror=1>'), '&quot;&gt;&lt;img src=x onerror=1&gt;');
  assert.equal(escapeHtml("' onfocus='x"), '&#39; onfocus=&#39;x');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});

test('safeHtml keeps simple formatting tags', () => {
  assert.equal(safeHtml('a<br/>b<br>c<BR />d'), 'a<br>b<br>c<br>d');
  assert.equal(safeHtml('<b>x</b> <small>y</small> <strong>z</strong>'), '<b>x</b> <small>y</small> <strong>z</strong>');
});

test('safeHtml blocks tags with attributes and everything else', () => {
  for (const evil of [
    '<img src=x onerror=alert(1)>',
    '<b onclick="x()">hi</b>',
    '<script>alert(1)</script>',
    '<svg/onload=alert(1)>',
    '<a href="javascript:alert(1)">x</a>',
    '<iframe src=//evil></iframe>',
  ]) {
    const out = safeHtml(evil);
    assert.ok(!/<(img|script|svg|a|iframe)\b/i.test(out), out);
    assert.ok(!/<b\s[^>]*on/i.test(out), out);
  }
});

test('plain text with ampersands and quotes survives', () => {
  assert.equal(safeHtml('Smith & Sons "North" parcel'), 'Smith &amp; Sons &quot;North&quot; parcel');
});
