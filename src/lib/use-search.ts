/**
 * Reading the URL query string without opting out of prerendering.
 *
 * THE PROBLEM
 * -----------
 * `useSearchParams` marks its whole subtree as client-only, so the login and
 * reset forms would exist only after hydration — a blank card on a slow
 * connection, on the two screens where a blank card looks like an outage.
 *
 * The previous workaround read `window.location.search` inside a `useEffect`
 * and called `setState` with the result. That works, but it is a cascading
 * render by construction — React renders once with nothing, then again with the
 * params — and `react-hooks/set-state-in-effect` flags it as an error for
 * exactly that reason.
 *
 * THE FIX
 * -------
 * `useSyncExternalStore` is the sanctioned way to read a value that lives
 * outside React. `getServerSearchParams` returns `null`, so the server render
 * and the hydration pass agree; React then reads the real value and re-renders
 * once. Same two renders, no effect, no lint suppression, and no hydration
 * mismatch — which the naive `useState(() => new URLSearchParams(...))` version
 * would have produced.
 *
 * The snapshot must be referentially stable or `useSyncExternalStore` re-renders
 * forever, so the parsed object is cached and only rebuilt when the query string
 * itself changes.
 */

let cachedSearch: string | null = null;
let cachedParams: URLSearchParams | null = null;

/** Client snapshot. Stable across calls unless the query string changed. */
export function getSearchParams(): URLSearchParams | null {
  const search = window.location.search;

  if (cachedParams === null || cachedSearch !== search) {
    cachedSearch = search;
    cachedParams = new URLSearchParams(search);
  }

  return cachedParams;
}

/**
 * Server/hydration snapshot. There is no location on the server, and returning
 * a fresh object here would break hydration — `null` is the honest answer.
 */
export function getServerSearchParams(): URLSearchParams | null {
  return null;
}

/**
 * Re-read on history navigation.
 *
 * `popstate` covers Back/Forward. `pushState` from the router does not fire it,
 * which is fine for these two screens: both read the query once on arrival and
 * navigate away rather than rewriting their own URL.
 */
export function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}
