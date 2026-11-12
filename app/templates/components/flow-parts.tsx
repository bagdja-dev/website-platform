'use client';

import { useEffect, useRef, useState } from 'react';

import {
  CONTENT_FIXTURES,
  FIXTURE_LABELS,
  FLOW_STEPS,
  STATUS_META,
  flowPosition,
  formatBytes,
  systemFixtures,
  requestJson,
  submissionApi,
  type CandidateFixture,
  type CheckReport,
  type SubmissionStatus,
  type TemplateManifestSummary,
} from '@/lib/template-submission';

export function StatusPill({ status }: { status: SubmissionStatus }) {
  const meta = STATUS_META[status];
  return <span className={`flow-pill tone-${meta.tone}`}>{meta.label}</span>;
}

export function FlowStepper({ status }: { status: SubmissionStatus }) {
  const position = flowPosition(status);
  return (
    <ol className="flow-stepper" aria-label="Tahapan pengajuan">
      {FLOW_STEPS.map((step, index) => {
        const state =
          index < position.step || (index === position.step && position.done)
            ? 'done'
            : index === position.step
              ? position.blocked
                ? 'blocked'
                : 'current'
              : 'upcoming';
        return (
          <li className={`flow-step is-${state}`} key={step.id} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="flow-step-marker" aria-hidden="true">
              {state === 'done' ? '✓' : state === 'blocked' ? '!' : index + 1}
            </span>
            <span className="flow-step-copy">
              <strong>{step.title}</strong>
              <small>{step.hint}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CheckReportView({ report, checkedAt }: { report: CheckReport; checkedAt: string | null }) {
  const errors = report.issues.filter((issue) => issue.level === 'error');
  const warnings = report.issues.filter((issue) => issue.level === 'warning');
  return (
    <div className="check-report">
      <div className={`check-summary ${errors.length ? 'tone-danger' : 'tone-success'}`} role="status">
        <strong>
          {errors.length
            ? `${errors.length} masalah perlu diperbaiki`
            : 'Semua pemeriksaan wajib lolos'}
        </strong>
        <span>
          {warnings.length ? `${warnings.length} saran` : 'Tanpa saran tambahan'}
          {checkedAt ? ` · dicek ${new Date(checkedAt).toLocaleString('id-ID')}` : ''}
        </span>
      </div>

      {report.issues.length ? (
        <ul className="check-issues">
          {[...errors, ...warnings].map((issue, index) => (
            <li className={`check-issue is-${issue.level}`} key={`${issue.code}-${index}`}>
              <span className="check-issue-level">{issue.level === 'error' ? 'Wajib' : 'Saran'}</span>
              <div>
                <p>{issue.message}</p>
                <small>
                  {issue.field ? <code>{issue.field}</code> : null} <code>{issue.code}</code>
                </small>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {report.renders.length ? (
        <div className="check-renders">
          <h4>Render dengan data contoh</h4>
          <ul>
            {report.renders.map((render) => (
              <li className={render.ok ? 'is-ok' : 'is-failed'} key={render.fixture}>
                <span aria-hidden="true">{render.ok ? '✓' : '✕'}</span>
                <strong>{FIXTURE_LABELS[render.fixture as CandidateFixture] ?? render.fixture}</strong>
                <small>
                  {render.ok
                    ? `${formatBytes(render.htmlBytes ?? 0)} · ${render.durationMs ?? 0} ms`
                    : render.error ?? 'Gagal'}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.package ? (
        <dl className="check-package">
          <div>
            <dt>Integritas npm</dt>
            <dd><code title={report.package.integrity}>{report.package.integrity.slice(0, 22)}…</code></dd>
          </div>
          <div>
            <dt>Bundle server</dt>
            <dd>{formatBytes(report.package.serverBundleBytes)}</dd>
          </div>
          <div>
            <dt>JavaScript browser</dt>
            <dd>{report.package.clientBundleBytes ? formatBytes(report.package.clientBundleBytes) : 'Tidak ada'}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

type PreviewState = { status: 'loading' | 'ready' | 'error'; html?: string; message?: string };

/** Preview artefak kandidat: HTML hasil SSR di iframe inert (tanpa script). */
export function CandidatePreview({
  submissionId,
  manifest,
  digest,
}: {
  submissionId: string;
  manifest: TemplateManifestSummary | null;
  digest: string;
}) {
  const pageFixtures = systemFixtures(manifest);
  const groups: Array<{ label: string; items: readonly CandidateFixture[] }> = [
    { label: 'Halaman konten', items: CONTENT_FIXTURES },
    ...(pageFixtures.length ? [{ label: 'Halaman sistem', items: pageFixtures }] : []),
  ];
  const [fixture, setFixture] = useState<CandidateFixture>('home');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [cache, setCache] = useState<Record<string, PreviewState>>({});
  const requested = useRef(new Set<string>());
  const key = `${digest}:${fixture}`;
  const state: PreviewState = cache[key] ?? { status: 'loading' };

  useEffect(() => {
    if (requested.current.has(key)) return;
    requested.current.add(key);
    requestJson<{ html: string }>(`${submissionApi(submissionId, 'preview')}?fixture=${fixture}`)
      .then((result) => setCache((current) => ({ ...current, [key]: { status: 'ready', html: result.html } })))
      .catch((error: unknown) => {
        requested.current.delete(key);
        setCache((current) => ({
          ...current,
          [key]: { status: 'error', message: error instanceof Error ? error.message : 'Preview gagal dimuat.' },
        }));
      });
  }, [key, submissionId, fixture]);

  return (
    <div className="candidate-preview">
      <div className="candidate-preview-toolbar">
        <div className="preview-fixture-groups">
          {groups.map((group) => (
            <div className="preview-fixture-group" key={group.label}>
              <span className="preview-fixture-group-label">{group.label}</span>
              <div className="segmented" role="tablist" aria-label={group.label}>
                {group.items.map((item) => (
                  <button
                    aria-selected={item === fixture}
                    className={item === fixture ? 'active' : ''}
                    key={item}
                    onClick={() => setFixture(item)}
                    role="tab"
                    type="button"
                  >
                    {FIXTURE_LABELS[item]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="segmented" aria-label="Ukuran layar">
          {(['desktop', 'mobile'] as const).map((item) => (
            <button
              aria-pressed={item === device}
              className={item === device ? 'active' : ''}
              key={item}
              onClick={() => setDevice(item)}
              type="button"
            >
              {item === 'desktop' ? 'Desktop' : 'Mobile'}
            </button>
          ))}
        </div>
      </div>
      <div className={`candidate-preview-stage is-${device}`}>
        {state.status === 'ready' ? (
          <iframe
            className="candidate-preview-frame"
            sandbox=""
            srcDoc={state.html}
            title={`Preview ${FIXTURE_LABELS[fixture]} (${device})`}
          />
        ) : (
          <div className="candidate-preview-placeholder" role={state.status === 'error' ? 'alert' : 'status'}>
            {state.status === 'error' ? state.message : 'Me-render preview di sandbox…'}
          </div>
        )}
      </div>
      <p className="candidate-preview-note">
        Preview statis hasil render server dengan data contoh Bagdja. JavaScript browser template tidak dijalankan di sini.
      </p>
    </div>
  );
}

/** Isi dist/client.js untuk dibaca reviewer (keputusan D1: JS berjalan di semua halaman tenant). */
export function ClientSourceView({ submissionId, hasClientBundle }: { submissionId: string; hasClientBundle: boolean }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; content?: string | null; bytes?: number; message?: string }>({
    status: 'loading',
  });

  useEffect(() => {
    if (!hasClientBundle) return;
    let active = true;
    requestJson<{ content: string | null; bytes: number }>(submissionApi(submissionId, 'client-source'))
      .then((result) => {
        if (active) setState({ status: 'ready', content: result.content, bytes: result.bytes });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Gagal memuat.' });
      });
    return () => {
      active = false;
    };
  }, [submissionId, hasClientBundle]);

  if (!hasClientBundle) {
    return <p className="muted-copy">Package ini tidak membawa JavaScript browser. Template hanya berupa HTML hasil render server.</p>;
  }
  return (
    <div className="client-source">
      <div className="callout tone-warning">
        <strong>Wajib dibaca sebelum menyetujui</strong>
        <p>
          JavaScript ini berjalan di semua halaman website seller, termasuk halaman login dan transaksi. Pastikan tidak
          membaca atau mengirim data pembeli, tidak membuat permintaan jaringan, dan tidak mengarahkan halaman ke situs lain.
        </p>
      </div>
      {state.status === 'loading' ? <p className="muted-copy">Memuat dist/client.js…</p> : null}
      {state.status === 'error' ? <p className="form-message error">{state.message}</p> : null}
      {state.status === 'ready' ? (
        <>
          <small className="muted-copy">dist/client.js · {formatBytes(state.bytes ?? 0)}</small>
          <pre className="client-source-code"><code>{state.content}</code></pre>
        </>
      ) : null}
    </div>
  );
}
