/**
 * COE Studio — live shared library.
 *
 * WHAT THIS REPLACES
 * ------------------
 * The portal stored every material in `localStorage.coeLearningFiles`. That key
 * is private to one browser profile on one computer, so an upload was visible
 * only to the person who made it — which is the whole problem this file exists
 * to fix.
 *
 * HOW IT WORKS WITHOUT REWRITING THE PORTAL
 * -----------------------------------------
 * scripts.js and enhanced-library.js read `coeLearningFiles` in dozens of
 * places, synchronously. Rather than rewrite ~530 KB of rendering code, that
 * key is kept — but demoted from *source of truth* to *render cache*:
 *
 *      server DB  --GET /api/library/materials-->  cache  -->  existing render
 *                 <--socket material:created-----
 *
 * Everyone's cache is filled from the same table, so everyone sees the same
 * library. A socket event patches the cache and re-renders, which is what makes
 * an upload appear on other people's screens with no refresh.
 *
 * Writes never touch the cache directly: an upload POSTs to the API, and the
 * material comes back through the socket like everybody else's. One direction
 * in, one direction out — so the screen can never disagree with the server.
 */

(function (global) {
    'use strict';

    const CACHE_KEY = 'coeLearningFiles';

    let ready = false;
    let currentUser = null;

    // -----------------------------------------------------------------------
    // Shape translation
    // -----------------------------------------------------------------------

    /**
     * Backend `kind` <-> the portal's material categories.
     *
     * The seeded folder tree already uses the portal's category names
     * ("Handouts", "Video Lectures", ...) so this is the only place the two
     * vocabularies have to meet.
     */
    const KIND_TO_CATEGORY = {
        REFERENCE: 'Reference Books',
        HANDOUT: 'Handouts',
        VIDEO: 'Video Lectures',
        LESSON: 'Lessons',
        /*
         * LINK comes back as a reference, not as 'GDrive Links'.
         *
         * 'GDrive Links' is a category with no folder: the tree only builds the
         * three in FOLDER_MATERIAL_CATEGORIES, so anything mapped here was
         * filed where nothing could draw it. Uploads no longer produce that
         * category (see upload-ui.js), but every link already saved is stored
         * as kind LINK, and this line is what brings those back into view
         * instead of leaving them stranded in the database.
         *
         * A link uploaded INTO a shelf is unaffected — standing in Handouts
         * stores it as HANDOUT, not LINK, so it returns to Handouts.
         */
        LINK: 'Reference Books',
        OTHER: 'Handouts'
    };

    const CATEGORY_TO_KIND = {
        'Reference Books': 'REFERENCE',
        'Handouts': 'HANDOUT',
        'Video Lectures': 'VIDEO',
        'Lessons': 'LESSON',
        'GDrive Links': 'LINK'
    };

    function categoryToKind(category) {
        return CATEGORY_TO_KIND[category] || 'OTHER';
    }

    /** Preview kind the portal's renderer understands. */
    function previewTypeFor(material) {
        if (material.externalUrl) return 'link';

        const mime = String(material.mimeType || '').toLowerCase();
        if (mime.startsWith('image/')) return 'image';
        if (mime === 'application/pdf') return 'pdf';
        if (mime.startsWith('video/')) return 'video';
        return 'text';
    }

    /** Display type used by the card badges. */
    function displayTypeFor(material) {
        if (material.externalUrl) return 'Google Drive Link';

        const mime = String(material.mimeType || '').toLowerCase();
        if (mime.startsWith('video/')) return 'Video';
        if (mime === 'application/pdf') return 'PDF';
        if (mime.startsWith('image/')) return 'Image';
        return 'Document';
    }

    /**
     * Backend Material -> the record shape the portal already renders.
     *
     * `content` points at the inline preview route rather than holding bytes.
     * The portal used to carry a whole base64 file in this field, which is what
     * put a single video over the browser's storage quota; a URL is a few dozen
     * characters and the file streams from disk on demand.
     */
    function toPortalRecord(material) {
        const isLink = Boolean(material.externalUrl);
        const source = isLink
            ? material.externalUrl
            : '/api/library/preview/' + material.id;

        return {
            id: material.id,
            serverId: material.id,
            folderId: '',
            folderIndex: -1,
            folderName: material.folderPath || '',

            title: material.title || 'Untitled',
            name: material.title || 'Untitled',
            // The real uploaded filename, not the title. The list falls back to
            // this when a title is only the folder name repeated, so passing
            // the title here defeated that entirely.
            originalName: material.originalName || '',
            description: material.description || '',

            discipline: material.course || '',
            year: material.year || '',
            subject: material.subject || '',
            // `semester` is where the upload path stores the lesson.
            lesson: material.semester || 'General',
            materialCategory: KIND_TO_CATEGORY[material.kind] || 'Handouts',
            professorName: material.professor || '',
            professorUsername: '',

            type: displayTypeFor(material),
            fileType: material.mimeType || '',
            size: Number(material.sizeBytes || 0),
            tags: Array.isArray(material.tags) ? material.tags : [],

            content: source,
            externalUrl: material.externalUrl || '',
            previewType: previewTypeFor(material),

            uploadedAt: material.createdAt || new Date().toISOString(),
            lastModified: material.updatedAt || material.createdAt || '',
            uploadedBy: material.uploadedByName || 'COE user',
            ownerUsername: material.uploadedById || '',

            views: Number(material.viewCount || 0),
            downloads: Number(material.downloadCount || 0),
            comments: [],
            favorite: Boolean(material.favoritedByMe),

            // Surfaced so the UI can say "waiting for approval" rather than
            // leaving an uploader wondering where their file went.
            status: material.status || 'APPROVED',
            accessLevel: 'Shared with all users'
        };
    }

    // -----------------------------------------------------------------------
    // The cache
    // -----------------------------------------------------------------------

    function readCache() {
        try {
            const parsed = JSON.parse(global.localStorage.getItem(CACHE_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function writeCache(records) {
        try {
            global.localStorage.setItem(CACHE_KEY, JSON.stringify(records));
            return true;
        } catch (error) {
            // Only metadata is held now, so this should not happen — but if the
            // quota is hit, a stale screen is better than a thrown boot.
            console.error('[coe-live] could not cache the material list', error);
            return false;
        }
    }

    /** Insert or replace one record, keyed by server id. */
    function upsert(record) {
        const records = readCache();
        const index = records.findIndex(item => item.id === record.id);

        if (index >= 0) {
            records[index] = record;
        } else {
            records.push(record);
        }

        writeCache(records);
    }

    function remove(id) {
        writeCache(readCache().filter(item => item.id !== id));
    }

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    /**
     * Re-render whichever library views are mounted.
     *
     * Coalesced: a burst of socket events during a batch upload would otherwise
     * re-render the grid once per file.
     */
    let renderTimer = null;

    function refreshViews() {
        if (renderTimer) return;

        renderTimer = global.setTimeout(function () {
            renderTimer = null;

            try {
                global.reloadSharedLibraryUploads?.();
                global.refreshSharedLibraryPanels?.();

                const library = global.enhancedLibrary;
                if (library) {
                    library.populateLibraryFolderTree?.();
                    library.populateSubjectFilter?.();
                    library.populateLessonFilter?.();
                    library.populateTagFilter?.();
                    library.displayMaterialCards?.(global.currentFolderId || 'all');
                    library.updateLibraryStats?.();
                }
                if (typeof global.displayLibrary === 'function') global.displayLibrary();

                // The folder context bar rebuilds its own upload button on
                // every render, so the permission has to be re-applied after.
                applyUploadPermissions();
            } catch (error) {
                console.warn('[coe-live] view refresh failed', error);
            }
        }, 80);
    }

    // -----------------------------------------------------------------------
    // Sync
    // -----------------------------------------------------------------------

    /** The API caps a page at 100; a class library is bigger than that. */
    const PAGE_SIZE = 100;
    const MAX_PAGES = 50;

    /**
     * Pull the shared library and replace the cache with it.
     *
     * Replace, not merge: the server is the only source of truth, so anything
     * left in this browser that the server does not have is stale by
     * definition and must not linger on screen.
     *
     * Paged, because asking for everything at once is rejected by the query
     * schema. The page cap is a runaway guard, not an expected limit — if it is
     * ever hit, that is logged rather than silently returning a partial library.
     */
    function syncLibrary() {
        const collected = [];

        function fetchPage(page) {
            return global.CoeApi
                .get('/api/library/materials?sort=recent&pageSize=' + PAGE_SIZE + '&page=' + page)
                .then(function (result) {
                    const materials = (result && result.materials) || [];
                    collected.push.apply(collected, materials);

                    const total = Number(result && result.total) || collected.length;

                    if (collected.length >= total || materials.length < PAGE_SIZE) {
                        return collected;
                    }

                    if (page >= MAX_PAGES) {
                        console.warn(
                            '[coe-live] stopped after ' + MAX_PAGES + ' pages; showing ' +
                            collected.length + ' of ' + total + ' materials'
                        );
                        return collected;
                    }

                    return fetchPage(page + 1);
                });
        }

        return fetchPage(1)
            .then(function (materials) {
                writeCache(materials.map(toPortalRecord));
                refreshViews();
                return materials.length;
            })
            .catch(function (error) {
                console.error('[coe-live] could not load the shared library', error.message || error);

                /*
                 * A rejected session must empty the list, not leave the last
                 * one on screen.
                 *
                 * The cache is only ever replaced by a successful sync, so a
                 * 401 used to leave whatever this browser last held sitting
                 * there looking current. After the database was emptied, one
                 * browser went on showing 518 materials that no longer
                 * existed — its session had died with them, so every sync
                 * since had failed without touching the cache.
                 *
                 * Only for 401/403. A dropped connection is not evidence that
                 * anything was deleted, and wiping the list every time a phone
                 * loses signal would be worse than showing it slightly stale.
                 */
                const status = error && error.status;
                if (status === 401 || status === 403) {
                    writeCache([]);
                    refreshViews();
                }

                throw error;
            });
    }

    /**
     * The opening sync, with the retries a page load deserves.
     *
     * `start()` fires this while the server may still be compiling the route,
     * while the network is still waking up, or a second after a restart. One
     * attempt turned any of those into a library that stayed empty until the
     * next reload — and, before `ready` was moved off it, into a session whose
     * uploads all went into the browser instead of the database.
     *
     * Three attempts, backing off, then it says so. A 401 or 403 is not retried:
     * that is a real answer about the session, not a hiccup, and syncLibrary has
     * already emptied the cache for it.
     */
    function syncWithRetry(attempt) {
        const tries = attempt || 1;
        const MAX_TRIES = 3;

        return syncLibrary().catch(function (error) {
            const status = (error && error.status) || 0;
            const fatal = status === 401 || status === 403;

            /*
             * A 401 here means the session is not usable, whatever the page
             * thinks.
             *
             * The portal decides it is signed in from `/api/auth/session`,
             * which is NextAuth's own endpoint: it reports what the JWT says
             * and asks the database nothing. Every `/api/*` route goes through
             * getCurrentAuth() instead, which re-reads the ActiveSession row
             * and the user on every request and refuses the moment either is
             * gone — a revoked session, an expired one, a reseeded database.
             *
             * The two therefore disagree, and the gap is a signed-in-looking
             * app where nothing works: the dashboard renders the name out of
             * the token, the library answers 401 and empties itself, and
             * uploads go to a server that refuses every one of them. That is
             * the state this was reported in.
             *
             * So the API's answer wins. Sign out properly — that clears the
             * stale cookie and the cached library, chat and Q&A with it — and
             * go to the login page, which is the one thing that can fix it.
             */
            if (status === 401) {
                // Nothing may take the server path on a session the server has
                // already refused — least of all an upload.
                ready = false;

                console.warn('[coe-live] the API rejected this session; signing out');
                global.showLibraryToast?.(
                    'Session expired',
                    'Taking you back to the sign-in page.',
                    'error'
                );

                return global.CoeApi.logout()
                    .catch(function () { /* going to login either way */ })
                    .then(function () {
                        global.location.href = 'login.html';
                    });
            }

            if (!fatal && tries < MAX_TRIES) {
                return new Promise(function (resolve) {
                    global.setTimeout(resolve, tries * 1200);
                }).then(function () {
                    return syncWithRetry(tries + 1);
                });
            }

            /*
             * Say what actually went wrong.
             *
             * "Could not load the library" on its own is a dead end for anyone
             * trying to fix it — a 401, a 500 and a dropped connection all look
             * identical, and they need three different answers. The status and
             * the server's own message are the difference between guessing and
             * knowing.
             */
            const detail = describeSyncFailure(status, error);

            console.error(
                '[coe-live] initial sync failed after ' + tries + ' attempt(s):',
                'status=' + status,
                error && (error.message || error)
            );

            global.showLibraryToast?.('Could not load the library', detail, 'error');
        });
    }

    /** Plain-language cause, with the status kept for whoever has to fix it. */
    function describeSyncFailure(status, error) {
        const message = (error && error.message) || '';

        // 401 never reaches here — it signs out and redirects. 403 is the
        // account being refused rather than unrecognised.
        if (status === 403) {
            return 'This account is not allowed to read the library. Ask an administrator.';
        }
        if (status === 0) {
            return 'Could not reach the server. Check that it is still running, then reload.';
        }
        if (status >= 500) {
            return 'The server answered ' + status + '. ' + (message || 'Try reloading in a moment.');
        }

        return 'The server answered ' + status + '. ' + (message || 'The list may be out of date.');
    }

    // -----------------------------------------------------------------------
    // Upload
    // -----------------------------------------------------------------------

    /**
     * Send one file (or a link) to the shared library.
     *
     * The folder is resolved first, because the server classifies a material
     * from its folder row rather than from anything posted alongside it — that
     * resolve step is what puts the upload in the folder the user was standing
     * in.
     *
     * @returns {Promise<{status: string, message: string}>}
     */
    function uploadMaterial(options) {
        const folder = options.folder || {};

        /*
         * The lesson.
         *
         * "Unfiled" is the tree's label for material with no lesson, so an
         * upload made while standing in it must not be stamped with the word
         * "Unfiled" — it has to go back to having no lesson, or it would land
         * in a folder called "Unfiled" beside the real one.
         */
        const lesson = String(options.lesson || '').trim();
        const storedLesson = (!lesson || lesson === 'Unfiled' || lesson === 'General') ? '' : lesson;

        return global.CoeApi.post('/api/library/resolve-folder', {
            course: folder.course || 'CE',
            year: folder.year || '',
            subject: folder.subject || '',
            category: folder.category || undefined
        }).then(function (resolved) {
            const form = new FormData();
            form.set('folderId', resolved.folderId);
            form.set('title', options.title || (options.file && options.file.name) || 'Untitled');
            form.set('description', options.description || '');
            form.set('kind', categoryToKind(folder.category || options.category));
            form.set('tags', (options.tags || []).join(','));
            // `semester` is the column the lesson is stored in.
            form.set('semester', storedLesson);
            form.set('professor', options.professorName || '');

            if (options.externalUrl) {
                form.set('externalUrl', options.externalUrl);
            } else if (options.file) {
                form.set('files', options.file, options.file.name);
            }

            return global.CoeApi.postForm('/api/library/upload', form);
        }).then(function (result) {
            // A student's upload is queued for approval and is deliberately not
            // broadcast, so say so rather than letting them think it vanished.
            const moderated = isModerated();

            return {
                status: moderated ? 'pending' : 'live',
                message: moderated
                    ? 'Sent for approval. An admin will publish it to the library.'
                    : (result && result.message) || 'Uploaded.'
            };
        });
    }

    /**
     * True when this account's uploads wait for approval.
     *
     * Must match AUTO_APPROVE_ROLES on the server. ACAD_COMMITTEE is in it:
     * publishing study material is the reason the role exists, so their
     * uploads go straight onto the shelf where every account can see them.
     */
    /*
     * Kept as one list because the two questions below are answered from it and
     * they must not drift apart: a role that may upload but is not auto-approved
     * has its material saved as PENDING, which the library list filters out, so
     * the upload disappears for everyone including the person who made it.
     *
     * Mirrors UPLOADER_ROLES and AUTO_APPROVE_ROLES in src/lib/enums.ts. The
     * server re-checks both on every request, so a mismatch here shows the
     * wrong button — it does not grant anything.
     */
    const UPLOADER_ROLES = [
        'ADMIN', 'ACAD_COMMITTEE', 'FACULTY',
        'ORG_OFFICER_COESC', 'ORG_OFFICER_PICE', 'ORG_OFFICER_IIEE'
    ];

    function isModerated() {
        const role = String((currentUser && currentUser.role) || '').toUpperCase();
        return ['LIBRARIAN', 'REGISTRAR'].concat(UPLOADER_ROLES).indexOf(role) === -1;
    }

    /** True when this account may approve or reject other people's uploads. */
    function canModerate() {
        const role = String((currentUser && currentUser.role) || '').toUpperCase();
        return role === 'ADMIN' || role === 'REGISTRAR';
    }

    /**
     * True when this account may add materials.
     *
     * Must match UPLOADER_ROLES on the server. This only decides what the UI
     * offers — the server refuses an upload from anyone else regardless, so a
     * mismatch here is a confusing button, not a hole.
     */
    function canUpload() {
        const role = String((currentUser && currentUser.role) || '').toUpperCase();
        return UPLOADER_ROLES.indexOf(role) > -1;
    }

    /**
     * Hide the upload controls from accounts that cannot use them.
     *
     * Reading stays open to everyone; this is only about not offering a button
     * that answers 403. Re-run after a render, because the folder context bar
     * rebuilds its own buttons.
     */
    function applyUploadPermissions() {
        const allowed = canUpload();

        const selectors = [
            '#library-upload-btn',
            '#library-dashboard-upload-btn',
            '.folder-upload-btn',
            '.upload-zone-btn',
            '#quick-upload-file',
            '#shortcut-upload'
        ];

        global.document.querySelectorAll(selectors.join(',')).forEach(function (node) {
            node.hidden = !allowed;
            // hidden alone loses to a stylesheet that sets display, so the
            // inline style is set too.
            node.style.display = allowed ? '' : 'none';
        });

        global.document.body.classList.toggle('coe-can-upload', allowed);
        global.document.body.classList.toggle('coe-read-only', !allowed);
    }

    // -----------------------------------------------------------------------
    // Approval queue
    // -----------------------------------------------------------------------

    /**
     * Uploads waiting for a decision.
     *
     * `status=PENDING` is honoured by the API only for moderators — a student
     * asking for it is quietly given the approved list instead, so this cannot
     * be used to peek at unreviewed uploads.
     */
    function listPending() {
        return global.CoeApi
            .get('/api/library/materials?status=PENDING&sort=recent&pageSize=100')
            .then(result => (result && result.materials) || []);
    }

    /**
     * Approve or reject. On approval the server emits `material:created`, so
     * the material lands in everyone's library through the normal live path —
     * there is no separate "publish" step to keep in sync.
     */
    function reviewMaterial(id, decision, note) {
        return global.CoeApi.post('/api/library/materials/' + encodeURIComponent(id), {
            action: 'review',
            decision: decision,
            note: note || undefined
        });
    }

    /**
     * Remove a material for everybody, not just this browser.
     *
     * The library's Delete button used to edit the local cache and stop there,
     * so the file came back on the next sync and every other account went on
     * seeing it the whole time. The server emits `material:deleted`, which the
     * listener below already handles, so one call clears it everywhere.
     *
     * Permitted for an administrator or the account that uploaded it — the
     * server decides, and answers 403 if it is neither.
     */
    function deleteMaterial(id) {
        return global.CoeApi
            .del('/api/library/materials/' + encodeURIComponent(id))
            .then(function (result) {
                // Do not wait for the socket to come back to us: the person who
                // pressed Delete should see it go immediately.
                remove(id);
                refreshViews();
                return result;
            });
    }

    /** Rename or re-file. Same permission rule as deleting. */
    function updateMaterial(id, changes) {
        return global.CoeApi.patch('/api/library/materials/' + encodeURIComponent(id), changes);
    }

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    let queueBound = false;

    /** Draw the queue. Hidden entirely for accounts that cannot moderate. */
    function renderApprovalQueue() {
        const host = global.document.getElementById('coe-approval-queue');
        if (!host) return Promise.resolve();

        if (!canModerate()) {
            host.hidden = true;
            return Promise.resolve();
        }

        return listPending().then(function (pending) {
            if (!pending.length) {
                host.hidden = true;
                host.innerHTML = '';
                return;
            }

            host.hidden = false;
            host.innerHTML =
                '<header class="coe-approval-head">' +
                    '<span class="material-icons">rule</span>' +
                    '<div>' +
                        '<strong>' + pending.length + ' upload' + (pending.length === 1 ? '' : 's') + ' waiting for approval</strong>' +
                        '<small>Only you and other moderators can see these. Approving publishes to everyone instantly.</small>' +
                    '</div>' +
                '</header>' +
                '<ul class="coe-approval-list">' +
                pending.map(function (material) {
                    const where = [material.course, material.year, material.subject]
                        .filter(Boolean).join(' / ');
                    return '' +
                        '<li class="coe-approval-item" data-material-id="' + escapeHtml(material.id) + '">' +
                            '<div class="coe-approval-info">' +
                                '<strong>' + escapeHtml(material.title) + '</strong>' +
                                '<small>' + escapeHtml(where || 'Unfiled') + ' &middot; ' +
                                    escapeHtml(material.uploadedByName || 'Unknown') + '</small>' +
                            '</div>' +
                            '<div class="coe-approval-actions">' +
                                '<a class="coe-approval-peek" href="/api/library/preview/' +
                                    encodeURIComponent(material.id) + '" target="_blank" rel="noopener">Open</a>' +
                                '<button type="button" data-review="APPROVED">Approve</button>' +
                                '<button type="button" data-review="REJECTED" class="is-reject">Reject</button>' +
                            '</div>' +
                        '</li>';
                }).join('') +
                '</ul>';

            // One delegated listener for the life of the page, so re-rendering
            // the list does not stack up handlers.
            if (queueBound) return;
            queueBound = true;

            host.addEventListener('click', function (event) {
                const button = event.target.closest('button[data-review]');
                if (!button) return;

                const item = button.closest('.coe-approval-item');
                const id = item && item.dataset.materialId;
                if (!id) return;

                const decision = button.dataset.review;
                let note;

                if (decision === 'REJECTED') {
                    note = global.prompt('Why is this being rejected? The uploader will see this.') || '';
                    if (!note.trim()) return;
                }

                // Disable both buttons: a double-click would otherwise fire two
                // reviews for the same material.
                item.querySelectorAll('button').forEach(b => { b.disabled = true; });

                reviewMaterial(id, decision, note)
                    .then(function (result) {
                        global.showLibraryToast?.(
                            decision === 'APPROVED' ? 'Published' : 'Rejected',
                            result.message || '',
                            decision === 'APPROVED' ? 'success' : 'info'
                        );
                        renderApprovalQueue();
                    })
                    .catch(function (error) {
                        item.querySelectorAll('button').forEach(b => { b.disabled = false; });
                        global.showLibraryToast?.('Could not review that', error.message || 'Try again.', 'error');
                    });
            });
        }).catch(function (error) {
            console.warn('[coe-live] approval queue unavailable', error.message || error);
        });
    }

    // -----------------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------------

    /**
     * Gate the page on a real session, load the shared library, then listen.
     *
     * Order matters: the session has to be adopted before scripts.js reads the
     * cached user, and the first sync has to land before the grid renders, or
     * the page flashes an empty library.
     */
    function start() {
        if (!global.CoeApi || !global.CoeApi.isServed()) {
            console.warn(
                '[coe-live] The portal is not being served by the app server, so the ' +
                'shared library is unavailable. Open it at /portal/index.html on the ' +
                'server instead of from the filesystem.'
            );
            return Promise.resolve(false);
        }

        return global.CoeApi.requireSession('login.html')
            .then(function (user) {
                if (!user) return false;
                currentUser = user;

                /*
                 * `ready` is set HERE, on the session — not after the first sync.
                 *
                 * Everything that reads this flag is asking one question: "does
                 * my upload go to the server, or into this browser?" A confirmed
                 * session on a served page is the complete answer to that. It
                 * used to be set only after the opening `syncLibrary()` resolved,
                 * which tied the answer to something unrelated: one 500, one
                 * dropped request, one reload during a server restart, and it
                 * stayed false for the rest of the session. Every upload after
                 * that took the local-only fallback in scripts.js — the card
                 * appeared, the toast said "uploaded", nothing was ever sent, and
                 * the next sync replaced the cache and took it away again. Files
                 * were lost to a failure that had nothing to do with uploading.
                 *
                 * A failed sync means the list on screen may be stale. It does
                 * not mean the server is unreachable, and it must never be the
                 * reason a file is written somewhere it cannot survive a refresh.
                 */
                ready = true;

                listen();
                applyUploadPermissions();

                return Promise.all([
                    // Handled, not propagated: a stale list is recoverable and
                    // the next sync fixes it. syncLibrary has already logged the
                    // reason and cleared the cache if the session was rejected.
                    syncWithRetry(),
                    global.CoeApi.connect()
                ]).then(function () {
                    renderApprovalQueue();
                    return true;
                });
            })
            .catch(function (error) {
                console.error('[coe-live] startup failed', error);
                return false;
            });
    }

    /** Wire the live events to the cache. */
    function listen() {
        global.CoeApi.on('material:created', function (material) {
            upsert(toPortalRecord(material));
            refreshViews();

            if (global.showLibraryToast && material.uploadedById !== (currentUser && currentUser.id)) {
                global.showLibraryToast(
                    'New material: ' + material.title,
                    [material.subject, KIND_TO_CATEGORY[material.kind]].filter(Boolean).join(' / '),
                    'info'
                );
            }
        });

        global.CoeApi.on('material:updated', function (material) {
            upsert(toPortalRecord(material));
            refreshViews();
        });

        global.CoeApi.on('material:deleted', function (payload) {
            remove(payload.id);
            refreshViews();
        });

        // Counter-only updates: patch in place rather than re-rendering from a
        // full record, so a view count ticking up does not rebuild the grid.
        global.CoeApi.on('material:counts', function (counts) {
            const records = readCache();
            const record = records.find(item => item.id === counts.id);
            if (!record) return;

            record.views = counts.viewCount;
            record.downloads = counts.downloadCount;
            writeCache(records);
            refreshViews();
        });

        // A folder appearing for someone else changes the tree everyone sees.
        global.CoeApi.on('folder:changed', function () {
            refreshViews();
        });

        // Personal notifications. A moderator is told the moment something
        // needs reviewing, and an uploader the moment their upload is decided —
        // both without refreshing.
        global.CoeApi.on('notification:new', function (notification) {
            const type = String(notification.type || '');

            if (type === 'MATERIAL_PENDING') {
                renderApprovalQueue();
            }

            if (type === 'MATERIAL_APPROVED' || type === 'MATERIAL_REJECTED') {
                // The approval already arrived via material:created; this is
                // the uploader being told what happened to their own file.
                global.showLibraryToast?.(
                    notification.title || 'Upload reviewed',
                    notification.body || '',
                    type === 'MATERIAL_APPROVED' ? 'success' : 'error'
                );
            }

            global.showNotificationBadge?.(notification);
        });
    }

    global.CoeLive = {
        start,
        syncLibrary,
        uploadMaterial,
        isModerated,
        canModerate,
        canUpload,
        applyUploadPermissions,
        listPending,
        reviewMaterial,
        deleteMaterial,
        updateMaterial,
        renderApprovalQueue,
        toPortalRecord,
        categoryToKind,
        get ready() { return ready; },
        get user() { return currentUser; }
    };

    // Start immediately. index.html loads this before scripts.js, so the
    // session is adopted and the library is in the cache by the time the
    // portal's own DOMContentLoaded handler runs.
    if (global.CoeApi && global.CoeApi.isServed()) {
        global.CoeLive.booted = start();
    }
})(window);
