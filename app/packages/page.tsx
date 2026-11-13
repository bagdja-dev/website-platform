import { redirect } from 'next/navigation';

import { getPlatformAccess } from '@/lib/platform-access';
import { getSessionToken } from '@/lib/session';
import { PlatformShell } from '../platform-shell';
import { PackageManager } from './package-manager';

export default async function PackagesPage() {
  const token = await getSessionToken();
  if (!token) redirect('/');
  const access = await getPlatformAccess(token);
  if (access.role !== 'reviewer' && access.role !== 'super_admin') redirect('/');

  return (
    <PlatformShell
      account={access.account}
      organizationName={access.organizationName}
      role={access.role}
      section="packages"
      title="Paket Template"
    >
      <PackageManager />
    </PlatformShell>
  );
}
