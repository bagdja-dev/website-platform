import { redirect } from "next/navigation";

import { AccessInbox } from "../access-inbox";
import { getPlatformAccess } from "@/lib/platform-access";
import { getSessionToken } from "@/lib/session";
import { PlatformShell } from "../platform-shell";

type InboxPageProps = {
  searchParams: Promise<{ requestId?: string; submissionId?: string }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const token = await getSessionToken();
  if (!token) redirect("/auth/login?next=%2Finbox");
  const access = await getPlatformAccess(token);
  if (
    access.role !== "super_admin" &&
    access.role !== "reviewer" &&
    access.role !== "designer"
  ) {
    redirect("/");
  }
  const { requestId, submissionId } = await searchParams;

  return (
    <PlatformShell
      organizationName={access.organizationName}
      role={access.role}
      section="inbox"
      title="Inbox"
    >
      <AccessInbox
        role={access.role}
        selectedRequestId={requestId}
        selectedSubmissionId={submissionId}
      />
    </PlatformShell>
  );
}
