/**
 * COE Studio — organisation announcement panels.
 *
 * One component, mounted three times: the COESC tab, the PICE tab and the IIEE
 * tab. Each mount is a `[data-announce-org="SLUG"]` element that becomes a list
 * of that org's notices plus — for the accounts allowed to publish under it — a
 * composer.
 *
 * Replaces `coe-org.js`, which filtered the org panels by `course`. That was
 * the wrong axis: `course` says who a notice is *for* ("CE students"), not who
 * it is *from*. Filtering PICE's panel on course="CE" meant a faculty notice
 * addressed to CE students appeared as though PICE had published it, and there
 * was no way for an org to publish anything of its own at all.
 *
 * WHAT EVERYONE SEES
 * ------------------
 * Reading is never restricted. A student in EE can open the PICE tab and read
 * PICE's notices, exactly as they can read the whole board — the org filter
 * narrows a panel, it does not hide anything from anyone. Each panel also
 * includes the college-wide notices, so an org box is never empty just because
 * the last announcement went out to everybody.
 *
 * WHAT IS RESTRICTED
 * ------------------
 * Publishing. The composer only appears for an account the server says may
 * publish under that org, and the server re-checks on every POST — a PICE
 * officer cannot publish as IIEE even by editing the page.
 *
 * LIVE
 * ----
 * A notice posted in one browser appears in every other open panel without a
 * refresh, through the same `announcement:*` events the rest of the portal
 * uses. That is the whole point of the shared board.
 */

