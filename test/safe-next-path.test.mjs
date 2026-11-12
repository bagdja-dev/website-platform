import assert from 'node:assert/strict';
import test from 'node:test';

import { getSafeNextPath } from '../lib/safe-next-path.mjs';

const origin = 'https://platform.example.test';

test('keeps a safe same-origin path and query', () => {
  assert.equal(
    getSafeNextPath('/review/queue?status=pending', origin),
    '/review/queue?status=pending',
  );
});

test('rejects protocol-relative and backslash-based external redirects', () => {
  assert.equal(getSafeNextPath('//attacker.example', origin), null);
  assert.equal(getSafeNextPath('/\\\\attacker.example', origin), null);
});

test('rejects non-path and malformed redirect values', () => {
  assert.equal(getSafeNextPath('https://attacker.example', origin), null);
  assert.equal(getSafeNextPath(null, origin), null);
});
