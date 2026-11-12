import { redirect } from 'next/navigation';

import { getPlatformAccess } from '@/lib/platform-access';
import { getSessionToken } from '@/lib/session';
import { PlatformShell } from '../platform-shell';
import { TemplateWorkspace } from './template-workspace';

type TemplatesPageProps = {
  searchParams: Promise<{ submissionId?: string }>;
};

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const token = await getSessionToken();
  if (!token) redirect('/');
  const access = await getPlatformAccess(token);
  if (
    access.role !== 'designer' &&
    access.role !== 'reviewer' &&
    access.role !== 'super_admin'
  ) {
    redirect('/');
  }

  return (
    <PlatformShell
      organizationName={access.organizationName}
      role={access.role}
      section="templates"
      title={access.role === 'designer' ? 'Template saya' : 'Template & review'}
    >
      <TemplateWorkspace initialSubmissionId={(await searchParams).submissionId} role={access.role} />
    </PlatformShell>
  );
}
