"use client";

/**
 * Admin dashboard — live user table and activity feed.
 *
 * Two data paths feed this screen:
 *
 *   1. Fetch, for anything the admin asks for (search, filter, sort, paging).
 *   2. Socket.IO, for anything that happens elsewhere — a new signup, a login,
 *      a status change. Those arrive as events and are merged into state, which
 *      is what satisfies "appears instantly without refreshing".
 *
 * The socket only ever *adds* to what is on screen; it never re-runs the
 * query. Re-fetching on every event would fight the admin's current filters.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { LOGIN_EVENT_LABELS, USER_ROLES, ACCOUNT_STATUSES, titleCase } from "@/lib/enums";

type AdminUserRow = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  role: string;
  status: string;
  statusReason?: string | null;
  discipline: string | null;
  emailVerified: Date | string | null;
  createdAt: Date | string;
  lastLoginAt: Date | string | null;
  lastLoginIp: string | null;
  loginCount: number;
  failedLoginCount?: number;
  deletedAt?: Date | string | null;
};

type LogRow = {
  id: string;
  userId: string | null;
  username: string | null;
  email: string | null;
  type: string;
  success: boolean;
  ipAddress: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  detail: string | null;
  createdAt: string;
};

type Stats = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  bannedUsers: number;
  onlineSessions: number;
  registrationsToday: number;
};

type Props = {
  initialUsers: { users: AdminUserRow[]; total: number; page: number; pageCount: number };
  initialStats: Stats;
  initialLogs: LogRow[];
  viewer: { id: string; name: string; role: string; isSuperAdmin: boolean; sessionId: string };
};

/** Keeps the feed bounded — an admin leaving this open all day would otherwise
 *  accumulate unbounded DOM nodes. */
const MAX_LOG_ROWS = 200;

