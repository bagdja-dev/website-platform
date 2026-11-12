import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSessionToken } from '@/lib/session';
import { AccessRequestForm } from './access-request-form';

export default async function AccessRequestPage() {
  const token = await getSessionToken();
  if (!token) {
    redirect('/auth/login?next=%2Fapply');
  }

  return (
    <main className="status-page">
      <section className="status-card application-status-card">
        <Link className="back-link" href="/">← Kembali ke portal</Link>
        <AccessRequestForm />
      </section>
    </main>
  );
}
