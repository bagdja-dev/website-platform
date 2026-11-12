export type PlatformAccessResponse = {
  allowed: boolean;
  role: "super_admin" | "designer" | "reviewer" | "applicant" | null;
  organizationName: string;
};

export function isOrganizationAdminAccess(
  value: unknown,
): value is PlatformAccessResponse;
