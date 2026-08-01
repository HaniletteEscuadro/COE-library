import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/session";
import { canViewAdmin } from "@/lib/rbac";
import { AppNav } from "@/components/app-nav";
import { listAnnouncements } from "@/lib/announcements";
import { listAssignments } from "@/lib/submissions";
import { getLibraryStats } from "@/lib/library";
import { titleCase } from "@/lib/enums";

export const dynamic = "force-dynamic";

/**
 * Student home.
 *
 * Everything here is server-rendered from the same shared tables every other
 * account reads, so two students loading this at the same moment see identical
 * announcements and assignments.
 */
export default async function DashboardPage() {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/auth/login?callbackUrl=/dashboard");
  }

  const viewer = { id: auth.user.id, role: auth.user.role };

  // Fetched together — they are independent and all needed for first paint.
  const [announcements, assignments, library] = await Promise.all([
    listAnnouncements({ pageSize: 5 }, auth.user.id),
    listAssignments({ pageSize: 5, status: "OPEN" }, viewer),
    getLibraryStats(),
  ]);

  const displayName = auth.user.name ?? auth.user.username ?? "there";
  const firstName = displayName.split(" ")[0];

  const pending = assignments.assignments.filter((item) => !item.mySubmission);

  return (
    <>
      <AppNav
        user={{
          name: displayName,
          role: auth.user.role,
          canViewAdmin: canViewAdmin(auth.user.role),
          sessionId: auth.session.sessionId ?? "",
        }}
      />

      <main className="dash">
        <header className="dash-head">
          <div>
            <p className="dash-kicker">{titleCase(auth.user.role)}</p>
            <h1>Hello, {firstName}</h1>
            <p className="dash-sub">
              {pending.length > 0
                ? `You have ${pending.length} assignment${pending.length === 1 ? "" : "s"} still to submit.`
                : "Nothing outstanding. Everything is submitted."}
            </p>
          </div>
          {announcements.unreadCount > 0 && (
            <Link href="/announcements" className="dash-badge">
              {announcements.unreadCount} unread
            </Link>
          )}
        </header>

        <section className="dash-tiles" aria-label="At a glance">
          <Tile value={library.totalMaterials} label="Materials" href="/library" />
          <Tile value={assignments.total} label="Open assignments" href="/assignments" />
          <Tile value={pending.length} label="To submit" href="/assignments" tone={pending.length > 0 ? "warn" : "ok"} />
          <Tile value={announcements.unreadCount} label="Unread notices" href="/announcements" />
        </section>

        <div className="dash-grid">
          {/* Announcements */}
          <section className="dash-card" aria-label="Latest announcements">
            <div className="dash-card-head">
              <h2>Announcements</h2>
              <Link href="/announcements">View all</Link>
            </div>

            {announcements.announcements.length === 0 ? (
              <p className="dash-empty">No announcements yet.</p>
            ) : (
              <ul className="dash-list">
                {announcements.announcements.map((item) => (
                  <li key={item.id} className={item.readByMe ? "" : "is-unread"}>
                    <div className="dash-list-top">
                      <strong>{item.title}</strong>
                      {item.priority !== "NORMAL" && (
                        <span className={`dash-pill dash-pill-${item.priority.toLowerCase()}`}>
                          {titleCase(item.priority)}
                        </span>
                      )}
                    </div>
                    <p>{item.body.slice(0, 140)}{item.body.length > 140 ? "…" : ""}</p>
                    <small>
                      {item.authorName ?? "COE"} · {formatDate(item.publishedAt)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Assignments */}
          <section className="dash-card" aria-label="Open assignments">
            <div className="dash-card-head">
              <h2>Assignments</h2>
              <Link href="/assignments">View all</Link>
            </div>

            {assignments.assignments.length === 0 ? (
              <p className="dash-empty">No open assignments.</p>
            ) : (
              <ul className="dash-list">
                {assignments.assignments.map((item) => (
                  <li key={item.id}>
                    <div className="dash-list-top">
                      <strong>{item.title}</strong>
                      {item.mySubmission ? (
                        <span className="dash-pill dash-pill-ok">
                          {item.mySubmission.score !== null
                            ? `${item.mySubmission.score}/${item.points}`
                            : "Submitted"}
                        </span>
                      ) : (
                        <span className="dash-pill dash-pill-warn">To do</span>
                      )}
                    </div>
                    <p>{item.subject ?? item.description ?? "No description."}</p>
                    <small>
                      {item.dueAt ? `Due ${formatDate(item.dueAt)}` : "No deadline"} · {item.points} pts
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Tile({
  value, label, href, tone,
}: {
  value: number;
  label: string;
  href: string;
  tone?: "ok" | "warn";
}) {
  return (
    <Link href={href} className={`dash-tile ${tone ? `dash-tile-${tone}` : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </Link>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
