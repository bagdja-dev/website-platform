'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type WorkflowStatus =
  | 'pending'
  | 'curating'
  | 'invited'
  | 'discussion'
  | 'approved'
  | 'rejected';

type ChecklistTopic =
  | 'portfolio'
  | 'design_decisions'
  | 'feedback_handling'
  | 'workflow'
  | 'collaboration';

type AccessRequest = {
  id: string;
  email: string;
  name: string;
  portfolio_url: string | null;
  message: string | null;
  status: WorkflowStatus;
  review_note: string | null;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  internal_notes: string | null;
  discussion_checklist: ChecklistTopic[];
  created_at: string;
  updated_at: string;
};

type RequestStatusFilter = 'all' | WorkflowStatus;
type AccessTab = 'requests' | 'invitations' | 'activity';

type Invitation = {
  id: string;
  email: string;
  role: 'designer' | 'reviewer';
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type AuditLog = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown>;
  created_at: string;
};

type CreatedInvitation = {
  email: string;
  role: 'designer' | 'reviewer';
  token: string;
  expiresAt: string;
  emailSent: boolean;
};

const statuses: { id: WorkflowStatus; label: string }[] = [
  { id: 'pending', label: 'Pengajuan baru' },
  { id: 'curating', label: 'Kurasi profil' },
  { id: 'invited', label: 'Diundang' },
  { id: 'discussion', label: 'Diskusi' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'rejected', label: 'Ditolak' },
];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? (payload as { message?: unknown }).message
        : null;
    throw new Error(
      typeof message === 'string'
        ? message
        : 'Permintaan belum dapat diproses.',
    );
  }
  return payload as T;
}

async function fetchAccessLists() {
  return Promise.all([
    requestJson<AccessRequest[]>('/api/platform/access-requests'),
    requestJson<Invitation[]>('/api/platform/invitations'),
    requestJson<AuditLog[]>('/api/platform/audit-logs'),
  ]);
}

function statusLabel(status: WorkflowStatus): string {
  return statuses.find((item) => item.id === status)?.label ?? status;
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    'access_request.created': 'Permohonan dikirim',
    'access_request.stage_changed': 'Tahap onboarding diperbarui',
    'access_request.approved': 'Designer disetujui',
    'access_request.rejected': 'Permohonan ditolak',
    'access_request.details_updated': 'Catatan atau PIC diperbarui',
  };
  return labels[action] ?? action.replaceAll('.', ' ');
}

