import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The site root.
 *
 * This app serves two front-ends. `src/app/*` is the Next.js one — /dashboard,
 * /library, /admin, /auth/login — and `/portal/*` is the COE Studio portal that
 * students actually use, the one with the library, the Q&A board, the COESC tab
 * and the live updates.
 *
 * The root used to send visitors to `/auth/login`, so anyone who typed the bare
 * domain landed on the Next.js sign-in page and never saw the portal. It looks
 * like the right page — same college, same product name — which is worse than
 * an obvious error: there is nothing to tell you that you are in the wrong
 * place, and both pages accept the same account.
 *
 * The portal is the product, so the root goes there. `/portal/index.html`
 * checks the session itself and redirects to `/portal/login.html` when there is
 * none, which keeps the portal's own sign-in page as the one students see.
 *
 * The Next.js pages are still reachable directly. /admin in particular is a
 * different, more detailed view than the portal's admin tab, and is worth
 * keeping.
 */
export default function Home() {
  redirect("/portal/index.html");
}
