export function isOrganizationAdminAccess(value) {
  if (!value || typeof value !== "object") return false;
  const access = value;
  const account = access.account;
  return (
    typeof access.allowed === "boolean" &&
    typeof access.organizationName === "string" &&
    (account === undefined ||
      (account !== null &&
        typeof account === "object" &&
        typeof account.displayName === "string" &&
        (account.email === null || typeof account.email === "string") &&
        (account.profilePicture === null ||
          typeof account.profilePicture === "string"))) &&
    (access.role === null ||
      access.role === "super_admin" ||
      access.role === "designer" ||
      access.role === "reviewer" ||
      access.role === "applicant") &&
    (!access.allowed || access.role !== null)
  );
}
