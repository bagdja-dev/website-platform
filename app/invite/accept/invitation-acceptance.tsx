'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function InvitationAcceptance({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/platform/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.message === 'string'
            ? result.message
            : 'Undangan belum dapat diterima.',
        );
      }
      router.push('/');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Undangan belum dapat diterima.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="status-card">
      <h1>Terima undangan Website Platform</h1>
      <p>
        Pastikan kamu masuk dengan akun Bagdja yang emailnya sama dengan email
        tujuan undangan.
      </p>
      <button className="primary-link" disabled={busy} onClick={() => void accept()}>
        {busy ? 'Memproses…' : 'Terima undangan'}
      </button>
      {message ? <p className="form-message error" role="alert">{message}</p> : null}
    </section>
  );
}
