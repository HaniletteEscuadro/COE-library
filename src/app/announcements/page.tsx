import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/session";
import { canViewAdmin } from "@/lib/rbac";
import { AppNav } from "@/components/app-nav";
import {
  canModerateAnnouncements,
  canPostAnnouncement,
  listAnnouncements,
} from "@/lib/announcements";
import { titleCase } from "@/lib/enums";
import { AnnouncementComposer } from "./composer";

export const dynamic = "force-dynamic";

/**
 * The shared board.
 *
 * Server-rendered from the same table every account reads, so what one student
 * sees here is exactly what every other student sees.
 */
export default async function AnnouncementsPage() {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/auth/login?callbackUrl=/announcements");
  }

  const { announcements, unreadCount } = await listAnnouncements({ pageSize: 50 }, auth.user.id);
  const canPost = canPostAnnouncement(auth.user.role);

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
            <p className="dash-kicker">Notice board</p>
            <h1>Announcements</h1>
            <p className="dash-sub">
              {unreadCount > 0
                ? `${unreadCount} you have not read yet.`
                : "You are up to date."}
            </p>
          </div>
        </header>

        {/* Only staff see the composer; the API enforces the same rule. */}
        {canPost && <AnnouncementComposer canPin={canModerateAnnouncements(auth.user.role)} />}

        <section className="dash-card" aria-label="All announcements">
          {announcements.length === 0 ? (
            <p className="dash-empty">Nothing posted yet.</p>
          ) : (
            <ul className="dash-list">
              {announcements.map((item) => (
                <li key={item.id} className={item.readByMe ? "" : "is-unread"}>
                  <div className="dash-list-top">
                    <strong>{item.title}</strong>
                    <span className="ann-tags">
                      {item.pinned && <span className="dash-pill dash-pill-ok">Pinned</span>}
                      {item.priority !== "NORMAL" && (
                        <span className={`dash-pill dash-pill-${item.priority.toLowerCase()}`}>
                          {titleCase(item.priority)}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* Rendered as text, never as HTML — an author cannot inject
                      markup into everyone else's page. */}
                  <p className="ann-body">{item.body}</p>
                  <small>
                    {item.authorName ?? "COE"} · {titleCase(item.category)} ·{" "}
                    {new Date(item.publishedAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {item.readCount > 0 ? ` · ${item.readCount} read` : ""}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
