"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

import {
  playNotificationSound,
  unlockNotificationAudio,
} from "@/lib/notification-sound";

type InboxNotification = {
  id: string;
  requestId: string;
  name: string;
  createdAt: string;
};

type InboxRequest = {
  id: string;
  topicId: string;
  name: string;
};

function isInboxRequest(value: unknown): value is InboxRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return (
    typeof request.id === "string" &&
    typeof request.topicId === "string" &&
    typeof request.name === "string"
  );
}

function isInboxNotification(value: unknown): value is InboxNotification {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const notification = value as Record<string, unknown>;
  return (
    typeof notification.id === "string" &&
    typeof notification.requestId === "string" &&
    typeof notification.name === "string" &&
    typeof notification.createdAt === "string"
  );
}

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

export function InboxNotificationBell() {
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const requestsByTopicRef = useRef<Map<string, InboxRequest>>(new Map());

  useEffect(() => {
    let active = true;
    let socket: Socket | null = null;
    let tokenRetryTimer: number | null = null;
    const unlockAudio = () => unlockNotificationAudio();
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });

    async function loadRequests() {
      const response = await fetch(
        "/api/platform/access-requests/discussions",
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(`Inbox request list failed (${response.status})`);
      }
      const body: unknown = await response.json();
      if (!Array.isArray(body) || !body.every(isInboxRequest)) {
        throw new Error("Inbox request list response is invalid");
      }
      if (active) {
        requestsByTopicRef.current = new Map(
          body.map((request) => [request.topicId, request]),
        );
      }
    }

    function broadcastRealtimeState(state: string) {
      window.dispatchEvent(
        new CustomEvent("website-platform:inbox-realtime-state", {
          detail: state,
        }),
      );
    }

    async function connectRealtime() {
      try {
        await loadRequests();
        const response = await fetch("/api/realtime/ws-token", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Realtime token request failed (${response.status})`);
        }
        const payload: unknown = await response.json();
        if (
          !payload ||
          typeof payload !== "object" ||
          !("access_token" in payload) ||
          typeof payload.access_token !== "string" ||
          !payload.access_token
        ) {
          throw new Error("Realtime token response is invalid");
        }
        if (!active) return;

        const eventServiceUrl =
          process.env.NEXT_PUBLIC_EVENT_API ?? "https://event.bagdja.com";
        socket = io(`${eventServiceUrl.replace(/\/$/, "")}/events`, {
          auth: { token: payload.access_token },
          transports: ["websocket"],
        });
        socket.on("connect", () => broadcastRealtimeState("connecting"));
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
            broadcastRealtimeState(
              canReceiveChatMessages ? "connected" : "channel-unavailable",
            );
          },
        );
        socket.on("connect_error", (connectError) => {
          console.error(
            "[InboxNotificationBell] realtime connection failed:",
            connectError,
          );
          broadcastRealtimeState("disconnected");
        });
        socket.on("disconnect", () =>
          broadcastRealtimeState("disconnected"),
        );
        socket.on("event", async (event: unknown) => {
          const parsed = getEventData(event);
          if (!parsed || parsed.eventName !== "bagdja.chat.message.created") {
            return;
          }
          const topicId =
            typeof parsed.data.topicId === "string"
              ? parsed.data.topicId
              : typeof parsed.data.topic_id === "string"
                ? parsed.data.topic_id
                : null;
          if (!topicId) return;

          const messageId =
            typeof parsed.data.messageId === "string"
              ? parsed.data.messageId
              : typeof parsed.data.message_id === "string"
                ? parsed.data.message_id
                : `${topicId}:${Date.now()}`;
          window.dispatchEvent(
            new CustomEvent("website-platform:inbox-message", {
              detail: { topicId, id: messageId },
            }),
          );

          let request = requestsByTopicRef.current.get(topicId);
          if (!request) {
            try {
              await loadRequests();
            } catch (loadError) {
              console.error(
                "[InboxNotificationBell] failed to refresh discussion list:",
                loadError,
              );
              return;
            }
            request = requestsByTopicRef.current.get(topicId);
          }
          if (!request) return;
          const selectedRequestId = new URLSearchParams(
            window.location.search,
          ).get("requestId");
          if (
            window.location.pathname === "/inbox" &&
            selectedRequestId === request.id
          ) {
            return;
          }

          const notification: InboxNotification = {
            id: messageId,
            requestId: request.id,
            name: request.name,
            createdAt: new Date().toISOString(),
          };
          playNotificationSound();
          window.dispatchEvent(
            new CustomEvent("website-platform:inbox-notification", {
              detail: notification,
            }),
          );
        });
      } catch (realtimeError) {
        console.error(
          "[InboxNotificationBell] realtime setup failed:",
          realtimeError,
        );
        if (active) {
          broadcastRealtimeState("disconnected");
          tokenRetryTimer = window.setTimeout(() => {
            void connectRealtime();
          }, 5000);
        }
      }
    }

    void connectRealtime();

    function receiveNotification(event: Event) {
      if (!(event instanceof CustomEvent) || !isInboxNotification(event.detail)) {
        return;
      }
      setNotifications((current) => [
        event.detail,
        ...current.filter((item) => item.id !== event.detail.id),
      ].slice(0, 20));
    }

    window.addEventListener(
      "website-platform:inbox-notification",
      receiveNotification,
    );
    return () => {
      active = false;
      if (tokenRetryTimer !== null) window.clearTimeout(tokenRetryTimer);
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      window.removeEventListener(
        "website-platform:inbox-notification",
        receiveNotification,
      );
      socket?.disconnect();
    };
  }, []);

  function clearNotifications() {
    setNotifications([]);
  }

  return (
    <div className="inbox-notification">
      <button
        aria-expanded={isOpen}
        aria-label={
          notifications.length
            ? `Notifikasi pesan baru, ${notifications.length} belum dibaca`
            : "Notifikasi pesan"
        }
        className="inbox-notification-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          viewBox="0 0 24 24"
          width="20"
        >
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
        {notifications.length > 0 ? (
          <span className="inbox-notification-count" aria-hidden="true">
            {notifications.length > 99 ? "99+" : notifications.length}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <section
          aria-label="Notifikasi inbox"
          className="inbox-notification-popover"
        >
          <header>
            <strong>Pesan baru</strong>
            {notifications.length > 0 ? (
              <button onClick={clearNotifications} type="button">
                Tandai dibaca
              </button>
            ) : null}
          </header>
          {notifications.length === 0 ? (
            <p className="inbox-notification-empty">Belum ada pesan baru.</p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={`/inbox?requestId=${encodeURIComponent(notification.requestId)}`}
                    onClick={() =>
                      setNotifications((current) =>
                        current.filter((item) => item.id !== notification.id),
                      )
                    }
                  >
                    <span className="inbox-notification-avatar" aria-hidden="true">
                      {notification.name.trim().charAt(0).toLocaleUpperCase("id-ID") ||
                        "?"}
                    </span>
                    <span>
                      <strong>{notification.name}</strong>
                      <span>Mengirim pesan baru</span>
                    </span>
                    <time dateTime={notification.createdAt}>
                      {new Date(notification.createdAt).toLocaleTimeString(
                        "id-ID",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
