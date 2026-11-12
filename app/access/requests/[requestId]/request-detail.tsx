"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WorkflowStatus =
  "pending" | "curating" | "invited" | "discussion" | "approved" | "rejected";

type ChecklistTopic =
  | "portfolio"
  | "design_decisions"
  | "feedback_handling"
  | "workflow"
  | "collaboration";

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

type AuditLog = {
  id: string;
  actor_user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

type RequestDetails = {
  request: AccessRequest;
  timeline: AuditLog[];
};

type CreatedInvitation = {
  token: string;
  expiresAt: string;
  email: string;
  emailSent: boolean;
};

const statuses: { id: WorkflowStatus; label: string }[] = [
  { id: "pending", label: "Pengajuan baru" },
  { id: "curating", label: "Kurasi profil" },
  { id: "invited", label: "Diundang" },
  { id: "discussion", label: "Diskusi" },
  { id: "approved", label: "Disetujui" },
  { id: "rejected", label: "Ditolak" },
];

const checklistTopics: { id: ChecklistTopic; label: string }[] = [
  { id: "portfolio", label: "Bedah portofolio dan proses berkarya" },
  { id: "design_decisions", label: "Alasan di balik keputusan desain" },
  {
    id: "feedback_handling",
    label: "Cara menerima dan menindaklanjuti masukan",
  },
  { id: "workflow", label: "Alur kerja dan komunikasi" },
  { id: "collaboration", label: "Ekspektasi kolaborasi" },
];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as { message?: unknown }).message
        : null;
    throw new Error(
      typeof message === "string"
        ? message
        : "Permintaan belum dapat diproses.",
    );
  }
  return payload as T;
}

function statusLabel(status: WorkflowStatus): string {
  return statuses.find((item) => item.id === status)?.label ?? status;
}

function nextStatus(status: WorkflowStatus): WorkflowStatus | null {
  if (status === "pending") return "curating";
  if (status === "curating") return "invited";
  if (status === "invited") return "discussion";
  return null;
}

function statusActionLabel(status: WorkflowStatus): string {
  if (status === "pending") return "Mulai kurasi";
  if (status === "curating") return "Tandai sudah diundang";
  return "Mulai diskusi";
}

function statusIndex(status: WorkflowStatus): number {
  return ["pending", "curating", "invited", "discussion", "approved"].indexOf(
    status,
  );
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    "access_request.created": "Permohonan dikirim",
    "access_request.stage_changed": "Tahap onboarding diperbarui",
    "access_request.approved": "Designer disetujui",
    "access_request.rejected": "Permohonan ditolak",
    "access_request.details_updated": "Catatan atau PIC diperbarui",
  };
  return labels[action] ?? action.replaceAll(".", " ");
}