export function AccessManagement() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [newInvitation, setNewInvitation] =
    useState<CreatedInvitation | null>(null);
  const [requestStatus, setRequestStatus] =
    useState<RequestStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<AccessTab>('requests');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [requestRows, invitationRows, auditRows] = await fetchAccessLists();
      setError('');
      setRequests(requestRows);
      setInvitations(invitationRows);
      setAuditLogs(auditRows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Data akses belum dapat dimuat.',
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchAccessLists()
      .then(([requestRows, invitationRows, auditRows]) => {
        if (!active) return;
        setRequests(requestRows);
        setInvitations(invitationRows);
        setAuditLogs(auditRows);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Data akses belum dapat dimuat.',
        );
      });
    return () => {
      active = false;
    };
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    const formData = new FormData(form);
    try {
      const created = await requestJson<CreatedInvitation>(
        '/api/platform/invitations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.get('email'),
            role: formData.get('role'),
          }),
        },
      );
      setNewInvitation(created);
      setShowInviteModal(false);
      form.reset();
      await load();
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : 'Undangan belum dapat dibuat.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invitationId: string) {
    setBusy(true);
    setError('');
    try {
      await requestJson(`/api/platform/invitations/${invitationId}`, {
        method: 'DELETE',
      });
      await load();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : 'Undangan belum dapat dicabut.',
      );
    } finally {
      setBusy(false);
    }
  }

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');
    return requests.filter((request) => {
      const matchesStatus =
        requestStatus === 'all' || request.status === requestStatus;
      const matchesSearch =
        !normalizedSearch ||
        `${request.name} ${request.email}`
          .toLocaleLowerCase('id-ID')
          .includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [requests, requestStatus, search]);
  const invitationUrl = newInvitation
    ? `/invite/accept?token=${encodeURIComponent(newInvitation.token)}`
    : '';
  const requestStatusTabs: {
    id: RequestStatusFilter;
    label: string;
    count: number;
  }[] = [
    { id: 'all', label: 'Semua', count: requests.length },
    ...statuses.map((status) => ({
      ...status,
      count: requests.filter((request) => request.status === status.id).length,
    })),
  ];
  const accessTabs: { id: AccessTab; label: string; count: number }[] = [
    { id: 'requests', label: 'Permohonan', count: requests.length },
    { id: 'invitations', label: 'Undangan akses', count: invitations.length },
    { id: 'activity', label: 'Aktivitas', count: auditLogs.length },
  ];
  return (
    <div className="access-management">
      {error ? (
        <p className="form-message error" role="alert">
          {error}
        </p>
      ) : null}
      {newInvitation ? (
        <div
          className={`invitation-result-inline${newInvitation.emailSent ? '' : ' failed'}`}
          role={newInvitation.emailSent ? 'status' : 'alert'}
        >
          <div>
            <strong>
              {newInvitation.emailSent
                ? `Undangan ${newInvitation.role} berhasil dikirim`
                : 'Email tidak terkirim'}
            </strong>
            <span>
              {newInvitation.emailSent
                ? `Tautan penerimaan sudah dikirim ke ${newInvitation.email}.`
                : `Undangan untuk ${newInvitation.email} tersimpan, tetapi email gagal dikirim. Kamu bisa membagikan tautan ini secara manual.`}{' '}
              Berlaku sampai{' '}
              {new Date(newInvitation.expiresAt).toLocaleString('id-ID')}.
            </span>
          </div>
          {!newInvitation.emailSent ? (
            <div className="invitation-result-actions">
              <input
                aria-label="Tautan undangan akses"
                readOnly
                value={invitationUrl}
              />
              <button
                className="secondary-link"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    new URL(invitationUrl, window.location.origin).toString(),
                  )
                }
                type="button"
              >
                Salin tautan
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="content-card access-workspace">
        <div className="access-workspace-header">
          <div
            className="access-main-tabs"
            role="tablist"
            aria-label="Kelola akses platform"
          >
            {accessTabs.map((tab) => (
              <button
                aria-controls={`access-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                className={`access-main-tab${activeTab === tab.id ? ' active' : ''}`}
                id={`access-main-tab-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
                <span>{tab.count}</span>
              </button>
            ))}
          </div>
          <button
            className="secondary-link refresh-button"
            disabled={busy}
            onClick={() => void load()}
            type="button"
          >
            Muat ulang
          </button>
        </div>

        {activeTab === 'requests' ? (
          <div
            aria-labelledby="access-main-tab-requests"
            className="access-tab-panel"
            id="access-panel-requests"
            role="tabpanel"
          >
            <div className="workflow-summary" aria-label="Ringkasan tahapan">
              {requestStatusTabs.map((status) => (
                <button
                  className={`workflow-summary-card${requestStatus === status.id ? ' selected' : ''}`}
                  key={status.id}
                  onClick={() => setRequestStatus(status.id)}
                  type="button"
                >
                  <span>{status.label}</span>
                  <strong>{status.count}</strong>
                </button>
              ))}
            </div>

            <div className="request-list-toolbar">
              <label>
                <span className="sr-only">Cari designer</span>
                <input
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="Cari nama atau email"
                  type="search"
                  value={search}
                />
              </label>
              <span>{filteredRequests.length} permohonan</span>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="tab-empty-state" id="access-request-list">
                <p className="muted-copy">
                  {requests.length === 0
                    ? 'Belum ada permohonan designer.'
                    : 'Tidak ada permohonan yang cocok dengan pencarian atau filter ini.'}
                </p>
              </div>
            ) : (
              <div className="table-scroll" id="access-request-list">
                <table className="access-table">
                  <thead>
                    <tr>
                      <th>Designer</th>
                      <th>Portofolio</th>
                      <th>Tahap</th>
                      <th>PIC</th>
                      <th>Diajukan</th>
                      <th>
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <Link
                            className="candidate-link"
                            href={`/access/requests/${request.id}`}
                          >
                            {request.name}
                          </Link>
                          <span>{request.email}</span>
                        </td>
                        <td>
                          {request.portfolio_url ? (
                            <a
                              className="table-link"
                              href={request.portfolio_url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Buka portofolio ↗
                            </a>
                          ) : (
                            <span className="table-muted">Belum ada</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-badge status-${request.status}`}
                          >
                            {statusLabel(request.status)}
                          </span>
                        </td>
                        <td>
                          {request.assigned_to_name ?? 'Belum ditetapkan'}
                        </td>
                        <td>
                          {new Date(request.created_at).toLocaleDateString(
                            'id-ID',
                          )}
                        </td>
                        <td>
                          <Link
                            className="table-action"
                            href={`/access/requests/${request.id}`}
                          >
                            Detail
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        ) : null}

        {activeTab === 'invitations' ? (
          <div
            aria-labelledby="access-main-tab-invitations"
            className="access-tab-panel"
            id="access-panel-invitations"
            role="tabpanel"
          >
            <div className="invite-toolbar">
              <div>
                <h2>Undang designer atau reviewer ke platform</h2>
                <p>
                  Penerima dapat mendaftar akun Bagdja dengan email yang
                  diundang, lalu menerima akses sesuai role.
                </p>
              </div>
              <button
                className="primary-link"
                disabled={busy}
                onClick={() => {
                  setError('');
                  setNewInvitation(null);
                  setShowInviteModal(true);
                }}
                type="button"
              >
                Buat undangan
              </button>
            </div>
            {invitations.length === 0 ? (
              <div className="tab-empty-state">
                <p className="muted-copy">Belum ada undangan akses.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="access-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Berlaku sampai</th>
                      <th>
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((invitation) => {
                      const status = invitation.accepted_at
                        ? 'Diterima'
                        : invitation.revoked_at
                          ? 'Dicabut'
                          : new Date(invitation.expires_at) < new Date()
                            ? 'Kedaluwarsa'
                            : 'Menunggu';
                      const canRevoke =
                        !invitation.accepted_at &&
                        !invitation.revoked_at &&
                        new Date(invitation.expires_at) >= new Date();
                      return (
                        <tr key={invitation.id}>
                          <td>
                            <strong>{invitation.email}</strong>
                          </td>
                          <td className="table-capitalize">{invitation.role}</td>
                          <td>
                            <span className="status-badge status-neutral">
                              {status}
                            </span>
                          </td>
                          <td>
                            {new Date(invitation.expires_at).toLocaleDateString(
                              'id-ID',
                            )}
                          </td>
                          <td>
                            {canRevoke ? (
                              <button
                                className="table-action danger"
                                disabled={busy}
                                onClick={() => void revoke(invitation.id)}
                                type="button"
                              >
                                Cabut
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'activity' ? (
          <div
            aria-labelledby="access-main-tab-activity"
            className="access-tab-panel"
            id="access-panel-activity"
            role="tabpanel"
          >
            {auditLogs.length === 0 ? (
              <div className="tab-empty-state">
                <p className="muted-copy">Belum ada aktivitas akses.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="access-table">
                  <thead>
                    <tr>
                      <th>Aktivitas</th>
                      <th>Objek</th>
                      <th>Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{actionLabel(entry.action)}</strong>
                        </td>
                        <td>{entry.entity_type}</td>
                        <td>
                          {new Date(entry.created_at).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>
      {showInviteModal ? (
        <div className="invite-modal-backdrop">
          <section
            aria-labelledby="invite-modal-title"
            aria-modal="true"
            className="invite-modal"
            role="dialog"
          >
            <div className="invite-modal-header">
              <div>
                <p className="access-eyebrow">Undangan akses</p>
                <h2 id="invite-modal-title">Undang ke Website Platform</h2>
                <p>
                  Undangan akan dikirim melalui email. Jika belum punya akun
                  Bagdja, penerima bisa mendaftar menggunakan email ini.
                </p>
              </div>
              <button
                aria-label="Tutup popup undangan"
                className="invite-modal-close"
                disabled={busy}
                onClick={() => setShowInviteModal(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="platform-form invite-modal-form" onSubmit={invite}>
              <label>
                Email penerima
                <input
                  autoComplete="email"
                  maxLength={320}
                  name="email"
                  placeholder="nama@email.com"
                  required
                  type="email"
                />
              </label>
              <label>
                Role
                <select defaultValue="designer" name="role">
                  <option value="designer">Designer</option>
                  <option value="reviewer">Reviewer</option>
                </select>
              </label>
              <p className="invite-modal-note">
                Tautan berlaku 7 hari dan hanya bisa diterima oleh akun Bagdja
                dengan email yang sama.
              </p>
              <div className="invite-modal-actions">
                <button
                  className="secondary-link"
                  disabled={busy}
                  onClick={() => setShowInviteModal(false)}
                  type="button"
                >
                  Batal
                </button>
                <button className="primary-link" disabled={busy} type="submit">
                  {busy ? 'Mengirim…' : 'Kirim undangan'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
