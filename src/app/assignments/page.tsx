import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/session";
import { canViewAdmin } from "@/lib/rbac";
import { AppNav } from "@/components/app-nav";
import { isAcademicStaff, listAssignments } from "@/lib/submissions";
import { SubmitBox } from "./submit-box";

export const dynamic = "force-dynamic";

/**
 * Assignments.
 *
 * Every student sees the same list. Each row carries only *that* student's own
 * submission — `listAssignments` scopes it by viewer id, so one student's work
 * never reaches another's page.
 */
export default async function AssignmentsPage() {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/auth/login?callbackUrl=/assignments");
  }

  const viewer = { id: auth.user.id, role: auth.user.role };
  const { assignments } = await listAssignments({ pageSize: 50 }, viewer);
  const staff = isAcademicStaff(auth.user.role);

  const todo = assignments.filter((item) => !item.mySubmission);

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
            <p className="dash-kicker">Coursework</p>
            <h1>Assignments</h1>
            <p className="dash-sub">
              {staff
                ? `${assignments.length} posted.`
                : todo.length > 0
                  ? `${todo.length} still to submit.`
                  : "Everything is submitted."}
            </p>
          </div>
        </header>

        <section className="dash-card" aria-label="All assignments">
          {assignments.length === 0 ? (
            <p className="dash-empty">No assignments yet.</p>
          ) : (
            <ul className="dash-list asg-list">
              {assignments.map((item) => {
                const overdue =
                  item.dueAt && !item.mySubmission && new Date(item.dueAt) < new Date();

                return (
                  <li key={item.id}>
                    <div className="dash-list-top">
                      <strong>{item.title}</strong>
                      {item.mySubmission ? (
                        <span className="dash-pill dash-pill-ok">
                          {item.mySubmission.score !== null
                            ? `${item.mySubmission.score} / ${item.points}`
                            : item.mySubmission.isLate
                              ? "Submitted late"
                              : "Submitted"}
                        </span>
                      ) : (
                        <span className={`dash-pill ${overdue ? "dash-pill-urgent" : "dash-pill-warn"}`}>
                          {overdue ? "Overdue" : "To do"}
                        </span>
                      )}
                    </div>

                    {item.description && <p>{item.description}</p>}

                    <small>
                      {item.subject ? `${item.subject} · ` : ""}
                      {item.dueAt
                        ? `Due ${new Date(item.dueAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "No deadline"}
                      {" · "}
                      {item.points} pts
                      {staff ? ` · ${item.submissionCount} submitted` : ""}
                    </small>

                    {/* Students get the submit box; staff see counts instead. */}
                    {!staff && (
                      <SubmitBox
                        assignmentId={item.id}
                        alreadySubmitted={Boolean(item.mySubmission)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
