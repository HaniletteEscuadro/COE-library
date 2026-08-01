"use client";

/**
 * Sign in / create account.
 *
 * A single centred card rather than a split hero. The marketing panel added
 * width without helping anyone actually sign in — this keeps one column of
 * attention, which is what a login screen is for.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { subscribeToLocation, getSearchParams, getServerSearchParams } from "@/lib/use-search";

type Mode = "login" | "register";
type FieldErrors = Record<string, string>;

export default function LoginPage() {
  return <LoginForm />;
}

function Brand() {
  return (
    <div className="lg-brand">
      <span className="lg-mark" aria-hidden="true">
        AU
      </span>
      <div>
        <strong>COE Studio</strong>
        <small>Araullo University · College of Engineering</small>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();

  /**
   * Query params are read from `window.location` rather than with
   * `useSearchParams`. That hook opts the whole subtree out of prerendering, so
   * the form would only exist after hydration — a blank card on slow
   * connections. This way the full form is in the server HTML and the params
   * are applied a moment later. See `@/lib/use-search`.
   */
  const query = useSyncExternalStore(subscribeToLocation, getSearchParams, getServerSearchParams);

  const [mode, setMode] = useState<Mode>("login");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "ok" } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reveal, setReveal] = useState(false);

  /**
   * NextAuth reports credential failures by bouncing back with `?error=`. That
   * banner is derived from the URL rather than copied into state, so there is
   * no effect writing state on mount — but it does have to be dismissable, or
   * the stale error would sit there through the next attempt because the query
   * string has not changed.
   */
  const [urlErrorDismissed, setUrlErrorDismissed] = useState(false);
  const urlError = urlErrorDismissed ? null : query?.get("error");

  const banner =
    message ??
    (urlError
      ? {
          text: urlError === "CredentialsSignin" ? "Invalid email or password." : urlError,
          tone: "error" as const,
        }
      : null);

  const csrf = useRef("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((res) => res.json())
      .then((data) => {
        csrf.current = data.token ?? "";
      })
      .catch(() => {});
  }, []);

  const isLogin = mode === "login";

  function switchTo(next: Mode) {
    setMode(next);
    setMessage(null);
    setUrlErrorDismissed(true);
    setErrors({});
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setUrlErrorDismissed(true);
    setErrors({});

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    // --- Register first, if that is the mode ---------------------------
    if (!isLogin) {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf.current },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          username: String(data.get("username") ?? ""),
          email,
          discipline: String(data.get("discipline") ?? ""),
          password,
          confirmPassword: String(data.get("confirmPassword") ?? ""),
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPending(false);
        setMessage({ text: body.message ?? "Could not create the account.", tone: "error" });
        setErrors(body.fieldErrors ?? {});
        return;
      }
    }

    // --- Sign in (both paths end here) ---------------------------------
    const result = await signIn("credentials", {
      email,
      password,
      remember: data.get("remember") ? "true" : "false",
      redirect: false,
    });

    setPending(false);

    if (result?.error) {
      setMessage({ text: result.error, tone: "error" });
      return;
    }

    router.push(query?.get("callbackUrl") ?? "/dashboard");
    router.refresh();
  }

  return (
    <main className="lg">
      <div className="lg-card">
        <Brand />

        <header className="lg-head">
          <h1>{isLogin ? "Sign in" : "Create account"}</h1>
          <p>{isLogin ? "Welcome back." : "Use your university email."}</p>
        </header>

        {/* Mode switch reads as a segmented control, not two separate pages. */}
        <div className="lg-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={isLogin ? "is-on" : ""}
            onClick={() => switchTo("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={!isLogin ? "is-on" : ""}
            onClick={() => switchTo("register")}
          >
            Register
          </button>
        </div>

        {banner && (
          <p className={`lg-msg lg-msg-${banner.tone}`} role="alert">
            {banner.text}
          </p>
        )}

        <form onSubmit={onSubmit} className="lg-form" noValidate>
          {!isLogin && (
            <>
              <Field label="Full name" name="name" autoComplete="name" placeholder="Juana Dela Cruz" error={errors.name} />
              <Field label="Username" name="username" autoComplete="username" placeholder="@juana.coe" error={errors.username} />
            </>
          )}

          <Field
            label="University email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@au.edu.ph"
            error={errors.email}
          />

          {!isLogin && (
            <label className="lg-field">
              <span>Course</span>
              <select name="discipline" defaultValue="CE">
                <option value="CE">Civil Engineering</option>
                <option value="EE">Electrical Engineering</option>
              </select>
            </label>
          )}

          <label className="lg-field">
            <span>Password</span>
            <div className="lg-pw">
              <input
                name="password"
                type={reveal ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder={isLogin ? "••••••••" : "8+ characters"}
                required
              />
              <button type="button" onClick={() => setReveal((v) => !v)} aria-label={reveal ? "Hide password" : "Show password"}>
                {reveal ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && <em>{errors.password}</em>}
            {!isLogin && !errors.password && (
              <em className="lg-hint">Needs upper and lower case, a number, and a symbol.</em>
            )}
          </label>

          {!isLogin && (
            <Field
              label="Confirm password"
              name="confirmPassword"
              type={reveal ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              error={errors.confirmPassword}
            />
          )}

          {isLogin && (
            <div className="lg-row">
              <label className="lg-remember">
                <input name="remember" type="checkbox" defaultChecked />
                <span>Keep me signed in</span>
              </label>
              <a className="lg-forgot" href="/auth/reset">Forgot password?</a>
            </div>
          )}

          <button type="submit" className="lg-submit" disabled={pending}>
            {pending ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>

      <p className="lg-foot">Shared library and workspace for CE and EE students.</p>
    </main>
  );
}

/** One labelled input. Keeps the form markup flat and consistent. */
function Field({
  label, name, type = "text", autoComplete, placeholder, error,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="lg-field">
      <span>{label}</span>
      <input name={name} type={type} autoComplete={autoComplete} placeholder={placeholder} required />
      {error && <em>{error}</em>}
    </label>
  );
}
