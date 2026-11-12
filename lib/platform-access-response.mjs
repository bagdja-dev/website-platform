export function isOrganizationAdminAccess(value) {
  if (!value || typeof value !== "object") return false;
  const access = value;
  return (
    typeof access.allowed === "boolean" &&
    typeof access.organizationName === "string" &&
    (access.role === null ||
      access.role === "super_admin" ||
      access.role === "designer" ||
      access.role === "reviewer" ||
      access.role === "applicant") &&
    (!access.allowed || access.role !== null)
  );
}
