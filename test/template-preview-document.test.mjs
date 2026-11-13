import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPreviewDocument } from '../lib/template-preview-document.ts';

test('runs template JavaScript behind a no-network CSP and a navigation guard', () => {
  const doc = buildPreviewDocument('<main>Kumpul</main>', 'window.x = "</script><script>alert(1)</script>";', true);
  assert.match(doc, /Content-Security-Policy" content="[^"]*connect-src 'none'/);
  assert.match(doc, /form-action 'none'/);
  assert.match(doc, /worker-src 'none'/);
  const guardAt = doc.indexOf("closest('a[href], [data-bagdja-intent], [data-bagdja-action]')");
  const clientAt = doc.indexOf('window.x');
  assert.ok(guardAt > 0 && clientAt > guardAt, 'guard runs before template script');
  assert.doesNotMatch(doc.slice(clientAt), /<\/script><script>alert/);
  assert.match(doc, /<main>Kumpul<\/main>/);
});

test('renders without any script when JavaScript is switched off', () => {
  const doc = buildPreviewDocument('<main>Kumpul</main>', 'window.x = 1;', false);
  assert.doesNotMatch(doc, /<script/);
});
