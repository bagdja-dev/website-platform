/**
 * Organization roles allowed to administer the initial Website Platform.
 * The role data comes from the authenticated Bagdja Auth organizations API.
 */
export function hasOrganizationAdminRole(organizations, ownerOrganizationSlug) {
  if (!Array.isArray(organizations) || !ownerOrganizationSlug) return false;

  return organizations.some((organization) => {
    if (
      organization?.orgId !== ownerOrganizationSlug ||
      organization?.isActive !== true
    ) {
      return false;
    }
    const role = organization?.role?.slug;
    return role === 'owner' || role === 'admin';
  });
}