export function AccessRequestDetail({ requestId }: { requestId: string }) {
  const [details, setDetails] = useState<RequestDetails | null>(null);
  const [invitation, setInvitation] = useState<CreatedInvitation | null>(null);
  const [internalNotes, setInternalNotes] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [discussionChecklist, setDiscussionChecklist] = useState<
    ChecklistTopic[]
  >([]);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState("");
  const [notificationLink, setNotificationLink] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await requestJson<RequestDetails>(
      `/api/platform/access-requests/${requestId}`,
    );
    setDetails(result);
    setInternalNotes(result.request.internal_notes ?? "");
    setDecisionNote(result.request.review_note ?? "");
    setDiscussionChecklist(result.request.discussion_checklist ?? []);
  }, [requestId]);

  useEffect(() => {
    let active = true;
    void requestJson<RequestDetails>(
      `/api/platform/access-requests/${requestId}`,
    )
      .then((result) => {
        if (!active) return;
        setDetails(result);
        setInternalNotes(result.request.internal_notes ?? "");
        setDecisionNote(result.request.review_note ?? "");
        setDiscussionChecklist(result.request.discussion_checklist ?? []);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Detail permohonan belum dapat dimuat.",
        );
      });
    return () => {
      active = false;
    };
  }, [requestId]);

  async function updateRequest(changes: {
    status?: WorkflowStatus;
    assignToMe?: boolean;
    internalNotes?: string;
    discussionChecklist?: ChecklistTopic[];
    decisionNote?: string;
  }) {
    if (!details) return;
    setBusy(true);
    setError("");
    setInvitation(null);
    try {
      const result = await requestJson<{
        request: AccessRequest;
        invitation: CreatedInvitation | null;
        notificationEmailSent?: boolean;
        discussionLink?: string;
      }>(`/api/platform/access-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: changes.status ?? details.request.status,
          internalNotes,
          discussionChecklist,
          ...changes,
        }),
      });
      setInvitation(result.invitation);
      if (result.notificationEmailSent === true) {
        setNotification("Email pembaruan permohonan berhasil dikirim.");
      } else if (result.notificationEmailSent === false) {
        setNotification(
          "Status tersimpan, tetapi email pemohon gagal dikirim.",
        );
      } else {
        setNotification("");
      }
      setNotificationLink(
        result.notificationEmailSent === false
          ? (result.discussionLink ?? "")
          : "",
      );
      await load();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Permohonan belum dapat diperbarui.",
      );
    } finally {
      setBusy(false);
    }
  }

  const request = details?.request;
  const invitationUrl = invitation
    ? `/invite/accept?token=${encodeURIComponent(invitation.token)}`
    : "";
  const rejectedFrom = details?.timeline.find(
    (entry) => entry.action === "access_request.rejected",
  )?.details?.fromStatus;
  const rejectedStatus = statuses.find((item) => item.id === rejectedFrom);
  const rejectedIndex = rejectedStatus ? statusIndex(rejectedStatus.id) : -1;

  return (
    <div className="access-management">
      <div className="detail-page-toolbar">
        <Link className="secondary-link" href="/access">
          ← Kembali ke permohonan
        </Link>
        {request ? (
          <span className={`status-badge status-${request.status}`}>
            {statusLabel(request.status)}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="form-message error" role="alert">
          {error}
        </p>
      ) : null}
      {notification ? (
        <p className="form-message" role="status">
          {notification}{" "}
          {notificationLink ? (
            <a
              className="table-link"
              href={notificationLink}
              target="_blank"
              rel="noreferrer"
            >
              Buka ruang diskusi
            </a>
          ) : null}
        </p>
      ) : null}

      {invitation && request ? (
        <div
          className={`invitation-result-inline${invitation.emailSent ? "" : " failed"}`}
          role={invitation.emailSent ? "status" : "alert"}
        >
          <div>
            <strong>
              {invitation.emailSent
                ? "Undangan designer berhasil dikirim"
                : "Email tidak terkirim"}
            </strong>
            <span>
              {invitation.emailSent
                ? `Tautan penerimaan sudah dikirim ke ${invitation.email}.`
                : `Undangan untuk ${invitation.email} tersimpan, tetapi email gagal dikirim. Kamu bisa membagikan tautan ini secara manual.`}{" "}
              Berlaku sampai{" "}
              {new Date(invitation.expiresAt).toLocaleString("id-ID")}.
            </span>
          </div>
          {!invitation.emailSent ? (
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

      {!details && !error ? (
        <p className="form-message" role="status">
          Memuat detail permohonan…
        </p>
      ) : null}

      {details && request ? (
        <section
          aria-labelledby="candidate-detail-title"
          className="candidate-detail candidate-detail-page"
        >
          <div className="candidate-detail-header">
            <div>
              <p className="access-eyebrow">Detail permohonan</p>
              <h2 id="candidate-detail-title">{request.name}</h2>
              <p>{request.email}</p>
            </div>
          </div>

          <div className="candidate-detail-grid">
            <div className="candidate-main-column">
              <div className="candidate-profile-card">
                <div className="candidate-profile-row">
                  <strong>Portofolio</strong>
                  {request.portfolio_url ? (
                    <a
                      className="table-link"
                      href={request.portfolio_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {request.portfolio_url} ↗
                    </a>
                  ) : (
                    <span className="table-muted">Belum dicantumkan</span>
                  )}
                </div>
                <div className="candidate-profile-row">
                  <strong>Motivasi, pengalaman, dan keahlian</strong>
                  <p>
                    {request.message || "Belum ada cerita yang ditambahkan."}
                  </p>
                </div>
                {request.review_note ? (
                  <div className="candidate-profile-row">
                    <strong>Catatan keputusan</strong>
                    <p>{request.review_note}</p>
                  </div>
                ) : null}
              </div>

              <div className="candidate-form-card">
                <label className="candidate-field">
                  <span>Catatan internal</span>
                  <textarea
                    maxLength={5000}
                    onChange={(event) =>
                      setInternalNotes(event.currentTarget.value)
                    }
                    placeholder="Catat hal penting dari profil dan proses kurasi."
                    rows={4}
                    value={internalNotes}
                  />
                </label>

                {request.status === "discussion" ? (
                  <fieldset className="discussion-checklist">
                    <legend>Topik diskusi</legend>
                    {checklistTopics.map((topic) => (
                      <label key={topic.id}>
                        <input
                          checked={discussionChecklist.includes(topic.id)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setDiscussionChecklist((current) =>
                              checked
                                ? [...current, topic.id]
                                : current.filter((item) => item !== topic.id),
                            );
                          }}
                          type="checkbox"
                        />
                        {topic.label}
                      </label>
                    ))}
                  </fieldset>
                ) : null}

                {!["approved", "rejected"].includes(request.status) ? (
                  <label className="candidate-field">
                    <span>Alasan keputusan (wajib saat menolak)</span>
                    <textarea
                      maxLength={2000}
                      onChange={(event) =>
                        setDecisionNote(event.currentTarget.value)
                      }
                      placeholder="Catat alasan keputusan akhir."
                      rows={2}
                      value={decisionNote}
                    />
                  </label>
                ) : null}

                <div className="candidate-form-actions">
                  <button
                    className="secondary-link"
                    disabled={busy}
                    onClick={() =>
                      void updateRequest({
                        internalNotes,
                        discussionChecklist,
                      })
                    }
                    type="button"
                  >
                    Simpan catatan
                  </button>
                  {request.assigned_to_user_id ? (
                    <span className="assignment-label">
                      PIC: {request.assigned_to_name}
                    </span>
                  ) : null}
                  {!["approved", "rejected"].includes(request.status) ? (
                    <button
                      className="secondary-link"
                      disabled={busy}
                      onClick={() => void updateRequest({ assignToMe: true })}
                      type="button"
                    >
                      Tetapkan saya sebagai PIC
                    </button>
                  ) : null}
                </div>
              </div>

              {!["approved", "rejected"].includes(request.status) ? (
                <div className="candidate-decision-actions">
                  {nextStatus(request.status) ? (
                    <div>
                      {request.status === "curating" ? (
                        <p>
                          Kandidat akan menerima email untuk masuk ke ruang
                          diskusi terbatas. Ini bukan undangan akses designer.
                        </p>
                      ) : null}
                      <button
                        className="primary-link"
                        disabled={busy}
                        onClick={() =>
                          void updateRequest({
                            status: nextStatus(request.status) ?? undefined,
                          })
                        }
                        type="button"
                      >
                        {statusActionLabel(request.status)}
                      </button>
                    </div>
                  ) : null}
                  {request.status === "discussion" ? (
                    <button
                      className="primary-link"
                      disabled={busy}
                      onClick={() =>
                        void updateRequest({
                          status: "approved",
                          decisionNote,
                        })
                      }
                      type="button"
                    >
                      Setujui dan buat undangan akses
                    </button>
                  ) : null}
                  <button
                    className="table-action danger"
                    disabled={busy || !decisionNote.trim()}
                    onClick={() =>
                      void updateRequest({
                        status: "rejected",
                        decisionNote,
                      })
                    }
                    type="button"
                  >
                    Tolak permohonan
                  </button>
                </div>
              ) : null}
              {request.status === "discussion" ? (
                <Link
                  className="primary-link"
                  href={`/inbox?requestId=${encodeURIComponent(request.id)}`}
                >
                  Buka inbox diskusi
                </Link>
              ) : null}
            </div>

            <aside className="candidate-history">
              <h3>Proses kurasi</h3>
              <ol className="candidate-timeline">
                {statuses.slice(0, 5).map((status, index) => {
                  const currentIndex = statusIndex(request.status);
                  const complete =
                    request.status === "rejected"
                      ? index <= rejectedIndex
                      : index < currentIndex;
                  const current =
                    request.status !== "rejected" && index === currentIndex;
                  return (
                    <li
                      className={`${complete ? "complete " : ""}${current ? "current" : ""}`}
                      key={status.id}
                    >
                      <span>{complete ? "✓" : index + 1}</span>
                      <div>
                        <strong>{status.label}</strong>
                        {current ? <small>Tahap saat ini</small> : null}
                      </div>
                    </li>
                  );
                })}
                {request.status === "rejected" ? (
                  <li className="rejected">
                    <span>×</span>
                    <div>
                      <strong>Ditolak</strong>
                      <small>Tahap akhir</small>
                    </div>
                  </li>
                ) : null}
              </ol>
              <h3>Riwayat aktivitas</h3>
              {details.timeline.length === 0 ? (
                <p className="table-muted">Belum ada riwayat.</p>
              ) : (
                <ol className="audit-timeline">
                  {details.timeline.map((entry) => (
                    <li key={entry.id}>
                      <strong>{actionLabel(entry.action)}</strong>
                      <span>
                        {entry.actor_user_id
                          ? `Oleh ${entry.actor_user_id.slice(0, 8)} · `
                          : ""}
                        {new Date(entry.created_at).toLocaleString("id-ID")}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}
