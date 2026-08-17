/**
 * Phone shell — bottom tab bar, More sheet, keyboard handling, keyboard types.
 *
 * WHY THIS EXISTS
 * ---------------
 * The portal's primary navigation is nine tiles in a sticky strip under the top
 * bar. On a desktop that is one row. On a phone styles.css collapses it to four
 * columns, so nine tiles become three rows — about 150px of a 667px screen
 * spent on navigation before any content, and all of it at the top, which is
 * the part of a phone screen a thumb cannot reach.
 *
 * This moves the four destinations students open daily into a fixed bar at the
 * bottom, with More for the rest. coe-phone.css hides the tile strip at the
 * same breakpoint, so the two never coexist.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It does not navigate. The tabs carry `data-page` and nothing else; the
 * capture-phase handler in scripts.js already routes any `button[data-page]`
 * through showPage, and setActiveNav already marks `.priority-nav-item[data-page]`
 * as current — which is why the tabs carry that class too. The More rows
 * forward a click to the sidebar's own anchor rather than repeating what it
 * does, the same trick mobile.js uses for the account menu. So access rules,
 * panel switching and active state stay in exactly one place.
 *
 * Self-contained: reads the DOM, appends two elements, toggles classes. Inert
 * above the breakpoint, and it removes what it built on the way out.
 */
