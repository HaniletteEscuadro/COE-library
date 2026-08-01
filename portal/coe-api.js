/**
 * COE Studio — bridge between the portal front-end and the auth-system server.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every feature in this portal used to read and write `localStorage`. That is
 * private to one browser profile on one computer, so a material you uploaded
 * or a question you asked existed only for you — nobody else could ever see it,
 * however the UI was written. This module replaces that with the shared
 * database behind `/api/*`, and with a Socket.IO connection so a change made by
 * one account appears in everyone else's open page immediately.
 *
 * SAME ORIGIN IS A REQUIREMENT, NOT A PREFERENCE
 * ----------------------------------------------
 * The page must be served from the Next.js server (http://host:3000/portal/...)
 * so it shares an origin with `/api/*`:
 *
 *   * the NextAuth session cookie is httpOnly and SameSite — a `fetch` from
 *     another origin simply will not carry it, and every call 401s;
 *   * `server.ts` pins the Socket.IO CORS origin to NEXTAUTH_URL, so a socket
 *     opened from `file://` or a Live Server port is refused at the handshake.
 *
 * Opening index.html straight off disk therefore cannot work. `isServed()`
 * detects that case so the UI can say so plainly instead of failing as a wall
 * of 401s.
 *
 * CSRF
 * ----
 * State-changing routes use a double-submit token: `/api/csrf` sets a cookie
 * and returns the same value, which must be echoed in `x-csrf-token`. The token
 * is fetched once and cached, then refreshed automatically on a 403 so a
 * long-open tab does not start failing silently.
 */

