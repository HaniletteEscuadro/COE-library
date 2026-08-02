/**
 * Student Voice — "Your Voice Matters".
 *
 * WHAT CHANGED, AND WHY IT MATTERED
 * ---------------------------------
 * This file used to keep every concern in `localStorage.coeStudentVoiceConcerns`.
 * That key is private to one browser profile on one computer, which meant the
 * feature never did the one thing it exists to do:
 *
 *   * a student raised a concern and it was saved into their own browser;
 *   * no administrator ever saw it, on any machine;
 *   * the "Public Board" showed each student only their own submissions back;
 *   * and the admin queue on an administrator's screen listed whatever *they*
 *     had personally typed, which was usually nothing at all.
 *
 * Every screen looked like it was working. Nothing was connected to anything.
 *
 * It now reads and writes `/api/concerns`, so there is one board and one queue
 * that every account sees the same way.
 *
 * ANONYMITY
 * ---------
 * The server decides what this file is allowed to render. A student's response
 * from `/api/concerns` contains no author field at all — not a hidden one, not
 * a blanked one — so the board cannot show a name even by accident. An
 * administrator's response carries `authorName`, and that is what the queue
 * displays. This file never chooses; it renders what it was given, and checks
 * `canModerate` from the same response before offering a moderation control.
 */

