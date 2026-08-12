"use client";

/**
 * Library browser: search, filter, sort, and per-material actions.
 *
 * Replaces the static "recently added" list. Fetches through
 * /api/library/materials so filtering happens in SQL against indexed columns
 * rather than in the browser over a full download.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Material = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  extension: string | null;
  sizeBytes: number;
  subject: string | null;
  course: string | null;
  tags: string[];
  uploadedByName: string | null;
  viewCount: number;
  downloadCount: number;
  likeCount: number;
  commentCount: number;
  likedByMe?: boolean;
  favoritedByMe?: boolean;
  bookmarkedByMe?: boolean;
  createdAt: string;
};

const KINDS = [
  { value: "", label: "All types" },
  { value: "REFERENCE", label: "Reference books" },
  { value: "HANDOUT", label: "Handouts" },
  { value: "VIDEO", label: "Video lectures" },
  { value: "LESSON", label: "Lessons" },
  { value: "LINK", label: "Links" },
];

const SORTS = [
  { value: "recent", label: "Recently added" },
  { value: "downloads", label: "Most downloaded" },
  { value: "views", label: "Most viewed" },
  { value: "likes", label: "Most liked" },
  { value: "rating", label: "Highest rated" },
  { value: "alphabetical", label: "A–Z" },
];

export function LibraryBrowser({ sessionId }: { sessionId: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [course, setCourse] = useState("");
  const [sort, setSort] = useState("recent");

  const csrf = useRef("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((res) => res.json())
      .then((data) => {
        csrf.current = data.token ?? "";
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams({ sort, pageSize: "24" });
    if (search) params.set("search", search);
    if (kind) params.set("kind", kind);
    if (course) params.set("course", course);

    try {
      const res = await fetch(`/api/library/materials?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setMaterials(data.materials ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, kind, course, sort]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  // A new upload from anyone drops straight into the list.
  useEffect(() => {
    if (!sessionId) return;

    const socket: Socket = io({ path: "/api/socket", auth: { sessionId } });

    socket.on("material:created", (material: Material) => {
      setMaterials((prev) => (prev.some((m) => m.id === material.id) ? prev : [material, ...prev]));
      setTotal((count) => count + 1);
    });

    socket.on("material:deleted", ({ id }: { id: string }) => {
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      setTotal((count) => Math.max(0, count - 1));
    });

    // Counter-only update, so a like elsewhere does not re-render the card.
    socket.on("material:counts", (counts: { id: string; likeCount: number; viewCount: number; downloadCount: number; commentCount: number }) => {
      setMaterials((prev) =>
        prev.map((m) => (m.id === counts.id ? { ...m, ...counts } : m)),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  /**
   * Optimistic toggle: flip locally first so the button responds instantly,
   * then reconcile with what the server actually decided.
   */
  async function act(id: string, action: "like" | "favorite" | "bookmark" | "unbookmark") {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (action === "like") {
          return { ...m, likedByMe: !m.likedByMe, likeCount: m.likeCount + (m.likedByMe ? -1 : 1) };
        }
        if (action === "favorite") return { ...m, favoritedByMe: !m.favoritedByMe };
        return { ...m, bookmarkedByMe: action === "bookmark" };
      }),
    );

    try {
      const res = await fetch(`/api/library/materials/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf.current },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error("rejected");

      const data = await res.json();

      setMaterials((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          if (action === "like") return { ...m, likedByMe: Boolean(data.liked) };
          if (action === "favorite") return { ...m, favoritedByMe: Boolean(data.favorited) };
          return { ...m, bookmarkedByMe: Boolean(data.bookmarked) };
        }),
      );
    } catch {
      // Put it back the way it was.
      void load();
    }
  }

  return (
    <section className="dash-card lib-browse" aria-label="Browse materials">
      <div className="dash-card-head">
        <h2>Browse</h2>
        <span className="lib-sub">{loading ? "Loading…" : `${total} material${total === 1 ? "" : "s"}`}</span>
      </div>

      <div className="lib-filters">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, subject, tag, uploader…"
          aria-label="Search materials"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
          {KINDS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course">
          <option value="">All courses</option>
          <option value="CE">Civil Engineering</option>
          <option value="EE">Electrical Engineering</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {loading && materials.length === 0 ? (
        // Skeletons rather than a spinner — the layout does not jump when the
        // real rows arrive.
        <ul className="dash-list">
          {[0, 1, 2].map((index) => (
            <li key={index} className="lib-skeleton"><span /><span /><span /></li>
          ))}
        </ul>
      ) : materials.length === 0 ? (
        <p className="dash-empty">
          {search || kind || course
            ? "Nothing matches those filters."
            : "No materials yet. Once someone uploads, it appears here for everyone."}
        </p>
      ) : (
        <ul className="dash-list">
          {materials.map((item) => (
            <li key={item.id}>
              <div className="dash-list-top">
                <strong>{item.title}</strong>
                <span className="dash-pill dash-pill-ok">
                  {item.extension?.toUpperCase() ?? item.kind}
                </span>
              </div>

              {item.description && <p>{item.description}</p>}

              <small>
                {item.uploadedByName ?? "COE"}
                {item.subject ? ` · ${item.subject}` : ""}
                {` · ${item.viewCount} views · ${item.downloadCount} downloads`}
              </small>

              {item.tags.length > 0 && (
                <div className="lib-tags">
                  {item.tags.map((tag) => (
                    <button key={tag} type="button" onClick={() => setSearch(tag)}>#{tag}</button>
                  ))}
                </div>
              )}

              <div className="asg-actions">
                <a className="asg-btn" href={`/api/library/download/${item.id}`}>Download</a>

                <button
                  type="button"
                  className={`lib-act ${item.likedByMe ? "is-on" : ""}`}
                  onClick={() => act(item.id, "like")}
                  aria-pressed={Boolean(item.likedByMe)}
                >
                  ♥ {item.likeCount}
                </button>

                <button
                  type="button"
                  className={`lib-act ${item.favoritedByMe ? "is-on" : ""}`}
                  onClick={() => act(item.id, "favorite")}
                  aria-pressed={Boolean(item.favoritedByMe)}
                >
                  ★ Favourite
                </button>

                <button
                  type="button"
                  className={`lib-act ${item.bookmarkedByMe ? "is-on" : ""}`}
                  onClick={() => act(item.id, item.bookmarkedByMe ? "unbookmark" : "bookmark")}
                  aria-pressed={Boolean(item.bookmarkedByMe)}
                >
                  🔖 {item.bookmarkedByMe ? "Saved" : "Save"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
