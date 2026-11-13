import { redirect } from 'next/navigation';

import { getPlatformAccess } from '@/lib/platform-access';
import { getSessionToken } from '@/lib/session';
import { PlatformShell } from '../../../platform-shell';
import { AccessRequestDetail } from './request-detail';

type AccessRequestDetailPageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function AccessRequestDetailPage({
  params,
}: AccessRequestDetailPageProps) {
  const token = await getSessionToken();
  if (!token) redirect('/');
  const access = await getPlatformAccess(token);
  if (access.role !== 'super_admin') redirect('/');
  const { requestId } = await params;

  return (
    <PlatformShell
      account={access.account}
      organizationName={access.organizationName}
      role="super_admin"
      section="access"
      title="Detail permohonan"
    >
      <AccessRequestDetail requestId={requestId} />
    </PlatformShell>
  );
}
