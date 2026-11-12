"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

import { sortDiscussionMessages } from "@/lib/discussion-message-order.mjs";

type DiscussionMessage = {
  id: string;
  senderUserId: string;
  senderRole?: "designer" | "reviewer" | null;
  senderDisplayName: string | null;
  body: string;
  createdAt: string;
};

type DiscussionResponse = {
  requestId: string;
  status:
    | "pending"
    | "curating"
    | "invited"
    | "discussion"
    | "approved"
    | "rejected"
    | "draft"
    | "submitted"
    | "in_review"
    | "changes_requested";
  topicId: string | null;
  viewerUserId: string;
  viewerRole?: "designer" | "reviewer";
  applicantName?: string;
  applicantEmail?: string;
  messages: DiscussionMessage[];
};

function getEventData(
  event: unknown,
): { eventName: string; data: Record<string, unknown> } | null {
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const envelope = event as Record<string, unknown>;
  const payload =
    envelope.data &&
    typeof envelope.data === "object" &&
    !Array.isArray(envelope.data)
      ? (envelope.data as Record<string, unknown>)
      : envelope;
  const data =
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : payload;
  const eventName =
    typeof payload.eventName === "string"
      ? payload.eventName
      : typeof envelope.eventName === "string"
        ? envelope.eventName
        : "";
  return { eventName, data };
}

async function readResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? body.message
        : null;
    throw new Error(
      typeof message === "string" ? message : "Diskusi belum dapat dimuat.",
    );
  }
  return body as T;
}

