/**
 * COE Studio — live shared announcements and tasks.
 *
 * Same story as the library and the Q&A board: `coeAnnouncements` and
 * `coeLearningTasks` were per-browser, so an announcement only ever reached
 * the person who posted it and a task only existed on the admin's own laptop.
 *
 * These two are wired through `window.CoeBoardBridge`, which scripts.js
 * exposes, because its `announcements` and `tasks` arrays live inside a
 * DOMContentLoaded closure — writing their localStorage keys from out here
 * would update the cache and leave the in-memory arrays stale.
 *
 * ONE ASYMMETRY WORTH KNOWING
 * ---------------------------
 * Announcements and tasks are broadcast to every signed-in account.
 * Submissions are NOT: `server.ts` routes `submission:created` to the staff
 * room only, so a student never learns who else handed in, or what they wrote.
 * That is deliberate, and this file does not work around it.
 */

(function (global) {
    'use strict';

    let ready = false;

    // -----------------------------------------------------------------------
    // Announcements
    // -----------------------------------------------------------------------

    /** The portal's tag vocabulary <-> the backend's category enum. */
    const TAG_TO_CATEGORY = {
        General: 'GENERAL',
        Academic: 'ACADEMIC',
        Event: 'EVENT',
        Exam: 'ACADEMIC',
        Org: 'ORG',
        Urgent: 'URGENT'
    };

    const CATEGORY_TO_TAG = {
        GENERAL: 'General',
        ACADEMIC: 'Academic',
        EVENT: 'Event',
        ORG: 'Org',
        URGENT: 'Urgent'
    };

    /** Server announcement -> the record renderAnnouncements() already draws. */
    function toPortalAnnouncement(row) {
        const posted = row.publishedAt || row.createdAt || new Date().toISOString();

        return {
            id: row.id,
            title: row.title || 'Untitled Announcement',
            tag: CATEGORY_TO_TAG[row.category] || 'General',
            course: row.course || 'CE/EE',
            postedAt: String(posted).slice(0, 10),
            /*
             * The real event date, now that the column exists.
             *
             * `row.expiresAt` is deliberately not consulted any more: it used
             * to stand in here, so a notice with an expiry showed the expiry
             * as its event date, and one without showed the day it was posted.
             * The fallback to `posted` is kept only for rows written before
             * the column existed — those genuinely have no event date, and the
             * posted day is the closest honest answer.
             */
            eventDate: String(row.eventDate || posted).slice(0, 10),
            summary: row.body ? String(row.body).split('\n')[0].slice(0, 240) : '',
            details: row.body || '',
            relatedPage: 'announcements',
            pinned: Boolean(row.pinned),
            createdBy: row.authorName || 'COE'
        };
    }

    function syncAnnouncements() {
        return global.CoeApi.get('/api/announcements?pageSize=100')
            .then(function (result) {
                const rows = (result && result.announcements) || [];
                global.CoeBoardBridge?.setAnnouncements(rows.map(toPortalAnnouncement));
                return rows.length;
            })
            .catch(function (error) {
                console.error('[coe-board] could not load announcements', error.message || error);
                throw error;
            });
    }

    /**
     * Post one. Takes the portal's own record shape so the caller in
     * scripts.js does not have to know the backend's field names.
     */
    function postAnnouncement(announcement) {
        // The portal writes a one-line summary and a longer body; the backend
        // has a single `body`, so they are joined rather than losing one.
        const body = [announcement.summary, announcement.details]
            .map(part => String(part || '').trim())
            .filter(Boolean)
            .join('\n\n');

        return global.CoeApi.post('/api/announcements', {
            title: announcement.title,
            body: body || announcement.title,
            category: TAG_TO_CATEGORY[announcement.tag] || 'GENERAL',
            priority: announcement.tag === 'Urgent' ? 'HIGH' : 'NORMAL',
            // "CE/EE" means everyone; the backend treats blank as unscoped.
            course: announcement.course === 'CE/EE' ? '' : (announcement.course || ''),
            year: '',
            pinned: Boolean(announcement.pinned),
            expiresAt: null,
            /*
             * The date the notice is about.
             *
             * This used to be dropped here. The composer's date picker was
             * read into `announcement.eventDate` and then never sent — the
             * request carried `expiresAt: null` and nothing else — so the
             * server had no idea a date had been chosen, and reading the
             * notice back fell through to the published date. Pick the 17th,
             * publish, and the card said today.
             *
             * It is NOT sent as `expiresAt`, which is the shape it would have
             * fitted. `expiresAt` is when a notice stops being shown, so
             * filing "Midterms on the 17th" there would hide the announcement
             * the moment the midterms arrived, and a date already past would
             * hide it instantly.
             */
            eventDate: announcement.eventDate || null
        });
    }

    /**
     * Take one off the board, for everyone.
     *
     * The portal's own delete only ever spliced the row out of the in-memory
     * array and rewrote `coeAnnouncements`. That looked right for about a
     * second: the card vanished, and the next `syncAnnouncements()` — a socket
     * event, a page change, anything — refetched the server's list and put it
     * straight back. An administrator could press Delete all afternoon and the
     * board would not change for anybody, themselves included.
     *
     * The server soft-deletes and broadcasts `announcement:deleted`, so every
     * open browser refreshes from the same list rather than each patching its
     * own copy.
     */
    function deleteAnnouncement(id) {
        return global.CoeApi.del('/api/announcements/' + encodeURIComponent(id));
    }

    /**
     * Clear notices published before `beforeIso`.
     *
     * There is no bulk endpoint, so this is a loop of single deletes. That is a
     * deliberate choice rather than a shortcut: each one goes through the same
     * permission check and writes its own audit-log row, so "who cleared the
     * board and when" is answerable afterwards. A college board is tens of
     * notices, not thousands, and the sweep is bounded by what one page holds.
     *
     * Sequential, not parallel — twenty concurrent writes against one SQLite
     * file is how you get `SQLITE_BUSY`, and this is not a hot path.
     *
     * @returns {Promise<{cleared: number, failed: number}>}
     */
    function clearAnnouncementsBefore(beforeIso) {
        const cutoff = new Date(beforeIso).getTime();

        if (Number.isNaN(cutoff)) {
            return Promise.reject(new Error('Invalid cut-off date.'));
        }

        return global.CoeApi.get('/api/announcements?pageSize=100')
            .then(function (result) {
                const rows = (result && result.announcements) || [];

                // Pinned notices survive. Pinning is the explicit signal that
                // something should stay up, and a date sweep that ignored it
                // would take the one notice the admin most meant to keep.
                const stale = rows.filter(function (row) {
                    if (row.pinned) return false;
                    const posted = new Date(row.publishedAt || row.createdAt || 0).getTime();
                    return !Number.isNaN(posted) && posted < cutoff;
                });

                let cleared = 0;
                let failed = 0;

                return stale.reduce(function (chain, row) {
                    return chain.then(function () {
                        return deleteAnnouncement(row.id)
                            .then(function () { cleared += 1; })
                            .catch(function (error) {
                                // One refusal must not strand the rest. A 403
                                // here means this account may not delete that
                                // particular notice, which is a real answer.
                                console.warn('[coe-board] could not clear', row.id, error.message || error);
                                failed += 1;
                            });
                    });
                }, Promise.resolve()).then(function () {
                    return syncAnnouncements().then(function () {
                        return { cleared: cleared, failed: failed };
                    });
                });
            });
    }

    // -----------------------------------------------------------------------
    // Tasks / assignments
    // -----------------------------------------------------------------------

    /**
     * Server assignment -> the portal's task record.
     *
     * `submissions` carries only the viewer's own entry, because that is all
     * the API returns to a student. An admin gets the real count, which is what
     * the "N submitted" badge reads.
     */
    function toPortalTask(row) {
        const mine = row.mySubmission;

        return {
            id: row.id,
            discipline: row.course || 'CE',
            topic: row.subject || '',
            lesson: row.year || 'General',
            title: row.title || 'Untitled Problem',
            notes: row.description || row.instructions || '',
            // Answer keys are not exposed by the assignments API, and should
            // not be: a student calling it must not receive one.
            answer: row.answerKey || '',
            fileName: '',
            attachmentName: 'No attachment',
            attachmentContent: '',
            attachmentPreviewType: 'text',
            attachmentFileType: '',
            problemPhotoContent: '',
            problemPhotoPreviewType: 'text',
            ownerUsername: row.authorName || '',
            dueAt: row.dueAt || '',
            points: Number(row.points || 100),
            submissionCount: Number(row.submissionCount || 0),
            submissions: mine
                ? [{
                    username: (global.CoeLive?.user && global.CoeLive.user.username) || '',
                    name: (global.CoeLive?.user && global.CoeLive.user.name) || 'You',
                    answer: mine.content || '',
                    correct: mine.status === 'RETURNED' && Number(mine.score || 0) > 0,
                    submittedAt: mine.submittedAt || '',
                    solutionFileName: mine.originalName || '',
                    solutionContent: '',
                    solutionPreviewType: 'text',
                    solutionFileType: ''
                }]
                : []
        };
    }

    function syncTasks() {
        return global.CoeApi.get('/api/assignments?pageSize=100')
            .then(function (result) {
                const rows = (result && result.assignments) || [];
                global.CoeBoardBridge?.setTasks(rows.map(toPortalTask));
                return rows.length;
            })
            .catch(function (error) {
                console.error('[coe-board] could not load tasks', error.message || error);
                throw error;
            });
    }

    /**
     * Publish a task to the whole class.
     *
     * `answerKey` is sent but never comes back: the API omits it from every
     * list, so the auto-check runs server-side inside `submitWork` instead of
     * requiring the key to be sitting in each student's browser the way the
     * old local version did.
     *
     * KNOWN GAP: the Assignment model has no attachment columns, so the problem
     * photo and the answer-key file are not carried. The text of the problem
     * and the answer key are.
     */
    function postTask(task) {
        return global.CoeApi.post('/api/assignments', {
            title: task.title,
            description: task.notes || '',
            instructions: task.notes || '',
            course: task.discipline || '',
            year: '',
            subject: task.topic || '',
            status: 'OPEN',
            dueAt: null,
            points: 100,
            allowLate: true,
            answerKey: task.answer || ''
        });
    }

    /**
     * Hand in work.
     *
     * Multipart when a file is attached so it goes through the same validation
     * as a library upload; plain JSON otherwise.
     */
    function submitWork(task, answer, file) {
        const path = '/api/assignments/' + encodeURIComponent(task.id) + '/submit';

        if (file) {
            const form = new FormData();
            form.set('content', answer || '');
            form.set('file', file, file.name);
            return global.CoeApi.postForm(path, form);
        }

        return global.CoeApi.post(path, { content: answer || '' });
    }

    // -----------------------------------------------------------------------
    // Live
    // -----------------------------------------------------------------------

    let announcementTimer = null;
    let taskTimer = null;

    /**
     * Both refreshes re-fetch rather than patching from the payload.
     *
     * The list each account is allowed to see differs — a student's assignment
     * row carries only their own submission — so rebuilding from a broadcast
     * meant for everyone would show one viewer another's data. Re-fetching
     * costs a request and keeps each account's view its own.
     */
    function scheduleAnnouncementRefresh() {
        if (announcementTimer) return;
        announcementTimer = global.setTimeout(function () {
            announcementTimer = null;
            syncAnnouncements().catch(function () { /* already logged */ });
        }, 150);
    }

    function scheduleTaskRefresh() {
        if (taskTimer) return;
        taskTimer = global.setTimeout(function () {
            taskTimer = null;
            syncTasks().catch(function () { /* already logged */ });
        }, 150);
    }

    function listen() {
        ['announcement:created', 'announcement:updated', 'announcement:deleted'].forEach(function (event) {
            global.CoeApi.on(event, function (payload) {
                scheduleAnnouncementRefresh();

                if (event === 'announcement:created') {
                    global.showLibraryToast?.(
                        'New announcement',
                        payload.title || '',
                        payload.priority === 'HIGH' ? 'error' : 'info'
                    );
                }
            });
        });

        ['assignment:created', 'assignment:updated', 'assignment:deleted'].forEach(function (event) {
            global.CoeApi.on(event, function (payload) {
                scheduleTaskRefresh();

                if (event === 'assignment:created') {
                    global.showLibraryToast?.('New task posted', payload.title || '', 'info');
                }
            });
        });

        // Staff-only. A student's socket is never in the room these come from,
        // so this handler simply never fires for them.
        ['submission:created', 'submission:updated'].forEach(function (event) {
            global.CoeApi.on(event, function (payload) {
                scheduleTaskRefresh();

                if (event === 'submission:created') {
                    global.showLibraryToast?.(
                        'New submission',
                        (payload.studentName || 'A student') + ' — ' + (payload.assignmentTitle || ''),
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
            console.warn('[coe-board] not served by the app server; announcements and tasks stay local');
            return Promise.resolve(false);
        }

        return global.CoeApi.session(false)
            .then(function (current) {
                if (!current) return false;

                // The bridge only exists once scripts.js has run its
                // DOMContentLoaded handler.
                if (!global.CoeBoardBridge) {
                    console.warn('[coe-board] bridge missing; scripts.js did not finish loading');
                    return false;
                }

                // Settled, not all: one failing board must not take the other
                // down with it.
                return Promise.allSettled([syncAnnouncements(), syncTasks()])
                    .then(function () { return global.CoeApi.connect(); })
                    .then(function () {
                        listen();
                        ready = true;
                        return true;
                    });
            })
            .catch(function (error) {
                console.error('[coe-board] startup failed', error);
                return false;
            });
    }

    global.CoeBoard = {
        start,
        syncAnnouncements,
        syncTasks,
        postAnnouncement,
        deleteAnnouncement,
        clearAnnouncementsBefore,
        postTask,
        submitWork,
        toPortalAnnouncement,
        toPortalTask,
        get ready() { return ready; }
    };

    /**
     * scripts.js builds the bridge inside its DOMContentLoaded handler, so this
     * must not start before that has run.
     *
     * Testing `readyState === 'loading'` would be wrong: a deferred script
     * executes at readyState "interactive", *before* DOMContentLoaded fires,
     * so that check fails and this would start too early — with no bridge to
     * call. Test for the bridge itself instead.
     */
    function boot() {
        global.CoeBoard.booted = start();
    }

    if (global.CoeBoardBridge) {
        boot();
    } else if (global.document.readyState === 'complete') {
        // DOMContentLoaded already fired and there is still no bridge, so
        // waiting for it would wait forever. start() reports the problem.
        boot();
    } else {
        // scripts.js registered its listener first (it loads first), so its
        // handler — and therefore the bridge — is ready before this runs.
        global.document.addEventListener('DOMContentLoaded', boot);
    }
})(window);
