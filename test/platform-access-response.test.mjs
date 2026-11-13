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
        account: {
          displayName: "nandanghermawan",
          email: "nandang@example.com",
          profilePicture: "https://example.com/avatar.png",
        },
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
  assert.equal(
    isOrganizationAdminAccess({
      allowed: true,
      role: "designer",
      organizationName: "Bagdja",
      account: {
        displayName: "Designer",
        email: "nandang@example.com",
        profilePicture: 123,
      },
    }),
    false,
  );
});