(function (global) {
    'use strict';

    const doc = global.document;

    const CONCERN_STATUS = { PENDING: 'PENDING', APPROVED: 'APPROVED', ADDRESSED: 'ADDRESSED' };

    const STATUS_LABEL = {
        PENDING: 'Pending review',
        APPROVED: 'Approved',
        ADDRESSED: 'Addressed'
    };

    let concerns = [];
    let totals = { pending: 0, approved: 0, addressed: 0, all: 0 };
    let canModerate = false;
    let started = false;
    let currentEditingConcernId = null;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function escapeVoiceHtml(value) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(value === null || value === undefined ? '' : value)
            .replace(/[&<>"']/g, character => map[character]);
    }

    function formatVoiceDate(isoString) {
        const date = new Date(isoString);
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
              ' · ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function getCategoryClass(category) {
        const classes = {
            'Academic Concern': 'category-academic',
            'Library Materials': 'category-library',
            Facilities: 'category-facilities',
            'Student Support': 'category-support',
            'General Suggestion': 'category-general'
        };
        return classes[category] || 'category-general';
    }

    function getConcernStatusClass(status) {
        const classes = {
            PENDING: 'status-pending',
            APPROVED: 'status-approved',
            ADDRESSED: 'status-addressed'
        };
        return classes[status] || 'status-pending';
    }

    function served() {
        return Boolean(global.CoeApi && global.CoeApi.isServed());
    }

    function toast(title, detail, tone) {
        if (global.showLibraryToast) global.showLibraryToast(title, detail, tone || 'success');
        else showVoiceNotice(detail || title, tone === 'error' ? 'warning' : 'success');
    }

    // -----------------------------------------------------------------------
    // Loading
    // -----------------------------------------------------------------------

    function sync() {
        if (!served()) {
            renderEverything();
            return Promise.resolve(false);
        }

        return global.CoeApi.get('/api/concerns')
            .then(function (result) {
                concerns = (result && result.concerns) || [];
                totals = (result && result.totals) || totals;
                // Straight from the server on every load. Never cached and
                // never inferred from the local user record — a stale "I am an
                // admin" is how a moderation button appears for somebody who
                // is not one, and answers 403 when they press it.
                canModerate = Boolean(result && result.canModerate);
                renderEverything();
                return true;
            })
            .catch(function (error) {
                console.error('[student-voice] could not load the board', error.message || error);
                const list = doc.getElementById('concerns-list');
                if (list) {
                    list.innerHTML = '<p class="empty-concerns">Could not load the board. Check your connection and try again.</p>';
                }
                return false;
            });
    }

    let timer = null;

    /** Coalesce a burst of live events into one reload. */
    function scheduleSync() {
        if (timer) return;
        timer = global.setTimeout(function () {
            timer = null;
            sync();
        }, 250);
    }

    // -----------------------------------------------------------------------
    // Submitting
    // -----------------------------------------------------------------------

    /**
     * Categories that are answered privately and never published.
     *
     * Mirrors PRIVATE_CONCERN_CATEGORIES on the server. The server is what
     * enforces it — this only decides whether the email box is shown and
     * required, so a mismatch here is a confusing form, not a leak.
     */
    const PRIVATE_CATEGORIES = ['Academic Concern'];

    function isPrivateCategory(category) {
        return PRIVATE_CATEGORIES.indexOf(String(category || '')) > -1;
    }

    /** Show and require the email box only where a private reply is the only reply. */
    function syncCategoryFields() {
        const category = doc.getElementById('concern-category');
        const field = doc.getElementById('concern-email-field');
        const input = doc.getElementById('concern-email');
        if (!field || !input) return;

        const priv = isPrivateCategory(category && category.value);

        field.hidden = !priv;
        // `required` is set as well as shown: a hidden-but-required field blocks
        // submission with a validation message the user cannot see and cannot
        // reach, which is worse than no validation at all.
        input.required = priv;
        if (!priv) input.value = '';
    }

    function handleConcernSubmission(event) {
        event.preventDefault();

        const form = event.currentTarget;
        const category = doc.getElementById('concern-category');
        const title = doc.getElementById('concern-title');
        const description = doc.getElementById('concern-description');
        const consent = doc.getElementById('concern-consent');
        const email = doc.getElementById('concern-email');
        const button = form.querySelector('button[type="submit"]');

        const payload = {
            category: String(category?.value || ''),
            title: String(title?.value || '').trim(),
            description: String(description?.value || '').trim(),
            consent: Boolean(consent && consent.checked),
            contactEmail: String(email?.value || '').trim()
        };

        if (!payload.category || !payload.title || !payload.description) {
            showVoiceNotice('Please fill in the category, subject and details.', 'warning');
            return;
        }

        if (!payload.consent) {
            showVoiceNotice('Tick the box to confirm you understand who can see your name.', 'warning');
            consent?.focus();
            return;
        }

        if (isPrivateCategory(payload.category) && !payload.contactEmail) {
            showVoiceNotice('An academic concern is answered by email, so an address is required.', 'warning');
            email?.focus();
            return;
        }

        if (!served()) {
            showVoiceNotice('Open the portal through the app server to submit.', 'warning');
            return;
        }

        const label = button ? button.innerHTML : '';
        if (button) {
            button.disabled = true;
            button.innerHTML = 'Sending…';
        }

        const wasPrivate = isPrivateCategory(payload.category);

        global.CoeApi.post('/api/concerns', payload)
            .then(function (result) {
                form.reset();
                syncCategoryFields();

                const success = doc.getElementById('concern-success-message');
                if (success) {
                    // Two different promises, so two different confirmations. A
                    // student who sent an academic concern and then watched the
                    // board for it would be watching a board it will never
                    // reach.
                    const detail = success.querySelector('span:last-of-type');
                    if (detail) {
                        detail.textContent = wasPrivate
                            ? 'It is not posted on the public board. The reply is sent to the email address you gave.'
                            : 'An administrator will look at it. It appears on the board once approved — anonymously.';
                    }
                    success.classList.remove('hidden');
                    global.setTimeout(function () { success.classList.add('hidden'); }, 8000);
                }

                toast('Sent for review', (result && result.message) || 'An administrator will look at it.', 'success');
                return sync();
            })
            .catch(function (error) {
                showVoiceNotice((error && error.message) || 'Could not send that. Try again.', 'warning');
            })
            .then(function () {
                if (button) {
                    button.disabled = false;
                    button.innerHTML = label;
                }
            });
    }

    // -----------------------------------------------------------------------
    // The public board
    // -----------------------------------------------------------------------

    function isPublicConcern(concern) {
        return concern.status !== CONCERN_STATUS.PENDING;
    }

    function renderEverything() {
        const publicConcerns = concerns.filter(isPublicConcern);
        updateConcernStats(publicConcerns);
        renderVoiceChart();
        displayApprovedConcerns(publicConcerns, getActiveConcernFilter());
        updateAdminModerationNotice();
        if (canModerate) refreshAdminVoiceView();
        applyModeratorVisibility();
    }

    /** Show the moderation card only to accounts the server says may moderate. */
    function applyModeratorVisibility() {
        doc.querySelectorAll('[data-voice-moderator-only]').forEach(function (node) {
            node.hidden = !canModerate;
        });
    }

    function updateConcernStats(publicConcerns) {
        const set = function (id, value) {
            const node = doc.getElementById(id);
            if (node) node.textContent = String(value);
        };

        set('total-concerns-count', publicConcerns.length);
        set('pending-concerns-count', totals.pending);
        set('resolved-concerns-count', totals.addressed);
        set('voice-dashboard-total', totals.all);
        set('voice-dashboard-pending', totals.pending);
        set('voice-dashboard-public', totals.approved + totals.addressed);
        set('voice-dashboard-addressed', totals.addressed);

        const mostCommon = doc.getElementById('most-common-category');
        if (mostCommon) {
            const counts = publicConcerns.reduce(function (acc, concern) {
                acc[concern.category] = (acc[concern.category] || 0) + 1;
                return acc;
            }, {});
            const categories = Object.keys(counts);
            mostCommon.textContent = categories.length
                ? categories.sort(function (a, b) { return counts[b] - counts[a]; })[0]
                : '—';
        }
    }

    function renderVoiceChart() {
        const chart = doc.getElementById('voice-chart');
        if (!chart) return;

        const rows = [
            { label: 'Pending', value: totals.pending, className: 'pending' },
            { label: 'Approved', value: totals.approved, className: 'approved' },
            { label: 'Addressed', value: totals.addressed, className: 'addressed' }
        ];
        const max = Math.max(1, ...rows.map(function (row) { return row.value; }));

        chart.innerHTML = rows.map(function (row) {
            return '<div class="voice-chart-row">' +
                '<span class="voice-chart-label">' + escapeVoiceHtml(row.label) + '</span>' +
                '<div class="voice-chart-track">' +
                    '<span class="voice-chart-fill ' + row.className + '" style="width:' +
                    Math.max(6, (row.value / max) * 100) + '%"></span>' +
                '</div>' +
                '<strong>' + row.value + '</strong>' +
            '</div>';
        }).join('');
    }

    function displayApprovedConcerns(publicConcerns, filter) {
        const list = doc.getElementById('concerns-list');
        if (!list) return;

        const filtered = !filter || filter === 'all'
            ? publicConcerns
            : publicConcerns.filter(function (c) { return c.category === filter; });

        if (!filtered.length) {
            list.innerHTML = '<p class="empty-concerns">' +
                (publicConcerns.length
                    ? 'Nothing in this category yet.'
                    : 'No concerns have been published yet. Approved submissions appear here for everyone.') +
                '</p>';
            return;
        }

        // Addressed last: the board is read top-down for what is still open.
        const approved = filtered.filter(function (c) { return c.status === CONCERN_STATUS.APPROVED; });
        const addressed = filtered.filter(function (c) { return c.status === CONCERN_STATUS.ADDRESSED; });

        list.innerHTML =
            renderConcernGroup('Open concerns', approved, true) +
            renderConcernGroup('Addressed', addressed, addressed.length > 0 && approved.length === 0);
    }

    function renderConcernGroup(title, group, open) {
        return '<details class="concern-group"' + (open ? ' open' : '') + '>' +
            '<summary>' +
                '<span>' + escapeVoiceHtml(title) + '</span>' +
                '<strong>' + group.length + '</strong>' +
            '</summary>' +
            '<div class="concern-group-list">' +
                (group.length
                    ? group.map(renderPublicConcernCard).join('')
                    : '<p class="empty-concerns">Nothing here yet.</p>') +
            '</div>' +
        '</details>';
    }

    function renderPublicConcernCard(concern) {
        return '<article class="concern-card" data-concern-id="' + escapeVoiceHtml(concern.id) + '">' +
            '<div class="concern-header">' +
                '<span class="concern-category ' + getCategoryClass(concern.category) + '">' +
                    escapeVoiceHtml(concern.category) + '</span>' +
                '<span class="concern-status ' + getConcernStatusClass(concern.status) + '">' +
                    escapeVoiceHtml(STATUS_LABEL[concern.status] || concern.status) + '</span>' +
            '</div>' +
            '<h4 class="concern-title">' + escapeVoiceHtml(concern.title) + '</h4>' +
            '<p class="concern-description">' + escapeVoiceHtml(concern.description) + '</p>' +
            (concern.response
                ? '<div class="concern-response">' +
                      '<strong><span class="material-icons">verified</span>College response</strong>' +
                      '<p>' + escapeVoiceHtml(concern.response) + '</p>' +
                  '</div>'
                : '') +
            '<div class="concern-meta">' +
                '<span class="concern-author"><span class="material-icons">visibility_off</span>Posted anonymously</span>' +
                '<span class="concern-date"><span class="material-icons">schedule</span>' +
                    escapeVoiceHtml(formatVoiceDate(concern.createdAt)) + '</span>' +
            '</div>' +
        '</article>';
    }

    function filterConcerns(category) {
        doc.querySelectorAll('.filter-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.filter === category);
        });
        displayApprovedConcerns(concerns.filter(isPublicConcern), category);
    }

    function getActiveConcernFilter() {
        const active = doc.querySelector('.filter-btn.active');
        return (active && active.dataset.filter) || 'all';
    }

    function switchStudentVoiceTab(tab) {
        doc.querySelectorAll('.voice-tab-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        doc.querySelectorAll('.voice-tab-content').forEach(function (content) {
            content.classList.remove('active');
        });
        const panel = doc.getElementById(tab + '-tab');
        if (panel) panel.classList.add('active');
        if (tab === 'board') sync();
    }

    // -----------------------------------------------------------------------
    // The administrator's queue
    // -----------------------------------------------------------------------

    function displayAdminConcerns(status) {
        const key = status || 'pending';
        const container = doc.getElementById(key + '-concerns-admin');
        if (!container) return;

        if (!canModerate) {
            container.innerHTML = '';
            return;
        }

        const wanted = key.toUpperCase();
        const filtered = key === 'all'
            ? concerns
            : concerns.filter(function (c) { return c.status === wanted; });

        const alert = key === 'pending' ? renderPendingAdminAlert() : '';

        container.innerHTML = filtered.length
            ? alert + filtered.map(renderAdminConcernCard).join('')
            : alert + '<p class="empty-concerns">Nothing in this queue.</p>';
    }

    function updateAdminModerationNotice() {
        Object.keys(totals).forEach(function (key) {
            doc.querySelectorAll('[data-voice-tab-count="' + key + '"]').forEach(function (badge) {
                badge.textContent = String(totals[key]);
                badge.classList.toggle('is-zero', totals[key] === 0);
            });
        });

        const summary = doc.getElementById('voice-admin-notice-summary');
        if (summary) {
            summary.textContent = totals.pending
                ? totals.pending + ' student submission' + (totals.pending === 1 ? '' : 's') + ' waiting for review.'
                : 'No submissions waiting for review.';
        }

        const pill = doc.getElementById('voice-admin-pending-pill');
        if (pill) {
            pill.textContent = totals.pending + ' pending';
            pill.classList.toggle('hidden', totals.pending === 0);
            pill.classList.toggle('is-live', totals.pending > 0);
        }
    }

    function renderPendingAdminAlert() {
        const pending = concerns.filter(function (c) { return c.status === CONCERN_STATUS.PENDING; });
        if (!pending.length) return '';

        const latest = pending[0];
        return '<div class="voice-admin-live-alert" role="status" aria-live="polite">' +
            '<span class="material-icons">notifications_active</span>' +
            '<div>' +
                '<strong>' + pending.length + ' waiting for review</strong>' +
                '<p>Latest: ' + escapeVoiceHtml(latest.title) + ' · ' +
                    escapeVoiceHtml(formatVoiceDate(latest.createdAt)) + '</p>' +
            '</div>' +
            '<button type="button" data-voice-action="open" data-concern-id="' +
                escapeVoiceHtml(latest.id) + '">Review</button>' +
        '</div>';
    }

    function renderAdminConcernCard(concern) {
        /*
         * The identity line.
         *
         * Only rendered from `concern.authorName`, which the API includes for
         * administrators and omits entirely for everybody else — so this branch
         * is dead code in a student's browser rather than something hidden from
         * them with CSS.
         */
        const who = concern.authorName
            ? '<span class="admin-concern-author" title="Visible to administrators only">' +
                  '<span class="material-icons">person</span>' +
                  escapeVoiceHtml(concern.authorName) +
                  (concern.authorUsername
                      ? ' <small>' + escapeVoiceHtml(concern.authorUsername) + '</small>'
                      : '') +
              '</span>'
            : '';

        const id = escapeVoiceHtml(concern.id);

        /*
         * The reply address, as a mailto.
         *
         * There is no SMTP configured in this deployment, so nothing here can
         * send the reply for you — the link opens whatever mail client the
         * reviewer already uses, with the subject filled in. Better an honest
         * link than a "Send reply" button that quietly does nothing.
         */
        const contact = concern.contactEmail
            ? '<a class="admin-concern-mail" href="mailto:' + escapeVoiceHtml(concern.contactEmail) +
                  '?subject=' + encodeURIComponent('Re: ' + concern.title) + '">' +
                  '<span class="material-icons">mail</span>' +
                  escapeVoiceHtml(concern.contactEmail) + '</a>'
            : '';

        // A concern raised before the consent tick existed. Worth flagging: it
        // is documented, but the student was never told it would be.
        const consentFlag = concern.consentAt
            ? ''
            : '<span class="admin-concern-noconsent" title="Raised before the consent notice existed">' +
                  '<span class="material-icons">help</span>No consent record</span>';

        const privateFlag = concern.isPrivate
            ? '<span class="admin-concern-private">' +
                  '<span class="material-icons">lock</span>Never published &middot; reply by email</span>'
            : '';

        return '<article class="admin-concern-card' + (concern.isPrivate ? ' is-private' : '') +
                   '" data-concern-id="' + id + '">' +
            '<div class="admin-concern-header">' +
                '<div class="admin-concern-headline">' +
                    '<span class="concern-category ' + getCategoryClass(concern.category) + '">' +
                        escapeVoiceHtml(concern.category) + '</span>' +
                    '<h4>' + escapeVoiceHtml(concern.title) + '</h4>' +
                '</div>' +
                '<span class="concern-status ' + getConcernStatusClass(concern.status) + '">' +
                    escapeVoiceHtml(STATUS_LABEL[concern.status] || concern.status) + '</span>' +
            '</div>' +
            '<div class="admin-concern-identity">' +
                who +
                contact +
                consentFlag +
                privateFlag +
                '<span class="concern-date"><span class="material-icons">schedule</span>' +
                    escapeVoiceHtml(formatVoiceDate(concern.createdAt)) + '</span>' +
            '</div>' +
            '<p class="concern-description">' + escapeVoiceHtml(concern.description) + '</p>' +
            (concern.response
                ? '<div class="concern-response"><strong>Response</strong><p>' +
                      escapeVoiceHtml(concern.response) + '</p></div>'
                : '') +
            '<div class="admin-concern-actions">' +
                // "Approve" means "publish to the board", so it is not offered
                // for a category that has no board. The server refuses it too;
                // this stops a reviewer pressing a button that can only fail.
                (concern.status === CONCERN_STATUS.PENDING && !concern.isPrivate
                    ? '<button type="button" class="voice-act is-approve" data-voice-action="approve" data-concern-id="' + id + '">' +
                          '<span class="material-icons">check_circle</span>Approve</button>'
                    : '') +
                (concern.status !== CONCERN_STATUS.ADDRESSED
                    ? '<button type="button" class="voice-act is-addressed" data-voice-action="addressed" data-concern-id="' + id + '">' +
                          '<span class="material-icons">task_alt</span>Mark addressed</button>'
                    : '') +
                '<button type="button" class="voice-act is-open" data-voice-action="open" data-concern-id="' + id + '">' +
                    '<span class="material-icons">edit_note</span>Respond</button>' +
                '<button type="button" class="voice-act is-reject" data-voice-action="reject" data-concern-id="' + id + '">' +
                    '<span class="material-icons">delete</span>Reject</button>' +
            '</div>' +
        '</article>';
    }

    function switchAdminVoiceTab(tab) {
        doc.querySelectorAll('.voice-admin-tab[data-admin-tab]').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.adminTab === tab);
        });
        doc.querySelectorAll('.admin-concerns-list').forEach(function (content) {
            content.classList.add('hidden');
        });
        const panel = doc.getElementById(tab + '-concerns-admin');
        if (panel) panel.classList.remove('hidden');
        displayAdminConcerns(tab);
    }

    function refreshAdminVoiceView() {
        const active = doc.querySelector('.voice-admin-tab.active[data-admin-tab]');
        switchAdminVoiceTab((active && active.dataset.adminTab) || 'pending');
    }

    // -----------------------------------------------------------------------
    // Moderation actions
    // -----------------------------------------------------------------------

    function patchConcern(id, changes, successText) {
        return global.CoeApi.patch('/api/concerns/' + encodeURIComponent(id), changes)
            .then(function () {
                toast('Updated', successText || 'The board has been updated.', 'success');
                return sync();
            })
            .catch(function (error) {
                toast(
                    error && error.status === 403 ? 'Not allowed' : 'Could not update',
                    (error && error.message) || 'Try again.',
                    'error'
                );
            });
    }

    function approveConcernQuick(id) {
        return patchConcern(id, { status: 'APPROVED' }, 'Published to the board for everyone.');
    }

    function markConcernAddressed(id) {
        return patchConcern(id, { status: 'ADDRESSED' }, 'Marked as addressed.');
    }

    function rejectConcernById(id) {
        if (!global.confirm('Reject this concern? It is removed from the queue and never published.')) {
            return Promise.resolve(false);
        }

        return global.CoeApi.del('/api/concerns/' + encodeURIComponent(id))
            .then(function () {
                toast('Rejected', 'Removed from the queue.', 'success');
                closeConcernModal();
                return sync();
            })
            .catch(function (error) {
                toast('Could not reject', (error && error.message) || 'Try again.', 'error');
            });
    }

    function openConcernDetail(concernId) {
        const concern = concerns.find(function (item) { return item.id === concernId; });
        if (!concern) return;

        currentEditingConcernId = concernId;

        const set = function (id, value) {
            const node = doc.getElementById(id);
            if (node) node.textContent = value;
        };

        set('detail-category', concern.category);
        set('detail-title', concern.title);
        set('detail-description', concern.description);
        set('detail-status', STATUS_LABEL[concern.status] || concern.status);
        set('concern-detail-date', formatVoiceDate(concern.createdAt));

        // Who raised it. Present only in an administrator's payload, and this
        // dialog is only reachable from the administrator's queue.
        const author = doc.getElementById('detail-author');
        if (author) {
            author.textContent = concern.authorName
                ? concern.authorName + (concern.authorUsername ? ' (' + concern.authorUsername + ')' : '')
                : 'Not available';
        }

        const contactRow = doc.getElementById('detail-contact-row');
        const contact = doc.getElementById('detail-contact');
        if (contactRow && contact) {
            contactRow.hidden = !concern.contactEmail;
            contact.innerHTML = concern.contactEmail
                ? '<a href="mailto:' + escapeVoiceHtml(concern.contactEmail) +
                      '?subject=' + encodeURIComponent('Re: ' + concern.title) + '">' +
                      escapeVoiceHtml(concern.contactEmail) + '</a>'
                : '';
        }

        const statusSelect = doc.getElementById('detail-status-select');
        if (statusSelect) {
            /*
             * Publishing is not an option for a private category.
             *
             * Removing the option rather than letting the save fail: the
             * reviewer sees the two states that exist for this concern, and the
             * hint below says what to do instead.
             */
            const approveOption = statusSelect.querySelector('option[value="APPROVED"]');
            if (approveOption) approveOption.hidden = Boolean(concern.isPrivate);

            statusSelect.value = concern.status;
        }

        const privateHint = doc.getElementById('detail-private-hint');
        if (privateHint) privateHint.hidden = !concern.isPrivate;

        const response = doc.getElementById('detail-response');
        if (response) response.value = concern.response || '';

        const modal = doc.getElementById('concern-detail-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('is-open');
        }
    }

    function saveConcernChanges() {
        if (!currentEditingConcernId) return;

        const status = doc.getElementById('detail-status-select')?.value;
        const response = doc.getElementById('detail-response')?.value || '';

        patchConcern(currentEditingConcernId, { status: status, response: response }, 'Saved.')
            .then(closeConcernModal);
    }

    function rejectConcern() {
        if (!currentEditingConcernId) return;
        rejectConcernById(currentEditingConcernId);
    }

    function closeConcernModal() {
        const modal = doc.getElementById('concern-detail-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('is-open');
        }
        currentEditingConcernId = null;
    }

    function showVoiceNotice(message, tone) {
        let notice = doc.getElementById('voice-inline-notice');
        if (!notice) {
            notice = doc.createElement('div');
            notice.id = 'voice-inline-notice';
            notice.className = 'inline-notice';
            doc.body.appendChild(notice);
        }
        notice.textContent = message;
        notice.dataset.tone = tone || 'success';
        notice.classList.add('show');
        global.clearTimeout(showVoiceNotice.timer);
        showVoiceNotice.timer = global.setTimeout(function () { notice.classList.remove('show'); }, 3200);
    }

    // -----------------------------------------------------------------------
    // Wiring
    // -----------------------------------------------------------------------

    function bind() {
        doc.getElementById('concern-form')?.addEventListener('submit', handleConcernSubmission);

        // The email box appears and disappears with the category.
        doc.getElementById('concern-category')?.addEventListener('change', syncCategoryFields);
        doc.getElementById('concern-form')?.addEventListener('reset', function () {
            // After the reset, not during — the field values are still the old
            // ones while the event is being handled.
            global.setTimeout(syncCategoryFields, 0);
        });
        syncCategoryFields();

        doc.querySelectorAll('.voice-tab-btn').forEach(function (tab) {
            tab.addEventListener('click', function () { switchStudentVoiceTab(this.dataset.tab); });
        });

        doc.querySelectorAll('.filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { filterConcerns(this.dataset.filter); });
        });

        doc.querySelectorAll('.voice-admin-tab[data-admin-tab]').forEach(function (tab) {
            tab.addEventListener('click', function () { switchAdminVoiceTab(this.dataset.adminTab); });
        });

        /*
         * Delegated, and no inline `onclick`.
         *
         * The cards are rebuilt on every sync, so per-element listeners would
         * have to be re-attached each time. The previous version solved that
         * with `onclick="window.studentVoiceManager.…('<id>')"` built into the
         * HTML string — which puts an id straight into executable markup, and
         * is one unescaped apostrophe away from being a script-injection site.
         */
        doc.addEventListener('click', function (event) {
            const button = event.target.closest('[data-voice-action]');
            if (!button) return;

            event.preventDefault();
            event.stopPropagation();

            const id = button.getAttribute('data-concern-id');
            if (!id) return;

            const action = button.getAttribute('data-voice-action');
            if (action === 'approve') approveConcernQuick(id);
            else if (action === 'addressed') markConcernAddressed(id);
            else if (action === 'reject') rejectConcernById(id);
            else if (action === 'open') openConcernDetail(id);
        });

        doc.getElementById('close-concern-modal')?.addEventListener('click', closeConcernModal);
        doc.getElementById('save-concern-btn')?.addEventListener('click', saveConcernChanges);
        doc.getElementById('reject-concern-btn')?.addEventListener('click', rejectConcern);

        const modal = doc.getElementById('concern-detail-modal');
        if (modal) {
            modal.addEventListener('click', function (event) {
                if (event.target === modal) closeConcernModal();
            });
        }

        doc.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeConcernModal();
        });
    }

    function start() {
        if (started) return Promise.resolve(true);
        if (!doc.getElementById('student-voice-panel')) return Promise.resolve(false);

        bind();

        if (!served()) {
            renderEverything();
            return Promise.resolve(false);
        }

        return global.CoeApi.session(false)
            .then(function (current) {
                if (!current) return false;

                return sync()
                    .then(function () { return global.CoeApi.connect(); })
                    .then(function () {
                        // `concern:created` only reaches administrators — the
                        // server routes it to the admin room — so a student's
                        // socket simply never fires this handler.
                        global.CoeApi.on('concern:created', function (payload) {
                            scheduleSync();
                            toast('New student concern', (payload && payload.title) || '', 'info');
                        });

                        ['concern:updated', 'concern:deleted'].forEach(function (name) {
                            global.CoeApi.on(name, scheduleSync);
                        });

                        started = true;
                        return true;
                    });
            })
            .catch(function (error) {
                console.error('[student-voice] startup failed', error);
                return false;
            });
    }

    global.studentVoiceManager = {
        start,
        sync,
        displayAdminConcerns,
        switchAdminVoiceTab,
        openConcernDetail,
        saveConcernChanges,
        rejectConcern,
        rejectConcernById,
        approveConcernQuick,
        markConcernAddressed,
        refreshStudentVoiceAdmin: refreshAdminVoiceView,
        displayPublicBoard: sync,
        getConcerns: function () { return concerns; },
        get canModerate() { return canModerate; },
        get ready() { return started; }
    };

    global.openConcernDetail = openConcernDetail;

    function boot() {
        global.studentVoiceManager.booted = start();
    }

    if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
