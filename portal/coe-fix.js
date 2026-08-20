/* ===========================================================================
   SCROLL WATCHDOG
   ---------------------------------------------------------------------------
   coe-fix.css guarantees the page is scrollable in its resting state.
   What it cannot reach is a lock applied at runtime, because inline styles and
   classes beat any stylesheet. There are three such locks in this codebase and
   each has a way of being left behind:

     - enhanced-library.js pins <body> with `position: fixed` while a material
       dialog is open, and unpins it on close. A dialog removed from the DOM by
       anything other than its own close path — a page switch, a re-render —
       never runs that second half.

     - mobile.js sets `body.style.overflow = 'hidden'` when the drawer opens,
       and close() is the only thing that clears it. Measured, this one does
       not stop the page on its own — the document scrolls on <html>, so
       overflow on <body> has nothing to hold. It is cleared anyway, because
       it is a lock left where a lock should not be and the next stylesheet
       change could give it teeth.

     - A dialog left in the DOM at `opacity: 0` with `position: fixed; inset: 0`
       is invisible, covers the viewport, and swallows every touch. The page is
       not locked at all in this case: the drag never reaches it. mobile.css
       names this failure mode in a comment about the drawer scrim; it is not
       specific to the scrim.

   All three look identical to the person holding the phone — the page will not
   move. This file checks for each and undoes it, on the events where a lock is
   most likely to have been stranded: first paint, back/forward restore, and
   returning to a backgrounded tab, which is what an in-app browser does every
   time you switch back to the conversation and out again.

   Verified in headless Chrome at 880x1400. With the fix blocked, a stranded
   `position: fixed` pin leaves the page dead and an invisible overlay keeps
   taking every tap; with it loaded, both recover on the next sweep.

   It never locks anything, and it only ever clears a lock whose owner is gone,
   so an open dialog keeps the page pinned exactly as it should.
   =========================================================================== */

(function () {
    'use strict';

    /* Something is genuinely open and entitled to hold the page still. */
    function dialogIsOpen() {
        var open = document.querySelector(
            '.modal.is-open, .modal.show, .modal.active, ' +
            '#material-detail-modal.is-open, ' +
            '.m-more-sheet.is-open, .m-account-sheet.is-open, ' +
            '.sidebar.is-open, [role="dialog"][open]'
        );
        if (open) return true;

        /* A drawer whose class is on <body> rather than on itself. */
        return document.body.classList.contains('nav-open') &&
               !!document.querySelector('.sidebar.is-open');
    }

    /**
     * Undo a body-level scroll lock whose dialog is no longer on screen.
     *
     * The scroll position matters: lockBackgroundScroll() parks the page by
     * setting `top: -<scrollY>px` on a fixed body, so the offset it wrote is
     * where the reader was. Restoring it is the difference between landing
     * back where they were and being thrown to the top of the page.
     */
    function clearStrandedLock() {
        var body = document.body;
        if (!body || body.classList.contains('auth-body')) return false;
        if (dialogIsOpen()) return false;

        var pinned = body.style.position === 'fixed';
        var frozen = body.style.overflow === 'hidden';
        var flagged = body.classList.contains('coe-modal-open') ||
                      body.classList.contains('nav-open') ||
                      body.classList.contains('sidebar-overlay-active');

        if (!pinned && !frozen && !flagged) return false;

        var parkedAt = pinned ? Math.abs(parseInt(body.style.top, 10) || 0) : 0;

        body.classList.remove('coe-modal-open', 'nav-open', 'sidebar-overlay-active');
        body.style.position = '';
        body.style.overflow = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        body.style.height = '';

        if (parkedAt) window.scrollTo(0, parkedAt);
        return true;
    }

    /**
     * Neutralise invisible full-screen overlays.
     *
     * The test is deliberately narrow — fixed, effectively the whole viewport,
     * and invisible while still laid out. A visible overlay is a dialog doing
     * its job and is left alone; `display: none` is already harmless. Only
     * `pointer-events` is touched, so nothing is hidden, moved or removed and
     * the element behaves normally again the moment it is made visible.
     */
    function disarmInvisibleOverlays() {
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var disarmed = 0;

        var candidates = document.querySelectorAll(
            '.modal, .overlay, .scrim, .backdrop, [class*="scrim"], [class*="overlay"], [role="dialog"]'
        );

        Array.prototype.forEach.call(candidates, function (el) {
            var style = window.getComputedStyle(el);
            if (style.position !== 'fixed') return;
            if (style.display === 'none' || style.pointerEvents === 'none') return;

            var box = el.getBoundingClientRect();
            if (box.width < vw * 0.9 || box.height < vh * 0.9) return;

            var invisible = style.visibility === 'hidden' ||
                            parseFloat(style.opacity) < 0.05;
            if (!invisible) return;

            el.style.pointerEvents = 'none';
            disarmed++;
        });

        return disarmed > 0;
    }

    function sweep() {
        clearStrandedLock();
        disarmInvisibleOverlays();
    }

    /*
     * A last resort, and the only check here that can be wrong.
     *
     * If the document reports nothing to scroll while the content inside it is
     * clearly taller than the window, the height is being clamped by something
     * this file has not accounted for. Rather than guess at which rule, clear
     * the clamp on the two elements that can carry it. Guarded by a 24px
     * margin so a page that genuinely fits — an empty list, a short panel —
     * never trips it.
     */
    function unclampDocument() {
        var doc = document.documentElement;
        var body = document.body;
        if (!body || body.classList.contains('auth-body')) return;
        if (dialogIsOpen()) return;

        var scrollable = doc.scrollHeight - window.innerHeight > 24;
        if (scrollable) return;

        var content = document.querySelector('.main-content');
        if (!content) return;
        if (content.getBoundingClientRect().height - window.innerHeight <= 24) return;

        doc.style.height = 'auto';
        doc.style.overflowY = 'auto';
        body.style.height = 'auto';
        body.style.maxHeight = 'none';
        body.style.overflowY = 'visible';
    }

    function run() {
        sweep();
        /* After layout settles: fonts, the hero image and the panels scripts.js
           builds all change the page height, and the clamp test above is only
           meaningful once they have. */
        setTimeout(function () {
            sweep();
            unclampDocument();
        }, 600);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

    /* Restored from the back/forward cache — the state that was current when
       the page was frozen comes back with it, stranded lock included. */
    window.addEventListener('pageshow', sweep);

    /* Returning from the conversation to the browser tab, which in an in-app
       browser is most of how the page is used. */
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) sweep();
    });

    /* Switching pages tears down whatever dialog the previous one had open. */
    document.addEventListener('click', function (event) {
        if (!event.target || !event.target.closest) return;
        if (!event.target.closest('[data-page]')) return;
        setTimeout(sweep, 320);
    }, true);
})();
