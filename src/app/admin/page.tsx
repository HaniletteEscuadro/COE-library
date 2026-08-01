import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/session";
import { canViewAdmin, isSuperAdmin } from "@/lib/rbac";
import { getDashboardStats, listUsers, listLoginEvents } from "@/lib/users";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";

/**
 * Admin dashboard.
 *
 * The first page of users, the counters and the recent activity are fetched on
 * the server so the table arrives populated. Everything after that — search,
 * filtering, sorting, edits, and the live feed — happens in the client
 * component without another full navigation.
 */
export default async function AdminPage() {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/auth/login?callbackUrl=/admin");
  }

  // Server-side gate. The nav hides the link for non-admins, but that is
  // cosmetic — this is the check that actually holds.
  if (!canViewAdmin(auth.user.role)) {
    redirect("/dashboard");
  }

  const [users, stats, logs] = await Promise.all([
    listUsers({
      search: "",
      sort: "createdAt",
      order: "desc",
      page: 1,
      pageSize: 25,
      includeDeleted: false,
    }),
    getDashboardStats(),
    listLoginEvents({ page: 1, pageSize: 40 }),
  ]);

  return (
    <AdminClient
      initialUsers={users}
      initialStats={stats}
      initialLogs={logs.events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      }))}
      viewer={{
        id: auth.user.id,
        name: auth.user.name ?? auth.user.username ?? "Administrator",
        role: auth.user.role,
        isSuperAdmin: isSuperAdmin(auth.user.role),
        sessionId: auth.session.sessionId ?? "",
      }}
    />
  );
}
