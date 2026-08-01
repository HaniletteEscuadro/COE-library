/**
 * COE Studio — COESC tab (College of Engineering Student Council).
 *
 * Four things on one screen, all backed by `/api/coesc/*`:
 *
 *   1. the council org chart — ten seats, with portraits only an administrator
 *      may upload;
 *   2. the council's announcements, read from the same shared board every other
 *      page reads, so a notice posted once appears here too;
 *   3. committee recruitment — students apply, and the applications land in the
 *      database rather than in the browser that sent them;
 *   4. the approvals queue — questions, materials and applications in one list,
 *      visible only to reviewers.
 *
 * WHY NOT localStorage
 * --------------------
 * The Organizations page still has an "interest form" that writes to
 * `localStorage`. That means an application is visible only inside the browser
 * that submitted it: the student sees a success message, and the council never
 * receives anything at all. Everything here goes through the API for that
 * reason — "dapat makita namin ang mga pag-apply nila" is only true if the row
 * is on the server.
 *
 * PERMISSIONS ARE A SERVER DECISION
 * ---------------------------------
 * `canManage` and `canReview` arrive from the API and only decide what is
 * *drawn*. Every write is re-checked server-side, so hiding a button is a
 * courtesy to the user, never the security boundary — a student editing the
 * DOM to reveal the upload control still gets a 403.
 */

