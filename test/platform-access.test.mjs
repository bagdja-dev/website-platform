import assert from 'node:assert/strict';
import test from 'node:test';

import { hasOrganizationAdminRole } from '../lib/platform-access.mjs';

test('grants access to the owner of the configured app organization', () => {
  assert.equal(
    hasOrganizationAdminRole(
      [{ orgId: 'bagdja', role: { slug: 'owner' }, isActive: true }],
      'bagdja',
    ),
    true,
  );
});

test('grants access to an admin of the configured app organization', () => {
  assert.equal(
    hasOrganizationAdminRole(
      [{ orgId: 'bagdja', role: { slug: 'admin' }, isActive: true }],
      'bagdja',
    ),
    true,
  );
});

test('does not grant access based on a role in a different organization', () => {
  assert.equal(
    hasOrganizationAdminRole(
      [{ orgId: 'another-org', role: { slug: 'owner' }, isActive: true }],
      'bagdja',
    ),
    false,
  );
});

test('does not grant access to ordinary members or missing organization data', () => {
  assert.equal(
    hasOrganizationAdminRole(
      [{ orgId: 'bagdja', role: { slug: 'designer' }, isActive: true }],
      'bagdja',
    ),
    false,
  );
  assert.equal(hasOrganizationAdminRole([], 'bagdja'), false);
  assert.equal(hasOrganizationAdminRole(null, 'bagdja'), false);
  assert.equal(hasOrganizationAdminRole([], ''), false);
});

test('does not grant access when the owner organization membership is inactive', () => {
  assert.equal(
    hasOrganizationAdminRole(
      [{ orgId: 'bagdja', role: { slug: 'owner' }, isActive: false }],
      'bagdja',
    ),
    false,
  );
});
