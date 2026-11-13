'use client';

import { useEffect, useState } from 'react';

import { postJson, requestJson } from '@/lib/template-submission';
import { tenantWebUrl } from '@/lib/tenant-url';

interface Tester {
  id: string;
  email: string;
  createdAt: string;
}

interface TrialWebsite {
  websiteName: string;
  websiteSlug: string;
  templateName: string;
  version: string;
  statusLabel: string;
}

interface TesterTeam {
  testers: Tester[];
  trialWebsites: TrialWebsite[];
  maxTesters: number;
}

const API = '/api/platform/templates/testers';

/**
 * Penguji = akun Bagdja yang ikut melihat & bertransaksi di versi uji template Anda (sebagai pembeli),
 * di website yang sedang menguji versi itu. Dikenali dari email login.
 */
export function TesterManager() {
  const [team, setTeam] = useState<TesterTeam | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    requestJson<TesterTeam>(API)
      .then((result) => {
        if (!cancelled) setTeam(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Tim penguji belum dapat dimuat.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(task: () => Promise<TesterTeam>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setTeam(await task());
      setNotice(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Permintaan belum dapat diproses.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    if (await run(() => postJson<TesterTeam>(API, { email: value }), `${value} ditambahkan ke tim penguji.`)) setEmail('');
  }

  const full = team ? team.testers.length >= team.maxTesters : false;

  return (
    <div className="content-card tester-manager">
      <section>
        <h2>Tim penguji</h2>
        <p className="muted-copy">
          Penguji membantu Anda mencoba alur pembeli — keranjang, pembayaran, gathering, dan chat — dengan versi uji
          template Anda. Mereka login dengan akun Bagdja ber-email di bawah, lalu membuka website yang sedang menguji
          versi Anda. Penguji tidak bisa memulai uji di website miliknya dan tidak bisa mereview.
        </p>
        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        {notice ? <p className="form-message" role="status">{notice}</p> : null}
        <form className="platform-form tester-form" onSubmit={(event) => void add(event)}>
          <label>
            Email akun Bagdja penguji
            <input
              type="email"
              required
              maxLength={320}
              value={email}
              disabled={busy || full}
              placeholder="penguji@contoh.com"
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
          </label>
          <button className="primary-link" type="submit" disabled={busy || full || !email.trim()}>
            {busy ? 'Menyimpan…' : 'Tambah penguji'}
          </button>
        </form>
        {team ? (
          <p className="muted-copy">{team.testers.length} dari {team.maxTesters} penguji{full ? ' — batas tercapai.' : '.'}</p>
        ) : null}
        {team && team.testers.length > 0 ? (
          <table className="package-table">
            <thead>
              <tr><th>Email</th><th>Ditambahkan</th><th aria-label="Aksi" /></tr>
            </thead>
            <tbody>
              {team.testers.map((tester) => (
                <tr key={tester.id}>
                  <td>{tester.email}</td>
                  <td>{new Date(tester.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</td>
                  <td>
                    <button
                      className="secondary-link danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void run(
                        () => requestJson<TesterTeam>(`${API}/${tester.id}`, { method: 'DELETE' }),
                        `${tester.email} dihapus dari tim penguji.`,
                      )}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : team ? (
          <p className="muted-copy">Belum ada penguji.</p>
        ) : null}
      </section>

      <section>
        <h3>Website uji aktif</h3>
        <p className="muted-copy">
          Bagikan tautan ini ke penguji. Mulai uji dari Studio → Toko template → pilih versi uji → “Uji versi … (hanya Anda)”.
        </p>
        {team && team.trialWebsites.length > 0 ? (
          <ul className="tester-websites">
            {team.trialWebsites.map((website) => (
              <li key={website.websiteSlug}>
                <strong>{website.websiteName}</strong>
                <span className="muted-copy"> · {website.templateName} {website.version} ({website.statusLabel})</span>
                <br />
                <a href={tenantWebUrl(website.websiteSlug)} target="_blank" rel="noreferrer">{tenantWebUrl(website.websiteSlug)}</a>
              </li>
            ))}
          </ul>
        ) : team ? (
          <p className="muted-copy">Belum ada website yang sedang menguji versi Anda.</p>
        ) : null}
      </section>
    </div>
  );
}
