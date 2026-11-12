'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

import {
  CHECKABLE_STATUSES,
  EDITABLE_STATUSES,
  designerNextAction,
  displayName,
  formatDate,
  inboxUrl,
  npmUrl,
  postJson,
  requestJson,
  submissionApi,
  type Submission,
  type SubmissionForm,
} from '@/lib/template-submission';

import { CandidatePreview, CheckReportView, FlowStepper, StatusPill } from './flow-parts';

const PACKAGE_NAME_PATTERN = '(@[a-z0-9]([a-z0-9._\\-]{0,61}[a-z0-9])?/)?[a-z0-9]([a-z0-9._\\-]{0,61}[a-z0-9])?';
const VERSION_PATTERN = '(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z.\\-]+)?(\\+[0-9A-Za-z.\\-]+)?';
const GITHUB_PATTERN = 'https://(www\\.)?github\\.com/[A-Za-z0-9_.\\-]+/[A-Za-z0-9_.\\-]+/?';

function readForm(form: HTMLFormElement): SubmissionForm {
  const data = new FormData(form);
  const text = (key: string) => String(data.get(key) ?? '').trim();
  return {
    packageName: text('packageName'),
    packageVersion: text('packageVersion'),
    description: text('description'),
    changelog: text('changelog'),
    license: text('license'),
    demoUrl: text('demoUrl') || undefined,
    githubUrl: text('githubUrl'),
  };
}

