import { redirect } from 'next/navigation';

import { InvitationAcceptance } from './invitation-acceptance';
import { getSessionToken } from '@/lib/session';

type InvitationRegistrationStatus = {
  registered: boolean;
  email: string;
};

type InvitationPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function InvitationPage({
  searchParams,
}: InvitationPageProps) {
  const [{ token }, sessionToken] = await Promise.all([
    searchParams,
    getSessionToken(),
  ]);
  if (!token || token.length > 200) redirect('/');
  if (!sessionToken) {
    const apiUrl =
      process.env.BAGDJA_WEBSITE_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:5003';
    let statusResponse: Response;
    try {
      statusResponse = await fetch(
        new URL(
          '/api/website-platform/invitations/registration-status',
          apiUrl,
        ),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        },
      );
    } catch (error) {
      console.error('Could not verify invitation account status:', error);
      return (
        <main className="status-page">
          <h1>Tidak dapat memeriksa undangan</h1>
          <p>Silakan coba lagi beberapa saat lagi.</p>
        </main>
      );
    }

    if (statusResponse.status === 404) {
      return (
        <main className="status-page">
          <h1>Undangan tidak dapat digunakan</h1>
          <p>
            Tautan undangan tidak valid, sudah kedaluwarsa, atau sudah digunakan.
          </p>
        </main>
      );
    }
    if (!statusResponse.ok) {
      console.error(
        `Invitation account status request returned ${statusResponse.status}`,
      );
      return (
        <main className="status-page">
          <h1>Tidak dapat memeriksa undangan</h1>
          <p>Silakan coba lagi beberapa saat lagi.</p>
        </main>
      );
    }

    let status: InvitationRegistrationStatus;
    try {
      status = (await statusResponse.json()) as InvitationRegistrationStatus;
    } catch (error) {
      console.error('Could not read invitation account status:', error);
      return (
        <main className="status-page">
          <h1>Tidak dapat memeriksa undangan</h1>
          <p>Silakan coba lagi beberapa saat lagi.</p>
        </main>
      );
    }
    if (
      typeof status.registered !== 'boolean' ||
      typeof status.email !== 'string'
    ) {
      console.error('Invitation account status response had an invalid shape');
      return (
        <main className="status-page">
          <h1>Tidak dapat memeriksa undangan</h1>
          <p>Silakan coba lagi beberapa saat lagi.</p>
        </main>
      );
    }

    const nextPath = `/invite/accept?token=${encodeURIComponent(token)}`;
    const authPath = status.registered ? '/auth/login' : '/auth/register';
    const authParams = new URLSearchParams({
      next: nextPath,
      email: status.email,
    });
    if (!status.registered) {
      authParams.set('verification_mode', 'otp');
    }
    redirect(`${authPath}?${authParams.toString()}`);
  }
  return (
    <main className="status-page">
      <InvitationAcceptance token={token} />
    </main>
  );
}
