/**
 * COE Studio — sign in, create account, reset password.
 *
 * Replaces `auth.js`, which authenticated against a list of accounts kept in
 * `localStorage`. Four things were wrong with that, and all four are the reason
 * this file exists rather than a patch:
 *
 *   1. **The Microsoft button did not authenticate anything.** It fabricated an
 *      account (`microsoft.coe@au.edu.ph`), wrote it into localStorage as the
 *      signed-in user, and redirected to the workspace — no password, no
 *      server. The workspace then bounced straight back here, because the real
 *      session check found nothing. There is no Microsoft provider on the
 *      server, so the button is gone rather than mended.
 *
 *   2. **The Google button could never work.** It needed an OAuth client id
 *      read from `localStorage.coeGoogleClientId`, which nothing ever sets, so
 *      it always failed with "Google sign-in needs a Google OAuth Web Client ID
 *      first." Meanwhile the server has a real, working Google provider that
 *      the button never touched. It does now — and it only appears when the
 *      server says the provider is actually configured.
 *
 *   3. **"Forgot Password?" was three `window.prompt` boxes** that rewrote a
 *      localStorage account. On the served portal it could only ever answer
 *      "No saved local account found." The real `/api/auth/forgot-password`
 *      route existed the whole time and was never called.
 *
 *   4. **The password rules disagreed with the server's**, so a password could
 *      pass here and be rejected on submit with a message the form had already
 *      promised was fine.
 *
 * THE RULE THIS FILE FOLLOWS
 * --------------------------
 * The server owns identity. Nothing here decides who you are, and nothing here
 * writes an identity to localStorage that the server has not confirmed. That is
 * what makes a stolen or edited browser store useless, and it is why the whole
 * local-accounts system is gone rather than kept "as a fallback" — a fallback
 * that signs people in is not a fallback.
 */

