"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AccessRequestDiscussion } from "./access-request-discussion";

type InboxRequest = {
  kind: "access" | "template";
  id: string;
  topicId: string;
  name: string;
  email: string;
  status: string;
  assignedToName: string | null;
  updatedAt: string;
  createdAt: string;
  packageName?: string;
  packageVersion?: string;
};

type RealtimeState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "channel-unavailable";

type RealtimeMessageEvent = {
  topicId: string;
  id: string;
};

function isInboxRequest(value: unknown): value is InboxRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return (
    (request.kind === "access" || request.kind === "template") &&
    typeof request.id === "string" &&
    typeof request.topicId === "string" &&
    typeof request.name === "string" &&
    typeof request.email === "string" &&
    typeof request.status === "string" &&
    (typeof request.assignedToName === "string" ||
      request.assignedToName === null) &&
    typeof request.updatedAt === "string" &&
    typeof request.createdAt === "string"
  );
}

async function loadDiscussions(
  role: "super_admin" | "reviewer" | "designer",
): Promise<InboxRequest[]> {
  const paths = [
    "/api/platform/templates/discussions",
    ...(role === "super_admin" || role === "designer"
      ? ["/api/platform/access-requests/discussions"]
      : []),
  ];
  const responses = await Promise.all(paths.map((path) => fetch(path, {
    cache: "no-store",
  })));
  const bodies: unknown[][] = await Promise.all(responses.map(async (response) => {
    const body: unknown = await response.json();
    if (!response.ok) {
      const message =
        body && typeof body === "object" && "message" in body
          ? body.message
          : null;
      throw new Error(
        typeof message === "string" ? message : "Inbox belum dapat dimuat.",
      );
    }
    if (!Array.isArray(body)) {
      throw new Error("Respons daftar diskusi tidak valid.");
    }
    return body as unknown[];
  }));
  const templateRows = bodies[0].map((row: unknown) =>
    row && typeof row === "object" && !Array.isArray(row)
      ? { ...row, kind: "template", assignedToName: null }
      : row,
  );
  const accessRows = bodies[1]?.map((row: unknown) =>
    row && typeof row === "object" && !Array.isArray(row)
      ? { ...row, kind: "access" }
      : row,
  ) ?? [];
  const rows = [...templateRows, ...accessRows];
  if (!rows.every(isInboxRequest)) {
    throw new Error("Respons daftar diskusi memiliki data yang tidak valid.");
  }
  return rows.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AccessInbox({
  role,
  selectedRequestId,
  selectedSubmissionId,
}: {
  role: "super_admin" | "reviewer" | "designer";
  selectedRequestId?: string;
  selectedSubmissionId?: string;
}) {
  const [requests, setRequests] = useState<InboxRequest[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [realtimeState, setRealtimeState] =
    useState<RealtimeState>("connecting");
  const [realtimeMessageEvent, setRealtimeMessageEvent] =
    useState<RealtimeMessageEvent | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRequests(await loadDiscussions(role));
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Inbox belum dapat dimuat.",
      );
    }
  }, [role]);

  useEffect(() => {
    let active = true;
    async function initialLoad() {
      try {
        const loadedRequests = await loadDiscussions(role);
        if (active) {
          setRequests(loadedRequests);
          setError("");
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Inbox belum dapat dimuat.",
          );
        }
      }
    }

    void initialLoad();
    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    function receiveRealtimeState(event: Event) {
      if (!(event instanceof CustomEvent)) return;
      const state = event.detail;
      if (
        state === "connecting" ||
        state === "connected" ||
        state === "disconnected" ||
        state === "channel-unavailable"
      ) {
        setRealtimeState(state);
      }
    }

    function receiveMessage(event: Event) {
      if (!(event instanceof CustomEvent) || !event.detail) return;
      const { topicId, id } = event.detail as Partial<RealtimeMessageEvent>;
      if (typeof topicId !== "string" || typeof id !== "string") return;
      setRealtimeMessageEvent({ topicId, id });
      void refresh();
    }

    window.addEventListener(
      "website-platform:inbox-realtime-state",
      receiveRealtimeState,
    );
    window.addEventListener("website-platform:inbox-message", receiveMessage);
    return () => {
      window.removeEventListener(
        "website-platform:inbox-realtime-state",
        receiveRealtimeState,
      );
      window.removeEventListener(
        "website-platform:inbox-message",
        receiveMessage,
      );
    };
  }, [refresh]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id-ID");
    if (!term) return requests ?? [];
    return (requests ?? []).filter(
      (request) =>
        request.name.toLocaleLowerCase("id-ID").includes(term) ||
        request.email.toLocaleLowerCase("id-ID").includes(term) ||
        request.packageName?.toLocaleLowerCase("id-ID").includes(term),
    );
  }, [requests, search]);

  const selectedRequest = requests?.find(
    (request) => request.kind === "access" && request.id === selectedRequestId,
  );
  const selectedTemplate = requests?.find(
    (request) => request.kind === "template" && request.id === selectedSubmissionId,
  );
  const hasSelection = Boolean(selectedRequestId || selectedSubmissionId);

  return (
    <section className="platform-inbox" aria-label="Inbox diskusi pemohon">
      <aside
        className={`platform-inbox-list${hasSelection ? " has-selection" : ""}`}
      >
        <div className="platform-inbox-list-heading">
          <div>
            <h2>Semua percakapan</h2>
            <span>{requests?.length ?? 0} percakapan</span>
          </div>
          <button
            className="table-action"
            onClick={() => void refresh()}
            type="button"
          >
            Perbarui
          </button>
        </div>
        <label className="platform-inbox-search">
          <span className="sr-only">Cari nama, package, atau email</span>
          <input
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Cari nama, package, atau email"
            type="search"
            value={search}
          />
        </label>
        {error ? (
          <p className="form-message error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="platform-inbox-list-items">
          {requests === null && !error ? (
            <p className="table-muted platform-inbox-placeholder">
              Memuat percakapan…
            </p>
          ) : filteredRequests.length === 0 ? (
            <p className="table-muted platform-inbox-placeholder">
              {search
                ? "Tidak ada percakapan yang cocok."
                : "Belum ada percakapan template atau permohonan."}
            </p>
          ) : (
            filteredRequests.map((request) => (
              <Link
                aria-current={
                  (request.kind === "access"
                    ? request.id === selectedRequestId
                    : request.id === selectedSubmissionId)
                    ? "page"
                    : undefined
                }
                className={`platform-inbox-item${(request.kind === "access" ? request.id === selectedRequestId : request.id === selectedSubmissionId) ? " active" : ""}`}
                href={`/inbox?${request.kind === "access" ? "requestId" : "submissionId"}=${encodeURIComponent(request.id)}`}
                key={`${request.kind}-${request.id}`}
              >
                <span className="platform-inbox-avatar" aria-hidden="true">
                  {request.name.trim().charAt(0).toLocaleUpperCase("id-ID") ||
                    "?"}
                </span>
                <span className="platform-inbox-item-content">
                  <span className="platform-inbox-item-title">
                    <strong>{request.name}</strong>
                    <time dateTime={request.updatedAt}>
                      {formatTime(request.updatedAt)}
                    </time>
                  </span>
                  <span className="platform-inbox-item-email">
                    {request.kind === "template"
                      ? `${request.packageName ?? "Template"}${request.packageVersion ? ` · v${request.packageVersion}` : ""}`
                      : request.email}
                  </span>
                  <span className="platform-inbox-item-status">
                    {request.kind === "template" ? "Diskusi template" : "Diskusi permohonan"}
                    {request.assignedToName
                      ? ` · PIC ${request.assignedToName}`
                      : ""}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      </aside>

      <div
        className={`platform-inbox-conversation${hasSelection ? " has-selection" : ""}`}
      >
        {selectedRequestId && selectedRequest ? (
          <>
            <Link
              className="platform-inbox-mobile-back"
              href="/inbox"
            >
              ← Semua percakapan
            </Link>
            <AccessRequestDiscussion
              realtimeMessageEvent={role === "super_admin" ? realtimeMessageEvent : undefined}
              realtimeState={role === "super_admin" ? realtimeState : undefined}
              requestId={selectedRequest.id}
            />
          </>
        ) : selectedSubmissionId && selectedTemplate ? (
          <>
            <Link className="platform-inbox-mobile-back" href="/inbox">
              ← Semua percakapan
            </Link>
            <Link
              className="secondary-link compact inbox-submission-link"
              href={`/templates?submissionId=${encodeURIComponent(selectedTemplate.id)}`}
            >
              Lihat pengajuan template →
            </Link>
            <AccessRequestDiscussion
              realtimeMessageEvent={role === "super_admin" ? realtimeMessageEvent : undefined}
              realtimeState={role === "super_admin" ? realtimeState : undefined}
              submissionId={selectedTemplate.id}
            />
          </>
        ) : hasSelection && requests ? (
          <div className="platform-inbox-empty">
            <h2>Percakapan tidak tersedia</h2>
            <p>
              Permohonan ini tidak memiliki diskusi aktif atau aksesnya telah
              dicabut.
            </p>
            <Link className="secondary-link" href="/inbox">
              Kembali ke inbox
            </Link>
          </div>
        ) : (
          <div className="platform-inbox-empty">
            <div className="platform-inbox-empty-icon" aria-hidden="true">
              ✉
            </div>
            <h2>Pilih percakapan</h2>
            <p>
              Pilih pemohon dari daftar untuk melihat pesan dan melanjutkan
              diskusi.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