(function (global) {
    'use strict';

    const doc = global.document;

    let announcements = [];
    let myOrgs = [];
    let orgs = [];
    let started = false;

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatWhen(iso) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';

        const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return minutes + ' min ago';

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');

        const days = Math.floor(hours / 24);
        if (days === 1) return 'Yesterday';
        if (days < 7) return days + ' days ago';

        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function orgLabel(slug) {
        const found = orgs.find(o => o.slug === slug);
        return found ? found.short : (slug || 'All COE');
    }

    /** Does this notice belong on the panel for `slug`? */
    function belongsTo(item, slug) {
        // A college-wide notice belongs on every panel — see the file header.
        if (!item.org) return true;
        return item.org === slug;
    }

    function mayPostAs(slug) {
        return myOrgs.some(o => o.slug === slug);
    }

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    function noticeHtml(item) {
        const priority = String(item.priority || '').toUpperCase();
        const tone = (priority === 'URGENT' || priority === 'HIGH') ? ' is-urgent' : '';
        const from = item.org ? orgLabel(item.org) : 'All COE';

        return '' +
            '<article class="ann-item' + tone + '">' +
                '<div class="ann-item-top">' +
                    '<span class="ann-from' + (item.org ? ' is-org' : '') + '">' + escapeHtml(from) + '</span>' +
                    (item.pinned
                        ? '<span class="material-icons ann-pin" title="Pinned">push_pin</span>'
                        : '') +
                    '<time>' + escapeHtml(formatWhen(item.publishedAt || item.createdAt)) + '</time>' +
                '</div>' +
                '<h4>' + escapeHtml(item.title) + '</h4>' +
                '<p>' + escapeHtml(item.body || '') + '</p>' +
                '<div class="ann-item-meta">' +
                    '<span>' + escapeHtml(item.authorName || 'COE') + '</span>' +
                    (item.course
                        ? '<span class="ann-course">' + escapeHtml(String(item.course).toUpperCase()) + '</span>'
                        : '') +
                '</div>' +
            '</article>';
    }

    function composerHtml(slug) {
        const org = orgs.find(o => o.slug === slug);
        const name = org ? org.name : slug;

        return '' +
            '<form class="ann-composer" data-announce-form="' + escapeHtml(slug) + '">' +
                '<div class="ann-composer-head">' +
                    '<span class="material-icons" aria-hidden="true">campaign</span>' +
                    '<div>' +
                        '<strong>Post as ' + escapeHtml(slug) + '</strong>' +
                        '<small>' + escapeHtml(name) + ' &middot; every student sees this immediately</small>' +
                    '</div>' +
                '</div>' +
                '<input type="text" name="title" placeholder="Announcement title" maxlength="160" required>' +
                '<textarea name="body" placeholder="What do you want everyone to know?" maxlength="5000" required></textarea>' +
                '<div class="ann-composer-row">' +
                    '<select name="priority" aria-label="Priority">' +
                        '<option value="NORMAL">Normal</option>' +
                        '<option value="HIGH">Important</option>' +
                        '<option value="URGENT">Urgent</option>' +
                    '</select>' +
                    '<select name="category" aria-label="Category">' +
                        '<option value="GENERAL">General</option>' +
                        '<option value="EVENT">Event</option>' +
                        '<option value="ACADEMIC">Academic</option>' +
                    '</select>' +
                    '<button type="submit">' +
                        '<span class="material-icons" aria-hidden="true">send</span>' +
                        '<span>Post</span>' +
                    '</button>' +
                '</div>' +
                '<p class="ann-note" data-announce-note hidden></p>' +
            '</form>';
    }

    function renderPanel(host) {
        const slug = String(host.dataset.announceOrg || '').toUpperCase();
        const mine = announcements.filter(item => belongsTo(item, slug)).slice(0, 8);

        const list = mine.length
            ? mine.map(noticeHtml).join('')
            : '<p class="ann-empty">No announcements yet. Anything ' + escapeHtml(slug) +
              ' posts appears here for every student.</p>';

        host.innerHTML =
            (mayPostAs(slug) ? composerHtml(slug) : '') +
            '<div class="ann-list">' + list + '</div>';
    }

    function render() {
        doc.querySelectorAll('[data-announce-org]').forEach(renderPanel);
    }

    // -----------------------------------------------------------------------
    // Posting
    // -----------------------------------------------------------------------

    function bind() {
        if (doc.body.dataset.announceBound === '1') return;
        doc.body.dataset.announceBound = '1';

        doc.addEventListener('submit', function (event) {
            const form = event.target.closest('[data-announce-form]');
            if (!form) return;

            event.preventDefault();

            const slug = form.getAttribute('data-announce-form');
            const note = form.querySelector('[data-announce-note]');
            const button = form.querySelector('button[type="submit"]');
            const data = new FormData(form);

            const title = String(data.get('title') || '').trim();
            const body = String(data.get('body') || '').trim();

            if (title.length < 3 || !body) {
                say(note, 'Give it a title and a message.', 'error');
                return;
            }

            if (button) button.disabled = true;
            say(note, 'Posting…', 'busy');

            global.CoeApi.post('/api/announcements', {
                title,
                body,
                org: slug,
                priority: String(data.get('priority') || 'NORMAL'),
                category: String(data.get('category') || 'GENERAL')
            })
                .then(function () {
                    form.reset();
                    say(note, 'Posted. Everyone can see it now.', 'ok');
                    global.setTimeout(function () { say(note, ''); }, 3000);
                    return sync();
                })
                .catch(function (error) {
                    // A 403 here means the server refused this org for this
                    // account — worth showing verbatim rather than softening.
                    say(note, (error && error.message) || 'Could not post that.', 'error');
                })
                .then(function () {
                    if (button) button.disabled = false;
                });
        });
    }

    function say(node, text, tone) {
        if (!node) return;
        node.textContent = text || '';
        node.className = 'ann-note' + (tone ? ' is-' + tone : '');
        node.hidden = !text;
    }

    // -----------------------------------------------------------------------
    // Loading
    // -----------------------------------------------------------------------

    function sync() {
        return global.CoeApi.get('/api/announcements?pageSize=60')
            .then(function (result) {
                announcements = (result && result.announcements) || [];
                orgs = (result && result.orgs) || [];
                myOrgs = (result && result.myOrgs) || [];
                render();
            })
            .catch(function (error) {
                console.error('[coe-announce] could not load announcements', error);
                doc.querySelectorAll('[data-announce-org]').forEach(function (host) {
                    host.innerHTML = '<p class="ann-empty">Could not load announcements.</p>';
                });
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

    function start() {
        if (started) return Promise.resolve(true);
        if (!global.CoeApi || !global.CoeApi.isServed()) return Promise.resolve(false);
        if (!doc.querySelector('[data-announce-org]')) return Promise.resolve(false);

        return global.CoeApi.session(false)
            .then(function (current) {
                if (!current) return false;

                bind();

                return sync()
                    .then(function () { return global.CoeApi.connect(); })
                    .then(function () {
                        ['announcement:created', 'announcement:updated', 'announcement:deleted']
                            .forEach(function (event) {
                                global.CoeApi.on(event, scheduleSync);
                            });

                        started = true;
                        return true;
                    });
            })
            .catch(function (error) {
                console.error('[coe-announce] startup failed', error);
                return false;
            });
    }

    global.CoeAnnounce = {
        start,
        sync,
        render,
        get announcements() { return announcements; },
        get ready() { return started; }
    };

    function boot() {
        const waitFor = (global.CoeLive && global.CoeLive.booted) || Promise.resolve();
        global.CoeAnnounce.booted = waitFor.then(start);
    }

    if (doc.readyState === 'complete' || global.CoeLive) {
        boot();
    } else {
        doc.addEventListener('DOMContentLoaded', boot);
    }
})(window);
