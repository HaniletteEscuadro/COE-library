"use client";

/**
 * Hand in work for one assignment.
 *
 * Sends multipart when a file is attached and JSON otherwise, matching what the
 * submit route accepts. Resubmitting is allowed — the API upserts on
 * (assignment, student), so it replaces rather than duplicating.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitBox({
  assignmentId,
  alreadySubmitted,
}: {
  assignmentId: string;
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
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
    setMessage(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const hasFile = file instanceof File && file.size > 0;

    // Multipart only when there is actually a file; JSON is cheaper otherwise.
    const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
      method: "POST",
      headers: hasFile
        ? { "x-csrf-token": csrf.current }
        : { "content-type": "application/json", "x-csrf-token": csrf.current },
      body: hasFile ? data : JSON.stringify({ content: String(data.get("content") ?? "") }),
    });

    const payload = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setMessage({ text: payload.message ?? "Could not submit.", tone: "error" });
      return;
    }

    setMessage({ text: payload.message ?? "Submitted.", tone: "ok" });
    form.reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="asg-actions">
        <button type="button" className="asg-btn" onClick={() => setOpen(true)}>
          {alreadySubmitted ? "Resubmit" : "Submit work"}
        </button>
        {message && <span className={`asg-msg asg-msg-${message.tone}`}>{message.text}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="asg-form" noValidate>
      {message && <p className={`lg-msg lg-msg-${message.tone === "ok" ? "ok" : "error"}`}>{message.text}</p>}

      <label className="lg-field">
        <span>Your answer</span>
        <textarea name="content" rows={3} placeholder="Type your answer, or attach a file below." />
      </label>

      <label className="lg-field">
        <span>Attach a file (optional)</span>
        <input type="file" name="file" />
      </label>

      <div className="asg-actions">
        <button type="submit" className="asg-btn asg-btn-primary" disabled={pending}>
          {pending ? "Submitting…" : "Submit"}
        </button>
        <button type="button" className="asg-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
