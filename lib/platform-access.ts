import { isOrganizationAdminAccess } from "./platform-access-response.mjs";

export type PlatformAccount = {
  displayName: string;
  email: string | null;
  profilePicture: string | null;
};

type PlatformAccess = {
  allowed: boolean;
  role: "super_admin" | "designer" | "reviewer" | "applicant" | null;
  organizationName: string;
  account: PlatformAccount;
};

export async function getPlatformAccess(accessToken: string): Promise<{
  allowed: boolean;
  role: "super_admin" | "designer" | "reviewer" | "applicant" | null;
  organizationName: string;
  account: PlatformAccount;
}> {
  const apiUrl =
    process.env.BAGDJA_WEBSITE_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:5003";
  const response = await fetch(
    new URL("/api/website-platform/access", apiUrl),
    {
      headers: { Authorization: "Bearer " + accessToken },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Website Platform access check failed (${response.status})`,
    );
  }
  const payload: unknown = await response.json();
  if (!isOrganizationAdminAccess(payload)) {
    throw new Error("Website API returned an invalid platform access response");
  }
  const access = payload as Omit<PlatformAccess, "account"> & {
    account?: PlatformAccount;
  };
  return {
    ...access,
    account: access.account ?? {
      displayName: "Akun Bagdja",
      email: null,
      profilePicture: null,
    },
  };
}
