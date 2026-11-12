'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  FIXTURE_LABELS,
  displayName,
  formatDate,
  inboxUrl,
  npmUrl,
  postJson,
  submissionApi,
  systemFixtures,
  type Submission,
} from '@/lib/template-submission';

import { CandidatePreview, CheckReportView, ClientSourceView, FlowStepper, StatusPill } from './flow-parts';

type Tab = 'preview' | 'check' | 'client' | 'manifest' | 'info';
type Decision = 'in_review' | 'changes_requested' | 'rejected' | 'approved';

export function ReviewerSubmission({
  submission,
  onChange,
}: {
  submission: Submission;
  onChange: (submission: Submission) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('preview');
  const [note, setNote] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [busy, setBusy] = useState<Decision | 'retry' | 'discussion' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const hasClientBundle = Boolean(submission.manifest?.entry.client);
  const manifest = submission.manifest;

  async function act(kind: Decision | 'retry' | 'discussion', task: () => Promise<Submission>, success: string) {
    setBusy(kind);
    setError('');
    setNotice('');
    try {
      const saved = await task();
      onChange(saved);
      setNotice(success);
      setNote('');
      setConfirmApprove(false);
      return saved;
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : 'Keputusan belum dapat disimpan.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  const decide = (status: Decision, success: string) =>
    act(status, () => postJson<Submission>(submissionApi(submission.id, 'review'), {
      status,
      ...(note.trim() ? { reviewNote: note.trim() } : {}),
    }), success);

  async function openDiscussion() {
    if (submission.discussion_topic_id) {
      router.push(inboxUrl(submission.id));
      return;
    }
    const saved = await act('discussion', () => postJson<Submission>(submissionApi(submission.id, 'discussion/start')), '');
    if (saved) router.push(inboxUrl(saved.id));
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'check', label: 'Hasil cek' },
    { id: 'client', label: hasClientBundle ? 'JavaScript ⚠' : 'JavaScript' },
    { id: 'manifest', label: 'Manifest' },
    { id: 'info', label: 'Info package' },
  ];

  return (
    <article className="flow-detail review-detail">
      <header className="flow-detail-header">
        <div>
          <span className="eyebrow">
            <a href={npmUrl(submission.package_name, submission.package_version)} rel="noreferrer" target="_blank">
              {submission.package_name}@{submission.package_version}
            </a>
          </span>
          <h2>{displayName(submission)}</h2>
        </div>
        <StatusPill status={submission.status} />
      </header>
      <FlowStepper status={submission.status} />

      <div className="review-layout">
        <div className="review-main">
          <div className="status-tabs review-tabs" role="tablist">
            {tabs.map((item) => (
              <button
                aria-selected={tab === item.id}
                className={`status-tab${tab === item.id ? ' active' : ''}`}
                key={item.id}
                onClick={() => setTab(item.id)}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="review-tab-panel" role="tabpanel">
            {tab === 'preview' ? (
              submission.candidate_digest ? (
                <CandidatePreview digest={submission.candidate_digest} manifest={manifest} submissionId={submission.id} />
              ) : (
                <p className="muted-copy">Belum ada artefak hasil cek.</p>
              )
            ) : null}
            {tab === 'check' ? (
              submission.check_report ? (
                <CheckReportView checkedAt={submission.checked_at} report={submission.check_report} />
              ) : (
                <p className="muted-copy">Belum ada hasil cek.</p>
              )
            ) : null}
            {tab === 'client' ? <ClientSourceView hasClientBundle={hasClientBundle} submissionId={submission.id} /> : null}
            {tab === 'manifest' ? (
              manifest ? (
                <dl className="flow-meta">
                  <div><dt>Slug</dt><dd><code>{manifest.slug}</code></dd></div>
                  <div><dt>Jenis bisnis</dt><dd>{manifest.businessProfiles.join(', ')}</dd></div>
                  <div><dt>Kemampuan</dt><dd>{manifest.capabilities.join(', ') || '—'}</dd></div>
                  <div><dt>Section ({manifest.sections.length})</dt><dd>{manifest.sections.join(', ')}</dd></div>
                  <div><dt>Halaman sistem milik template</dt><dd>{systemFixtures(manifest).map((fixture) => FIXTURE_LABELS[fixture]).join(', ') || 'Tidak ada — memakai tampilan Bagdja'}</dd></div>
                  <div><dt>Halaman contoh</dt><dd>{manifest.defaultPages?.map((page) => page.title).join(', ') || 'Tidak ada'}</dd></div>
                </dl>
              ) : (
                <p className="muted-copy">Manifest belum tersedia.</p>
              )
            ) : null}
            {tab === 'info' ? (
              <div className="review-info">
                <dl className="flow-meta">
                  <div><dt>Designer</dt><dd>{submission.designer_email ?? submission.designer_user_id}</dd></div>
                  <div><dt>Lisensi</dt><dd>{submission.license}</dd></div>
                  <div><dt>Repository</dt><dd>{submission.github_url ? <a href={submission.github_url} rel="noreferrer" target="_blank">{submission.github_url}</a> : '—'}</dd></div>
                  <div><dt>Demo</dt><dd>{submission.demo_url ? <a href={submission.demo_url} rel="noreferrer" target="_blank">{submission.demo_url}</a> : '—'}</dd></div>
                  <div><dt>Diajukan</dt><dd>{formatDate(submission.submitted_at)}</dd></div>
                  <div><dt>Digest artefak</dt><dd><code className="digest">{submission.candidate_digest ?? '—'}</code></dd></div>
                </dl>
                <h4>Deskripsi</h4>
                <p>{submission.description}</p>
                <h4>Yang baru di versi ini</h4>
                <p>{submission.changelog}</p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="review-decision" aria-label="Keputusan review">
          {error ? <p className="form-message error" role="alert">{error}</p> : null}
          {notice ? <p className="form-message" role="status">{notice}</p> : null}

          {submission.status === 'submitted' ? (
            <>
              <h3>Mulai review</h3>
              <p className="muted-copy">Ambil pengajuan ini agar reviewer lain tahu sedang kamu tangani.</p>
              <button className="primary-link full" disabled={busy !== null} onClick={() => void decide('in_review', 'Pengajuan kamu ambil untuk direview.')} type="button">
                {busy === 'in_review' ? 'Mengambil…' : 'Ambil untuk direview'}
              </button>
            </>
          ) : null}

          {submission.status === 'in_review' ? (
            <>
              <h3>Keputusan</h3>
              <ul className="review-checklist">
                <li>Preview rapi di desktop & mobile, termasuk website kosong</li>
                <li>Tidak ada masalah wajib di Hasil cek</li>
                <li>{hasClientBundle ? 'JavaScript sudah dibaca dan aman' : 'Tanpa JavaScript browser'}</li>
              </ul>
              {confirmApprove ? (
                <div className="callout tone-info">
                  <strong>Terbitkan {submission.package_version}?</strong>
                  <p>Versi ini langsung tampil di katalog Studio. Seller yang sudah memakai versi lama tetap di versinya sampai memilih update.</p>
                  <div className="flow-actions">
                    <button className="primary-link" disabled={busy !== null} onClick={() => void decide('approved', 'Template terbit di katalog Studio.')} type="button">
                      {busy === 'approved' ? 'Menerbitkan…' : 'Ya, terbitkan'}
                    </button>
                    <button className="secondary-link" disabled={busy !== null} onClick={() => setConfirmApprove(false)} type="button">Batal</button>
                  </div>
                </div>
              ) : (
                <button className="primary-link full" disabled={busy !== null} onClick={() => setConfirmApprove(true)} type="button">
                  Setujui & terbitkan
                </button>
              )}
              <label className="platform-form review-note-field">
                Catatan untuk designer
                <textarea
                  maxLength={3000}
                  onChange={(event) => setNote(event.currentTarget.value)}
                  placeholder="Wajib untuk Minta revisi atau Tolak. Catatan revisi juga dikirim ke Inbox."
                  rows={4}
                  value={note}
                />
              </label>
              <div className="review-secondary-actions">
                <button className="secondary-link" disabled={busy !== null || !note.trim()} onClick={() => void decide('changes_requested', 'Catatan revisi terkirim ke Inbox designer.')} type="button">
                  {busy === 'changes_requested' ? 'Mengirim…' : 'Minta revisi'}
                </button>
                <button className="secondary-link danger" disabled={busy !== null || !note.trim()} onClick={() => void decide('rejected', 'Pengajuan ditolak.')} type="button">
                  {busy === 'rejected' ? 'Menyimpan…' : 'Tolak'}
                </button>
              </div>
            </>
          ) : null}

          {submission.status === 'publish_failed' ? (
            <>
              <h3>Penerbitan gagal</h3>
              <p className="form-message error">{submission.publication_error ?? 'Gangguan sistem saat menerbitkan.'}</p>
              <p className="muted-copy">Keputusan setuju tetap berlaku. Coba lagi setelah layanan normal.</p>
              <button className="primary-link full" disabled={busy !== null} onClick={() => void act('retry', () => postJson<Submission>(submissionApi(submission.id, 'retry-publish')), 'Template terbit di katalog Studio.')} type="button">
                {busy === 'retry' ? 'Menerbitkan…' : 'Coba terbitkan lagi'}
              </button>
            </>
          ) : null}

          {['published', 'deprecated', 'revoked'].includes(submission.status) ? (
            <>
              <h3>Sudah diproses</h3>
              <p className="muted-copy">Kelola versi terbit (tandai usang atau cabut) di halaman Paket Template.</p>
              <Link className="secondary-link full" href="/packages">Buka Paket Template</Link>
            </>
          ) : null}

          <div className="review-discussion">
            <h4>Diskusi</h4>
            <p className="muted-copy">Semua percakapan dengan designer berlangsung di Inbox.</p>
            <button className="secondary-link full" disabled={busy !== null} onClick={() => void openDiscussion()} type="button">
              {submission.discussion_topic_id ? 'Buka di Inbox' : busy === 'discussion' ? 'Membuka…' : 'Mulai diskusi di Inbox'}
            </button>
          </div>
        </aside>
      </div>
    </article>
  );
}
