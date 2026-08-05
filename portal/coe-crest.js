/**
 * COE Studio — organisation crests.
 *
 * THE PROBLEM THIS SOLVES
 * ----------------------
 * The PICE, IIEE and COESC marks are image files that have to be copied into
 * `assets/` by hand. Until they are, every place that shows a crest shows a
 * broken image instead — and a broken image in the middle of an organisation's
 * profile card reads as a fault in the site, not as a file somebody has yet to
 * add.
 *
 * WHAT IT DOES
 * ------------
 * Two things, so the crest appears either way.
 *
 * 1. It tries several filenames per crest rather than one. `pice-logo.png`
 *    first, then .jpg, .jpeg, .webp and .svg. Whatever you exported, saving it
 *    under `assets/pice-logo.<ext>` is enough — no renaming, no converting.
 *
 * 2. If none of them exists, the tile keeps its shape and shows a lettermark in
 *    that organisation's own colours. It is deliberately NOT a drawing of their
 *    logo: PICE and IIEE are other bodies' registered marks, and an approximation
 *    of one passed off in its place would be worse than an honest placeholder.
 *    It reads as a considered stand-in, and it disappears the moment the real
 *    file lands.
 *
 * Loading is done with `new Image()` rather than by pointing the <img> at each
 * candidate in turn. Setting a failing src on the visible element makes the
 * browser paint its broken-image glyph between attempts, which is the flicker
 * this file exists to avoid.
 */

(function (global) {
    'use strict';

    const doc = global.document;

    /** Extensions tried in order, best-quality-for-a-logo first. */
    const EXTENSIONS = ['png', 'svg', 'webp', 'jpg', 'jpeg'];

    /**
     * The lettermark shown while a file is missing.
     *
     * The colours are each organisation's own, taken from their marks, so the
     * placeholder still tells you which body you are looking at.
     */
    const CRESTS = {
        pice: { file: 'pice-logo', text: 'PICE', bg: '#241f5c', fg: '#f0921f' },
        iiee: { file: 'iiee-logo', text: 'IIEE', bg: '#1b2a6b', fg: '#f0921f' },
        coesc: { file: 'coesc-logo', text: 'COESC', bg: '#7a1522', fg: '#f0d68a' }
    };

    /**
     * Where `assets/` is relative to the page.
     *
     * login.html and index.html both sit at the portal root, so this is a
     * constant today — it is a variable so that moving either page into a
     * subfolder is a one-line change here rather than a hunt through markup.
     */
    const BASE = 'assets/';

    /** Resolves to the first URL that loads, or null when none of them do. */
    function findImage(name, index) {
        index = index || 0;
        if (index >= EXTENSIONS.length) return Promise.resolve(null);

        const url = BASE + name + '.' + EXTENSIONS[index];

        return new Promise(function (resolve) {
            const probe = new global.Image();
            probe.onload = function () {
                // A zero-sized decode is a file that exists but is not a usable
                // image — treat it as missing rather than showing an empty box.
                resolve(probe.naturalWidth > 0 ? url : null);
            };
            probe.onerror = function () { resolve(null); };
            probe.src = url;
        }).then(function (found) {
            return found || findImage(name, index + 1);
        });
    }

    function paintFallback(tile, crest) {
        const mark = doc.createElement('span');
        mark.className = 'coe-crest-fallback';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = crest.text;
        mark.style.setProperty('--crest-bg', crest.bg);
        mark.style.setProperty('--crest-fg', crest.fg);
        tile.appendChild(mark);
    }

    function apply(tile) {
        const key = tile.dataset.crest;
        const crest = CRESTS[key];
        if (!crest || tile.dataset.crestDone === 'true') return;
        tile.dataset.crestDone = 'true';

        const img = tile.querySelector('img');

        findImage(crest.file).then(function (url) {
            if (url && img) {
                img.src = url;
                tile.classList.add('has-crest');
                return;
            }

            // No file: drop the <img> entirely. Left in place with no src it
            // would still render its alt text inside the tile, on top of the
            // lettermark that replaces it.
            if (img) img.remove();
            paintFallback(tile, crest);
        });
    }

    function start() {
        doc.querySelectorAll('[data-crest]').forEach(apply);
    }

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
    else start();

    global.CoeCrest = { refresh: start };
}(window));