export function DesignerSubmission({
  submission,
  onChange,
}: {
  /** null = pendaftaran baru. */
  submission: Submission | null;
  onChange: (submission: Submission) => void;
}) {
  const [busy, setBusy] = useState<'save' | 'check' | 'submit' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isNew = submission === null;
  const status = submission?.status ?? 'draft';
  const editable = isNew || EDITABLE_STATUSES.includes(status);

  async function run<T>(kind: 'save' | 'check' | 'submit', task: () => Promise<T>): Promise<T | null> {
    setBusy(kind);
    setError('');
    setNotice('');
    try {
      return await task();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : 'Permintaan belum dapat diproses.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save(form: HTMLFormElement, checkAfterSave: boolean) {
    if (!form.reportValidity()) return;
    const payload = readForm(form);
    const saved = await run('save', () =>
      isNew
        ? postJson<Submission>('/api/platform/templates/submissions', payload)
        : requestJson<Submission>(submissionApi(submission.id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
    );
    if (!saved) return;
    if (!checkAfterSave) {
      onChange(saved);
      setNotice('Perubahan tersimpan.');
      return;
    }
    // Pendaftaran baru: komponen ini tetap tampil (dengan progres cek) sampai cek selesai,
    // baru kemudian induk berpindah ke pengajuan yang tersimpan.
    const checked = await check(saved);
    if (!checked) onChange(saved);
  }

  async function check(target: Submission): Promise<Submission | null> {
    const checked = await run('check', () => postJson<Submission>(submissionApi(target.id, 'check')));
    if (!checked) return null;
    onChange(checked);
    setNotice(checked.status === 'checked' ? 'Package lolos pemeriksaan. Cek preview lalu ajukan review.' : '');
    return checked;
  }

  async function submitForReview() {
    if (!submission) return;
    const submitted = await run('submit', () => postJson<Submission>(submissionApi(submission.id, 'submit')));
    if (!submitted) return;
    onChange(submitted);
    setNotice('Pengajuan terkirim ke reviewer Bagdja.');
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    void save(event.currentTarget, submitter?.value === 'check');
  }

  const canCheck = !isNew && CHECKABLE_STATUSES.includes(status);

  return (
    <article className="flow-detail">
      <header className="flow-detail-header">
        <div>
          <span className="eyebrow">{isNew ? 'Pengajuan baru' : `${submission.package_name}@${submission.package_version}`}</span>
          <h2>{isNew ? 'Daftarkan template dari npm' : displayName(submission)}</h2>
        </div>
        {submission ? <StatusPill status={status} /> : null}
      </header>

      <FlowStepper status={status} />

      <div className={`callout tone-${status === 'published' ? 'success' : status === 'check_failed' || status === 'rejected' || status === 'changes_requested' ? 'warning' : 'info'}`}>
        <strong>Langkah berikutnya</strong>
        <p>{isNew ? 'Terbitkan template ke npm dengan versi exact, lalu daftarkan di sini. Nama dan slug template dibaca dari manifest.json di package.' : designerNextAction(status)}</p>
        {submission?.discussion_topic_id ? (
          <Link className="callout-link" href={inboxUrl(submission.id)}>Buka diskusi di Inbox →</Link>
        ) : null}
      </div>

      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {notice ? <p className="form-message" role="status">{notice}</p> : null}

      {submission?.review_note && (status === 'changes_requested' || status === 'rejected') ? (
        <section className="flow-section review-note-card">
          <h3>Catatan reviewer</h3>
          <p>{submission.review_note}</p>
        </section>
      ) : null}

      {editable ? (
        <section className="flow-section">
          <div className="flow-section-head">
            <h3>1 · Package npm</h3>
            {status === 'changes_requested' ? (
              <p>Versi npm tidak bisa diubah isinya. Terbitkan versi baru, lalu ganti versinya di sini.</p>
            ) : (
              <p>Gunakan versi exact (mis. 1.2.0), bukan tag seperti latest atau range.</p>
            )}
          </div>
          <form className="platform-form flow-form" key={submission?.id ?? 'new'} onSubmit={onSubmit}>
            <div className="flow-form-row">
              <label>
                Nama package
                <input defaultValue={submission?.package_name ?? ''} maxLength={214} name="packageName" pattern={PACKAGE_NAME_PATTERN} placeholder="@studio-kamu/nama-template" required />
              </label>
              <label className="flow-form-narrow">
                Versi
                <input defaultValue={submission?.package_version ?? ''} maxLength={100} name="packageVersion" pattern={VERSION_PATTERN} placeholder="1.0.0" required />
              </label>
            </div>
            <label>
              Repository GitHub
              <input defaultValue={submission?.github_url ?? ''} maxLength={2048} name="githubUrl" pattern={GITHUB_PATTERN} placeholder="https://github.com/studio-kamu/nama-template" required type="url" />
            </label>
            <label>
              Deskripsi untuk seller
              <textarea defaultValue={submission?.description ?? ''} maxLength={3000} minLength={20} name="description" placeholder="Untuk bisnis apa template ini cocok, dan apa keunggulannya?" required rows={3} />
            </label>
            <label>
              Yang baru di versi ini
              <textarea defaultValue={submission?.changelog ?? ''} maxLength={2000} minLength={5} name="changelog" placeholder="Rilis pertama / perbaikan tampilan mobile / …" required rows={2} />
            </label>
            <div className="flow-form-row">
              <label className="flow-form-narrow">
                Lisensi
                <input defaultValue={submission?.license ?? 'MIT'} maxLength={80} name="license" required />
              </label>
              <label>
                URL demo (opsional)
                <input defaultValue={submission?.demo_url ?? ''} maxLength={2048} name="demoUrl" placeholder="https://…" type="url" />
              </label>
            </div>
            <div className="flow-actions">
              <button className="primary-link" disabled={busy !== null} name="intent" type="submit" value="check">
                {busy === 'check' ? 'Mengecek package…' : busy === 'save' ? 'Menyimpan…' : isNew ? 'Simpan & cek package' : 'Simpan & cek ulang'}
              </button>
              {!isNew ? (
                <button className="secondary-link" disabled={busy !== null} name="intent" type="submit" value="save">
                  Simpan saja
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : (
        <section className="flow-section">
          <div className="flow-section-head">
            <h3>Package</h3>
          </div>
          <dl className="flow-meta">
            <div><dt>Package</dt><dd><a href={npmUrl(submission!.package_name, submission!.package_version)} rel="noreferrer" target="_blank">{submission!.package_name}@{submission!.package_version}</a></dd></div>
            <div><dt>Slug</dt><dd><code>{submission!.slug ?? '—'}</code></dd></div>
            <div><dt>Diajukan</dt><dd>{formatDate(submission!.submitted_at)}</dd></div>
            {submission!.published_at ? <div><dt>Terbit</dt><dd>{formatDate(submission!.published_at)}</dd></div> : null}
          </dl>
        </section>
      )}

      {isNew && busy === 'check' ? (
        <section className="flow-section">
          <div className="flow-section-head">
            <h3>2 · Cek otomatis</h3>
          </div>
          <ol className="check-progress" aria-live="polite">
            <li>Mengambil package dari npm</li>
            <li>Memeriksa integritas tarball & manifest.json</li>
            <li>Me-render dengan data contoh di sandbox</li>
          </ol>
        </section>
      ) : null}

      {submission && (canCheck || submission.check_report) ? (
        <section className="flow-section">
          <div className="flow-section-head">
            <h3>2 · Cek otomatis</h3>
            <p>Ambil dari npm, cek integritas & manifest, lalu render dengan data contoh di sandbox.</p>
          </div>
          {busy === 'check' || status === 'checking' ? (
            <ol className="check-progress" aria-live="polite">
              <li>Mengambil {submission.package_name}@{submission.package_version} dari npm</li>
              <li>Memeriksa integritas tarball & manifest.json</li>
              <li>Me-render dengan data contoh di sandbox</li>
            </ol>
          ) : submission.check_report ? (
            <CheckReportView checkedAt={submission.checked_at} report={submission.check_report} />
          ) : (
            <p className="muted-copy">Belum dicek.</p>
          )}
          {canCheck && !busy && submission.check_report ? (
            <div className="flow-actions">
              <button className="secondary-link" onClick={() => void check(submission)} type="button">
                Cek ulang versi ini
              </button>
            </div>
          ) : null}
          {canCheck && !busy && !submission.check_report ? (
            <div className="flow-actions">
              <button className="primary-link" onClick={() => void check(submission)} type="button">
                Cek package
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {submission?.candidate_digest ? (
        <section className="flow-section">
          <div className="flow-section-head">
            <h3>Preview</h3>
            <p>Seperti inilah reviewer dan seller akan melihat template kamu.</p>
          </div>
          <CandidatePreview digest={submission.candidate_digest} manifest={submission.manifest} submissionId={submission.id} />
        </section>
      ) : null}

      {status === 'checked' ? (
        <section className="flow-section flow-submit">
          <div>
            <h3>3 · Ajukan ke reviewer</h3>
            <p>Reviewer memeriksa versi yang sama persis dengan preview di atas. Setelah disetujui, template langsung tampil di katalog Studio.</p>
          </div>
          <button className="primary-link" disabled={busy !== null} onClick={() => void submitForReview()} type="button">
            {busy === 'submit' ? 'Mengirim…' : 'Ajukan review'}
          </button>
        </section>
      ) : null}
    </article>
  );
}