(function (global) {
    'use strict';

    const doc = global.document;
    const api = global.CoeApi;

    /** Where to go once the server has confirmed a session. */
    const WORKSPACE = 'index.html';

    /**
     * The server's password rules, mirrored exactly.
     *
     * `strongPassword` in `src/lib/validation.ts` is the authority. Keeping a
     * looser copy here is how a form tells someone their password is fine and
     * then shows them a server error for the same password.
     */
    const PASSWORD_RULES = [
        { test: (v) => v.length >= 8, label: 'At least 8 characters' },
        { test: (v) => /[a-z]/.test(v), label: 'A lowercase letter' },
        { test: (v) => /[A-Z]/.test(v), label: 'An uppercase letter' },
        { test: (v) => /[0-9]/.test(v), label: 'A number' },
        { test: (v) => /[^A-Za-z0-9]/.test(v), label: 'A symbol' }
    ];

    const THEME_KEY = 'coePortalLoginTheme';
    /** Only the last email typed, to save re-typing it. Never a credential. */
    const LAST_EMAIL_KEY = 'coeLastSignInEmail';

    /**
     * Tells the workspace to show its welcome notification once.
     *
     * `sessionStorage`, not `localStorage`: it must die with the tab, so a
     * browser reopened tomorrow does not greet someone who never signed in
     * today. It carries no identity — only "a sign-in just happened here" — so
     * the flag being forged achieves nothing beyond an extra toast.
     */
    const JUST_SIGNED_IN_KEY = 'coeJustSignedIn';

    function markJustSignedIn() {
        try { global.sessionStorage.setItem(JUST_SIGNED_IN_KEY, '1'); }
        catch (error) { /* private mode — the greeting is simply skipped */ }
    }

    let mode = 'login';
    let busy = false;

    // -----------------------------------------------------------------------
    // Small helpers
    // -----------------------------------------------------------------------

    function el(id) {
        return doc.getElementById(id);
    }

    function show(node, visible) {
        if (node) node.hidden = !visible;
    }

    /**
     * Say something to the user.
     *
     * `textContent`, never `innerHTML`: some of these strings come from the
     * server, and a message is not worth an injection point.
     */
    function setMessage(text, tone) {
        const box = el('auth-message');
        if (!box) return;

        box.textContent = text || '';
        box.className = 'lg-message' + (tone ? ' is-' + tone : '');
        box.hidden = !text;
    }

    /** Disable the form while a request is in flight, so it cannot double-submit. */
    function setBusy(state, label) {
        busy = state;

        doc.querySelectorAll('.lg-form button, .lg-form input, .lg-form select')
            .forEach(function (node) { node.disabled = state; });

        const button = doc.querySelector('.lg-form:not([hidden]) .lg-submit');
        if (!button) return;

        if (state) {
            button.dataset.label = button.dataset.label || button.querySelector('span').textContent;
            button.querySelector('span').textContent = label || 'Please wait…';
            button.classList.add('is-busy');
        } else {
            if (button.dataset.label) button.querySelector('span').textContent = button.dataset.label;
            button.classList.remove('is-busy');
        }
    }

    // -----------------------------------------------------------------------
    // Mode switching
    // -----------------------------------------------------------------------

    function setMode(next) {
        mode = next;

        show(el('login-form'), next === 'login');
        show(el('register-form'), next === 'register');
        show(el('reset-form'), next === 'reset');

        const titles = {
            login: ['Welcome back', 'Sign in to your COE Studio account.'],
            register: ['Create your account', 'Use your university email address.'],
            reset: ['Reset your password', 'We will send a reset link to your email.']
        };

        el('auth-title').textContent = titles[next][0];
        el('auth-subtitle').textContent = titles[next][1];

        // The footer offers the one action that is not on screen.
        show(el('footer-register'), next === 'login');
        show(el('footer-login'), next !== 'login');

        setMessage('');

        // Focus the first field, so a keyboard user is not left hunting.
        const first = doc.querySelector('.lg-form:not([hidden]) input:not([type=checkbox])');
        if (first) first.focus();
    }

    // -----------------------------------------------------------------------
    // Password field behaviour
    // -----------------------------------------------------------------------

    function wireReveal(inputId, buttonId) {
        const input = el(inputId);
        const button = el(buttonId);
        if (!input || !button) return;

        button.addEventListener('click', function () {
            const revealed = input.type === 'text';
            input.type = revealed ? 'password' : 'text';
            button.querySelector('.material-icons').textContent = revealed ? 'visibility' : 'visibility_off';
            button.setAttribute('aria-label', revealed ? 'Show password' : 'Hide password');
            input.focus();
        });
    }

    /**
     * Live checklist against the server's actual rules.
     *
     * A checklist rather than a strength bar: "weak/medium/strong" does not tell
     * anyone what to type next, and the server rejects on specific missing
     * characters, so those are what the form should name.
     */
    function renderPasswordRules(value) {
        const host = el('password-rules');
        if (!host) return;

        host.innerHTML = PASSWORD_RULES.map(function (rule) {
            const met = rule.test(value);
            return '<li class="' + (met ? 'is-met' : '') + '">' +
                '<span class="material-icons" aria-hidden="true">' +
                    (met ? 'check_circle' : 'radio_button_unchecked') +
                '</span>' + rule.label + '</li>';
        }).join('');
    }

    function passwordMeetsRules(value) {
        return PASSWORD_RULES.every(function (rule) { return rule.test(value); });
    }

    // -----------------------------------------------------------------------
    // Theme
    // -----------------------------------------------------------------------

    function applyTheme(theme) {
        const dark = theme !== 'light';
        doc.body.classList.toggle('lg-dark', dark);

        const icon = doc.querySelector('#theme-toggle .material-icons');
        if (icon) icon.textContent = dark ? 'light_mode' : 'dark_mode';

        try { global.localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (error) { /* private mode */ }
    }

    // -----------------------------------------------------------------------
    // Sign in
    // -----------------------------------------------------------------------

    async function onLogin(event) {
        event.preventDefault();
        if (busy) return;

        const email = el('login-email').value.trim();
        const password = el('login-password').value;
        const remember = el('login-remember').checked;

        if (!email || !password) {
            setMessage('Enter your email and password.', 'error');
            return;
        }

        setBusy(true, 'Signing in…');
        setMessage('');

        try {
            const session = await api.login(email, password, remember);
            api.adoptSession(session);

            // Only the address, so the field is pre-filled next time. Never the
            // password, and never anything that stands in for a session.
            try {
                if (remember) global.localStorage.setItem(LAST_EMAIL_KEY, email);
                else global.localStorage.removeItem(LAST_EMAIL_KEY);
            } catch (error) { /* private mode */ }

            markJustSignedIn();
            setMessage('Signed in. Opening your workspace…', 'ok');
            global.location.href = WORKSPACE;
        } catch (error) {
            setBusy(false);
            // The server answers a wrong password and an unknown account with
            // the same sentence, deliberately. Nothing is added to it here.
            setMessage((error && error.message) || 'Could not sign in. Try again.', 'error');
            el('login-password').value = '';
            el('login-password').focus();
        }
    }

    // -----------------------------------------------------------------------
    // Create account
    // -----------------------------------------------------------------------

    async function onRegister(event) {
        event.preventDefault();
        if (busy) return;

        const details = {
            name: el('reg-name').value.trim(),
            username: el('reg-username').value.trim(),
            email: el('reg-email').value.trim(),
            discipline: el('reg-course').value,
            password: el('reg-password').value,
            confirmPassword: el('reg-confirm').value
        };

        if (!details.name || !details.username || !details.email) {
            setMessage('Fill in every field.', 'error');
            return;
        }

        if (!passwordMeetsRules(details.password)) {
            setMessage('Your password does not meet all the requirements below.', 'error');
            el('reg-password').focus();
            return;
        }

        if (details.password !== details.confirmPassword) {
            setMessage('The two passwords do not match.', 'error');
            el('reg-confirm').focus();
            return;
        }

        setBusy(true, 'Creating account…');
        setMessage('');

        try {
            await api.register(details);
        } catch (error) {
            setBusy(false);
            setMessage((error && error.message) || 'Could not create the account.', 'error');
            return;
        }

        // Straight in, so a new account is not asked to type the same password
        // again a second later.
        try {
            const session = await api.login(details.email, details.password, true);
            api.adoptSession(session);
            markJustSignedIn();
            setMessage('Account created. Opening your workspace…', 'ok');
            global.location.href = WORKSPACE;
        } catch (error) {
            // The account exists; only the automatic sign-in failed. Say so
            // plainly rather than implying the registration did not work.
            setBusy(false);
            setMessage('Account created. Please sign in.', 'ok');
            el('login-email').value = details.email;
            setMode('login');
        }
    }

    // -----------------------------------------------------------------------
    // Password reset
    // -----------------------------------------------------------------------

    async function onReset(event) {
        event.preventDefault();
        if (busy) return;

        const email = el('reset-email').value.trim();
        if (!email) {
            setMessage('Enter your email address.', 'error');
            return;
        }

        setBusy(true, 'Sending…');

        try {
            const result = await api.post('/api/auth/forgot-password', { email });

            // The server answers the same way whether or not the address is
            // registered — that is what stops this form being used to find out
            // who has an account. The wording keeps that promise.
            setMessage(
                (result && result.message) ||
                'If that email is registered, a reset link has been created.',
                'ok'
            );

            // Development only: with no mail delivery configured the server
            // hands back the link so it can still be followed.
            if (result && result.devResetUrl) {
                const box = el('reset-dev-link');
                const link = el('reset-dev-anchor');
                if (box && link) {
                    link.href = result.devResetUrl;
                    show(box, true);
                }
            }

            setBusy(false);
        } catch (error) {
            setBusy(false);
            setMessage((error && error.message) || 'Could not send the reset link.', 'error');
        }
    }

    // -----------------------------------------------------------------------
    // Google
    // -----------------------------------------------------------------------

    /**
     * Show the Google button only if the server actually has the provider.
     *
     * `/api/auth/providers` is NextAuth's own list and reflects the server's
     * configuration, so the button cannot appear on a deployment where it would
     * only produce an error. This is the same condition
     * `isGoogleAuthConfigured()` applies on the server.
     */
    async function setupGoogle() {
        const block = el('google-block');
        if (!block) return;

        try {
            const response = await fetch(api.apiBase() + '/api/auth/providers', {
                credentials: 'include'
            });
            if (!response.ok) return;

            const providers = await response.json();
            if (!providers || !providers.google) return;

            show(block, true);
        } catch (error) {
            // Leave it hidden. A missing button is a smaller problem than one
            // that fails when pressed.
        }
    }

    /**
     * Hand off to NextAuth.
     *
     * A real form POST, not `fetch`: the provider flow is a redirect to Google
     * and back, which the browser has to perform as a navigation. NextAuth also
     * requires its own CSRF token here — a different token from the one this
     * app's routes use.
     */
    async function startGoogle() {
        setBusy(true, 'Opening Google…');

        try {
            const response = await fetch(api.apiBase() + '/api/auth/csrf', { credentials: 'include' });
            const { csrfToken } = await response.json();

            const form = doc.createElement('form');
            form.method = 'POST';
            form.action = api.apiBase() + '/api/auth/signin/google';
            form.style.display = 'none';

            const fields = {
                csrfToken: csrfToken,
                callbackUrl: api.apiBase() + '/portal/' + WORKSPACE
            };

            Object.keys(fields).forEach(function (name) {
                const input = doc.createElement('input');
                input.type = 'hidden';
                input.name = name;
                input.value = fields[name];
                form.appendChild(input);
            });

            doc.body.appendChild(form);
            form.submit();
        } catch (error) {
            setBusy(false);
            setMessage('Could not reach Google sign-in. Try again.', 'error');
        }
    }

    // -----------------------------------------------------------------------
    // Start
    // -----------------------------------------------------------------------

    /**
     * If the server already knows this browser, go straight through.
     *
     * Asked of the server, never of localStorage: a leftover cached user must
     * not be enough to open the workspace.
     */
    function skipIfSignedIn() {
        return api.session(true).then(function (current) {
            if (!current) return false;
            api.adoptSession(current);
            global.location.href = WORKSPACE;
            return true;
        }).catch(function () { return false; });
    }

    function start() {
        applyTheme((function () {
            try { return global.localStorage.getItem(THEME_KEY) || 'dark'; }
            catch (error) { return 'dark'; }
        })());

        el('theme-toggle').addEventListener('click', function () {
            applyTheme(doc.body.classList.contains('lg-dark') ? 'light' : 'dark');
        });

        wireReveal('login-password', 'login-password-toggle');
        wireReveal('reg-password', 'reg-password-toggle');
        wireReveal('reg-confirm', 'reg-confirm-toggle');

        el('reg-password').addEventListener('input', function () {
            renderPasswordRules(this.value);
        });
        renderPasswordRules('');

        el('login-form').addEventListener('submit', onLogin);
        el('register-form').addEventListener('submit', onRegister);
        el('reset-form').addEventListener('submit', onReset);

        doc.querySelectorAll('[data-mode]').forEach(function (node) {
            node.addEventListener('click', function (event) {
                event.preventDefault();
                setMode(node.getAttribute('data-mode'));
            });
        });

        el('google-button').addEventListener('click', startGoogle);

        // Pre-fill the address from last time. Convenience only — it carries no
        // authority, and the password is never stored.
        try {
            const last = global.localStorage.getItem(LAST_EMAIL_KEY);
            if (last) {
                el('login-email').value = last;
                el('login-remember').checked = true;
            }
        } catch (error) { /* private mode */ }

        setMode('login');
        void setupGoogle();

        // The page is usable now; reveal it. Prevents the form flashing before
        // the "already signed in" check has had a chance to redirect.
        doc.body.classList.add('is-ready');
    }

    function boot() {
        if (!api || !api.isServed()) {
            // Opened as a file:// page. `coe-api.js` already shows a banner
            // explaining it; signing in genuinely cannot work, so the form is
            // left disabled rather than pretending.
            doc.body.classList.add('is-ready', 'is-offline');
            setMessage(
                'This page was opened from your computer rather than from the ' +
                'server, so signing in is not possible. Open it through the app ' +
                'server instead.',
                'error'
            );
            return;
        }

        skipIfSignedIn().then(function (redirected) {
            if (!redirected) start();
        });
    }

    if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
