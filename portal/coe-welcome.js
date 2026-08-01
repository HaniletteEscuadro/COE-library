/**
 * COE Studio — the welcome notification, and the signed-in identity fields.
 *
 * THE WELCOME IS A NOTIFICATION, NOT A BANNER
 * -------------------------------------------
 * It appears once, at the top, immediately after signing in, and dismisses
 * itself. An earlier version of this file put a permanent strip under the top
 * bar on every page. That was wrong twice over: the Home hero already carries a
 * welcome line, and a greeting repeated on the Library, the Q&A board and every
 * other tab is furniture rather than a welcome — it stops being read on the
 * second page and never stops taking up space.
 *
 * "Once, after signing in" is decided by a flag `coe-login.js` writes into
 * `sessionStorage` at the moment the server confirms the session. It is cleared
 * as soon as the toast is shown, so a refresh or a tab switch does not repeat
 * it, and it dies with the tab.
 *
 * It reuses the portal's existing top-centre toast rather than inventing a
 * second notification style, so a welcome looks like every other thing the app
 * tells you.
 *
 * IT ALSO FILLS THE IDENTITY FIELDS
 * ---------------------------------
 * The Home hero's welcome line and the top bar's name / role / avatar. Those
 * exist in the markup and `scripts.js` fills them from
 * `studentWorkplaceCurrentUser` in localStorage — a cache of the session that
 * anyone with the browser open can edit, so it can name the wrong person, or
 * one who is no longer signed in. This runs after it and overwrites with what
 * the *server* says, which is the only account the API will actually act as.
 */

