import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/session";
import { canViewAdmin } from "@/lib/rbac";
import { AppNav } from "@/components/app-nav";
import { titleCase } from "@/lib/enums";
import { ProfileForms } from "./profile-forms";

export const dynamic = "force-dynamic";

/** Your own account: editable details, and a password change. */
export default async function ProfilePage() {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/auth/login?callbackUrl=/profile");
  }

  return (
    <>
      <AppNav
        user={{
          name: auth.user.name ?? auth.user.username ?? "COE user",
          role: auth.user.role,
          canViewAdmin: canViewAdmin(auth.user.role),
          sessionId: auth.session.sessionId ?? "",
        }}
      />

      <main className="dash">
        <header className="dash-head">
          <div>
            <p className="dash-kicker">Your account</p>
            <h1>Profile</h1>
            <p className="dash-sub">
              {auth.user.email} · {titleCase(auth.user.role)}
            </p>
          </div>
        </header>

        <section className="dash-tiles" aria-label="Account summary">
          <div className="dash-tile">
            <strong>{auth.user.loginCount}</strong>
            <span>Sign-ins</span>
          </div>
          <div className="dash-tile">
            <strong>{new Date(auth.user.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong>
            <span>Joined</span>
          </div>
          <div className="dash-tile">
            <strong>
              {auth.user.lastLoginAt
                ? new Date(auth.user.lastLoginAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "—"}
            </strong>
            <span>Last sign-in</span>
          </div>
          <div className="dash-tile">
            <strong>{auth.user.discipline ?? "—"}</strong>
            <span>Course</span>
          </div>
        </section>

        <ProfileForms
          initial={{
            name: auth.user.name ?? "",
            discipline: auth.user.discipline ?? "",
            username: auth.user.username ?? "",
            email: auth.user.email ?? "",
            hasPassword: auth.user.hasPassword,
          }}
        />
      </main>
    </>
  );
}
