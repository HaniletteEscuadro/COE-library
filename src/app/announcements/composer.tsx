"use client";

/**
 * Post an announcement. Staff only — this component is not even rendered for
 * students, and the API rejects them regardless.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AnnouncementComposer({ canPin }: { canPin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const csrf = useRef("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((res) => res.json())
      .then((data) => {
        csrf.current = data.token ?? "";
      })
      .catch(() => {});
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.current },
      body: JSON.stringify({
        title: String(data.get("title") ?? ""),
        body: String(data.get("body") ?? ""),
        category: String(data.get("category") ?? "GENERAL"),
        priority: String(data.get("priority") ?? "NORMAL"),
        pinned: data.get("pinned") === "on",
      }),
    });

    const payload = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(payload.message ?? "Could not post.");
      return;
    }

    (event.target as HTMLFormElement).reset();
    setOpen(false);
    // Re-render the server component so the new post appears in the list.
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="ann-open" onClick={() => setOpen(true)}>
        + Post an announcement
      </button>
    );
  }

  return (
    <section className="dash-card ann-composer" aria-label="New announcement">
      <div className="dash-card-head">
        <h2>New announcement</h2>
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>

      {error && <p className="lg-msg lg-msg-error">{error}</p>}

      <form onSubmit={onSubmit} className="ann-form" noValidate>
        <label className="lg-field">
          <span>Title</span>
          <input name="title" placeholder="Midterm schedule" required />
        </label>

        <label className="lg-field">
          <span>Message</span>
          <textarea name="body" rows={4} placeholder="What does everyone need to know?" required />
        </label>

        <div className="ann-row">
          <label className="lg-field">
            <span>Category</span>
            <select name="category" defaultValue="GENERAL">
              <option value="GENERAL">General</option>
              <option value="ACADEMIC">Academic</option>
              <option value="EVENT">Event</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>

          <label className="lg-field">
            <span>Priority</span>
            <select name="priority" defaultValue="NORMAL">
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>
        </div>

        {canPin && (
          <label className="lg-remember">
            <input type="checkbox" name="pinned" />
            <span>Pin to the top</span>
          </label>
        )}

        <button type="submit" className="lg-submit" disabled={pending}>
          {pending ? "Posting…" : "Post announcement"}
        </button>
      </form>
    </section>
  );
}
