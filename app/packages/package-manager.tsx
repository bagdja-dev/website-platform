'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  compareVersionsDesc,
  displayName,
  formatDate,
  inboxUrl,
  npmUrl,
  postJson,
  requestJson,
  submissionApi,
  type Submission,
  type SubmissionStatus,
} from '@/lib/template-submission';

import { StatusPill } from '../templates/components/flow-parts';

type Filter = { id: string; label: string; statuses: readonly SubmissionStatus[] };

const FILTERS: Filter[] = [
  { id: 'live', label: 'Terbit', statuses: ['published'] },
  { id: 'deprecated', label: 'Usang', statuses: ['deprecated'] },
  { id: 'revoked', label: 'Dicabut', statuses: ['revoked'] },
  { id: 'failed', label: 'Gagal terbit', statuses: ['publish_failed'] },
  { id: 'all', label: 'Semua versi terbit', statuses: ['published', 'deprecated', 'revoked', 'publish_failed'] },
];

type TemplateGroup = { key: string; name: string; packageName: string; versions: Submission[] };

export function PackageManager() {
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [filter, setFilter] = useState('live');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await requestJson<Submission[]>('/api/platform/templates/packages'));
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Daftar paket belum dapat dimuat.');
      setRows((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestJson<Submission[]>('/api/platform/templates/packages')
      .then((result) => {
        if (active) setRows(result);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Daftar belum dapat dimuat.');
        setRows([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((item) => [item.id, (rows ?? []).filter((row) => item.statuses.includes(row.status)).length])),
    [rows],
  );

  const groups = useMemo<TemplateGroup[]>(() => {
    const active = FILTERS.find((item) => item.id === filter)!;
    const needle = query.trim().toLowerCase();
    const map = new Map<string, TemplateGroup>();
    for (const row of rows ?? []) {
      if (!active.statuses.includes(row.status)) continue;
      if (needle && ![row.name, row.slug, row.package_name].some((value) => value?.toLowerCase().includes(needle))) continue;
      const key = row.slug ?? row.package_name;
      const group = map.get(key) ?? { key, name: displayName(row), packageName: row.package_name, versions: [] };
      group.versions.push(row);
      map.set(key, group);
    }
    return [...map.values()]
      .map((group) => ({ ...group, versions: group.versions.sort((a, b) => compareVersionsDesc(a.package_version, b.package_version)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filter, query, rows]);

  function onUpdated(updated: Submission) {
    setSelected(updated);
    setRows((current) => (current ?? []).map((row) => (row.id === updated.id ? updated : row)));
  }

  return (
    <div className="package-catalog">
      <section className="content-card">
        <div className="flow-list-head">
          <div>
            <h2>Versi di katalog Studio</h2>
            <p className="muted-copy">
              Template terbit lewat tombol “Setujui & terbitkan” di antrean review. Di sini kamu mengelola versi yang sudah terbit.
            </p>
          </div>
          <button className="secondary-link" onClick={() => void load()} type="button">Muat ulang</button>
        </div>
        <input
          aria-label="Cari template"
          className="flow-search"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Cari nama, slug, atau package…"
          type="search"
          value={query}
        />
        <div className="status-tabs flow-filter" role="tablist">
          {FILTERS.map((item) => (
            <button
              aria-selected={filter === item.id}
              className={`status-tab${filter === item.id ? ' active' : ''}`}
              key={item.id}
              onClick={() => setFilter(item.id)}
              role="tab"
              type="button"
            >
              {item.label} <span>{counts[item.id] ?? 0}</span>
            </button>
          ))}
        </div>
        {error ? <p className="form-message error" role="alert">{error}</p> : null}

        {rows === null ? <p className="muted-copy">Memuat…</p> : null}
        {rows !== null && groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">▤</div>
            <h3>Belum ada versi di kategori ini</h3>
            <p>Versi akan muncul di sini setelah reviewer menyetujui pengajuan.</p>
          </div>
        ) : null}

        <div className="package-groups">
          {groups.map((group) => (
            <section className="package-group" key={group.key}>
              <header>
                <div>
                  <h3>{group.name}</h3>
                  <small><code>{group.key}</code> · {group.packageName}</small>
                </div>
                <span className="muted-copy">{group.versions.length} versi</span>
              </header>
              <div className="table-scroll package-table-scroll">
                <table className="package-table">
                  <thead>
                    <tr>
                      <th>Versi</th>
                      <th>Status</th>
                      <th>Terbit</th>
                      <th aria-label="Aksi" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.versions.map((version) => (
                      <tr className={selected?.id === version.id ? 'selected' : ''} key={version.id}>
                        <td><strong>{version.package_version}</strong></td>
                        <td><StatusPill status={version.status} /></td>
                        <td>{formatDate(version.published_at)}</td>
                        <td className="package-table-action">
                          <button className="secondary-link compact" onClick={() => setSelected(version)} type="button">
                            Kelola
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </section>

      {selected ? <VersionPanel key={selected.id} onClose={() => setSelected(null)} onUpdated={onUpdated} submission={selected} /> : null}
    </div>
  );
}

function VersionPanel({
  submission,
  onClose,
  onUpdated,
}: {
  submission: Submission;
  onClose: () => void;
  onUpdated: (submission: Submission) => void;
}) {
  const [pinned, setPinned] = useState<number | null>(null);
  const [mode, setMode] = useState<'idle' | 'deprecate' | 'revoke'>('idle');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    requestJson<{ pinnedWebsites: number }>(submissionApi(submission.id, 'pinned-websites'))
      .then((result) => {
        if (active) setPinned(result.pinnedWebsites);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [submission.id]);

  async function apply(action: 'deprecate' | 'revoke' | 'retry-publish') {
    setBusy(true);
    setError('');
    try {
      if (action === 'retry-publish') {
        onUpdated(await postJson<Submission>(submissionApi(submission.id, 'retry-publish')));
        setNotice('Versi berhasil diterbitkan.');
      } else {
        const result = await postJson<{ submission: Submission; pinnedWebsites: number }>(
          submissionApi(submission.id, action),
          note.trim() ? { note: note.trim() } : {},
        );
        onUpdated(result.submission);
        setPinned(result.pinnedWebsites);
        setNotice(action === 'deprecate' ? 'Versi ditandai usang dan disembunyikan dari katalog.' : 'Versi dicabut dari runtime.');
      }
      setMode('idle');
      setNote('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Aksi belum dapat diproses.');
    } finally {
      setBusy(false);
    }
  }

  const canDeprecate = submission.status === 'published';
  const canRevoke = submission.status === 'published' || submission.status === 'deprecated';

  return (
    <aside aria-label={`Kelola ${displayName(submission)} ${submission.package_version}`} className="version-panel" role="dialog">
      <header>
        <div>
          <span className="eyebrow">Versi {submission.package_version}</span>
          <h3>{displayName(submission)}</h3>
        </div>
        <button aria-label="Tutup" className="icon-button" onClick={onClose} type="button">✕</button>
      </header>
      <StatusPill status={submission.status} />
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {notice ? <p className="form-message" role="status">{notice}</p> : null}

      <dl className="flow-meta">
        <div><dt>Website memakai versi ini</dt><dd><strong>{pinned ?? '…'}</strong></dd></div>
        <div><dt>Package</dt><dd><a href={npmUrl(submission.package_name, submission.package_version)} rel="noreferrer" target="_blank">{submission.package_name}@{submission.package_version}</a></dd></div>
        <div><dt>Designer</dt><dd>{submission.designer_email ?? submission.designer_user_id}</dd></div>
        <div><dt>Terbit</dt><dd>{formatDate(submission.published_at)}</dd></div>
        <div><dt>Digest</dt><dd><code className="digest">{submission.artifact_digest ?? submission.candidate_digest ?? '—'}</code></dd></div>
      </dl>

      {submission.status === 'publish_failed' ? (
        <div className="callout tone-danger">
          <strong>Penerbitan gagal</strong>
          <p>{submission.publication_error ?? 'Gangguan sistem.'}</p>
          <button className="primary-link" disabled={busy} onClick={() => void apply('retry-publish')} type="button">
            {busy ? 'Menerbitkan…' : 'Coba terbitkan lagi'}
          </button>
        </div>
      ) : null}

      {mode === 'idle' && (canDeprecate || canRevoke) ? (
        <div className="version-actions">
          {canDeprecate ? (
            <button className="secondary-link full" onClick={() => setMode('deprecate')} type="button">
              Tandai usang
            </button>
          ) : null}
          {canRevoke ? (
            <button className="secondary-link danger full" onClick={() => setMode('revoke')} type="button">
              Cabut versi
            </button>
          ) : null}
          <p className="muted-copy">
            <strong>Usang:</strong> hilang dari katalog, website yang memakai tetap berjalan.<br />
            <strong>Cabut:</strong> untuk masalah keamanan/hukum — website yang memakai berhenti dirender.
          </p>
        </div>
      ) : null}

      {mode !== 'idle' ? (
        <div className={`callout ${mode === 'revoke' ? 'tone-danger' : 'tone-warning'}`}>
          <strong>{mode === 'revoke' ? `Cabut ${submission.package_version}?` : `Tandai ${submission.package_version} usang?`}</strong>
          <p>
            {mode === 'revoke'
              ? `${pinned ?? 0} website akan berhenti dirender sampai owner-nya beralih versi. Tindakan ini tidak bisa dibatalkan.`
              : 'Seller baru tidak bisa memilih versi ini. Website yang sudah memakainya tidak terpengaruh.'}
          </p>
          <label className="platform-form">
            {mode === 'revoke' ? 'Alasan (wajib)' : 'Alasan (opsional)'}
            <textarea maxLength={2000} onChange={(event) => setNote(event.currentTarget.value)} rows={3} value={note} />
          </label>
          <div className="flow-actions">
            <button
              className={mode === 'revoke' ? 'primary-link danger-fill' : 'primary-link'}
              disabled={busy || (mode === 'revoke' && note.trim().length < 5)}
              onClick={() => void apply(mode)}
              type="button"
            >
              {busy ? 'Memproses…' : mode === 'revoke' ? 'Ya, cabut' : 'Ya, tandai usang'}
            </button>
            <button className="secondary-link" disabled={busy} onClick={() => setMode('idle')} type="button">Batal</button>
          </div>
        </div>
      ) : null}

      {submission.discussion_topic_id ? (
        <a className="secondary-link full" href={inboxUrl(submission.id)}>Buka diskusi di Inbox</a>
      ) : null}
    </aside>
  );
}
