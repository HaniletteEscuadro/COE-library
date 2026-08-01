"use client";

/**
 * Two independent forms: details, and password.
 *
 * Kept separate because they have different consequences — saving your name is
 * routine, changing your password signs you out of every device including this
 * one. Merging them into one Save button would make that surprising.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

type Props = {
  initial: {
    name: string;
    discipline: string;
    username: string;
    email: string;
    hasPassword: boolean;
  };
};

type Note = { text: string; tone: "ok" | "error" } | null;

export function ProfileForms({ initial }: Props) {
  const router = useRouter();
  const csrf = useRef("");

  const [detailNote, setDetailNote] = useState<Note>(null);
  const [passwordNote, setPasswordNote] = useState<Note>(null);
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    fetch("/api/csrf")
      .then((res) => res.json())
      .then((data) => {
        csrf.current = data.token ?? "";
      })
      .catch(() => {});
  }, []);

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingDetails(true);
    setDetailNote(null);
    setDetailErrors({});

    const data = new FormData(event.currentTarget);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.current },
      body: JSON.stringify({
        name: String(data.get("name") ?? ""),
        discipline: String(data.get("discipline") ?? ""),
      }),
    });

    const payload = await res.json().catch(() => ({}));
    setSavingDetails(false);

    if (!res.ok) {
      setDetailNote({ text: payload.message ?? "Could not save.", tone: "error" });
      setDetailErrors(payload.fieldErrors ?? {});
      return;
    }

    setDetailNote({ text: payload.message ?? "Saved.", tone: "ok" });
    router.refresh();
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordNote(null);
    setPasswordErrors({});

    const data = new FormData(event.currentTarget);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.current },
      body: JSON.stringify({
        action: "password",
        currentPassword: String(data.get("currentPassword") ?? ""),
        password: String(data.get("password") ?? ""),
        confirmPassword: String(data.get("confirmPassword") ?? ""),
      }),
    });

    const payload = await res.json().catch(() => ({}));
    setSavingPassword(false);

    if (!res.ok) {
      setPasswordNote({ text: payload.message ?? "Could not change password.", tone: "error" });
      setPasswordErrors(payload.fieldErrors ?? {});
      return;
    }

    setPasswordNote({ text: payload.message ?? "Password changed.", tone: "ok" });

    // The API revoked every session, this one included. Sending the user to
    // the login screen is honest about what just happened.
    if (payload.signedOut) {
      setTimeout(() => signOut({ callbackUrl: "/auth/login" }), 1500);
    }
  }

  return (
    <div className="dash-grid">
      {/* Details */}
      <section className="dash-card" aria-label="Your details">
        <div className="dash-card-head"><h2>Details</h2></div>

        {detailNote && (
          <p className={`lg-msg lg-msg-${detailNote.tone}`} role="alert">{detailNote.text}</p>
        )}

        <form onSubmit={saveDetails} className="ann-form" noValidate>
          <label className="lg-field">
            <span>Full name</span>
            <input name="name" defaultValue={initial.name} required />
            {detailErrors.name && <em>{detailErrors.name}</em>}
          </label>

          <label className="lg-field">
            <span>Course</span>
            <select name="discipline" defaultValue={initial.discipline}>
              <option value="">Not set</option>
              <option value="CE">Civil Engineering</option>
              <option value="EE">Electrical Engineering</option>
            </select>
          </label>

          {/* Shown but not editable — changing identity is an admin action. */}
          <label className="lg-field">
            <span>Username</span>
            <input value={initial.username} disabled />
            <em className="lg-hint">Contact an administrator to change this.</em>
          </label>

          <label className="lg-field">
            <span>Email</span>
            <input value={initial.email} disabled />
            <em className="lg-hint">Contact an administrator to change this.</em>
          </label>

          <button type="submit" className="lg-submit" disabled={savingDetails}>
            {savingDetails ? "Saving…" : "Save details"}
          </button>
        </form>
      </section>

      {/* Password */}
      <section className="dash-card" aria-label="Change password">
        <div className="dash-card-head"><h2>Password</h2></div>

        {passwordNote && (
          <p className={`lg-msg lg-msg-${passwordNote.tone}`} role="alert">{passwordNote.text}</p>
        )}

        {!initial.hasPassword ? (
          <p className="dash-empty">
            This account signs in with Google. There is no password to change.
          </p>
        ) : (
          <form onSubmit={changePassword} className="ann-form" noValidate>
            <p className="lg-hint" style={{ margin: 0 }}>
              Changing your password signs you out on every device, including this one.
            </p>

            <label className="lg-field">
              <span>Current password</span>
              <input name="currentPassword" type="password" autoComplete="current-password" required />
              {passwordErrors.currentPassword && <em>{passwordErrors.currentPassword}</em>}
            </label>

            <label className="lg-field">
              <span>New password</span>
              <input name="password" type="password" autoComplete="new-password" placeholder="8+ characters" required />
              {passwordErrors.password ? (
                <em>{passwordErrors.password}</em>
              ) : (
                <em className="lg-hint">Needs upper and lower case, a number, and a symbol.</em>
              )}
            </label>

            <label className="lg-field">
              <span>Confirm new password</span>
              <input name="confirmPassword" type="password" autoComplete="new-password" required />
              {passwordErrors.confirmPassword && <em>{passwordErrors.confirmPassword}</em>}
            </label>

            <button type="submit" className="lg-submit" disabled={savingPassword}>
              {savingPassword ? "Changing…" : "Change password"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
