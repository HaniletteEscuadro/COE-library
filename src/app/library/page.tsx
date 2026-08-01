import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/session";
import { canViewAdmin } from "@/lib/rbac";
import { AppNav } from "@/components/app-nav";
import { canUpload, getFolderTree, getLibraryStats } from "@/lib/library";
import { LibraryLive } from "./library-live";
import { LibraryBrowser } from "./browser";

export const dynamic = "force-dynamic";

/**
 * Shared Engineering Library.
 *
 * One repository for everyone: the same folders, the same materials, whoever is
 * signed in. Files are streamed through an authenticated download route rather
 * than linked directly, so `storageKey` never reaches the browser.
 */
export default async function LibraryPage() {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/auth/login?callbackUrl=/library");
  }

  const [folders, stats] = await Promise.all([getFolderTree(), getLibraryStats()]);

  // The picker only offers leaf folders — uploading into "Civil Engineering"
  // rather than a specific category would defeat the whole tree.
  const uploadTargets: Array<{ id: string; label: string }> = [];

  const walk = (
    nodes: Array<{ id: string; name: string; children: unknown[] }>,
    trail: string[],
  ) => {
    for (const node of nodes) {
      const children = node.children as typeof nodes;
      const path = [...trail, node.name];

      if (children.length === 0) {
        uploadTargets.push({ id: node.id, label: path.join(" / ") });
      } else {
        walk(children, path);
      }
    }
  };

  walk(folders as never, []);

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
            <p className="dash-kicker">ENGIdocs</p>
            <h1>Engineering Library</h1>
            <p className="dash-sub">
              Shared references, handouts and video lectures for CE and EE.
              {canUpload(auth.user.role) ? " You can upload here." : ""}
            </p>
          </div>
        </header>

        <LibraryLive
          folders={uploadTargets}
          canUpload={canUpload(auth.user.role)}
          sessionId={auth.session.sessionId ?? ""}
        />

        <section className="dash-tiles" aria-label="Library totals">
          <div className="dash-tile"><strong>{stats.totalMaterials}</strong><span>Materials</span></div>
          <div className="dash-tile"><strong>{stats.pdfs}</strong><span>PDFs</span></div>
          <div className="dash-tile"><strong>{stats.videos}</strong><span>Videos</span></div>
          <div className="dash-tile"><strong>{stats.totalDownloads}</strong><span>Downloads</span></div>
        </section>

        <div className="dash-grid lib-grid-2">
          {/* Folder tree */}
          <section className="dash-card" aria-label="Folders">
            <div className="dash-card-head"><h2>Folders</h2></div>

            {folders.length === 0 ? (
              <p className="dash-empty">No folders yet.</p>
            ) : (
              <ul className="lib-tree">
                {folders.map((course) => (
                  <li key={course.id}>
                    <strong>{course.name}</strong>
                    <span className="lib-count">{course.totalCount}</span>
                    <ul>
                      {course.children.map((year) => (
                        <li key={year.id}>
                          <span>{year.name}</span>
                          <span className="lib-count">{year.totalCount}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <LibraryBrowser sessionId={auth.session.sessionId ?? ""} />
        </div>
      </main>
    </>
  );
}
