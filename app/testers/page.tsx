import { redirect } from 'next/navigation';

import { getPlatformAccess } from '@/lib/platform-access';
import { getSessionToken } from '@/lib/session';
import { PlatformShell } from '../platform-shell';
import { TesterManager } from './tester-manager';

/** Tim penguji designer (plan/website-builder/template-candidate-trial-plan.md §2.2). */
export default async function TestersPage() {
  const token = await getSessionToken();
  if (!token) redirect('/');
  const access = await getPlatformAccess(token);
  if (access.role !== 'designer') redirect('/');

  return (
    <PlatformShell account={access.account} organizationName={access.organizationName} role={access.role} section="testers" title="Tim penguji">
      <TesterManager />
    </PlatformShell>
  );
}
