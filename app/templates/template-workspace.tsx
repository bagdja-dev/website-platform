'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  displayName,
  requestJson,
  submissionApi,
  type PlatformRole,
  type Submission,
  type SubmissionStatus,
} from '@/lib/template-submission';

import { DesignerSubmission } from './components/designer-submission';
import { StatusPill } from './components/flow-parts';
import { ReviewerSubmission } from './components/reviewer-submission';

type Filter = { id: string; label: string; statuses: readonly SubmissionStatus[] | null };

const DESIGNER_FILTERS: Filter[] = [
  { id: 'active', label: 'Perlu tindakan', statuses: ['draft', 'check_failed', 'checked', 'changes_requested'] },
  { id: 'review', label: 'Di review', statuses: ['checking', 'submitted', 'in_review', 'publishing', 'publish_failed'] },
  { id: 'published', label: 'Terbit', statuses: ['published', 'deprecated'] },
  { id: 'all', label: 'Semua', statuses: null },
];

const REVIEWER_FILTERS: Filter[] = [
  { id: 'waiting', label: 'Menunggu', statuses: ['submitted'] },
  { id: 'in_review', label: 'Sedang direview', statuses: ['in_review'] },
  { id: 'failed', label: 'Gagal terbit', statuses: ['publish_failed'] },
  { id: 'all', label: 'Semua', statuses: null },
];

const NEW = 'new';

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export function TemplateWorkspace({
  role,
  initialSubmissionId,
}: {
  role: PlatformRole;
  /** Dari `?submissionId=` (mis. tautan "Lihat pengajuan" di Inbox). */
  initialSubmissionId?: string;
}) {
  const isDesigner = role === 'designer';
  const filters = isDesigner ? DESIGNER_FILTERS : REVIEWER_FILTERS;
  const listUrl = isDesigner ? '/api/platform/templates/submissions/mine' : '/api/platform/templates/review-queue';

  const [rows, setRows] = useState<Submission[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSubmissionId && UUID_PATTERN.test(initialSubmissionId) ? initialSubmissionId : null,
  );
  const [detail, setDetail] = useState<Submission | null>(null);
  const [filter, setFilter] = useState(filters[0].id);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    requestJson<Submission[]>(listUrl)
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
  }, [listUrl]);

  useEffect(() => {
    if (!selectedId || selectedId === NEW) return;
    let active = true;
    requestJson<Submission>(submissionApi(selectedId))
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Detail belum dapat dimuat.');
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of filters) {
      result[item.id] = (rows ?? []).filter((row) => !item.statuses || item.statuses.includes(row.status)).length;
    }
    return result;
  }, [filters, rows]);

  const visible = useMemo(() => {
    const active = filters.find((item) => item.id === filter);
    const needle = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (row) =>
        (!active?.statuses || active.statuses.includes(row.status)) &&
        (!needle ||
          [row.name, row.slug, row.package_name, row.designer_email]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(needle))),
    );
  }, [filter, filters, query, rows]);

  function select(id: string | null) {
    setSelectedId(id);
    setDetail(null);
  }

  function onChange(updated: Submission) {
    setDetail(updated);
    setSelectedId(updated.id);
    setRows((current) => {
      const list = current ?? [];
      return list.some((row) => row.id === updated.id)
        ? list.map((row) => (row.id === updated.id ? updated : row))
        : [updated, ...list];
    });
  }

  const current = selectedId === NEW ? null : detail;
  const showingDetail = selectedId !== null;

  return (
    <div className={`flow-workspace${showingDetail ? ' has-selection' : ''}`}>
      <section className="flow-list content-card">
        <div className="flow-list-head">
          <div>
            <h2>{isDesigner ? 'Template saya' : 'Antrean review'}</h2>
            <p className="muted-copy">
              {isDesigner ? 'Setiap versi npm adalah satu pengajuan.' : 'Urut dari yang paling lama menunggu.'}
            </p>
          </div>
          {isDesigner ? (
            <button className="primary-link" onClick={() => select(NEW)} type="button">
              + Daftarkan
            </button>
          ) : null}
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
          {filters.map((item) => (
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
        <ul className="flow-list-items">
          {rows === null ? <li className="muted-copy flow-list-empty">Memuat…</li> : null}
          {rows !== null && visible.length === 0 ? (
            <li className="flow-list-empty">
              <p className="muted-copy">
                {isDesigner && rows.length === 0
                  ? 'Belum ada pengajuan. Terbitkan template ke npm lalu klik “Daftarkan”.'
                  : 'Tidak ada pengajuan di kategori ini.'}
              </p>
            </li>
          ) : null}
          {visible.map((row) => (
            <li key={row.id}>
              <button
                aria-current={selectedId === row.id ? 'true' : undefined}
                className={`flow-list-item${selectedId === row.id ? ' selected' : ''}`}
                onClick={() => select(row.id)}
                type="button"
              >
                <span className="flow-list-item-top">
                  <strong>{displayName(row)}</strong>
                  <StatusPill status={row.status} />
                </span>
                <span className="flow-list-item-sub">
                  {row.package_name}@{row.package_version}
                </span>
                <small>
                  {!isDesigner && row.designer_email ? `${row.designer_email} · ` : ''}
                  diperbarui {new Date(row.updated_at).toLocaleDateString('id-ID')}
                  {row.discussion_topic_id ? ' · 💬 ada diskusi' : ''}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flow-panel content-card">
        {showingDetail ? (
          <button className="flow-back" onClick={() => select(null)} type="button">
            ← Kembali ke daftar
          </button>
        ) : null}
        {selectedId === NEW ? (
          <DesignerSubmission onChange={onChange} submission={null} />
        ) : current ? (
          isDesigner ? (
            <DesignerSubmission key={current.id} onChange={onChange} submission={current} />
          ) : (
            <ReviewerSubmission key={current.id} onChange={onChange} submission={current} />
          )
        ) : selectedId ? (
          <p className="muted-copy flow-loading">Memuat detail…</p>
        ) : (
          <div className="empty-state flow-empty">
            <div className="empty-state-icon" aria-hidden="true">▦</div>
            <h3>{isDesigner ? 'Pilih pengajuan atau daftarkan yang baru' : 'Pilih pengajuan dari antrean'}</h3>
            <p>
              {isDesigner
                ? 'Alurnya: daftarkan package npm → cek otomatis & preview → ajukan → reviewer menerbitkan ke Studio.'
                : 'Periksa preview hasil build, hasil cek, dan JavaScript-nya sebelum menerbitkan.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
