/**
 * COE Studio — the student's own calendar.
 *
 * WHAT THIS IS FOR
 * ----------------
 * The calendar screen already showed two things, and both belonged to somebody
 * else: the administrator's agenda, and the announcement board. A student could
 * read it and put nothing on it. This adds the half that is theirs — a plan for
 * a day, which they add and they clear, and which nobody else can see.
 *
 * WHY IT IS ON THE SERVER
 * -----------------------
 * The admin agenda beside it is still `localStorage.coeCalendarAgendas`, so it
 * exists on exactly one computer and disappears with the browser profile. That
 * is survivable for an agenda one person retypes; it is not survivable for the
 * list a student keeps their week in. These entries go to `/api/calendar`,
 * scoped to the signed-in account, so they are on whichever device that account
 * signs in from.
 *
 * THE LOCAL MIRROR
 * ----------------
 * `renderCalendarDashboard()` in scripts.js is synchronous and lives inside a
 * DOMContentLoaded closure. Rather than make it async, the fetched entries are
 * mirrored into `localStorage.coeMyCalendar` — the same "demote the key from
 * source of truth to render cache" trick coe-live.js uses for the library. The
 * server is authoritative; this key is what the renderer reads.
 *
 * OPENED AS A FILE
 * ----------------
 * With no server to talk to (index.html opened straight off the disk) every
 * operation falls back to the mirror alone. The feature keeps working; it is
 * simply per-browser again, which is the most that context allows.
 */

(function (global) {
    'use strict';

    const CACHE_KEY = 'coeMyCalendar';

    let entries = [];
    let ready = false;

    // -----------------------------------------------------------------------
    // The mirror
    // -----------------------------------------------------------------------

    function readCache() {
        try {
            const parsed = JSON.parse(global.localStorage.getItem(CACHE_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function writeCache(list) {
        entries = Array.isArray(list) ? list : [];
        try {
            global.localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
        } catch (error) {
            // A full quota must not lose what the server already has. The
            // in-memory copy above is what the renderer reads this session.
            console.warn('[coe-calendar] could not mirror entries locally', error);
        }
    }

    /** Redraw whichever calendar views scripts.js has mounted. */
    function refresh() {
        try {
            if (typeof global.renderCalendarDashboard === 'function') {
                global.renderCalendarDashboard();
            }
        } catch (error) {
            console.warn('[coe-calendar] saved, but the view did not refresh', error);
        }
    }

    function served() {
        return Boolean(global.CoeApi && global.CoeApi.isServed());
    }

    /**
     * Today, as the person looking at the screen would write it.
     *
     * Not `toISOString().slice(0, 10)` — that converts to UTC first, so for
     * anyone east of Greenwich it returns *yesterday* for the whole first part
     * of the day. In Manila (UTC+8) every entry made before 8am would land on
     * the wrong square.
     */
    function todayKey(date) {
        const value = date || new Date();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return value.getFullYear() + '-' + month + '-' + day;
    }

    // -----------------------------------------------------------------------
    // Reading
    // -----------------------------------------------------------------------

    function sync() {
        if (!served()) {
            writeCache(readCache());
            return Promise.resolve(entries);
        }

        return global.CoeApi.get('/api/calendar')
            .then(function (result) {
                writeCache((result && result.entries) || []);
                refresh();
                return entries;
            })
            .catch(function (error) {
                /*
                 * Signed out means the entries are not this browser's to show.
                 * Anything else — a dropped connection on a phone — is not
                 * evidence that anything was deleted, so the mirror stands.
                 */
                if (error && (error.status === 401 || error.status === 403)) {
                    writeCache([]);
                    refresh();
                    return entries;
                }

                console.error('[coe-calendar] could not load your calendar', error.message || error);
                entries = readCache();
                return entries;
            });
    }

    // -----------------------------------------------------------------------
    // Writing
    // -----------------------------------------------------------------------

    function localId() {
        return 'plan-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);
    }

    function add(input) {
        const entry = {
            date: String((input && input.date) || todayKey()),
            title: String((input && input.title) || '').trim(),
            detail: String((input && input.detail) || '').trim()
        };

        if (entry.title.length < 2) {
            return Promise.reject(new Error('Give this plan a name.'));
        }

        if (!served()) {
            writeCache(entries.concat([{
                id: localId(),
                date: entry.date,
                title: entry.title,
                detail: entry.detail,
                done: false,
                createdAt: new Date().toISOString()
            }]));
            refresh();
            return Promise.resolve(true);
        }

        return global.CoeApi.post('/api/calendar', entry).then(function (result) {
            // Appended from the response rather than re-fetching: the server
            // assigns the id, and one round trip is enough for one entry.
            if (result && result.entry) {
                writeCache(entries.concat([result.entry]));
                refresh();
            } else {
                return sync();
            }
            return true;
        });
    }

    function remove(id) {
        if (!id) return Promise.resolve(false);

        if (!served()) {
            writeCache(entries.filter(function (item) { return item.id !== id; }));
            refresh();
            return Promise.resolve(true);
        }

        return global.CoeApi.del('/api/calendar/' + encodeURIComponent(id)).then(function () {
            writeCache(entries.filter(function (item) { return item.id !== id; }));
            refresh();
            return true;
        });
    }

    function setDone(id, done) {
        if (!id) return Promise.resolve(false);

        const apply = function () {
            writeCache(entries.map(function (item) {
                return item.id === id ? Object.assign({}, item, { done: Boolean(done) }) : item;
            }));
            refresh();
            return true;
        };

        if (!served()) return Promise.resolve(apply());

        return global.CoeApi
            .patch('/api/calendar/' + encodeURIComponent(id), { done: Boolean(done) })
            .then(apply);
    }

    /**
     * Bulk clear. `scope` is "past" (default), "done" or "all".
     *
     * `today` is sent with it because the server runs in UTC — see the note in
     * the route handler. Clearing "past" from a phone in Manila before 8am
     * would otherwise take today's entries with it.
     */
    function clear(scope) {
        const which = scope === 'all' || scope === 'done' ? scope : 'past';
        const today = todayKey();

        const applyLocally = function () {
            const kept = entries.filter(function (item) {
                if (which === 'all') return false;
                if (which === 'done') return !item.done;
                return String(item.date || '') >= today;
            });
            const cleared = entries.length - kept.length;
            writeCache(kept);
            refresh();
            return { cleared: cleared };
        };

        if (!served()) return Promise.resolve(applyLocally());

        return global.CoeApi
            .del('/api/calendar?scope=' + which + '&today=' + encodeURIComponent(today))
            .then(function (result) {
                applyLocally();
                return { cleared: (result && result.cleared) || 0 };
            });
    }

    // -----------------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------------

    function start() {
        if (ready) return Promise.resolve(true);

        // Show whatever the last session left, immediately, so the card is not
        // empty for the length of a request.
        entries = readCache();

        if (!served()) {
            ready = true;
            refresh();
            return Promise.resolve(false);
        }

        return global.CoeApi.session(false)
            .then(function (current) {
                if (!current) {
                    // Signed out: the previous account's plans are not this
                    // visitor's to see.
                    writeCache([]);
                    return false;
                }

                return sync().then(function () {
                    ready = true;
                    return true;
                });
            })
            .catch(function (error) {
                console.error('[coe-calendar] startup failed', error);
                return false;
            });
    }

    global.CoeCalendar = {
        start,
        sync,
        add,
        remove,
        setDone,
        clear,
        todayKey,
        get entries() { return entries; },
        get ready() { return ready; }
    };

    function boot() {
        global.CoeCalendar.booted = start();
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
