"use client";

/**
 * Application navigation.
 *
 * Links are filtered by role here for tidiness, but that is presentation only —
 * every page and route re-checks permission server-side. Hiding a link is not
 * access control.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { NotificationBell } from "@/components/notification-bell";

type Props = {
  user: { name: string; role: string; canViewAdmin: boolean; sessionId?: string };
};

const LINKS = [
  { href: "/dashboard", label: "Home", adminOnly: false },
  { href: "/announcements", label: "Announcements", adminOnly: false },
  { href: "/assignments", label: "Assignments", adminOnly: false },
  { href: "/library", label: "Library", adminOnly: false },
  { href: "/profile", label: "Profile", adminOnly: false },
  { href: "/admin", label: "Admin", adminOnly: true },
];

export function AppNav({ user }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = LINKS.filter((link) => !link.adminOnly || user.canViewAdmin);

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/dashboard" className="nav-brand">
          <span className="nav-mark">AU</span>
          <span className="nav-name">COE Studio</span>
        </Link>

        {/* Burger, mobile only */}
        <button
          type="button"
          className="nav-burger"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav-links ${open ? "is-open" : ""}`}>
          {links.map((link) => {
            // startsWith so /library/material/123 still highlights Library,
            // but "/" must not match everything.
            const active =
              pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "is-active" : ""}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="nav-user">
          {user.sessionId && <NotificationBell sessionId={user.sessionId} />}
          <span className="nav-user-name">{user.name}</span>
          <span className="nav-user-role">{user.role.toLowerCase()}</span>
          <button type="button" onClick={() => signOut({ callbackUrl: "/auth/login" })}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
