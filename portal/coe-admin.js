/**
 * COE Studio — live admin settings.
 *
 * WHAT THIS REPLACES
 * ------------------
 * The admin panel read `studentWorkplaceUsers` from localStorage. That meant:
 *
 *   * the account list was whoever had signed up *in this browser*, so two
 *     admins on two laptops managed two different, private lists;
 *   * changing someone's role wrote a string into this browser and nowhere
 *     else — the person whose role you "changed" was completely unaffected;
 *   * the only roles the toggle understood were ADMIN and STUDENT, flipped
 *     back and forth by one button.
 *
 * Now every read comes from `/api/admin/users` and every change is a request
 * the server authorises, records in the audit log, and broadcasts. The socket
 * events land in the `admin` room, which `server.ts` only lets real admins
 * join — so one admin's change appears on every other admin's screen at once.
 *
 * WHAT IS ENFORCED WHERE
 * ----------------------
 * Nothing here is a permission check. The server decides:
 *   * only a full ADMIN may change a role or purge an account,
 *   * the last remaining admin cannot be demoted or deleted,
 *   * disabling an account revokes its sessions.
 * This file only decides which controls are worth showing.
 */

(function (global) {
    'use strict';

    let ready = false;
    let canManageRoles = false;
    let viewerId = '';

    /**
     * Roles the panel offers.
     *
     * Must match USER_ROLES on the server — a value not in that list is
     * rejected by the schema, which is exactly what used to happen to the two
     * org-officer roles: the dropdown offered them and the save silently
     * failed.
     */
    const ROLES = [
        { value: 'STUDENT', label: 'Student' },
        { value: 'FACULTY', label: 'Faculty' },
        { value: 'LIBRARIAN', label: 'Librarian' },
        { value: 'REGISTRAR', label: 'Registrar' },
        { value: 'ORG_OFFICER_PICE', label: 'PICE Officer' },
        { value: 'ORG_OFFICER_IIEE', label: 'IIEE Officer' },
        // Sees who raised a Student Voice concern, and moderates the board.
        // Nothing else — not the admin dashboard, not library uploads.
        { value: 'ORG_OFFICER_COESC', label: 'COESC Officer' },
        // Verifies Q&A answers and uploads library materials, which go live
        // immediately. Not an administrator: no dashboard, no accounts, and no
        // access to Student Voice identities.
        { value: 'ACAD_COMMITTEE', label: 'Acad Committee' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'USER', label: 'Unassigned' }
    ];

    const STATUSES = [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'INACTIVE', label: 'Disabled' },
        { value: 'BANNED', label: 'Banned' }
    ];

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function roleLabel(role) {
        const match = ROLES.find(r => r.value === String(role || '').toUpperCase());
        return match ? match.label : (role || 'Unassigned');
    }

    function formatWhen(iso) {
        if (!iso) return 'Never';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return 'Unknown';

        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // -----------------------------------------------------------------------
    // Data
    // -----------------------------------------------------------------------

    function isAdminViewer() {
        const user = global.CoeLive && global.CoeLive.user;
        const role = String((user && user.role) || '').toUpperCase();
        return role === 'ADMIN' || role === 'REGISTRAR';
    }

    function fetchAccounts() {
        // `sort` takes a column name, not a preset — newest accounts first.
        return global.CoeApi.get('/api/admin/users?pageSize=100&sort=createdAt&order=desc');
    }

    function fetchLogs() {
        return global.CoeApi.get('/api/admin/logs?pageSize=25')
            .catch(function () { return { events: [] }; });
    }

    function setRole(id, role) {
        return global.CoeApi.patch('/api/admin/users/' + encodeURIComponent(id), { role: role });
    }

    function setStatus(id, status, reason) {
        return global.CoeApi.patch('/api/admin/users/' + encodeURIComponent(id), {
            status: status,
            statusReason: reason || undefined
        });
    }

    function removeAccount(id, hard) {
        return global.CoeApi.del(
            '/api/admin/users/' + encodeURIComponent(id) + (hard ? '?hard=true' : '')
        );
    }

    function createAccount(details) {
        return global.CoeApi.post('/api/admin/users', details);
    }

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    function renderStats(stats) {
        const set = function (id, value) {
            const node = global.document.getElementById(id);
            if (node) node.textContent = String(value ?? 0);
        };

        if (!stats) return;

        set('admin-total-accounts', stats.totalUsers);
        set('admin-count-admin', stats.adminUsers ?? stats.admins);
        set('admin-count-student', stats.studentUsers ?? stats.students);
        set('admin-count-faculty', stats.facultyUsers ?? stats.faculty);
    }

    /**
     * One account row.
     *
     * The role control is a real `<select>` over every role the server accepts,
     * not the old two-state toggle button — "set as admin, or whatever the role
     * is" needs all of them to be reachable.
     */
    function renderAccount(account) {
        const role = String(account.role || 'USER').toUpperCase();
        const status = String(account.status || 'ACTIVE').toUpperCase();
        const isSelf = account.id === viewerId;

        const roleControl = canManageRoles
            ? '<select class="coe-admin-role" data-user-id="' + escapeHtml(account.id) + '"' +
                  (isSelf ? ' disabled title="You cannot change your own role"' : '') + '>' +
                  ROLES.map(function (option) {
                      return '<option value="' + option.value + '"' +
                          (option.value === role ? ' selected' : '') + '>' +
                          escapeHtml(option.label) + '</option>';
                  }).join('') +
              '</select>'
            : '<span class="coe-admin-rolechip">' + escapeHtml(roleLabel(role)) + '</span>';

        const statusControl =
            '<select class="coe-admin-status" data-user-id="' + escapeHtml(account.id) + '"' +
                (isSelf ? ' disabled title="You cannot change your own status"' : '') + '>' +
                STATUSES.map(function (option) {
                    return '<option value="' + option.value + '"' +
                        (option.value === status ? ' selected' : '') + '>' +
                        escapeHtml(option.label) + '</option>';
                }).join('') +
            '</select>';

        return '' +
            '<div class="coe-admin-row status-' + escapeHtml(status.toLowerCase()) + '" data-user-id="' + escapeHtml(account.id) + '">' +
                '<div class="coe-admin-who">' +
                    '<strong>' + escapeHtml(account.name || account.username || 'Unnamed') + '</strong>' +
                    '<small>' + escapeHtml(account.username || '') +
                        (account.email ? ' &middot; ' + escapeHtml(account.email) : '') + '</small>' +
                '</div>' +
                '<div class="coe-admin-meta">' +
                    '<span title="Last sign-in">' + escapeHtml(formatWhen(account.lastLoginAt)) + '</span>' +
                    '<small>' + escapeHtml(String(account.loginCount || 0)) + ' sign-ins</small>' +
                '</div>' +
                '<div class="coe-admin-controls">' +
                    roleControl +
                    statusControl +
                    '<button type="button" class="coe-admin-del" data-user-id="' + escapeHtml(account.id) + '"' +
                        (isSelf ? ' disabled title="You cannot delete your own account"' : ' title="Delete account"') + '>' +
                        '<span class="material-icons">delete_outline</span>' +
                    '</button>' +
                '</div>' +
            '</div>';
    }

    function renderAccounts(payload) {
        const host = global.document.getElementById('account-list');
        if (!host) return;

        canManageRoles = Boolean(payload.canManageRoles);
        viewerId = payload.viewerId || '';

        const accounts = payload.users || [];

        if (!accounts.length) {
            host.innerHTML = '<p class="empty-accounts">No accounts yet.</p>';
            return;
        }

        host.innerHTML =
            '<div class="coe-admin-head">' +
                '<span>Account</span><span>Last sign-in</span>' +
                '<span>' + (canManageRoles ? 'Role &amp; status' : 'Role') + '</span>' +
            '</div>' +
            accounts.map(renderAccount).join('') +
            (canManageRoles ? '' :
                '<p class="coe-admin-note">Only a full administrator can change roles.</p>');

        renderStats(payload.stats);
    }

    function renderLogs(payload) {
        const host = global.document.getElementById('admin-account-logs');
        if (!host) return;

        const events = (payload && payload.events) || [];

        if (!events.length) {
            host.innerHTML = '<p class="empty-accounts">No account activity yet.</p>';
            return;
        }

        host.innerHTML = events.slice(0, 20).map(function (event) {
            const ok = event.success !== false;
            return '' +
                '<div class="coe-admin-log ' + (ok ? 'is-ok' : 'is-fail') + '">' +
                    '<span class="material-icons">' + (ok ? 'check_circle' : 'error_outline') + '</span>' +
                    '<div>' +
                        '<strong>' + escapeHtml(event.type || 'Event') + '</strong>' +
                        '<small>' + escapeHtml(event.username || event.email || 'Unknown') +
                            (event.detail ? ' &middot; ' + escapeHtml(event.detail) : '') + '</small>' +
                    '</div>' +
                    '<time>' + escapeHtml(formatWhen(event.createdAt)) + '</time>' +
                '</div>';
        }).join('');
    }

    // -----------------------------------------------------------------------
    // Refresh
    // -----------------------------------------------------------------------

    let refreshTimer = null;

    /**
     * Reload from the server rather than patching from the socket payload.
     *
     * A role change moves counters, the audit log and possibly several rows at
     * once; re-reading is one request and cannot drift from what the server
     * actually holds.
     */
    function refresh() {
        if (!isAdminViewer()) return Promise.resolve(false);

        return Promise.all([fetchAccounts(), fetchLogs()])
            .then(function (results) {
                renderAccounts(results[0]);
                renderLogs(results[1]);
                return true;
            })
            .catch(function (error) {
                // An admin who has just been demoted still holds a socket in
                // the admin room — rooms are decided at handshake — so they
                // keep receiving events and keep getting 403 here. Expected,
                // and not worth an error line every time.
                if (error.status === 403) return false;

                console.error('[coe-admin] could not load the admin panel', error.message || error);
                return false;
            });
    }

    /**
     * Coalesce a burst of live events into one reload.
     *
     * This defers; it does not drop. The first version returned early while a
     * timer was pending, which meant an event arriving in the quiet window
     * after a reload was discarded and the panel silently went stale — a role
     * changed by one admin never appeared on another's screen.
     */
    function scheduleRefresh() {
        if (refreshTimer) return;

        refreshTimer = global.setTimeout(function () {
            refreshTimer = null;
            refresh();
        }, 200);
    }

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------

    function bind() {
        const host = global.document.getElementById('account-list');
        if (!host || host.dataset.coeBound === 'true') return;
        host.dataset.coeBound = 'true';

        const toast = function (title, detail, tone) {
            if (global.showLibraryToast) global.showLibraryToast(title, detail, tone);
        };

        // Delegated, so rows redrawn by a live event keep working.
        host.addEventListener('change', function (event) {
            const select = event.target.closest('select.coe-admin-role, select.coe-admin-status');
            if (!select) return;

            const id = select.dataset.userId;
            if (!id) return;

            const isRole = select.classList.contains('coe-admin-role');
            const value = select.value;
            let reason;

            if (!isRole && value !== 'ACTIVE') {
                reason = global.prompt('Reason for ' + value.toLowerCase() + ' (the person will see this):') || '';
                if (!reason.trim()) {
                    refresh();   // put the dropdown back
                    return;
                }
            }

            select.disabled = true;

            const request = isRole ? setRole(id, value) : setStatus(id, value, reason);

            request
                .then(function (result) {
                    toast(
                        isRole ? 'Role updated' : 'Status updated',
                        (result.user && (result.user.name || result.user.username) || '') +
                            ' is now ' + (isRole ? roleLabel(value) : value.toLowerCase()),
                        'success'
                    );
                    return refresh();
                })
                .catch(function (error) {
                    // The server refused — the last-admin guard, a registrar
                    // reaching for ADMIN, or self-demotion. Reload so the
                    // control shows what is actually true.
                    toast('Could not change that', error.message || 'Try again.', 'error');
                    return refresh();
                })
                .then(function () { select.disabled = false; });
        });

        host.addEventListener('click', function (event) {
            const button = event.target.closest('button.coe-admin-del');
            if (!button || button.disabled) return;

            const id = button.dataset.userId;
            if (!id) return;

            const row = button.closest('.coe-admin-row');
            const who = row?.querySelector('strong')?.textContent || 'this account';

            if (!global.confirm('Delete ' + who + '? They will no longer be able to sign in.')) return;

            button.disabled = true;

            removeAccount(id, false)
                .then(function (result) {
                    toast('Account deleted', result.message || '', 'success');
                    return refresh();
                })
                .catch(function (error) {
                    button.disabled = false;
                    toast('Could not delete', error.message || 'Try again.', 'error');
                });
        });
    }

    /** Replace the local create-account form with one that hits the API. */
    function bindCreateForm() {
        const form = global.document.getElementById('admin-create-account-form');
        if (!form || form.dataset.coeBound === 'true') return;
        form.dataset.coeBound = 'true';

        // Capture phase, so this runs before the listener scripts.js attached —
        // which writes the account into localStorage and nowhere else.
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            event.stopImmediatePropagation();

            const value = function (id) {
                return String(global.document.getElementById(id)?.value || '').trim();
            };

            const username = value('admin-create-username');
            const details = {
                name: value('admin-create-name'),
                username: username,
                email: value('admin-create-email') ||
                    // The form has no email field in older markup; derive one
                    // so the required field is never silently empty.
                    (username.replace(/^@/, '') + '@au.edu.ph'),
                password: value('admin-create-password'),
                discipline: value('admin-create-course') || 'CE',
                role: value('admin-create-role') || 'STUDENT',
                status: 'ACTIVE'
            };

            createAccount(details)
                .then(function (result) {
                    global.showLibraryToast?.(
                        'Account created',
                        (result.user?.username || details.username) + ' — ' + roleLabel(details.role),
                        'success'
                    );
                    form.reset();
                    return refresh();
                })
                .catch(function (error) {
                    global.showLibraryToast?.('Could not create the account', error.message || 'Try again.', 'error');
                });
        }, true);
    }

    // -----------------------------------------------------------------------
    // Live
    // -----------------------------------------------------------------------

    function listen() {
        // Admin-room events. `server.ts` decides room membership from the
        // database role during the handshake, so a non-admin socket never
        // receives these however the client is written.
        ['user:created', 'user:updated', 'user:deleted', 'log:new', 'stats:updated']
            .forEach(function (event) {
                global.CoeApi.on(event, function (payload) {
                    scheduleRefresh();

                    if (event === 'user:created') {
                        global.showLibraryToast?.(
                            'New account',
                            (payload.name || payload.username || 'Someone') + ' registered',
                            'info'
                        );
                    }
                });
            });
    }

    // -----------------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------------

    function start() {
        if (!global.CoeApi || !global.CoeApi.isServed()) {
            console.warn('[coe-admin] not served by the app server; the admin panel stays local to this browser');
            return Promise.resolve(false);
        }

        return global.CoeApi.session(false)
            .then(function (current) {
                if (!current) return false;
                if (!isAdminViewer()) return false;

                bind();
                bindCreateForm();

                return Promise.all([refresh(), global.CoeApi.connect()])
                    .then(function () {
                        listen();
                        ready = true;
                        return true;
                    });
            })
            .catch(function (error) {
                console.error('[coe-admin] startup failed', error);
                return false;
            });
    }

    global.CoeAdmin = {
        start,
        refresh,
        scheduleRefresh,
        setRole,
        setStatus,
        removeAccount,
        createAccount,
        fetchAccounts,
        ROLES,
        get ready() { return ready; }
    };

    // CoeLive.user is what tells this whether the viewer is an admin, and that
    // is filled during CoeLive's own boot — so wait for it rather than racing.
    function boot() {
        const waitFor = global.CoeLive && global.CoeLive.booted
            ? global.CoeLive.booted
            : Promise.resolve();

        global.CoeAdmin.booted = waitFor.then(start);
    }

    if (global.document.readyState === 'complete' || global.CoeLive) {
        boot();
    } else {
        global.document.addEventListener('DOMContentLoaded', boot);
    }
})(window);
