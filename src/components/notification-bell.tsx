"use client";

/**
 * Notification bell.
 *
 * Fetches once on mount, then relies on Socket.IO for anything new — polling a
 * badge every few seconds is wasteful when the server can simply say so.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [badge, setBadge] = useState(0);
  const [open, setOpen] = useState(false);
  const csrf = useRef("");
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setBadge(data.badge ?? 0);
    } catch {
      /* the bell is not worth surfacing an error for */
    }
  }, []);

  /**
   * Initial fetch.
   *
   * Both calls are deliberately behind a promise boundary rather than invoked
   * straight from the effect body: `load` writes state, and a synchronous
   * setState inside an effect is a cascading render (and a
   * `react-hooks/set-state-in-effect` error). Chaining it after the CSRF fetch
   * also means one round trip instead of two racing ones.
   */
  useEffect(() => {
    let cancelled = false;

    fetch("/api/csrf")
      .then((res) => res.json())
      .then((data) => {
        csrf.current = data.token ?? "";
      })
      .catch(() => {})
      // The bell should still populate if the CSRF endpoint fails — that token
      // is only needed to mark notifications read, not to list them.
      .finally(() => {
        if (!cancelled) void load();
      });

    // A signed-out user unmounting mid-flight must not have state written to a
    // dead component.
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Live: a new notification bumps the badge without a refresh.
  useEffect(() => {
    if (!sessionId) return;

    const socket: Socket = io({ path: "/api/socket", auth: { sessionId } });

    socket.on("notification:new", (payload: Item & { userId: string }) => {
      // The server also emits a transient broadcast with an empty userId for
      // library-wide toasts; those are not personal notifications.
      if (!payload.userId) {
        setBadge((count) => count + 1);
        return;
      }

      setItems((prev) => [payload, ...prev].slice(0, 50));
      setBadge((count) => count + 1);
    });

    // A new announcement counts toward the same badge.
    socket.on("announcement:created", () => setBadge((count) => count + 1));

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;

    function onClick(event: MouseEvent) {
      if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.current },
      body: JSON.stringify({}),
    }).catch(() => {});

    setItems((prev) => prev.map((item) => ({ ...item, readAt: new Date().toISOString() })));
    setBadge(0);
  }

  return (
    <div className="bell" ref={panel}>
      <button
        type="button"
        className="bell-btn"
        aria-label={badge > 0 ? `${badge} unread notifications` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
      >
        <span aria-hidden="true">🔔</span>
        {badge > 0 && <em>{badge > 99 ? "99+" : badge}</em>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            {badge > 0 && (
              <button type="button" onClick={markAllRead}>Mark all read</button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="bell-empty">Nothing yet.</p>
          ) : (
            <ul className="bell-list">
              {items.map((item) => (
                <li key={item.id} className={item.readAt ? "" : "is-unread"}>
                  {item.href ? (
                    <Link href={item.href} onClick={() => setOpen(false)}>
                      <strong>{item.title}</strong>
                      {item.body && <span>{item.body}</span>}
                      <small>{item.actorName ?? "COE"} · {relative(item.createdAt)}</small>
                    </Link>
                  ) : (
                    <div>
                      <strong>{item.title}</strong>
                      {item.body && <span>{item.body}</span>}
                      <small>{relative(item.createdAt)}</small>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function relative(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