(function () {
  'use strict';

  /* Must match the `max-width: 760px` blocks in coe-phone.css. Above this the
     tile strip comes back and a bottom bar would be a second navigation. */
  var BREAKPOINT = 760;

  /*
   * The four daily destinations, in the order a student moves through a day:
   * what is due, what to read, where to ask. Home first because it is the
   * default panel and a tab bar's first slot is where people reach to start
   * over.
   *
   * `page` matches the `data-page` values already in index.html. Labels are
   * shorter than the tile strip's — 20% of a 360px screen is about seven
   * characters before it ellipses.
   */
  var TABS = [
    { page: 'home', icon: 'home', label: 'Home' },
    { page: 'tasks', icon: 'task_alt', label: 'Tasks' },
    { page: 'library', icon: 'auto_stories', label: 'Study' },
    { page: 'qa-hub', icon: 'forum', label: 'Ask' }
  ];

  /* Everything in the sidebar that is not already a tab goes in the More sheet.
     Listed as data rather than filtered by hand so the two sets cannot overlap
     if TABS changes. */
  var TAB_PAGES = TABS.map(function (tab) { return tab.page; });

  function isPhone() {
    return window.innerWidth <= BREAKPOINT;
  }

  /* ---------------------------------------------------------------------
     The bar
     --------------------------------------------------------------------- */

  function buildBar() {
    if (document.querySelector('.m-tabbar')) return;

    var nav = document.createElement('nav');
    /*
     * The id is load-bearing, not a handle for this script — everything here
     * works through the class. coe-phone.css selects the tabs through it
     * because they also carry `.priority-nav-item`, and the rules that come
     * with that class are weighted to beat other class selectors. See the note
     * above the `#m-tabbar .m-tab` block there.
     */
    nav.id = 'm-tabbar';
    nav.className = 'm-tabbar';
    nav.setAttribute('aria-label', 'Primary');

    /*
     * `priority-nav-item` alongside `m-tab` is not decorative. setActiveNav in
     * scripts.js selects `.priority-nav-item[data-page]` to mark the current
     * destination; without the class these tabs would never light up, and with
     * it they light up for free — including when the page is opened from the
     * drawer or a card rather than from the bar.
     */
    var tabs = TABS.map(function (tab) {
      return '<button type="button" class="priority-nav-item m-tab" data-page="' +
        tab.page + '" aria-current="false">' +
        '<span class="material-icons" aria-hidden="true">' + tab.icon + '</span>' +
        '<span class="m-tab-label">' + tab.label + '</span>' +
        '</button>';
    }).join('');

    /* No `data-page` on More — it opens a sheet, and the delegated handler in
       scripts.js would otherwise try to route it to a panel called "more". */
    var more =
      '<button type="button" class="m-tab m-tab-more" id="m-tab-more" ' +
      'aria-label="More destinations" aria-expanded="false" aria-controls="m-more-sheet">' +
      '<span class="material-icons" aria-hidden="true">apps</span>' +
      '<span class="m-tab-label">More</span>' +
      '</button>';

    nav.innerHTML = tabs + more;
    document.body.appendChild(nav);

    document.getElementById('m-tab-more').addEventListener('click', function (event) {
      event.stopPropagation();
      toggleMore();
    });

    /* The bar is built after scripts.js has already run setActiveNav for the
       landing page, so the new buttons start unmarked. Ask the page which panel
       is showing and mark the match. */
    syncActive();
  }

  function removeBar() {
    var bar = document.querySelector('.m-tabbar');
    if (bar) bar.remove();
  }

  /** Mirror the visible panel onto the tabs, for the one case setActiveNav
   *  cannot cover: the bar not existing yet when the page first loaded. */
  function syncActive() {
    var panel = document.querySelector('.page-panel:not(.hidden)[data-page]');
    var current = panel ? panel.getAttribute('data-page') : 'home';

    document.querySelectorAll('.m-tabbar .m-tab[data-page]').forEach(function (tab) {
      var active = tab.getAttribute('data-page') === current;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  /* ---------------------------------------------------------------------
     The More sheet
     --------------------------------------------------------------------- */

  function sheet() {
    return document.getElementById('m-more-sheet');
  }

  function scrim() {
    return document.querySelector('.m-more-scrim');
  }

  /**
   * Read the destinations out of the sidebar.
   *
   * Not a hard-coded list on purpose. The Admin Panel link is hidden for
   * students by scripts.js — it toggles the `<li>`, not the anchor — so asking
   * the DOM what is currently visible means the sheet enforces the same access
   * rules without knowing they exist. A destination added to the sidebar later
   * appears here on its own.
   */
  /**
   * Hidden by an access rule?
   *
   * scripts.js hides a restricted destination by setting `display: none` on the
   * anchor and on its `<li>`, so those two elements are the whole test.
   *
   * Deliberately not `offsetParent === null`, which is the usual shorthand.
   * That answers "is this element visible", ancestors included — and the
   * sidebar is an ancestor. It is only translated off-screen today, so the
   * shorthand happens to work; hide the sidebar itself on phones, which is a
   * reasonable thing to do now that a tab bar exists, and every row would
   * vanish from this sheet at once with nothing to point at.
   */
  function hiddenByRole(link) {
    var li = link.closest('li');
    return getComputedStyle(link).display === 'none' ||
      (!!li && getComputedStyle(li).display === 'none');
  }

  function destinations() {
    var links = document.querySelectorAll('.sidebar-nav a[data-page]');
    var out = [];

    Array.prototype.forEach.call(links, function (link) {
      var page = link.getAttribute('data-page');
      if (!page || TAB_PAGES.indexOf(page) !== -1) return;
      if (hiddenByRole(link)) return;

      var icon = link.querySelector('.material-icons');
      out.push({
        page: page,
        icon: icon ? icon.textContent.trim() : 'chevron_right',
        /* The anchor's own text, minus the icon's ligature name. */
        label: (link.textContent || '').replace(icon ? icon.textContent : '', '').trim() || page
      });
    });

    return out;
  }

  function buildSheet() {
    if (sheet()) return;

    var back = document.createElement('div');
    back.className = 'm-more-scrim';
    document.body.appendChild(back);

    var panel = document.createElement('div');
    panel.className = 'm-more-sheet';
    panel.id = 'm-more-sheet';
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', 'More destinations');
    document.body.appendChild(panel);

    back.addEventListener('click', closeMore);

    panel.addEventListener('click', function (event) {
      var item = event.target.closest('.m-more-item');
      if (!item) return;

      closeMore();

      /*
       * Forward to the sidebar's anchor rather than calling showPage. The
       * anchor has handlers bound to it by scripts.js — access checks, panel
       * refreshes, the drawer's own close — and a programmatic click runs all
       * of them. Calling showPage directly would skip whichever of those the
       * destination happens to need.
       */
      var page = item.getAttribute('data-target-page');
      var link = document.querySelector('.sidebar-nav a[data-page="' + page + '"]');
      if (link) link.click();
    });

    enableSwipeDismiss(panel);
  }

  function fillSheet() {
    var panel = sheet();
    if (!panel) return;

    var current = document.querySelector('.page-panel:not(.hidden)[data-page]');
    var currentPage = current ? current.getAttribute('data-page') : '';

    /*
     * `data-target-page`, not `data-page`.
     *
     * The fallback handler in scripts.js claims every `button[data-page]` click
     * during capture and stops the event there. A row named that way would
     * navigate — but this sheet's own handler would never run, so the sheet
     * would stay open over the page it just opened, and the forward through the
     * sidebar anchor below would be skipped along with it. Under a different
     * attribute the row is invisible to that handler and this one gets the
     * click.
     */
    var rows = destinations().map(function (item) {
      return '<button type="button" role="menuitem" class="m-more-item' +
        (item.page === currentPage ? ' is-active' : '') +
        '" data-target-page="' + item.page + '">' +
        '<span class="material-icons" aria-hidden="true">' + item.icon + '</span>' +
        item.label +
        '</button>';
    }).join('');

    panel.innerHTML =
      '<span class="m-more-grip" aria-hidden="true"></span>' +
      '<span class="m-more-title">Go to</span>' +
      rows;
  }

  function isMoreOpen() {
    var panel = sheet();
    return !!panel && panel.classList.contains('is-open');
  }

  function openMore() {
    buildSheet();
    /* Rebuilt every time it opens: the admin link can appear mid-session when a
       role loads, and the active row moves as you navigate. */
    fillSheet();

    var panel = sheet();
    var back = scrim();
    if (!panel || !back) return;

    panel.classList.add('is-open');
    back.classList.add('is-open');

    var btn = document.getElementById('m-tab-more');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function closeMore() {
    var panel = sheet();
    var back = scrim();
    if (panel) {
      panel.classList.remove('is-open', 'is-dragging');
      panel.style.transform = '';
    }
    if (back) back.classList.remove('is-open');

    var btn = document.getElementById('m-tab-more');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleMore() {
    isMoreOpen() ? closeMore() : openMore();
  }

  function removeSheet() {
    var panel = sheet();
    var back = scrim();
    if (panel) panel.remove();
    if (back) back.remove();
  }

  /**
   * Drag the sheet down to dismiss it.
   *
   * The gesture both platforms use, and the reason the grab handle is drawn.
   * Only downward drags that start with the sheet already scrolled to its top
   * count — otherwise a flick to see the last row would throw the sheet off the
   * screen instead of scrolling it.
   */
  function enableSwipeDismiss(panel) {
    var startY = 0;
    var delta = 0;
    var dragging = false;

    panel.addEventListener('touchstart', function (event) {
      if (panel.scrollTop > 0) return;
      startY = event.touches[0].clientY;
      delta = 0;
      dragging = true;
      panel.classList.add('is-dragging');
    }, { passive: true });

    panel.addEventListener('touchmove', function (event) {
      if (!dragging) return;
      delta = event.touches[0].clientY - startY;

      /* Upward drag is a scroll, not a dismiss. Hand it back. */
      if (delta < 0) {
        dragging = false;
        panel.classList.remove('is-dragging');
        panel.style.transform = '';
        return;
      }

      panel.style.transform = 'translateY(' + delta + 'px)';
    }, { passive: true });

    panel.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-dragging');
      panel.style.transform = '';

      /* ~90px, about a thumb's length of travel: far enough that a stray
         movement during a tap cannot reach it. */
      if (delta > 90) closeMore();
    }, { passive: true });
  }

  /* ---------------------------------------------------------------------
     The keyboard

     A fixed bottom bar and a software keyboard want the same 60px.

     Android resizes the visual viewport when the keyboard opens, so the bar
     ends up floating above it — 60px of chrome between the field and the keys.
     iOS does not resize the layout viewport at all: the bar stays pinned to a
     bottom that is now underneath the keyboard, and on a short screen the
     focused field goes with it.

     visualViewport reports the real visible area on both, so one measurement
     covers them. Below that, focus/blur is the fallback for iOS versions
     without the API.
     --------------------------------------------------------------------- */

  function keyboardOpen(open) {
    document.body.classList.toggle('m-keyboard-open', !!open);
  }

  function watchKeyboard() {
    var vv = window.visualViewport;

    if (vv) {
      var onResize = function () {
        /* The gap between the layout viewport and what is actually visible. A
           retracting URL bar accounts for ~100px on Android; a keyboard is
           never less than about 200px, so the threshold separates them without
           needing to know which browser this is. */
        var hidden = window.innerHeight - vv.height;
        keyboardOpen(isPhone() && hidden > 200);
      };

      vv.addEventListener('resize', onResize);
      return;
    }

    /* No visualViewport: assume any focused text field means a keyboard. */
    document.addEventListener('focusin', function (event) {
      if (!isPhone()) return;
      var target = event.target;
      if (!target || typeof target.matches !== 'function') return;
      if (target.matches('input:not([type=checkbox]):not([type=radio]), textarea')) {
        keyboardOpen(true);
      }
    });

    document.addEventListener('focusout', function () {
      keyboardOpen(false);
    });
  }

  /* ---------------------------------------------------------------------
     Keyboard types

     Both platforms pick a keyboard from the field's type and inputmode. Left
     unset, every field gets the full QWERTY — so entering a student number
     means tapping through to the numeric page, and an email field offers
     autocapitalisation and no "@".

     Applied by name/id/placeholder rather than in the markup because these
     fields are spread across index.html and several scripts that build forms
     at runtime; one pass over the document catches all of them, and re-running
     it catches the ones added later.

     `inputmode` only — never `type`. Both attributes choose the keyboard, but
     `type` also turns on constraint validation, and guessing wrong there stops
     a form from submitting at all. A Drive link pasted without its scheme is
     valid input to this portal and invalid to `type="url"`; a sign-in field
     that accepts either an email or a student number is invalid to
     `type="email"`. `inputmode` changes the keys and nothing else, so a wrong
     guess costs a keyboard switch instead of a blocked submission.
     --------------------------------------------------------------------- */

  var FIELD_HINTS = [
    { match: /mail/i, mode: 'email', autocomplete: 'email', flat: true },
    { match: /phone|mobile|contact|cp[-_ ]?(no|num)/i, mode: 'tel', autocomplete: 'tel', flat: true },
    { match: /url|link|website/i, mode: 'url', flat: true },
    { match: /user(name)?|handle/i, autocomplete: 'username', flat: true },
    { match: /student[-_ ]?(no|number|id)|\byear\b|section|room|\bcode\b|amount|count|quantity/i, mode: 'numeric', flat: true },
    { match: /search|filter|query/i, mode: 'search' }
  ];

  function hintFields(root) {
    var scope = root || document;
    var fields = scope.querySelectorAll('input:not([data-m-hinted])');

    Array.prototype.forEach.call(fields, function (field) {
      field.setAttribute('data-m-hinted', '');

      /* A field whose type already carries meaning has its keyboard chosen —
         email, tel, number, date and password all map to one, and a password
         field must keep its own or the strip above it starts suggesting
         dictionary words for a password. */
      var type = (field.getAttribute('type') || 'text').toLowerCase();
      if (type !== 'text' && type !== 'search' && type !== '') return;

      var name = [
        field.getAttribute('name') || '',
        field.id || '',
        field.getAttribute('placeholder') || ''
      ].join(' ');

      for (var i = 0; i < FIELD_HINTS.length; i += 1) {
        var hint = FIELD_HINTS[i];
        if (!hint.match.test(name)) continue;

        if (hint.mode && !field.getAttribute('inputmode')) {
          field.setAttribute('inputmode', hint.mode);
        }
        if (hint.autocomplete && !field.getAttribute('autocomplete')) {
          field.setAttribute('autocomplete', hint.autocomplete);
        }

        /* iOS capitalises the first letter of every text field and autocorrects
           what it does not recognise. Right for a sentence, wrong for an email,
           a username or a student number — and on a phone the correction is
           easy to send without noticing. */
        if (hint.flat) {
          if (!field.getAttribute('autocapitalize')) field.setAttribute('autocapitalize', 'off');
          if (!field.getAttribute('autocorrect')) field.setAttribute('autocorrect', 'off');
          field.setAttribute('spellcheck', 'false');
        }
        break;
      }
    });
  }

  /* ---------------------------------------------------------------------
     Wiring
     --------------------------------------------------------------------- */

  function sync() {
    if (isPhone()) {
      buildBar();
    } else {
      closeMore();
      removeBar();
      removeSheet();
      keyboardOpen(false);
    }
  }

  function init() {
    /* login.html has no panels and no sidebar; the field hints still apply
       there, the shell does not. */
    var isPortal = !!document.querySelector('.sidebar-nav');

    hintFields();

    if (!isPortal) return;

    sync();
    watchKeyboard();

    /*
     * Anything tapped outside the sheet closes it — including a tab, which
     * navigates and would otherwise leave the sheet sitting over the page it
     * just opened.
     *
     * On `window`, in the capture phase, and that is not a style choice. The
     * global fallback handler in scripts.js is itself a capture listener on
     * `document`, and it calls `stopPropagation()` on every `[data-page]`
     * click it routes. `document` capture runs before the target, so a bubble
     * listener here — or any listener on the bar or the button — never sees a
     * tab tap at all. `window` capture is the one phase that runs first.
     */
    window.addEventListener('click', function (event) {
      if (!isMoreOpen()) return;
      /* A click can land on a non-element node, and `closest` is not defined
         there — an uncaught throw here would leave the sheet stuck open. */
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('.m-more-sheet')) return;
      if (target.closest('#m-tab-more')) return;
      closeMore();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMore();
    });

    /*
     * Keep the tabs in step with panels changed from anywhere else — a
     * dashboard card, a calendar event, the drawer. setActiveNav covers the
     * tabs already because they carry `.priority-nav-item`, so this is only the
     * backstop for panel switches that bypass it. Watching `class` on the
     * panels is cheaper than polling and fires exactly when one is revealed.
     */
    var panels = document.querySelectorAll('.page-panel[data-page]');
    if (panels.length && window.MutationObserver) {
      var pending = false;
      var observer = new MutationObserver(function () {
        /* A single showPage call toggles `hidden` on every panel, so a naive
           handler would run a dozen times per navigation. */
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          pending = false;
          syncActive();
          hintFields();
        });
      });

      Array.prototype.forEach.call(panels, function (panel) {
        observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
      });
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(sync, 150);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