(function (global) {
    'use strict';

    const doc = global.document;

    let officers = [];
    let tiers = [];
    let committees = [];
    let applications = [];
    let approvals = null;
    let canManage = false;
    let canReview = false;
    let started = false;

    /**
     * The signed-in account's own id.
     *
     * Needed because `/api/coesc/applications` returns *every* application to a
     * reviewer — which is the point of that endpoint, but it means "My
     * Applications" and the "You are a member" badge would show an administrator
     * the whole college's applications as if they were their own. Both filter on
     * this instead of trusting the list to already be personal.
     */
    let myUserId = '';

    /** Only this account's applications, whatever the endpoint returned. */
    function myApplications() {
        return applications.filter(a => a.applicantId === myUserId);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Initials for the placeholder portrait, e.g. "Matt A. Panahon" -> "MP". */
    function initialsOf(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '??';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function formatWhen(iso) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';

        const days = Math.floor((Date.now() - date.getTime()) / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return days + ' days ago';

        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatBytes(bytes) {
        const n = Number(bytes) || 0;
        if (n <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
        return (i === 0 ? n : (n / Math.pow(1024, i)).toFixed(1)) + ' ' + units[i];
    }

    function el(id) {
        return doc.getElementById(id);
    }

    /** Small transient message under a form. */
    function say(node, text, tone) {
        if (!node) return;
        node.textContent = text || '';
        node.className = 'coesc-note' + (tone ? ' is-' + tone : '');
        node.hidden = !text;
    }

    // -----------------------------------------------------------------------
    // Org chart
    // -----------------------------------------------------------------------

    function officerCard(officer) {
        const accent = officer.course ? ' coesc-officer--' + officer.course.toLowerCase() : '';
        const isAdviser = officer.position === 'ADVISER';

        const portrait = officer.photoUrl
            ? '<img src="' + escapeHtml(officer.photoUrl) + '" alt="' + escapeHtml(officer.name) + '" loading="lazy">'
            : '<span class="coesc-initials" aria-hidden="true">' + escapeHtml(initialsOf(officer.name)) + '</span>';

        // The upload control is drawn only for administrators. The server
        // enforces the same rule regardless of what the DOM says.
        const manage = canManage
            ? '<div class="coesc-officer-tools">' +
                  '<button type="button" class="coesc-mini-btn" data-officer-photo="' + escapeHtml(officer.id) + '">' +
                      '<span class="material-icons">photo_camera</span>' +
                      (officer.hasPhoto ? 'Replace' : 'Add photo') +
                  '</button>' +
                  '<button type="button" class="coesc-mini-btn" data-officer-rename="' + escapeHtml(officer.id) + '">' +
                      '<span class="material-icons">edit</span>Rename' +
                  '</button>' +
              '</div>'
            : '';

        return '' +
            '<article class="coesc-officer' + accent + (isAdviser ? ' coesc-officer--adviser' : '') + '">' +
                '<div class="coesc-officer-photo' + (officer.photoUrl ? ' has-image' : '') + '">' +
                    portrait +
                '</div>' +
                '<p class="coesc-officer-role">' + escapeHtml(officer.positionLabel) + '</p>' +
                '<h4 class="coesc-officer-name">' + escapeHtml(officer.name) + '</h4>' +
                (officer.course
                    ? '<span class="coesc-officer-tag">' + escapeHtml(officer.course) + '</span>'
                    : '') +
                manage +
            '</article>';
    }

    /**
     * Draw the council as an org chart, top to bottom.
     *
     * Each level is a `.coesc-tier`; the connector lines between them are drawn
     * in CSS from the nodes themselves, using the first-child/last-child trick,
     * so the horizontal bar spans exactly the outermost siblings whether a tier
     * holds one seat or seven. Nothing here measures or positions anything, and
     * there is no absolute positioning to fall out of alignment when a name
     * wraps onto a second line.
     *
     * The tiers come from the server so the hierarchy is described once.
     */
    function renderOfficers() {
        const host = el('coesc-tree');
        if (!host) return;

        if (!officers.length) {
            host.innerHTML =
                '<p class="coesc-empty">The council roster has not been set up yet.</p>';
            return;
        }

        // Fall back to a single tier if an older server did not send them, so
        // the chart degrades to a flat row rather than disappearing.
        const levels = tiers.length ? tiers : [{ tier: 0, label: '', link: 'none' }];

        const html = levels.map(function (level) {
            const seats = officers
                .filter(o => (typeof o.tier === 'number' ? o.tier : 0) === level.tier)
                .sort((a, b) => a.sortOrder - b.sortOrder);

            if (!seats.length) return '';

            const linkClass = level.link === 'dashed'
                ? ' coesc-tier--dashed'
                : (level.link === 'solid' ? ' coesc-tier--linked' : '');

            return '' +
                '<div class="coesc-tier' + linkClass + '" data-tier="' + level.tier + '">' +
                    (level.label
                        ? '<span class="coesc-tier-label">' + escapeHtml(level.label) + '</span>'
                        : '') +
                    '<div class="coesc-tier-nodes">' +
                        seats.map(function (officer) {
                            return '<div class="coesc-node">' + officerCard(officer) + '</div>';
                        }).join('') +
                    '</div>' +
                '</div>';
        }).join('');

        host.innerHTML = html;

        const hint = el('coesc-manage-hint');
        if (hint) hint.hidden = !canManage;
    }

    // -----------------------------------------------------------------------
    // Announcements
    // -----------------------------------------------------------------------

    function renderAnnouncements(list) {
        const host = el('coesc-announcements');
        if (!host) return;

        if (!list.length) {
            host.innerHTML =
                '<p class="coesc-empty">No announcements yet. Anything the council posts ' +
                'appears here for every student.</p>';
            return;
        }

        host.innerHTML = list.slice(0, 6).map(function (item) {
            const priority = String(item.priority || '').toUpperCase();
            const tone = (priority === 'URGENT' || priority === 'HIGH') ? ' is-urgent' : '';

            return '' +
                '<article class="coesc-notice' + tone + '">' +
                    '<div class="coesc-notice-head">' +
                        '<h4>' + escapeHtml(item.title) + '</h4>' +
                        (item.pinned
                            ? '<span class="material-icons coesc-pin" title="Pinned">push_pin</span>'
                            : '') +
                    '</div>' +
                    '<p>' + escapeHtml(item.body || '') + '</p>' +
                    '<div class="coesc-notice-meta">' +
                        '<span>' + escapeHtml(item.authorName || 'COESC') + '</span>' +
                        '<span>' + escapeHtml(formatWhen(item.publishedAt || item.createdAt)) + '</span>' +
                        '<span class="coesc-scope">' + escapeHtml(String(item.course || '').toUpperCase() || 'All COE') + '</span>' +
                    '</div>' +
                '</article>';
        }).join('');
    }

    function syncAnnouncements() {
        return global.CoeApi.get('/api/announcements?pageSize=20')
            .then(function (result) {
                renderAnnouncements((result && result.announcements) || []);
            })
            .catch(function (error) {
                renderLoadError('coesc-announcements', 'announcements', error);
                throw error;
            });
    }

    // -----------------------------------------------------------------------
    // Recruitment
    // -----------------------------------------------------------------------

    function renderCommittees() {
        const host = el('coesc-committees');
        const select = el('coesc-committee-select');
        if (!host) return;

        const own = myApplications();

        host.innerHTML = committees.map(function (committee) {
            const mine = own.find(a => a.committee === committee.slug &&
                (a.status === 'PENDING' || a.status === 'APPROVED'));

            const badge = mine
                ? '<span class="coesc-committee-state is-' + mine.status.toLowerCase() + '">' +
                      (mine.status === 'APPROVED' ? 'You are a member' : 'Application pending') +
                  '</span>'
                : '';

            return '' +
                '<article class="coesc-committee">' +
                    '<h4>' + escapeHtml(committee.name) + '</h4>' +
                    '<p>' + escapeHtml(committee.description) + '</p>' +
                    badge +
                '</article>';
        }).join('');

        if (select) {
            const current = select.value;
            select.innerHTML = '<option value="">Choose a committee</option>' +
                committees.map(c =>
                    '<option value="' + escapeHtml(c.slug) + '">' + escapeHtml(c.name) + '</option>'
                ).join('');
            if (current) select.value = current;
        }
    }

    /** The signed-in student's own applications, with the council's reply. */
    function renderMyApplications() {
        const host = el('coesc-my-applications');
        if (!host) return;

        const mine = myApplications().slice(0, 10);

        if (!mine.length) {
            host.innerHTML = '<p class="coesc-empty">You have not applied to a committee yet.</p>';
            return;
        }

        host.innerHTML = mine.map(function (item) {
            return '' +
                '<div class="coesc-application-row">' +
                    '<div>' +
                        '<strong>' + escapeHtml(item.committeeName) + '</strong>' +
                        '<small>' + escapeHtml(formatWhen(item.createdAt)) + '</small>' +
                    '</div>' +
                    '<span class="coesc-status is-' + escapeHtml(item.status.toLowerCase()) + '">' +
                        escapeHtml(item.status) +
                    '</span>' +
                    (item.reviewNote
                        ? '<p class="coesc-application-note">' + escapeHtml(item.reviewNote) + '</p>'
                        : '') +
                '</div>';
        }).join('');
    }

    // -----------------------------------------------------------------------
    // Approvals (reviewers only)
    // -----------------------------------------------------------------------

    function approvalCard(kind, item) {
        if (kind === 'application') {
            return '' +
                '<article class="coesc-approval" data-approval-kind="application" data-approval-id="' + escapeHtml(item.id) + '">' +
                    '<header>' +
                        '<span class="coesc-approval-tag is-application">Committee</span>' +
                        '<time>' + escapeHtml(formatWhen(item.createdAt)) + '</time>' +
                    '</header>' +
                    '<h4>' + escapeHtml(item.fullName) + ' &rarr; ' + escapeHtml(item.committeeName) + '</h4>' +
                    '<p class="coesc-approval-meta">' +
                        escapeHtml(item.course) + ' &middot; ' + escapeHtml(item.yearLevel) +
                        (item.applicantEmail ? ' &middot; ' + escapeHtml(item.applicantEmail) : '') +
                    '</p>' +
                    '<p class="coesc-approval-body">' + escapeHtml(item.message) + '</p>' +
                    '<div class="coesc-approval-actions">' +
                        '<button type="button" class="coesc-approve" data-approve="application" data-id="' + escapeHtml(item.id) + '">' +
                            '<span class="material-icons">check</span>Approve</button>' +
                        '<button type="button" class="coesc-reject" data-reject="application" data-id="' + escapeHtml(item.id) + '">' +
                            '<span class="material-icons">close</span>Reject</button>' +
                    '</div>' +
                '</article>';
        }

        if (kind === 'question') {
            return '' +
                '<article class="coesc-approval" data-approval-kind="question" data-approval-id="' + escapeHtml(item.id) + '">' +
                    '<header>' +
                        '<span class="coesc-approval-tag is-question">Q&amp;A</span>' +
                        '<time>' + escapeHtml(formatWhen(item.createdAt)) + '</time>' +
                    '</header>' +
                    '<h4>' + escapeHtml(item.title) + '</h4>' +
                    '<p class="coesc-approval-meta">' +
                        escapeHtml(item.askerName) +
                        (item.subject ? ' &middot; ' + escapeHtml(item.subject) : '') +
                        (item.course ? ' &middot; ' + escapeHtml(item.course) : '') +
                    '</p>' +
                    '<p class="coesc-approval-body">' + escapeHtml(item.description || '') + '</p>' +
                    '<div class="coesc-approval-actions">' +
                        '<button type="button" class="coesc-approve" data-approve="question" data-id="' + escapeHtml(item.id) + '">' +
                            '<span class="material-icons">check</span>Publish</button>' +
                        '<button type="button" class="coesc-reject" data-reject="question" data-id="' + escapeHtml(item.id) + '">' +
                            '<span class="material-icons">close</span>Reject</button>' +
                    '</div>' +
                '</article>';
        }

        return '' +
            '<article class="coesc-approval" data-approval-kind="material" data-approval-id="' + escapeHtml(item.id) + '">' +
                '<header>' +
                    '<span class="coesc-approval-tag is-material">Material</span>' +
                    '<time>' + escapeHtml(formatWhen(item.createdAt)) + '</time>' +
                '</header>' +
                '<h4>' + escapeHtml(item.title || item.originalName) + '</h4>' +
                '<p class="coesc-approval-meta">' +
                    escapeHtml(item.uploadedByName) + ' &middot; ' + escapeHtml(formatBytes(item.sizeBytes)) +
                    (item.folderPath ? ' &middot; ' + escapeHtml(item.folderPath) : '') +
                '</p>' +
                '<div class="coesc-approval-actions">' +
                    '<button type="button" class="coesc-approve" data-approve="material" data-id="' + escapeHtml(item.id) + '">' +
                        '<span class="material-icons">check</span>Approve</button>' +
                    '<button type="button" class="coesc-reject" data-reject="material" data-id="' + escapeHtml(item.id) + '">' +
                        '<span class="material-icons">close</span>Reject</button>' +
                '</div>' +
            '</article>';
    }

    function renderApprovals() {
        const section = el('coesc-approvals-section');
        const host = el('coesc-approvals');
        const badge = el('coesc-approvals-count');
        if (!section || !host) return;

        section.hidden = !canReview;
        if (!canReview) return;

        const counts = (approvals && approvals.counts) || { total: 0 };
        if (badge) badge.textContent = String(counts.total || 0);

        const cards = []
            .concat(((approvals && approvals.applications) || []).map(i => approvalCard('application', i)))
            .concat(((approvals && approvals.questions) || []).map(i => approvalCard('question', i)))
            .concat(((approvals && approvals.materials) || []).map(i => approvalCard('material', i)));

        host.innerHTML = cards.length
            ? cards.join('')
            : '<p class="coesc-empty">Nothing is waiting for approval. Good.</p>';
    }

    function syncApprovals() {
        if (!canReview) return Promise.resolve();

        return global.CoeApi.get('/api/coesc/approvals')
            .then(function (result) {
                approvals = result;
                renderApprovals();
            })
            .catch(function (error) {
                // A student never sees this section, so a 403 here means the
                // role changed mid-session; hide it rather than showing an error.
                if (error && error.status === 403) {
                    canReview = false;
                    renderApprovals();
                    return;
                }
                console.error('[coesc] could not load approvals', error);
            });
    }

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------

    /**
     * Approve or reject one item.
     *
     * Three endpoints, because all three already existed and work: this screen
     * gathers them into one queue rather than replacing flows that are fine.
     * Questions and materials both take `action: "review"` with a `decision`;
     * only the committee application, which is new, has its own shape.
     */
    function decide(kind, id, approve) {
        const decision = approve ? 'APPROVED' : 'REJECTED';

        if (kind === 'application') {
            return global.CoeApi.patch('/api/coesc/applications/' + encodeURIComponent(id), {
                status: decision
            });
        }

        if (kind === 'question') {
            return global.CoeApi.post('/api/qa/questions/' + encodeURIComponent(id), {
                action: 'review',
                decision: decision
            });
        }

        return global.CoeApi.post('/api/library/materials/' + encodeURIComponent(id), {
            action: 'review',
            decision: decision
        });
    }

    function bindApprovalActions() {
        const host = el('coesc-approvals');
        if (!host || host.dataset.bound === '1') return;
        host.dataset.bound = '1';

        host.addEventListener('click', function (event) {
            const button = event.target.closest('[data-approve], [data-reject]');
            if (!button) return;

            const approve = button.hasAttribute('data-approve');
            const kind = button.getAttribute(approve ? 'data-approve' : 'data-reject');
            const id = button.getAttribute('data-id');
            const card = button.closest('.coesc-approval');

            button.disabled = true;
            if (card) card.classList.add('is-busy');

            decide(kind, id, approve)
                .then(function () {
                    // Remove immediately rather than waiting for the refetch:
                    // the reviewer is working through a list and the card
                    // vanishing is the feedback that the click landed.
                    if (card) card.remove();
                    return syncApprovals();
                })
                .catch(function (error) {
                    button.disabled = false;
                    if (card) card.classList.remove('is-busy');
                    global.alert((error && error.message) || 'Could not save that decision.');
                });
        });
    }

    /** Admin-only: upload a portrait through a hidden file input. */
    function bindOfficerTools() {
        const panel = el('coesc-panel');
        const input = el('coesc-photo-input');
        if (!panel || panel.dataset.officerBound === '1') return;
        panel.dataset.officerBound = '1';

        let targetId = null;

        panel.addEventListener('click', function (event) {
            const photoBtn = event.target.closest('[data-officer-photo]');
            if (photoBtn && input) {
                targetId = photoBtn.getAttribute('data-officer-photo');
                input.value = '';
                input.click();
                return;
            }

            const renameBtn = event.target.closest('[data-officer-rename]');
            if (renameBtn) {
                const id = renameBtn.getAttribute('data-officer-rename');
                const officer = officers.find(o => o.id === id);
                if (!officer) return;

                const next = global.prompt('Name of the ' + officer.positionLabel + ':', officer.name);
                if (next === null) return;

                global.CoeApi.patch('/api/coesc/officers/' + encodeURIComponent(id), { name: next })
                    .then(function (result) {
                        applyOfficerUpdate(result.officer);
                    })
                    .catch(function (error) {
                        global.alert((error && error.message) || 'Could not rename that seat.');
                    });
            }
        });

        if (input) {
            input.addEventListener('change', function () {
                const file = input.files && input.files[0];
                if (!file || !targetId) return;

                const form = new FormData();
                form.append('photo', file);

                const status = el('coesc-manage-status');
                say(status, 'Uploading photo…', 'busy');

                global.CoeApi.postForm(
                    '/api/coesc/officers/' + encodeURIComponent(targetId) + '/photo',
                    form
                )
                    .then(function (result) {
                        applyOfficerUpdate(result.officer);
                        say(status, 'Photo updated.', 'ok');
                        global.setTimeout(function () { say(status, ''); }, 2500);
                    })
                    .catch(function (error) {
                        say(status, (error && error.message) || 'Could not upload that photo.', 'error');
                    });
            });
        }
    }

    /** Replace one seat in place, from a response or a live event. */
    function applyOfficerUpdate(officer) {
        if (!officer) return;
        const index = officers.findIndex(o => o.id === officer.id);
        if (index === -1) officers.push(officer);
        else officers[index] = officer;
        renderOfficers();
    }

    function bindApplicationForm() {
        const form = el('coesc-apply-form');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            const status = el('coesc-apply-status');
            const data = new FormData(form);
            const submit = form.querySelector('button[type="submit"]');

            if (submit) submit.disabled = true;
            say(status, 'Sending your application…', 'busy');

            global.CoeApi.post('/api/coesc/applications', {
                committee: String(data.get('committee') || ''),
                fullName: String(data.get('fullName') || ''),
                course: String(data.get('course') || ''),
                yearLevel: String(data.get('yearLevel') || ''),
                contact: String(data.get('contact') || ''),
                message: String(data.get('message') || '')
            })
                .then(function (result) {
                    say(status, result.message || 'Application sent.', 'ok');
                    form.reset();
                    return syncApplications();
                })
                .catch(function (error) {
                    say(status, (error && error.message) || 'Could not send that application.', 'error');
                })
                .then(function () {
                    if (submit) submit.disabled = false;
                });
        });
    }

    // -----------------------------------------------------------------------
    // Loading
    // -----------------------------------------------------------------------

    /**
     * Show why a section is empty, instead of leaving it blank.
     *
     * A blank panel is indistinguishable from "there is nothing here", which is
     * exactly how a 500 from the API looked: an empty council with no hint that
     * anything had gone wrong. The most common cause is a server still running
     * from before a migration, so the message says so.
     */
    function renderLoadError(hostId, what, error) {
        const host = el(hostId);
        if (!host) return;

        const status = (error && error.status) || 0;
        const detail = status === 401
            ? 'Your session ended. Sign in again.'
            : status >= 500
                ? 'The server could not answer. If the app was just updated, it needs a restart.'
                : ((error && error.message) || 'Something went wrong.');

        host.innerHTML =
            '<div class="coesc-error" role="alert">' +
                '<span class="material-icons">error_outline</span>' +
                '<div>' +
                    '<strong>Could not load ' + escapeHtml(what) + '.</strong>' +
                    '<p>' + escapeHtml(detail) + '</p>' +
                '</div>' +
                '<button type="button" class="coesc-retry" data-retry="1">Retry</button>' +
            '</div>';
    }

    function syncOfficers() {
        return global.CoeApi.get('/api/coesc/officers')
            .then(function (result) {
                officers = (result && result.officers) || [];
                tiers = (result && result.tiers) || [];
                committees = (result && result.committees) || [];
                canManage = Boolean(result && result.canManage);
                renderOfficers();
                renderCommittees();
            })
            .catch(function (error) {
                console.error('[coesc] could not load the council', error);
                renderLoadError('coesc-tree', 'the council roster', error);
                throw error;
            });
    }

    function syncApplications() {
        return global.CoeApi.get('/api/coesc/applications')
            .then(function (result) {
                applications = (result && result.applications) || [];
                canReview = Boolean(result && result.canReview);
                renderCommittees();
                renderMyApplications();
                renderApprovals();
            })
            .catch(function (error) {
                console.error('[coesc] could not load applications', error);
            });
    }

    /**
     * Load every section independently.
     *
     * Deliberately not a `.then()` chain. Chained, a single failing request
     * aborted everything after it — one 500 from the roster endpoint left the
     * structure *and* the announcements blank with no error anywhere, which is
     * exactly the bug this replaces. `allSettled` means each section either
     * renders or explains itself, and the others are unaffected.
     */
    function syncAll() {
        return Promise.allSettled([
            syncOfficers(),
            syncApplications(),
            syncApprovals(),
            syncAnnouncements()
        ]).then(function (outcomes) {
            return outcomes.every(o => o.status === 'fulfilled');
        });
    }

    /** Retry buttons inside any error box. */
    function bindRetry() {
        const panel = el('coesc-panel');
        if (!panel || panel.dataset.retryBound === '1') return;
        panel.dataset.retryBound = '1';

        panel.addEventListener('click', function (event) {
            const button = event.target.closest('[data-retry]');
            if (!button) return;

            button.disabled = true;
            button.textContent = 'Retrying…';
            syncAll().then(function () {
                // Nothing to restore: whichever section succeeded has already
                // replaced its own error box.
            });
        });
    }

    let timer = null;

    /** Coalesce a burst of live events into one reload. */
    function scheduleSync(fn) {
        if (timer) return;
        timer = global.setTimeout(function () {
            timer = null;
            fn().catch(function () { /* already logged */ });
        }, 250);
    }

    function start() {
        if (started) return Promise.resolve(true);
        if (!global.CoeApi || !global.CoeApi.isServed()) return Promise.resolve(false);
        if (!el('coesc-panel')) return Promise.resolve(false);

        return global.CoeApi.session(false)
            .then(function (current) {
                if (!current) return false;

                myUserId = (current.user && current.user.id) || '';

                bindOfficerTools();
                bindApplicationForm();
                bindApprovalActions();
                bindRetry();

                return syncAll()
                    .then(function () { return global.CoeApi.connect(); })
                    .then(function () {
                        global.CoeApi.on('coesc:officer-updated', applyOfficerUpdate);

                        // Reviewers only ever receive these — the server routes
                        // them to the staff room.
                        ['coesc:application-created', 'coesc:application-updated'].forEach(function (event) {
                            global.CoeApi.on(event, function () {
                                scheduleSync(function () {
                                    return Promise.all([syncApplications(), syncApprovals()]);
                                });
                            });
                        });

                        // A new question or upload lands in the same queue.
                        ['question:created', 'question:updated', 'material:created', 'material:updated']
                            .forEach(function (event) {
                                global.CoeApi.on(event, function () {
                                    if (!canReview) return;
                                    scheduleSync(syncApprovals);
                                });
                            });

                        ['announcement:created', 'announcement:updated', 'announcement:deleted']
                            .forEach(function (event) {
                                global.CoeApi.on(event, function () {
                                    scheduleSync(syncAnnouncements);
                                });
                            });

                        started = true;
                        return true;
                    });
            })
            .catch(function (error) {
                console.error('[coesc] startup failed', error);
                return false;
            });
    }

    global.CoeCouncil = {
        start,
        sync: syncAll,
        get officers() { return officers; },
        get applications() { return applications; },
        get ready() { return started; }
    };

    function boot() {
        const waitFor = (global.CoeLive && global.CoeLive.booted) || Promise.resolve();
        global.CoeCouncil.booted = waitFor.then(start);
    }

    if (doc.readyState === 'complete' || global.CoeLive) {
        boot();
    } else {
        doc.addEventListener('DOMContentLoaded', boot);
    }
})(window);