export function AccessRequestDiscussion({
  requestId,
  submissionId,
  realtimeMessageEvent,
  realtimeState: sharedRealtimeState,
}: {
  requestId?: string;
  submissionId?: string;
  realtimeMessageEvent?: { topicId: string; id: string } | null;
  realtimeState?: "connecting" | "connected" | "disconnected" | "channel-unavailable";
}) {
  const [discussion, setDiscussion] = useState<DiscussionResponse | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [realtimeState, setRealtimeState] = useState<
    "connecting" | "connected" | "disconnected" | "channel-unavailable"
  >("connecting");
  const messagesRef = useRef<HTMLOListElement>(null);
  const topicIdRef = useRef<string | null>(null);
  const lastSharedMessageIdRef = useRef<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const usesSharedRealtime = sharedRealtimeState !== undefined;
  const displayRealtimeState = sharedRealtimeState ?? realtimeState;

  const endpoint = submissionId
    ? `/api/platform/templates/submissions/${submissionId}/discussion`
    : requestId
      ? `/api/platform/access-requests/${requestId}/discussion`
      : "/api/platform/access-requests/mine/discussion";
  const isTemplateDiscussion = Boolean(submissionId);

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await readResponse<DiscussionResponse>(response);
    setDiscussion({
      ...result,
      messages: sortDiscussionMessages(result.messages),
    });
    topicIdRef.current = result.topicId;
    setError("");
  }, [endpoint]);

  useEffect(() => {
    let active = true;
    async function initialLoad() {
      try {
        await load();
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Diskusi belum dapat dimuat.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialLoad();
    let socket: Socket | null = null;
    let tokenRetryTimer: number | null = null;
    async function connectRealtime() {
      try {
        const response = await fetch("/api/realtime/ws-token", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Realtime token request failed (${response.status})`);
        }
        const payload: unknown = await response.json();
        if (!active) return;
        if (
          !payload ||
          typeof payload !== "object" ||
          !("access_token" in payload) ||
          typeof payload.access_token !== "string" ||
          !payload.access_token
        ) {
          throw new Error("Realtime token response is invalid");
        }

        const eventServiceUrl =
          process.env.NEXT_PUBLIC_EVENT_API ?? "https://event.bagdja.com";
        socket = io(`${eventServiceUrl.replace(/\/$/, "")}/events`, {
          auth: { token: payload.access_token },
          transports: ["websocket"],
        });
        socket.on("connect", () => {
          if (active) setRealtimeState("connecting");
        });
        socket.on(
          "authenticated",
          (auth: { channels?: unknown } | undefined) => {
            const channels = Array.isArray(auth?.channels)
              ? auth.channels.filter(
                  (channel): channel is string => typeof channel === "string",
                )
              : [];
            const canReceiveChatMessages = channels.some((channel) =>
              channel.endsWith(".bagdja.chat.message.created"),
            );
            if (active) {
              setRealtimeState(
                canReceiveChatMessages ? "connected" : "channel-unavailable",
              );
            }
            if (!canReceiveChatMessages) {
              console.error(
                "[AccessRequestDiscussion] realtime token has no chat message channel",
              );
            }
          },
        );
        socket.on("connect_error", (connectError) => {
          console.error(
            "[AccessRequestDiscussion] realtime connection failed:",
            connectError,
          );
          if (active) setRealtimeState("disconnected");
        });
        socket.on("disconnect", () => {
          if (active) setRealtimeState("disconnected");
        });
        socket.on("event", (event: unknown) => {
          const parsed = getEventData(event);
          if (!parsed) return;
          const eventPayload = parsed.data;
          const eventTopicId =
            typeof eventPayload.topicId === "string"
              ? eventPayload.topicId
              : typeof eventPayload.topic_id === "string"
                ? eventPayload.topic_id
                : null;
          if (
            parsed.eventName === "bagdja.chat.message.created" &&
            eventTopicId &&
            eventTopicId === topicIdRef.current
          ) {
            const eventId =
              typeof eventPayload.messageId === "string"
                ? eventPayload.messageId
                : typeof eventPayload.message_id === "string"
                  ? eventPayload.message_id
                  : `${eventTopicId}:${Date.now()}`;
            window.dispatchEvent(
              new CustomEvent("website-platform:inbox-message", {
                detail: { topicId: eventTopicId, id: eventId },
              }),
            );
            void load().catch((loadError: unknown) => {
              if (active) {
                setError(
                  loadError instanceof Error
                    ? loadError.message
                    : "Diskusi belum dapat diperbarui.",
                );
              }
            });
          }
        });
      } catch (realtimeError) {
        console.error(
          "[AccessRequestDiscussion] realtime setup failed:",
          realtimeError,
        );
        if (active) setRealtimeState("disconnected");
        if (active) {
          tokenRetryTimer = window.setTimeout(() => {
            void connectRealtime();
          }, 5000);
        }
      }
    }

    if (!usesSharedRealtime) void connectRealtime();
    return () => {
      active = false;
      if (tokenRetryTimer !== null) window.clearTimeout(tokenRetryTimer);
      socket?.disconnect();
    };
  }, [load, usesSharedRealtime]);

  useEffect(() => {
    topicIdRef.current = discussion?.topicId ?? null;
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [discussion]);

  useEffect(() => {
    if (
      !usesSharedRealtime ||
      !realtimeMessageEvent ||
      realtimeMessageEvent.id === lastSharedMessageIdRef.current
    ) {
      return;
    }
    lastSharedMessageIdRef.current = realtimeMessageEvent.id;
    if (realtimeMessageEvent.topicId !== topicIdRef.current) return;
    void load().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Diskusi belum dapat diperbarui.",
      );
    });
  }, [load, realtimeMessageEvent, usesSharedRealtime]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = body.trim();
    if (!message) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: message }),
      });
      const result = await readResponse<{
        activityUpdated: boolean;
        emailSent?: boolean;
      }>(response);
      setBody("");
      if (composerRef.current) composerRef.current.style.height = "";
      const warnings: string[] = [];
      if (result.emailSent === false) {
        warnings.push("notifikasi email belum berhasil dikirim");
      }
      if (!result.activityUpdated) {
        warnings.push("urutan inbox mungkin belum diperbarui");
      }
      await load();
      if (warnings.length) setError(warnings.join(" dan "));
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Pesan belum dapat dikirim.",
      );
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  if (loading) {
    return (
      <section
        className={`discussion-card${requestId || submissionId ? " discussion-card-inbox" : ""}`}
        aria-label={isTemplateDiscussion ? "Diskusi template" : "Diskusi permohonan"}
      >
        <div className="discussion-loading" role="status" aria-label="Memuat percakapan">
          <span aria-hidden="true" className="discussion-spinner" />
          <span className="sr-only">Memuat percakapan…</span>
        </div>
      </section>
    );
  }
  if (!discussion) {
    return (
      <p className="form-message error" role="alert">
        {error || "Ruang diskusi tidak tersedia untuk akun ini."}
      </p>
    );
  }

  return (
    <section
      className={`discussion-card${requestId || submissionId ? " discussion-card-inbox" : ""}`}
      aria-label={isTemplateDiscussion ? "Diskusi template" : "Diskusi permohonan"}
    >
      <div className="discussion-heading">
        <div>
          <p className="access-eyebrow">
            {isTemplateDiscussion
              ? "Inbox template"
              : requestId
                ? "Inbox kurasi"
                : "Diskusi permohonan designer"}
          </p>
          <h2>
            {isTemplateDiscussion
              ? `Review template: ${discussion.applicantName ?? "template"}`
              : requestId
                ? `Permohonan dari ${discussion.applicantName ?? "kandidat"}`
                : "Percakapan dengan tim Bagdja"}
          </h2>
          {(requestId || isTemplateDiscussion) && discussion.applicantEmail ? (
            <p className="discussion-contact">{discussion.applicantEmail}</p>
          ) : null}
        </div>
        <div className="discussion-heading-meta">
          <span className={`status-badge status-${discussion.status}`}>
            {discussion.status === "invited"
              ? "Undangan diskusi"
              : discussion.status === "discussion"
                ? "Diskusi aktif"
                : "Riwayat diskusi"}
          </span>
          <span
            className={`discussion-realtime${displayRealtimeState === "connected" ? " is-connected" : ""}`}
            role="status"
          >
            <span aria-hidden="true" />
            {displayRealtimeState === "connected"
              ? "Realtime aktif"
              : displayRealtimeState === "connecting"
                ? "Menyambung…"
                : displayRealtimeState === "channel-unavailable"
                  ? "Kanal chat belum tersedia"
                  : "Realtime terputus"}
          </span>
        </div>
      </div>
      {!requestId && !isTemplateDiscussion ? (
        <p className="table-muted">
          Ruang ini hanya untuk membahas permohonan designer dan tidak
          memberikan akses ke fitur kerja designer.
        </p>
      ) : null}
      {error ? (
        <p className="form-message error" role="alert">
          {error}
        </p>
      ) : null}
      <ol className="discussion-messages" aria-live="polite" ref={messagesRef}>
        {discussion.status === "invited" ? (
          <li className="discussion-empty">
            Tim kurasi akan memulai diskusi dan membuka kanal percakapan untuk
            permohonan ini. Kamu akan dapat mengirim pesan setelah kanal
            tersedia.
          </li>
        ) : discussion.messages.length === 0 ? (
          <li className="discussion-empty">
            Belum ada pesan. Kamu dapat memulai percakapan di bawah.
          </li>
        ) : (
          discussion.messages.map((message) => {
            const ownMessage = isTemplateDiscussion && message.senderRole
              ? message.senderRole === discussion.viewerRole
              : message.senderUserId === discussion.viewerUserId;
            const senderRole =
              message.senderRole === "designer"
                ? "Designer"
                : message.senderRole === "reviewer"
                  ? "Reviewer"
                  : discussion.viewerRole === "designer"
                    ? "Reviewer"
                    : "Designer";
            const senderName = message.senderDisplayName?.trim();
            return (
              <li
                className={`discussion-message${ownMessage ? " is-own" : ""}`}
                key={message.id}
              >
                <div className="discussion-message-meta">
                  <strong>
                    {ownMessage
                      ? "Kamu"
                      : isTemplateDiscussion
                        ? `${senderRole} · ${senderName || (senderRole === "Reviewer" ? "Tim Bagdja" : "Designer")}`
                        : senderName || "Tim Bagdja"}
                  </strong>
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString("id-ID")}
                  </time>
                </div>
                <p>{message.body}</p>
              </li>
            );
          })
        )}
      </ol>
      {discussion.status === "discussion" && discussion.topicId ? (
        <form className="discussion-composer" onSubmit={send}>
          <label className="sr-only" htmlFor="discussion-message">
            Pesan
          </label>
          <div className="discussion-composer-input">
            <textarea
              id="discussion-message"
              maxLength={5000}
              onChange={(event) => {
                const textarea = event.currentTarget;
                setBody(textarea.value);
                textarea.style.height = "auto";
                textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  if (!sending && body.trim()) {
                    event.currentTarget.form?.requestSubmit();
                  }
                }
              }}
              placeholder="Tulis pesan…"
              required
              ref={composerRef}
              rows={1}
              value={body}
            />
            <button
              aria-label={sending ? "Mengirim pesan" : "Kirim pesan"}
              className={`discussion-send-button${sending ? " is-sending" : ""}`}
              disabled={sending || !body.trim()}
              type="submit"
            >
              {sending ? (
                <span aria-hidden="true" className="discussion-spinner" />
              ) : (
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="19"
                  viewBox="0 0 24 24"
                  width="19"
                >
                  <path
                    d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              )}
            </button>
          </div>
          <span className="discussion-composer-hint">
            Enter untuk mengirim · Shift+Enter untuk baris baru
          </span>
        </form>
      ) : null}
    </section>
  );
}
