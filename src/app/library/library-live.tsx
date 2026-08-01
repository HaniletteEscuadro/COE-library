"use client";

/**
 * Library upload + live feed.
 *
 * Two jobs in one component because they share state: an upload the user just
 * made and an upload someone else made both have to end up in the same list.
 *
 *   Upload  -> POST /api/library/upload (multipart, XHR for progress)
 *   Live    -> Socket.IO "material:created" from the shared library room
 *
 * The socket is what makes someone else's upload appear here with no refresh.
 * `XMLHttpRequest` rather than `fetch` because fetch still cannot report upload
 * progress, and a 50 MB file with no progress bar looks like a hang.
 */

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type FolderOption = { id: string; label: string };

type LiveMaterial = {
  id: string;
  title: string;
  description: string | null;
  extension: string | null;
  kind: string;
  sizeBytes: number;
  subject: string | null;
  uploadedByName: string | null;
  downloadCount: number;
  createdAt: string;
};

type Props = {
  folders: FolderOption[];
  canUpload: boolean;
  sessionId: string;
};

export function LibraryLive({ folders, canUpload, sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  /** Uploads that arrived after this page was rendered, newest first. */
  const [live, setLive] = useState<LiveMaterial[]>([]);
  const [connected, setConnected] = useState(false);

  const csrf = useRef("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch("/api/csrf")
      .then((res) => res.json())
      .then((data) => {
        csrf.current = data.token ?? "";
      })
      .catch(() => {});
  }, []);

  // --- Live feed ---------------------------------------------------------
  useEffect(() => {
    if (!sessionId) return;

    const socket: Socket = io({ path: "/api/socket", auth: { sessionId } });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("material:created", (material: LiveMaterial) => {
      // Guard against duplicates: the uploader receives their own broadcast.
      setLive((prev) => (prev.some((m) => m.id === material.id) ? prev : [material, ...prev]));
    });

    socket.on("material:deleted", ({ id }: { id: string }) => {
      setLive((prev) => prev.filter((m) => m.id !== id));
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  // --- Upload ------------------------------------------------------------
  function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const files = data.getAll("files").filter((f) => f instanceof File && f.size > 0);

    if (files.length === 0) {
      setMessage({ text: "Choose a file first.", tone: "error" });
      return;
    }

    const request = new XMLHttpRequest();
    request.open("POST", "/api/library/upload");
    request.setRequestHeader("x-csrf-token", csrf.current);

    request.upload.addEventListener("progress", (progressEvent) => {
      if (!progressEvent.lengthComputable) return;
      setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
    });

    request.addEventListener("load", () => {
      setProgress(null);

      let payload: { message?: string } = {};
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        /* keep the fallback message */
      }

      if (request.status >= 200 && request.status < 300) {
        setMessage({ text: payload.message ?? "Uploaded.", tone: "ok" });
        form.reset();
        setOpen(false);
        // The row itself arrives over the socket, so nothing to insert here.
      } else {
        setMessage({ text: payload.message ?? "Upload failed.", tone: "error" });
      }
    });

    request.addEventListener("error", () => {
      setProgress(null);
      setMessage({ text: "Network error during upload.", tone: "error" });
    });

    setProgress(0);
    request.send(data);
  }

  return (
    <>
      <div className="lib-live-bar">
        <span className={`lib-live ${connected ? "is-on" : ""}`}>
          <i />
          {connected ? "Live" : "Connecting…"}
        </span>

        {canUpload && !open && (
          <button type="button" className="asg-btn asg-btn-primary" onClick={() => setOpen(true)}>
            Upload material
          </button>
        )}
      </div>

      {message && (
        <p className={`lg-msg lg-msg-${message.tone === "ok" ? "ok" : "error"}`}>{message.text}</p>
      )}

      {canUpload && open && (
        <section className="dash-card" aria-label="Upload a material">
          <div className="dash-card-head">
            <h2>Upload material</h2>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>

          <form ref={formRef} onSubmit={upload} className="ann-form" noValidate>
            <label className="lg-field">
              <span>Folder</span>
              <select name="folderId" required>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.label}</option>
                ))}
              </select>
            </label>

            <label className="lg-field">
              <span>Title</span>
              <input name="title" placeholder="Chapter 5 Reviewer" required />
            </label>

            <label className="lg-field">
              <span>Description (optional)</span>
              <textarea name="description" rows={2} placeholder="What is this for?" />
            </label>

            <label className="lg-field">
              <span>Tags (optional)</span>
              <input name="tags" placeholder="reviewer, midterms" />
            </label>

            <label className="lg-field">
              <span>File</span>
              <input type="file" name="files" multiple required />
            </label>

            {progress !== null && (
              <div className="lib-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progress}%` }} />
                <small>{progress}%</small>
              </div>
            )}

            <button type="submit" className="lg-submit" disabled={progress !== null}>
              {progress !== null ? `Uploading… ${progress}%` : "Upload"}
            </button>
          </form>
        </section>
      )}

      {/* Anything uploaded while this page has been open, by anyone. */}
      {live.length > 0 && (
        <section className="dash-card" aria-label="Just uploaded">
          <div className="dash-card-head">
            <h2>Just uploaded</h2>
            <span className="lib-sub">{live.length} new</span>
          </div>
          <ul className="dash-list">
            {live.map((item) => (
              <li key={item.id} className="is-unread">
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
                </small>
                <div className="asg-actions">
                  <a className="asg-btn" href={`/api/library/download/${item.id}`}>Download</a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
