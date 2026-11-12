import assert from "node:assert/strict";
import test from "node:test";

import { isOrganizationAdminAccess } from "../lib/platform-access-response.mjs";

test("accepts super admin, designer, reviewer, and applicant access responses", () => {
  for (const role of ["super_admin", "designer", "reviewer", "applicant"]) {
    assert.equal(
      isOrganizationAdminAccess({
        allowed: true,
        role,
        organizationName: "Bagdja",
      }),
      true,
    );
  }
});

test("accepts denied access but rejects malformed or contradictory responses", () => {
  assert.equal(
    isOrganizationAdminAccess({
      allowed: false,
      role: null,
      organizationName: "Bagdja",
    }),
    true,
  );
  assert.equal(isOrganizationAdminAccess(null), false);
  assert.equal(
    isOrganizationAdminAccess({
      allowed: true,
      role: "unknown",
      organizationName: "Bagdja",
    }),
    false,
  );
  assert.equal(
    isOrganizationAdminAccess({
      allowed: true,
      role: null,
      organizationName: "Bagdja",
    }),
    false,
  );
});
