import { redirect } from 'next/navigation';

import { AccessManagement } from './access-management';
import { getPlatformAccess } from '@/lib/platform-access';
import { getSessionToken } from '@/lib/session';
import { PlatformShell } from '../platform-shell';

export default async function AccessManagementPage() {
  const token = await getSessionToken();
  if (!token) redirect('/');
  const access = await getPlatformAccess(token);
  if (access.role !== 'super_admin') redirect('/');

  return (
    <PlatformShell
      organizationName={access.organizationName}
      role="super_admin"
      section="access"
      title="Akses & undangan"
    >
      <AccessManagement />
    </PlatformShell>
  );
}