(function (global) {
    'use strict';

    const doc = global.document;

    let user = null;
    let timer = null;

    /** Greeting for the hour, refreshed so a tab left open does not go stale. */
    function greetingFor(date) {
        const hour = date.getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    /** A greeting uses a first name: "Emmanuel A. Gepullano" -> "Emmanuel". */
    function firstName(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        return parts.length ? parts[0] : 'Engineer';
    }

    function initials(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /** "ORG_OFFICER_PICE" would read as "Org Officer Pice"; name them properly. */
    const ROLE_LABELS = {
        ADMIN: 'Administrator',
        REGISTRAR: 'Registrar',
        FACULTY: 'Faculty',
        LIBRARIAN: 'Librarian',
        STUDENT: 'Student',
        USER: 'Member',
        ORG_OFFICER_PICE: 'PICE Officer',
        ORG_OFFICER_IIEE: 'IIEE Officer'
    };

    function roleLabel(role) {
        return ROLE_LABELS[role] || 'Member';
    }

    const COURSE_LABELS = {
        CE: 'Civil Engineering',
        EE: 'Electrical Engineering',
        COE: 'College of Engineering'
    };

    function render() {
        if (!user) return;

        const name = user.name || user.username || 'Engineer';
        const course = String(user.discipline || '').toUpperCase();

        // The hero line. `textContent` on the whole line rather than only the
        // span, so the greeting itself changes with the hour.
        const line = doc.querySelector('.hero-welcome');
        if (line) {
            line.textContent = greetingFor(new Date()) + ', ';
            const strong = doc.createElement('span');
            strong.id = 'welcome-user-name';
            strong.textContent = firstName(name);
            line.appendChild(strong);
        }

        const meta = doc.getElementById('welcome-user-meta');
        if (meta) {
            meta.textContent = course
                ? `${roleLabel(user.role)} · ${COURSE_LABELS[course] || course}`
                : roleLabel(user.role);
        }

        // Top bar. Overwritten unconditionally — see the note in the header
        // about why the cached value is not trusted.
        const topName = doc.getElementById('top-account-name');
        const topRole = doc.getElementById('top-account-role');
        const avatar = doc.getElementById('top-account-avatar');

        if (topName) topName.textContent = name;
        if (topRole) topRole.textContent = roleLabel(user.role);
        if (avatar && !avatar.querySelector('img')) avatar.textContent = initials(name);
    }

    /** Set by coe-login.js the moment the server confirms a sign-in. */
    const JUST_SIGNED_IN = 'coeJustSignedIn';

    /**
     * The welcome itself.
     *
     * Reuses `window.showLibraryToast` — the portal's existing top-centre
     * notification — so this looks like everything else the app says, and
     * inherits its dismissal, stacking and styling. If that helper has not
     * loaded yet (it lives in a deferred script), a small fallback draws the
     * same markup, because a greeting that silently does not appear is worse
     * than one drawn by hand.
     */
    function showWelcomeToast() {
        let consumed = false;
        try {
            consumed = global.sessionStorage.getItem(JUST_SIGNED_IN) === '1';
            // Cleared immediately: a refresh or a tab switch must not repeat it.
            if (consumed) global.sessionStorage.removeItem(JUST_SIGNED_IN);
        } catch (error) {
            return; // Private mode — no flag, no toast. Nothing is broken.
        }

        if (!consumed || !user) return;

        const name = user.name || user.username || 'Engineer';
        const course = String(user.discipline || '').toUpperCase();
        const title = `${greetingFor(new Date())}, ${firstName(name)}`;
        const detail = course
            ? `${roleLabel(user.role)} · ${COURSE_LABELS[course] || course}`
            : roleLabel(user.role);

        if (typeof global.showLibraryToast === 'function') {
            global.showLibraryToast(title, detail, 'success');
            return;
        }

        // Fallback, matching the same host and classes.
        let host = doc.getElementById('coe-toast-host');
        if (!host) {
            host = doc.createElement('div');
            host.id = 'coe-toast-host';
            host.setAttribute('role', 'status');
            host.setAttribute('aria-live', 'polite');
            doc.body.appendChild(host);
        }

        const toast = doc.createElement('div');
        toast.className = 'coe-toast coe-toast-success';
        toast.innerHTML =
            '<span class="material-icons coe-toast-icon">waving_hand</span>' +
            '<div class="coe-toast-copy"><strong></strong><small></small></div>' +
            '<button type="button" class="coe-toast-close" aria-label="Dismiss">' +
                '<span class="material-icons">close</span></button>';

        // textContent, never innerHTML: the name comes from the database.
        toast.querySelector('strong').textContent = title;
        toast.querySelector('small').textContent = detail;

        const dismiss = function () {
            toast.classList.add('is-leaving');
            global.setTimeout(function () { toast.remove(); }, 240);
        };

        toast.querySelector('.coe-toast-close').addEventListener('click', dismiss);
        host.appendChild(toast);
        global.setTimeout(dismiss, 4200);
    }

    function start() {
        if (!global.CoeApi || !global.CoeApi.isServed()) return Promise.resolve(false);
        // Only where the greeting actually lives.
        if (!doc.querySelector('.hero-welcome') && !doc.getElementById('top-account-name')) {
            return Promise.resolve(false);
        }

        return global.CoeApi.session(false)
            .then(function (current) {
                // No server session, no greeting. Deliberately not falling back
                // to the cached user — see the note at the top of this file.
                if (!current || !current.user) return false;

                user = current.user;
                render();

                // Slightly delayed so the deferred script that owns the toast
                // helper has loaded, and so the greeting is not competing with
                // the page's own first paint.
                global.setTimeout(showWelcomeToast, 600);

                /*
                 * Run again on the next frame *and* shortly after.
                 *
                 * `scripts.js` writes the same fields from its own cached copy
                 * during its start-up, and the order the two finish in is not
                 * fixed. Re-rendering means the server's answer is the one left
                 * on screen either way, rather than whichever happened to be
                 * last.
                 */
                global.requestAnimationFrame(render);
                global.setTimeout(render, 800);

                // Keeps "Good morning" from still being there at eight at night.
                timer = global.setInterval(render, 5 * 60 * 1000);

                return true;
            })
            .catch(function (error) {
                console.error('[coe-welcome] could not load the session', error);
                return false;
            });
    }

    global.CoeWelcome = {
        start,
        render,
        get user() { return user; },
        stop: function () {
            if (timer) global.clearInterval(timer);
            timer = null;
        }
    };

    function boot() {
        const waitFor = (global.CoeLive && global.CoeLive.booted) || Promise.resolve();
        global.CoeWelcome.booted = waitFor.then(start);
    }

    if (doc.readyState === 'complete' || global.CoeLive) {
        boot();
    } else {
        doc.addEventListener('DOMContentLoaded', boot);
    }
})(window);
