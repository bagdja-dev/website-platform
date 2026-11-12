'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('Website Platform page failed:', error);
  }, [error]);

  return (
    <main className="status-page">
      <section className="status-card">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">B</div>
          <div className="brand-copy">
            <strong>Bagdja</strong>
            <span>Website Platform</span>
          </div>
        </div>
        <h1>Akses belum dapat diverifikasi</h1>
        <p>
          Bagdja Auth belum dapat mengonfirmasi sesi dan role organisasi. Tidak
          ada akses yang diberikan sampai verifikasi berhasil.
        </p>
        <div className="status-actions">
          <button className="primary-link" onClick={retry} type="button">
            Coba lagi
          </button>
          <form action="/auth/logout" method="post">
            <button className="secondary-link" type="submit">
              Keluar dan masuk kembali
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
