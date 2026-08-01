"use client";

/**
 * Forgot password / set a new one.
 *
 * One page, two modes, decided by whether the URL carries a `?token=`:
 *   no token  -> ask for the email address
 *   token     -> ask for the new password
 *
 * Reuses the login stylesheet so the two screens are visually identical.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { subscribeToLocation, getSearchParams, getServerSearchParams } from "@/lib/use-search";

export default function ResetPage() {
  const router = useRouter();

  /**
   * Read from location rather than `useSearchParams` so the form is in the
   * server HTML instead of appearing only after hydration. See
   * `@/lib/use-search` for why this is a store subscription and not an effect.
   *
   * `query` is null for exactly one render — the server pass and hydration —
   * which is what `ready` gates on: neither form should flash before it is
   * known which of the two this is.
   */
  const query = useSyncExternalStore(subscribeToLocation, getSearchParams, getServerSearchParams);
  const token = query?.get("token") ?? null;
  const ready = query !== null;

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [devLink, setDevLink] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);

  const csrf = useRef("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((res) => res.json())
      .then((data) => {
        csrf.current = data.token ?? "";
      })
      .catch(() => {});
  }, []);

  async function requestLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setDevLink(null);

    const data = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.current },
      body: JSON.stringify({ email: String(data.get("email") ?? "") }),
    });

    const payload = await res.json().catch(() => ({}));
    setPending(false);

    setMessage({
      text: payload.message ?? "If that email is registered, a reset link has been created.",
      tone: "ok",
    });

    // Development only — the API withholds this in production.
    if (payload.devResetUrl) setDevLink(payload.devResetUrl);
  }

  async function setNewPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setErrors({});

    const data = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.current },
      body: JSON.stringify({
        token,
        password: String(data.get("password") ?? ""),
        confirmPassword: String(data.get("confirmPassword") ?? ""),
      }),
    });

    const payload = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setMessage({ text: payload.message ?? "Could not reset the password.", tone: "error" });
      setErrors(payload.fieldErrors ?? {});
      return;
    }

    setMessage({ text: payload.message ?? "Password updated.", tone: "ok" });
    setTimeout(() => router.push("/auth/login"), 1400);
  }

  return (
    <main className="lg">
      <div className="lg-card">
        <div className="lg-brand">
          <span className="lg-mark" aria-hidden="true">AU</span>
          <div>
            <strong>COE Studio</strong>
            <small>Araullo University · College of Engineering</small>
          </div>
        </div>

        <header className="lg-head">
          <h1>{token ? "Set a new password" : "Reset your password"}</h1>
          <p>
            {token
              ? "Choose a password you have not used before."
              : "We will create a reset link for your account."}
          </p>
        </header>

        {message && (
          <p className={`lg-msg lg-msg-${message.tone}`} role="alert">
            {message.text}
          </p>
        )}

        {devLink && (
          <p className="lg-msg lg-msg-ok">
            Development mode — email is not configured yet, so use this link:{" "}
            <a href={devLink}>Open reset link</a>
          </p>
        )}

        {!ready ? (
          <p className="lg-loading">Loading…</p>
        ) : token ? (
          <form onSubmit={setNewPassword} className="lg-form" noValidate>
            <label className="lg-field">
              <span>New password</span>
              <div className="lg-pw">
                <input
                  name="password"
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="8+ characters"
                  required
                />
                <button type="button" onClick={() => setReveal((v) => !v)}>
                  {reveal ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password ? (
                <em>{errors.password}</em>
              ) : (
                <em className="lg-hint">Needs upper and lower case, a number, and a symbol.</em>
              )}
            </label>

            <label className="lg-field">
              <span>Confirm password</span>
              <input
                name="confirmPassword"
                type={reveal ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                required
              />
              {errors.confirmPassword && <em>{errors.confirmPassword}</em>}
            </label>

            <button type="submit" className="lg-submit" disabled={pending}>
              {pending ? "Saving…" : "Set new password"}
            </button>
          </form>
        ) : (
          <form onSubmit={requestLink} className="lg-form" noValidate>
            <label className="lg-field">
              <span>University email</span>
              <input name="email" type="email" autoComplete="email" placeholder="you@au.edu.ph" required />
            </label>

            <button type="submit" className="lg-submit" disabled={pending}>
              {pending ? "Please wait…" : "Send reset link"}
            </button>
          </form>
        )}

        <footer className="lg-card-foot">
          <span>Remembered it?</span>
          <Link href="/auth/login">Back to sign in</Link>
        </footer>
      </div>
    </main>
  );
}