export function AdminClient({ initialUsers, initialStats, initialLogs, viewer }: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers.users);
  const [total, setTotal] = useState(initialUsers.total);
  const [page, setPage] = useState(initialUsers.page);
  const [pageCount, setPageCount] = useState(initialUsers.pageCount);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [logs, setLogs] = useState<LogRow[]>(initialLogs);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  /** Ids that just arrived over the socket, for the highlight animation. */
  const [flash, setFlash] = useState<Set<string>>(new Set());

  const csrf = useRef("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d) => { csrf.current = d.token ?? ""; })
      .catch(() => {});
  }, []);

  // --- Fetching ----------------------------------------------------------
  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      const params = new URLSearchParams({
        search, sort, order, page: String(nextPage), pageSize: "25",
      });
      if (role) params.set("role", role);
      if (status) params.set("status", status);

      try {
        const res = await fetch(`/api/admin/users?${params}`);
        const body = await res.json();

        if (!res.ok) {
          setNotice({ text: body.message ?? "Could not load accounts.", tone: "error" });
          return;
        }

        setUsers(body.users);
        setTotal(body.total);
        setPage(body.page);
        setPageCount(body.pageCount);
        if (body.stats) setStats(body.stats);
      } finally {
        setLoading(false);
      }
    },
    [search, role, status, sort, order],
  );

  // Debounced: typing a name should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(1), 300);
    return () => clearTimeout(timer);
  }, [load]);

  // --- Live updates ------------------------------------------------------
  useEffect(() => {
    if (!viewer.sessionId) return;

    const socket: Socket = io({ path: "/api/socket", auth: { sessionId: viewer.sessionId } });

    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    socket.on("connect_error", () => setLive(false));

    const highlight = (id: string) => {
      setFlash((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setFlash((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 2600);
    };

    // A brand-new account: prepend so it is the first thing the admin sees.
    socket.on("user:created", (user: AdminUserRow) => {
      setUsers((prev) => (prev.some((row) => row.id === user.id) ? prev : [user, ...prev]));
      setTotal((prev) => prev + 1);
      highlight(user.id);
    });

    socket.on("user:updated", (user: AdminUserRow) => {
      setUsers((prev) => prev.map((row) => (row.id === user.id ? { ...row, ...user } : row)));
      highlight(user.id);
    });

    socket.on("user:deleted", ({ id }: { id: string }) => {
      setUsers((prev) => prev.filter((row) => row.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    });

    socket.on("log:new", (entry: LogRow) => {
      setLogs((prev) => [entry, ...prev].slice(0, MAX_LOG_ROWS));
    });

    socket.on("stats:updated", (next: Stats) => setStats(next));

    return () => { socket.disconnect(); };
  }, [viewer.sessionId]);

  // --- Mutations ---------------------------------------------------------
  async function mutate(id: string, body: Record<string, unknown>, successText: string) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.current },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));

    setNotice(
      res.ok
        ? { text: successText, tone: "ok" }
        : { text: payload.message ?? "Action failed.", tone: "error" },
    );

    // The socket echo updates the row; no refetch needed on success.
    return res.ok;
  }

  async function removeUser(user: AdminUserRow) {
    const label = user.email ?? user.username ?? "this account";
    if (!confirm(`Delete ${label}? Their activity history is kept.`)) return;

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf.current },
    });
    const payload = await res.json().catch(() => ({}));

    setNotice(
      res.ok
        ? { text: "Account deleted.", tone: "ok" }
        : { text: payload.message ?? "Could not delete.", tone: "error" },
    );
  }

  const statTiles = useMemo(
    () => [
      { label: "Total accounts", value: stats.totalUsers, tone: "brand" },
      { label: "Active", value: stats.activeUsers, tone: "ok" },
      { label: "Inactive", value: stats.inactiveUsers, tone: "warn" },
      { label: "Banned", value: stats.bannedUsers, tone: "bad" },
      { label: "Online now", value: stats.onlineSessions, tone: "live" },
      { label: "New today", value: stats.registrationsToday, tone: "brand" },
    ],
    [stats],
  );

  return (
    <main className="adm">
      <header className="adm-head">
        <div>
          <p className="adm-kicker">Administration</p>
          <h1>Accounts &amp; activity</h1>
          <p className="adm-sub">
            Signed in as {viewer.name} · {titleCase(viewer.role)}
          </p>
        </div>
        <span className={`adm-live ${live ? "is-on" : ""}`}>
          <i />
          {live ? "Live" : "Reconnecting…"}
        </span>
      </header>

      {notice && (
        <p className={`adm-notice adm-notice-${notice.tone}`} role="status">
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </p>
      )}

      <section className="adm-stats" aria-label="Account totals">
        {statTiles.map((tile) => (
          <article key={tile.label} className={`adm-stat adm-stat-${tile.tone}`}>
            <strong>{tile.value}</strong>
            <span>{tile.label}</span>
          </article>
        ))}
      </section>

      <div className="adm-grid">
        {/* Users */}
        <section className="adm-panel" aria-label="Registered accounts">
          <div className="adm-toolbar">
            <div className="adm-search">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, username…"
                aria-label="Search accounts"
              />
            </div>
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
              <option value="">All roles</option>
              {USER_ROLES.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {ACCOUNT_STATUSES.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </select>
            <select
              value={`${sort}:${order}`}
              onChange={(e) => {
                const [nextSort, nextOrder] = e.target.value.split(":");
                setSort(nextSort);
                setOrder(nextOrder as "asc" | "desc");
              }}
              aria-label="Sort"
            >
              <option value="createdAt:desc">Newest first</option>
              <option value="createdAt:asc">Oldest first</option>
              <option value="lastLoginAt:desc">Recently active</option>
              <option value="name:asc">Name A–Z</option>
              <option value="role:asc">Role</option>
            </select>
          </div>

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Last login</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && !loading && (
                  <tr><td colSpan={6} className="adm-empty">No accounts match those filters.</td></tr>
                )}
                {users.map((user) => (
                  <tr key={user.id} className={flash.has(user.id) ? "is-new" : ""}>
                    <td>
                      <div className="adm-user">
                        <span className="adm-avatar">{initials(user.name ?? user.email ?? "?")}</span>
                        <div>
                          <strong>{user.name ?? "Unnamed"}</strong>
                          <small>{user.email}</small>
                          {user.username && <small className="adm-handle">{user.username}</small>}
                        </div>
                      </div>
                    </td>
                    <td><span className="adm-role">{titleCase(user.role)}</span></td>
                    <td><span className={`adm-status adm-status-${user.status.toLowerCase()}`}>{titleCase(user.status)}</span></td>
                    <td className="adm-date">{formatDate(user.createdAt)}</td>
                    <td className="adm-date">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}</td>
                    <td>
                      <div className="adm-actions">
                        <button type="button" onClick={() => setEditing(user)}>Edit</button>
                        {user.status === "ACTIVE" ? (
                          <button
                            type="button"
                            onClick={() => mutate(user.id, { status: "INACTIVE" }, "Account disabled.")}
                            disabled={user.id === viewer.id}
                            title={user.id === viewer.id ? "You cannot disable yourself" : "Disable"}
                          >
                            Disable
                          </button>
                        ) : (
                          <button type="button" onClick={() => mutate(user.id, { status: "ACTIVE" }, "Account enabled.")}>
                            Enable
                          </button>
                        )}
                        <button
                          type="button"
                          className="adm-danger"
                          onClick={() => removeUser(user)}
                          disabled={user.id === viewer.id}
                          title={user.id === viewer.id ? "You cannot delete yourself" : "Delete"}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="adm-pager">
            <span>{total} account{total === 1 ? "" : "s"}</span>
            <div>
              <button type="button" onClick={() => load(page - 1)} disabled={page <= 1 || loading}>Previous</button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" onClick={() => load(page + 1)} disabled={page >= pageCount || loading}>Next</button>
            </div>
          </div>
        </section>

        {/* Activity */}
        <section className="adm-panel adm-feed" aria-label="Live activity">
          <div className="adm-feed-head">
            <h2>Activity</h2>
            <small>{logs.length} recent event{logs.length === 1 ? "" : "s"}</small>
          </div>
          <ol className="adm-log">
            {logs.length === 0 && <li className="adm-empty">No activity yet.</li>}
            {logs.map((entry) => (
              <li key={entry.id} className={entry.success ? "" : "is-failed"}>
                <div className="adm-log-top">
                  <strong>{LOGIN_EVENT_LABELS[entry.type as keyof typeof LOGIN_EVENT_LABELS] ?? titleCase(entry.type)}</strong>
                  <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
                </div>
                <p>{entry.username ?? entry.email ?? "Unknown account"}</p>
                <small>
                  {[entry.browser, entry.os, entry.device].filter(Boolean).join(" · ") || "Unknown device"}
                  {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
                </small>
                {entry.detail && <small className="adm-log-detail">{entry.detail}</small>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {editing && (
        <EditDialog
          user={editing}
          canChangeRole={viewer.isSuperAdmin}
          onClose={() => setEditing(null)}
          onSave={async (changes) => {
            const ok = await mutate(editing.id, changes, "Account updated.");
            if (ok) setEditing(null);
          }}
        />
      )}
    </main>
  );
}

/** Edit dialog. Sends only the fields that actually changed. */
function EditDialog({
  user, canChangeRole, onClose, onSave,
}: {
  user: AdminUserRow;
  canChangeRole: boolean;
  onClose: () => void;
  onSave: (changes: Record<string, unknown>) => void;
}) {
  return (
    <div className="adm-modal" role="dialog" aria-modal="true" aria-label="Edit account">
      <div className="adm-modal-card">
        <h3>Edit account</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const changes: Record<string, unknown> = {};

            // Diffing keeps the audit log meaningful — it records what changed,
            // not every field on the form.
            const put = (key: string, current: string | null | undefined) => {
              const next = String(data.get(key) ?? "").trim();
              if (next && next !== (current ?? "")) changes[key] = next;
            };

            put("name", user.name);
            put("username", user.username);
            put("email", user.email);
            put("discipline", user.discipline);
            put("status", user.status);
            if (canChangeRole) put("role", user.role);

            const reason = String(data.get("statusReason") ?? "").trim();
            if (changes.status && reason) changes.statusReason = reason;

            if (Object.keys(changes).length === 0) {
              onClose();
              return;
            }

            onSave(changes);
          }}
        >
          <label><span>Full name</span><input name="name" defaultValue={user.name ?? ""} /></label>
          <label><span>Username</span><input name="username" defaultValue={user.username ?? ""} /></label>
          <label><span>Email</span><input name="email" type="email" defaultValue={user.email ?? ""} /></label>
          <label><span>Course</span><input name="discipline" defaultValue={user.discipline ?? ""} placeholder="CE / EE" /></label>

          <label>
            <span>Role</span>
            <select name="role" defaultValue={user.role} disabled={!canChangeRole}>
              {USER_ROLES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
            {!canChangeRole && <em>Only full administrators can change roles.</em>}
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={user.status}>
              {ACCOUNT_STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
          </label>

          <label><span>Reason (optional)</span><input name="statusReason" defaultValue={user.statusReason ?? ""} placeholder="Recorded in the audit log" /></label>

          <div className="adm-modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="adm-primary">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatDate(value: Date | string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
