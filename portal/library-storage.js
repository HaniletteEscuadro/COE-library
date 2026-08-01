/**
 * Large-file storage for the COE library.
 *
 * WHY THIS EXISTS
 * ---------------
 * Uploaded files were base64-encoded straight into localStorage, which every
 * browser caps at roughly 5 MB per origin. base64 also inflates a file by ~37%,
 * so a single 5.8 MB PDF could never fit. IndexedDB has no such limit — it is
 * bounded by available disk (typically GBs), and it stores binary natively.
 *
 * SPLIT STORAGE
 * -------------
 * The two stores hold different things on purpose:
 *
 *   localStorage  -> the file LIST (title, subject, folder, tags, size, ...)
 *                    Small, and synchronous, so existing code that reads the
 *                    list on page load keeps working unchanged.
 *
 *   IndexedDB     -> the file CONTENT (the heavy base64/blob payload),
 *                    keyed by file id.
 *
 * Content is hydrated back onto the in-memory records after boot, so all the
 * existing synchronous `file.content` reads continue to work.
 */

(function (global) {
    'use strict';

    const DB_NAME = 'coeLibraryStorage';
    const DB_VERSION = 1;
    const STORE = 'fileContents';

    let dbPromise = null;

    /**
     * Synchronous mirror of the store.
     *
     * The library reads `file.content` synchronously all over the place
     * (previews, downloads, card rendering). IndexedDB is async, so the whole
     * store is pulled into this Map once at boot and every later write keeps it
     * in step. Callers then read content without awaiting anything.
     */
    const cache = new Map();
    let readyPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
            if (!global.indexedDB) {
                reject(new Error('IndexedDB is not available in this browser.'));
                return;
            }

            const request = global.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return dbPromise;
    }

    function tx(mode, run) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE, mode);
            const store = transaction.objectStore(STORE);
            let result;

            try {
                result = run(store);
            } catch (error) {
                reject(error);
                return;
            }

            transaction.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        }));
    }

    /** Store one file's content. */
    function putContent(id, content, previewType) {
        if (!id) return Promise.resolve(false);
        // Unchanged body: skip the write. saveFiles() runs over the whole list
        // on every upload, and re-writing a 50 MB video each time is the
        // difference between a snappy library and a stalled one.
        if (cache.get(id) === content) return Promise.resolve(true);
        // Cache first: the caller may read this back on the very next line.
        cache.set(id, content);
        return tx('readwrite', store => store.put({ id, content, previewType }))
            .then(() => true)
            .catch(error => {
                console.error('[library-storage] put failed', error);
                return false;
            });
    }

    /** Read one file's content back. */
    function getContent(id) {
        if (!id) return Promise.resolve(null);
        return tx('readonly', store => store.get(id))
            .then(row => (row && row.content) || null)
            .catch(() => null);
    }

    /** Read every stored content row as a Map keyed by id. */
    function getAllContents() {
        return tx('readonly', store => store.getAll())
            .then(rows => {
                const map = new Map();
                (rows || []).forEach(row => { if (row && row.id) map.set(row.id, row.content); });
                return map;
            })
            .catch(() => new Map());
    }

    function removeContent(id) {
        if (!id) return Promise.resolve(false);
        cache.delete(id);
        return tx('readwrite', store => store.delete(id)).then(() => true).catch(() => false);
    }

    /**
     * Pull every stored content row into the synchronous cache.
     * Resolves once, then hands back the same promise to later callers.
     */
    function ready() {
        if (readyPromise) return readyPromise;

        readyPromise = getAllContents()
            .then(map => {
                map.forEach((content, id) => cache.set(id, content));
                return cache;
            })
            .catch(() => cache);

        return readyPromise;
    }

    /** Content for one id, without awaiting. Empty string until ready() resolves. */
    function getCachedContent(id) {
        return (id && cache.get(id)) || '';
    }

    /**
     * The inverse of hydrateRecords: copies with the offloaded bodies taken
     * back out, ready to go into localStorage.
     *
     * Any code that reads the list with getAllLibraryFiles() and then writes
     * it back - a download counter, a view counter - would otherwise push a
     * hydrated video straight into the ~5 MB quota and throw.
     */
    function stripForStorage(records) {
        if (!Array.isArray(records)) return records;
        return records.map(record => {
            if (!record || !record.contentRef) return record;
            return Object.assign({}, record, { content: '' });
        });
    }

    /**
     * Put content back onto records that were saved with it stripped out.
     * Mutates and returns the same array, so callers can use it inline.
     */
    function hydrateRecords(records) {
        if (!Array.isArray(records)) return records;
        records.forEach(record => {
            if (!record || !record.id) return;
            if (record.content) return;
            if (!record.contentRef) return;
            record.content = getCachedContent(record.id);
        });
        return records;
    }

    /** Drop content rows whose file no longer exists in the list. */
    function pruneContents(validIds) {
        const keep = new Set(validIds || []);
        return tx('readwrite', store => {
            const request = store.getAllKeys();
            request.onsuccess = () => {
                (request.result || []).forEach(key => { if (!keep.has(key)) store.delete(key); });
            };
            return request;
        }).then(() => true).catch(() => false);
    }

    /** Bytes currently held, for a real usage figure rather than a guess. */
    function estimateUsage() {
        if (global.navigator && navigator.storage && navigator.storage.estimate) {
            return navigator.storage.estimate()
                .then(info => ({ usage: info.usage || 0, quota: info.quota || 0 }))
                .catch(() => ({ usage: 0, quota: 0 }));
        }
        return Promise.resolve({ usage: 0, quota: 0 });
    }

    function isAvailable() {
        return Boolean(global.indexedDB);
    }

    /**
     * Drop every stored file body.
     *
     * Used when a session ends: the bodies are the larger half of what a
     * signed-out browser would otherwise keep, and the next person to open it
     * could read all of them.
     *
     * This empties the object store rather than deleting the database.
     * `indexedDB.deleteDatabase` blocks for as long as any tab holds a
     * connection open — which this module does, from boot — so it would appear
     * to succeed and quietly do nothing until the tab was closed.
     *
     * The in-memory mirror is cleared first and synchronously, so a caller
     * reading `getCachedContent` immediately after gets nothing back even
     * though the IndexedDB write is still in flight.
     */
    function clear() {
        cache.clear();

        if (!isAvailable()) return Promise.resolve(false);

        return tx('readwrite', store => store.clear())
            .then(() => true)
            .catch(error => {
                console.warn('[library-storage] could not clear stored files', error);
                return false;
            });
    }

    global.CoeLibraryStorage = {
        putContent,
        getContent,
        getAllContents,
        removeContent,
        pruneContents,
        estimateUsage,
        isAvailable,
        ready,
        getCachedContent,
        hydrateRecords,
        stripForStorage,
        clear
    };

    // Start filling the cache immediately. Nothing has to await this — the
    // library just renders without heavy previews for the first few ms, and
    // the refresh hooked to ready() fills them in.
    if (isAvailable()) ready();
})(window);