(function (global) {
    'use strict';

    // -----------------------------------------------------------------------
    // Environment
    // -----------------------------------------------------------------------

    /**
     * True when the page came from the app server rather than the filesystem.
     * Cookies and sockets both depend on this.
     */
    function isServed() {
        return global.location.protocol === 'http:' || global.location.protocol === 'https:';
    }

    /** Origin of the API. Same origin as this page, by design. */
    function apiBase() {
        return global.location.origin;
    }

    // -----------------------------------------------------------------------
    // CSRF
    // -----------------------------------------------------------------------

    let csrfToken = '';
    let csrfPromise = null;

    function fetchCsrf(force) {
        if (csrfToken && !force) return Promise.resolve(csrfToken);
        if (csrfPromise && !force) return csrfPromise;

        csrfPromise = fetch(apiBase() + '/api/csrf', { credentials: 'include' })
            .then(response => (response.ok ? response.json() : null))
            .then(body => {
                csrfToken = (body && (body.csrfToken || body.token)) || '';
                csrfPromise = null;
                return csrfToken;
            })
            .catch(() => {
                csrfPromise = null;
                return '';
            });

        return csrfPromise;
    }

    // -----------------------------------------------------------------------
    // Request helpers
    // -----------------------------------------------------------------------

    /**
     * One place where every response shape is normalised, so callers never have
     * to guess whether they got JSON, an empty body, or an HTML error page.
     */
    function readBody(response) {
        const type = response.headers.get('content-type') || '';
        if (type.indexOf('application/json') > -1) {
            return response.json().catch(() => ({}));
        }
        return response.text().then(text => ({ message: text }));
    }

    function request(method, path, options) {
        const settings = options || {};

        if (!isServed()) {
            return Promise.reject(new ApiError(
                'The portal is open as a local file, so it cannot reach the server. ' +
                'Open it through the app server instead.',
                0
            ));
        }

        const send = function (token) {
            const headers = Object.assign({}, settings.headers);
            const init = {
                method,
                credentials: 'include',
                headers
            };

            if (method !== 'GET' && method !== 'HEAD') {
                headers['x-csrf-token'] = token || '';
            }

            if (settings.body instanceof FormData) {
                // Do NOT set Content-Type: the browser has to add the multipart
                // boundary itself, and overriding it breaks the upload.
                init.body = settings.body;
            } else if (settings.body !== undefined) {
                headers['Content-Type'] = 'application/json';
                init.body = JSON.stringify(settings.body);
            }

            return fetch(apiBase() + path, init);
        };

        const needsToken = method !== 'GET' && method !== 'HEAD';

        return (needsToken ? fetchCsrf(false) : Promise.resolve(''))
            .then(send)
            .then(response => {
                // A stale token after a long-open tab: refresh once and retry.
                if (response.status === 403 && needsToken) {
                    return fetchCsrf(true).then(send);
                }
                return response;
            })
            .then(response => readBody(response).then(body => {
                if (!response.ok) {
                    throw new ApiError(
                        (body && body.message) || 'Request failed.',
                        response.status,
                        body
                    );
                }
                return body;
            }));
    }

    /** Carries the HTTP status so callers can tell 401 from a real failure. */
    function ApiError(message, status, body) {
        this.name = 'ApiError';
        this.message = message;
        this.status = status || 0;
        this.body = body || null;
    }
    ApiError.prototype = Object.create(Error.prototype);
    ApiError.prototype.constructor = ApiError;

    // -----------------------------------------------------------------------
    // Session
    // -----------------------------------------------------------------------

    let cachedSession = null;

    /**
     * The signed-in user, or null.
     *
     * `/api/auth/session` returns `{}` when signed out, which is why the check
     * is on `user.id` rather than on the object being truthy.
     */
    function session(force) {
        if (cachedSession && !force) return Promise.resolve(cachedSession);

        return fetch(apiBase() + '/api/auth/session', { credentials: 'include' })
            .then(response => (response.ok ? response.json() : null))
            .then(body => {
                cachedSession = body && body.user && body.user.id ? body : null;
                return cachedSession;
            })
            .catch(() => null);
    }

    /**
     * Sign in with email and password through NextAuth's credentials provider.
     *
     * NextAuth expects a form POST to its callback with its own CSRF token —
     * a different token from the `/api/csrf` one used by the app's own routes.
     * `json: true` makes it answer with a URL instead of redirecting.
     */
    function login(email, password, remember) {
        if (!isServed()) {
            return Promise.reject(new ApiError(
                'Open the portal through the app server to sign in.', 0
            ));
        }

        return fetch(apiBase() + '/api/auth/csrf', { credentials: 'include' })
            .then(response => response.json())
            .then(body => {
                const form = new URLSearchParams();
                form.set('csrfToken', body.csrfToken);
                form.set('email', String(email || '').trim());
                form.set('password', String(password || ''));
                form.set('remember', remember ? 'true' : 'false');
                form.set('redirect', 'false');
                form.set('json', 'true');
                form.set('callbackUrl', apiBase() + '/portal/index.html');

                return fetch(apiBase() + '/api/auth/callback/credentials', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: form.toString()
                });
            })
            .then(response => response.json().catch(() => ({})))
            .then(result => {
                // NextAuth reports a failed credential check by putting ?error=
                // on the returned URL rather than by using an error status.
                const url = String(result && result.url ? result.url : '');
                const match = url.match(/[?&]error=([^&]+)/);

                if (match) {
                    throw new ApiError(decodeURIComponent(match[1].replace(/\+/g, ' ')), 401);
                }

                cachedSession = null;
                return session(true).then(current => {
                    if (!current) {
                        throw new ApiError('Sign in failed. Check your email and password.', 401);
                    }
                    // Adopt here rather than leaving it to the caller: every
                    // page that signs in needs the cached user populated, and a
                    // caller that forgets gets a workspace with no identity.
                    adoptSession(current);
                    return current;
                });
            });
    }

    function logout() {
        return fetch(apiBase() + '/api/auth/csrf', { credentials: 'include' })
            .then(response => response.json())
            .then(body => {
                const form = new URLSearchParams();
                form.set('csrfToken', body.csrfToken);
                form.set('json', 'true');
                form.set('callbackUrl', apiBase() + '/portal/login.html');

                return fetch(apiBase() + '/api/auth/signout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: form.toString()
                });
            })
            .then(() => {
                cachedSession = null;
                disconnectSocket();
                // Signing out has to take the cached library, chat and Q&A with
                // it. Otherwise the next person to open this browser reads all
                // of it without signing in.
                clearSessionCaches();
            })
            .catch(() => {
                cachedSession = null;
                // Especially on the failure path: the request may well have
                // reached the server, and leaving the data behind because the
                // reply did not come back is the wrong way to be wrong.
                clearSessionCaches();
            });
    }

    function register(details) {
        return request('POST', '/api/auth/register', { body: details });
    }

    // -----------------------------------------------------------------------
    // Live updates
    // -----------------------------------------------------------------------

    let socket = null;
    let socketReady = null;
    const listeners = new Map();

    /**
     * Open the shared live connection.
     *
     * `server.ts` decides room membership from the database role during the
     * handshake — the client cannot ask to join a room. Every signed-in account
     * lands in the `library` room, which is what makes an upload appear on
     * everyone's screen at once.
     *
     * The socket authenticates from the session cookie. `sessionId` is passed as
     * well because the handshake accepts it as a fallback.
     */
    function connect() {
        if (socketReady) return socketReady;

        socketReady = session(false).then(current => {
            if (!current) return null;
            if (typeof global.io !== 'function') {
                console.warn('[coe-api] socket.io client script is not loaded; live updates are off');
                return null;
            }

            socket = global.io({
                path: '/api/socket',
                withCredentials: true,
                transports: ['websocket', 'polling'],
                auth: { sessionId: current.sessionId || '' }
            });

            socket.on('connect_error', error => {
                console.warn('[coe-api] live connection refused:', error && error.message);
            });

            // Re-attach anything registered before the socket existed.
            listeners.forEach((handlers, event) => {
                handlers.forEach(handler => socket.on(event, handler));
            });

            return socket;
        });

        return socketReady;
    }

    /**
     * Subscribe to a live event. Safe to call before connect() — handlers are
     * held and attached once the socket opens.
     */
    function on(event, handler) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(handler);
        if (socket) socket.on(event, handler);

        return function off() {
            const handlers = listeners.get(event);
            if (handlers) handlers.delete(handler);
            if (socket) socket.off(event, handler);
        };
    }

    function disconnectSocket() {
        if (socket) {
            socket.close();
            socket = null;
        }
        socketReady = null;
    }

    // -----------------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // Identity bridge
    // -----------------------------------------------------------------------

    /** Storage key the whole portal already reads to learn who is signed in. */
    const CURRENT_USER_KEY = 'studentWorkplaceCurrentUser';

    /**
     * Write the server's idea of the signed-in user into the key the portal
     * already reads.
     *
     * scripts.js, enhanced-library.js and tanong-mo-sagot-ko.js each read
     * `studentWorkplaceCurrentUser` at load. Filling it from the session means
     * every one of those files gets a real, server-verified identity without a
     * single line changing in any of them — and, critically, the SAME identity
     * that `/api/*` will enforce, rather than a name this browser made up.
     *
     * This is a cache of the session, never the source of truth: the server
     * re-checks the account on every request and socket handshake.
     */
    /**
     * Everything this browser cached on behalf of a signed-in account.
     *
     * These are render caches, refilled from the server on the next sync — but
     * they are not harmless when the session ends. Left in place they mean the
     * next person to pick up the phone sees the whole library without signing
     * in, and that a material deleted on the server goes on being listed here
     * for as long as the cache survives.
     *
     * Both of those actually happened: after the database was emptied, a
     * browser still showed 518 materials, because its session died with the
     * data and every sync since had 401'd without touching the cache.
     */
    const SESSION_CACHE_KEYS = [
        'coeLearningFiles',      // the library list
        'coeQaQuestions',        // Q&A board
        'coeChatMessages',       // chat threads
        'coeAnnouncements',
        'coeTasks'
    ];

    function clearSessionCaches() {
        // The cached identity goes too. `logoutCurrentUser` in scripts.js also
        // removes it, but a logout that depends on its caller to finish the job
        // leaves the account on screen for anyone who calls this directly.
        try { global.localStorage.removeItem(CURRENT_USER_KEY); } catch (error) { /* private mode */ }

        SESSION_CACHE_KEYS.forEach(function (key) {
            try { global.localStorage.removeItem(key); } catch (error) { /* private mode */ }
        });

        // The file bodies live in IndexedDB, not localStorage, and are the
        // larger half of what is left behind.
        try {
            if (global.CoeLibraryStorage && typeof global.CoeLibraryStorage.clear === 'function') {
                global.CoeLibraryStorage.clear();
            } else if (global.indexedDB) {
                global.indexedDB.deleteDatabase('coeLibraryStorage');
            }
        } catch (error) {
            console.warn('[coe-api] could not clear the stored files', error);
        }
    }

    function adoptSession(current) {
        if (!current || !current.user) {
            global.localStorage.removeItem(CURRENT_USER_KEY);
            clearSessionCaches();
            return null;
        }

        const user = current.user;
        const portalUser = {
            id: user.id,
            username: user.username || user.email || '',
            email: user.email || '',
            name: user.name || user.username || 'COE user',
            role: user.role || 'STUDENT',
            discipline: user.discipline || '',
            status: user.status || 'ACTIVE',
            profilePicture: user.image || '',
            // Marks this as server-backed, so anything still reading the old
            // local account list can tell the difference.
            source: 'server'
        };

        try {
            global.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(portalUser));
        } catch (error) {
            console.warn('[coe-api] could not cache the signed-in user', error);
        }

        return portalUser;
    }

    /**
     * Gate a portal page on a real session.
     *
     * Returns the user, or redirects to the login page and resolves to null.
     * Called at the top of index.html's scripts so a signed-out visitor never
     * sees a workspace built from a stale cached identity.
     */
    function requireSession(loginPath) {
        return session(true).then(current => {
            const user = adoptSession(current);

            if (!user) {
                global.localStorage.removeItem(CURRENT_USER_KEY);
                // adoptSession already cleared these, but a page that calls
                // requireSession without it must not be the exception.
                clearSessionCaches();
                global.location.href = loginPath || 'login.html';
                return null;
            }

            return user;
        });
    }

    /**
     * Say it out loud when the page was opened off the filesystem.
     *
     * Every live module calls `isServed()` and quietly does nothing when it is
     * false. That was meant to avoid a wall of 401s, but the result was worse:
     * the portal looks like it works. Uploads land, questions post, the library
     * fills — all of it into this one browser, invisible to everybody else and
     * gone with the cache. Somebody can use it for weeks before noticing.
     *
     * The banner is deliberately hard to miss and cannot be dismissed, because
     * nothing on the page is real until it is gone.
     */
    function warnIfNotServed() {
        if (isServed()) return;
        if (global.document.getElementById('coe-offline-warning')) return;

        const url = 'http://localhost:3000/portal/index.html';
        const banner = global.document.createElement('div');
        banner.id = 'coe-offline-warning';
        banner.setAttribute('role', 'alert');
        banner.style.cssText = [
            'position:fixed', 'inset:0 0 auto 0', 'z-index:2147483647',
            'padding:12px 18px', 'background:#8a1c1c', 'color:#fff',
            'font:500 14px/1.5 system-ui,sans-serif', 'text-align:center',
            'box-shadow:0 2px 10px rgba(0,0,0,0.35)'
        ].join(';');
        banner.innerHTML =
            '<strong>This page was opened from your computer, not from the server.</strong><br>' +
            'Nothing you do here is saved or shared — no login, no live updates, and PDFs cannot open. ' +
            'Open <a href="' + url + '" style="color:#ffd9d9">' + url + '</a> instead.';

        const attach = function () {
            if (!global.document.body) return;
            global.document.body.appendChild(banner);
            // Push the page down so the banner does not cover the header.
            global.document.body.style.paddingTop =
                (banner.offsetHeight || 64) + 'px';
        };

        if (global.document.body) attach();
        else global.document.addEventListener('DOMContentLoaded', attach);
    }

    warnIfNotServed();

    global.CoeApi = {
        isServed,
        apiBase,
        warnIfNotServed,

        adoptSession,
        requireSession,
        CURRENT_USER_KEY,

        session,
        login,
        logout,
        register,

        get: (path) => request('GET', path),
        post: (path, body) => request('POST', path, { body }),
        patch: (path, body) => request('PATCH', path, { body }),
        del: (path) => request('DELETE', path),
        postForm: (path, formData) => request('POST', path, { body: formData }),

        connect,
        on,
        disconnect: disconnectSocket,

        ApiError
    };
})(window);
