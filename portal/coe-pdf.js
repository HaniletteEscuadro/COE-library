/**
 * COE Studio — PDF page viewer.
 *
 * WHY NOT JUST AN <iframe>
 * -----------------------
 * The library used to point an iframe at the file and let the browser's own PDF
 * plugin handle it. Two things were wrong with that:
 *
 *   1. Nothing rendered at all. `next.config.ts` sends `X-Frame-Options: DENY`
 *      on every route, and DENY has no same-origin exception — the browser
 *      refused to frame the portal's own preview URL. (Fixed separately, in
 *      the config.)
 *   2. Even once framed, a phone will not read it. iOS Safari renders only the
 *      first page of a PDF in an iframe and gives no way to reach page two;
 *      Android Chrome usually declines to render inline and offers a download.
 *
 * So the pages are drawn here instead, onto a canvas, with paging this file
 * controls: swipe on a touch screen, buttons and arrow keys on a desktop.
 *
 * PDF.js is served from the app's own /vendor directory rather than a CDN, so
 * this keeps working with no internet and nothing to whitelist.
 */

(function (global) {
    'use strict';

    const PDFJS_URL = '/vendor/pdf.min.mjs';
    const WORKER_URL = '/vendor/pdf.worker.min.mjs';

    /*
     * Standard fonts and character maps.
     *
     * PDF.js does not ship the 14 standard PDF fonts (Helvetica, Times,
     * Courier and their variants) inside the library — it fetches them. Without
     * `standardFontDataUrl` it warns
     *
     *     Ensure that the `standardFontDataUrl` API parameter is provided
     *
     * and a document that uses them renders with its text missing. Almost every
     * PDF produced by Word or a browser's "print to PDF" uses one of the
     * fourteen, so this is not an edge case.
     *
     * `cMapUrl` is the same problem for text that is not plain Latin.
     *
     * Both are fetched per document, only when a document needs them, and both
     * are served from the app rather than a CDN.
     */
    const FONTS_URL = '/vendor/pdf-fonts/';
    const CMAPS_URL = '/vendor/pdf-cmaps/';

    let pdfjsLib = null;
    let loading = null;

    /** Load PDF.js once, on first use — it is 444 KB and most visits never open a PDF. */
    function loadPdfjs() {
        if (pdfjsLib) return Promise.resolve(pdfjsLib);
        if (loading) return loading;

        /*
         * Opened off the filesystem, `location.origin` is "file://" and the
         * import resolves to `file:///vendor/pdf.min.mjs` — the root of the
         * drive, where nothing is. The browser reports only
         *
         *     Failed to fetch dynamically imported module
         *
         * which says nothing about the cause. Catch it here and give back the
         * one instruction that fixes it, rather than a path nobody can act on.
         */
        if (global.location.protocol === 'file:') {
            return Promise.reject(new Error(
                'Open the portal from the server address ' +
                '(http://localhost:3000/portal/index.html), not by opening the file directly.'
            ));
        }

        // Resolved against the page's origin rather than left as a bare path.
        // A dynamic import in a classic script resolves relative to the
        // document, which is right here — but being explicit keeps it correct
        // if the portal is ever served from a sub-path.
        const moduleUrl = new URL(PDFJS_URL, global.location.origin).href;

        loading = import(moduleUrl)
            .then(function (module) {
                const lib = module.default || module;
                lib.GlobalWorkerOptions.workerSrc = new URL(WORKER_URL, global.location.origin).href;
                pdfjsLib = lib;
                return lib;
            })
            .catch(function (error) {
                loading = null;
                throw error;
            });

        return loading;
    }

    /**
     * How to hand a source to PDF.js.
     *
     * Two kinds reach this viewer:
     *
     *   - A server URL, `/api/library/preview/<id>`. Authenticated, so the
     *     session cookie has to travel with it.
     *   - A `data:` URL. Everything uploaded before the library moved to the
     *     server keeps its bytes in the browser, and those records still open
     *     from the list.
     *
     * They cannot be fetched the same way. Asking for a `data:` URL with
     * `credentials: "include"` is a TypeError — the credentials modes are not
     * defined for data URLs — and the failure arrives before a single page is
     * read, so every legacy file reported itself as unopenable. The bytes are
     * decoded and passed straight in instead, which also skips re-parsing a
     * multi-megabyte base64 string through the network stack.
     */
    function toSource(url) {
        if (/^data:/i.test(url)) {
            const comma = url.indexOf(',');
            if (comma < 0) throw new Error('That file’s saved data is incomplete.');

            const meta = url.slice(0, comma);
            const body = url.slice(comma + 1);

            if (/;base64/i.test(meta)) {
                const binary = global.atob(body);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                return { data: bytes };
            }

            return { data: new TextEncoder().encode(decodeURIComponent(body)) };
        }

        // blob: is same-origin by construction and takes no credentials either.
        if (/^blob:/i.test(url)) return { url: url };

        return { url: url, withCredentials: true };
    }

    /**
     * One open document. Holds the page it is on and knows how to draw it.
     *
     * Rendering is serialised through `pending`: a fast swipe can ask for three
     * pages before the first has finished, and PDF.js throws if two renders
     * share a canvas.
     */
    function createViewer(container, url, options) {
        const settings = options || {};

        let doc = null;
        // Kept separately: `destroy()` lives on the loading task, not on the
        // document proxy the promise resolves to. Calling `doc.destroy()` is a
        // TypeError, which the catch below would swallow — leaving the worker
        // and its page buffers alive after the dialog closed.
        let loadingTask = null;
        let page = 1;
        let scale = 1;
        let pending = Promise.resolve();
        let destroyed = false;

        container.classList.add('coe-pdf');
        container.innerHTML =
            '<div class="coe-pdf-stage">' +
                '<canvas class="coe-pdf-canvas"></canvas>' +
                '<div class="coe-pdf-loading"><span class="material-icons">hourglass_top</span> Loading…</div>' +
            '</div>' +
            '<div class="coe-pdf-bar">' +
                '<button type="button" class="coe-pdf-prev" aria-label="Previous page">' +
                    '<span class="material-icons">chevron_left</span></button>' +
                '<span class="coe-pdf-count" aria-live="polite">–</span>' +
                '<button type="button" class="coe-pdf-next" aria-label="Next page">' +
                    '<span class="material-icons">chevron_right</span></button>' +
            '</div>';

        const stage = container.querySelector('.coe-pdf-stage');
        const canvas = container.querySelector('.coe-pdf-canvas');
        const loadingEl = container.querySelector('.coe-pdf-loading');
        const countEl = container.querySelector('.coe-pdf-count');
        const prevBtn = container.querySelector('.coe-pdf-prev');
        const nextBtn = container.querySelector('.coe-pdf-next');
        const ctx = canvas.getContext('2d');

        function setLoading(on) {
            loadingEl.style.display = on ? '' : 'none';
        }

        function updateBar() {
            if (!doc) return;
            countEl.textContent = page + ' / ' + doc.numPages;
            prevBtn.disabled = page <= 1;
            nextBtn.disabled = page >= doc.numPages;
            container.classList.toggle('is-single', doc.numPages <= 1);
        }

        function draw() {
            if (!doc || destroyed) return pending;

            pending = pending
                .then(function () { return doc.getPage(page); })
                .then(function (pdfPage) {
                    if (destroyed) return;

                    // Fit the width of the stage, then cap so a tall page still
                    // fits the height rather than needing a scroll to see any
                    // of it.
                    const unscaled = pdfPage.getViewport({ scale: 1 });
                    const available = stage.clientWidth || 600;
                    const availableHeight = stage.clientHeight || 800;

                    const byWidth = available / unscaled.width;
                    const byHeight = availableHeight / unscaled.height;
                    scale = Math.min(byWidth, byHeight) || 1;

                    // Draw at device resolution, then scale down with CSS, or
                    // text is soft on a phone.
                    const dpr = Math.min(global.devicePixelRatio || 1, 2);
                    const viewport = pdfPage.getViewport({ scale: scale * dpr });

                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);
                    canvas.style.width = Math.floor(viewport.width / dpr) + 'px';
                    canvas.style.height = Math.floor(viewport.height / dpr) + 'px';

                    return pdfPage.render({ canvasContext: ctx, viewport: viewport }).promise;
                })
                .then(function () {
                    if (destroyed) return;
                    setLoading(false);
                    updateBar();
                })
                .catch(function (error) {
                    if (destroyed) return;
                    setLoading(false);
                    console.error('[coe-pdf] could not render page', page, error);
                });

            return pending;
        }

        function go(next) {
            if (!doc) return;
            const target = Math.min(Math.max(1, next), doc.numPages);
            if (target === page) return;
            page = target;
            draw();
        }

        prevBtn.addEventListener('click', function (e) { e.stopPropagation(); go(page - 1); });
        nextBtn.addEventListener('click', function (e) { e.stopPropagation(); go(page + 1); });

        // --- Swipe ----------------------------------------------------------
        //
        // Horizontal intent only, so it never fights a vertical scroll, and a
        // minimum distance so a tap that drifts does not turn the page.
        let startX = 0;
        let startY = 0;
        let tracking = false;

        stage.addEventListener('touchstart', function (event) {
            if (event.touches.length !== 1) return;
            startX = event.touches[0].clientX;
            startY = event.touches[0].clientY;
            tracking = true;
        }, { passive: true });

        stage.addEventListener('touchend', function (event) {
            if (!tracking) return;
            tracking = false;

            const dx = event.changedTouches[0].clientX - startX;
            const dy = event.changedTouches[0].clientY - startY;

            if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;

            go(dx < 0 ? page + 1 : page - 1);
        }, { passive: true });

        // --- Keyboard -------------------------------------------------------
        function onKey(event) {
            // Not while somebody is typing a comment.
            if (event.target.closest('input, textarea, [contenteditable="true"]')) return;
            if (!container.isConnected) return;

            if (event.key === 'ArrowRight' || event.key === 'PageDown') {
                event.preventDefault();
                go(page + 1);
            } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                event.preventDefault();
                go(page - 1);
            }
        }

        global.document.addEventListener('keydown', onKey);

        // Re-fit when the pane changes size — entering fullscreen, or a phone
        // being turned.
        let resizeTimer = null;
        const onResize = function () {
            global.clearTimeout(resizeTimer);
            resizeTimer = global.setTimeout(draw, 150);
        };
        global.addEventListener('resize', onResize);

        const observer = global.ResizeObserver ? new global.ResizeObserver(onResize) : null;
        if (observer) observer.observe(stage);

        setLoading(true);

        const ready = loadPdfjs()
            .then(function (lib) {
                loadingTask = lib.getDocument(Object.assign(toSource(url), {
                    standardFontDataUrl: FONTS_URL,
                    cMapUrl: CMAPS_URL,
                    cMapPacked: true
                }));

                return loadingTask.promise;
            })
            .then(function (loaded) {
                if (destroyed) return null;
                doc = loaded;
                page = 1;
                updateBar();
                return draw();
            })
            .catch(function (error) {
                if (destroyed) return null;
                console.error('[coe-pdf] could not open the document', error);

                // Say why. A bare "could not be opened" leaves nobody — reader
                // or maintainer — able to tell a damaged file from a missing
                // one from an expired session.
                const reason = (error && (error.message || error.name)) || 'Unknown error';
                const escaped = reason.replace(/[&<>"]/g, function (ch) {
                    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
                });

                const parts = [
                    '<div class="coe-pdf-failed">',
                    '<span class="material-icons">error_outline</span>',
                    '<strong>This PDF could not be opened</strong>',
                    '<span class="coe-pdf-reason">' + escaped + '</span>'
                ];

                // A data: URL is the file itself — megabytes of base64 in an
                // href, which no browser will treat as a navigable link.
                if (!/^data:/i.test(url)) {
                    parts.push('<a href="' + url + '" target="_blank" rel="noopener">Open it in a new tab</a>');
                }

                parts.push('</div>');
                container.innerHTML = parts.join('');
                return null;
            });

        return {
            get page() { return page; },
            get pages() { return doc ? doc.numPages : 0; },
            next: function () { go(page + 1); },
            prev: function () { go(page - 1); },
            goTo: go,
            redraw: draw,
            ready: ready,
            destroy: function () {
                destroyed = true;
                global.document.removeEventListener('keydown', onKey);
                global.removeEventListener('resize', onResize);
                if (observer) observer.disconnect();

                // The loading task, not the document — see the note above.
                // This shuts the worker down; without it every PDF opened
                // leaves one running for the life of the tab.
                if (loadingTask) {
                    Promise.resolve(loadingTask.destroy()).catch(function () { /* already gone */ });
                    loadingTask = null;
                }

                doc = null;
            }
        };
    }

    let current = null;

    /**
     * Show a PDF inside `container`. Replaces whatever was there.
     * Returns the viewer, so the caller can page it programmatically.
     */
    function open(container, url, options) {
        close();
        current = createViewer(container, url, options);
        return current;
    }

    function close() {
        if (current) {
            current.destroy();
            current = null;
        }
    }

    global.CoePdf = {
        open,
        close,
        loadPdfjs,
        // Exported so the source handling can be checked without a rasteriser.
        toSource,
        get viewer() { return current; }
    };
})(window);
