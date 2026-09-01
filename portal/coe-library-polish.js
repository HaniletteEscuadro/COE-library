/* ==========================================================================
   coe-library-polish.js — filter state for the library toolbar
   ==========================================================================

   Two jobs, both about the toolbar telling the truth:

     1. `#library-filter-lesson` and `#library-filter-tag` are populated from
        whatever the current folder actually holds (populateLessonFilter and
        populateTagFilter in enhanced-library.js). In a folder with no lessons
        and no tags they end up holding only their "All …" placeholder, and a
        select you cannot choose anything from is worse than one that is not
        there. Those get `.libp-empty`, and the stylesheet hides them.

     2. A filter holding a value is why the grid looks emptier than expected,
        so it gets `.libp-active` and reads as set rather than as default.

   The selects are rewritten wholesale (`innerHTML = …`) on every folder
   change, so this watches for that rather than running once. It reads and
   classes elements and does nothing else — enhanced-library.js remains the
   only thing that decides what is *in* them.
   ========================================================================== */

(function () {
    'use strict';

    // Only the two that can legitimately come up empty. The type, year,
    // subject and sort selects always carry a real set of options, so hiding
    // them on an option count would eventually hide a working control.
    var COLLAPSIBLE = ['library-filter-lesson', 'library-filter-tag'];

    var TRACKED = COLLAPSIBLE.concat([
        'library-filter-type',
        'library-filter-year',
        'library-filter-subject'
    ]);

    function sync(select) {
        if (!select) return;

        if (COLLAPSIBLE.indexOf(select.id) !== -1) {
            // A lone placeholder means "nothing to filter by here", not
            // "one choice available".
            select.classList.toggle('libp-empty', select.options.length <= 1);
        }

        select.classList.toggle('libp-active', Boolean(select.value));
    }

    function syncAll() {
        TRACKED.forEach(function (id) {
            sync(document.getElementById(id));
        });
    }

    function start() {
        syncAll();

        TRACKED.forEach(function (id) {
            var select = document.getElementById(id);
            if (!select) return;

            select.addEventListener('change', function () {
                // A change to one filter can repopulate another — picking a
                // subject narrows the lessons — so re-read the whole row.
                syncAll();
            });

            // enhanced-library.js replaces the options, which fires no event
            // of its own; the observer is the only way to hear about it.
            new MutationObserver(function () {
                sync(select);
            }).observe(select, { childList: true });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
