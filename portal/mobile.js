/**
 * Mobile navigation drawer.
 *
 * On phones the 280px sidebar is overlaid off-canvas instead of taking a
 * column, so it needs a control to open it and the usual ways to close it.
 * Everything here is inert above 900px — the desktop layout is untouched.
 *
 * Self-contained on purpose: it only reads the DOM and toggles classes, so it
 * cannot interfere with scripts.js or the page's own state.
 */
(function () {
  'use strict';

  var BREAKPOINT = 900;
  var sidebar = null;
  var bar = null;

  function isMobile() {
    return window.innerWidth <= BREAKPOINT;
  }

  function isOpen() {
    return document.body.classList.contains('nav-open');
  }

  function open() {
    if (!sidebar) return;
    sidebar.classList.add('is-open');
    document.body.classList.add('nav-open');
    // Stop the page behind the drawer from scrolling with it.
    document.body.style.overflow = 'hidden';
    var btn = document.getElementById('m-nav-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function close() {
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    document.body.style.overflow = '';
    var btn = document.getElementById('m-nav-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    isOpen() ? close() : open();
  }

  /*
   * The account menu.
   *
   * styles.css hides `.nav-right` below 700px, and the profile dropdown — the
   * only place with Sign Out — lives inside it. On a phone that left no way to
   * see who you were signed in as or to sign out at all, short of finding the
   * Settings page. So the bar carries its own.
   *
   * Each item forwards a click to the anchor that already exists in the hidden
   * dropdown rather than repeating what it does. The dropdown's own handler is
   * bound to that element and a programmatic click still bubbles to it, so
   * signing out here runs exactly the same code as signing out on a desktop —
   * including revoking the session server-side. Nothing to keep in step later.
   */
  /*
   * Single quotes inside the selectors on purpose.
   *
   * These are written into a double-quoted HTML attribute below. With double
   * quotes inside, `data-find="a[data-action="view-profile"]"` closes the
   * attribute at the second quote, the selector arrives truncated, and
   * querySelector throws a DOMException — so the row does nothing at all when
   * tapped. Single quotes are equally valid CSS and survive the round trip.
   */
  var ACCOUNT_ITEMS = [
    { icon: 'person', label: 'View Profile', find: "a[data-action='view-profile']" },
    { icon: 'photo_camera', label: 'Change Picture', find: "a[data-action='change-picture']" },
    { icon: 'settings', label: 'Settings', find: ".profile-dropdown-menu a[data-page='settings']" },
    { icon: 'logout', label: 'Sign Out', find: '#dropdown-logout-btn', danger: true }
  ];

  function accountSheet() {
    return document.querySelector('.m-account-sheet');
  }

  function closeAccount() {
    var sheet = accountSheet();
    if (sheet) sheet.classList.remove('is-open');
    var btn = document.getElementById('m-account-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleAccount() {
    var sheet = accountSheet();
    if (!sheet) return;

    var willOpen = !sheet.classList.contains('is-open');
    // Never both at once — the drawer covers the sheet.
    if (willOpen) close();

    sheet.classList.toggle('is-open', willOpen);
    var btn = document.getElementById('m-account-toggle');
    if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  /** Whatever the header knows about the signed-in account. */
  function accountName() {
    var el = document.getElementById('top-account-name');
    var name = el ? el.textContent.trim() : '';
    return name || 'My account';
  }

  function accountRole() {
    var el = document.getElementById('top-account-role');
    return el ? el.textContent.trim() : '';
  }

  function buildAccountSheet() {
    if (accountSheet()) return;

    var sheet = document.createElement('div');
    sheet.className = 'm-account-sheet';
    sheet.setAttribute('role', 'menu');
    sheet.id = 'm-account-sheet';

    var head =
      '<div class="m-account-who">' +
        '<strong class="m-account-name"></strong>' +
        '<span class="m-account-role"></span>' +
      '</div>';

    var items = ACCOUNT_ITEMS.map(function (item) {
      return '<button type="button" role="menuitem" class="m-account-item' +
        (item.danger ? ' is-danger' : '') + '" data-find="' + item.find + '">' +
        '<span class="material-icons">' + item.icon + '</span>' + item.label +
        '</button>';
    }).join('');

    sheet.innerHTML = head + items;
    document.body.appendChild(sheet);

    sheet.addEventListener('click', function (event) {
      var button = event.target.closest('.m-account-item');
      if (!button) return;

      closeAccount();

      var target = null;
      try {
        target = document.querySelector(button.getAttribute('data-find'));
      } catch (error) {
        // A bad selector throws rather than returning null, and an uncaught
        // throw here would take the fallback below with it.
        console.warn('[mobile] account item selector failed', error);
      }

      if (target) {
        target.click();
        return;
      }

      // The dropdown is part of index.html, so this should not happen — but a
      // Sign Out button that silently does nothing is the worst outcome here,
      // so fall back to the settings page's own button, then to the login page.
      if (button.classList.contains('is-danger')) {
        var settingsBtn = document.getElementById('logout-current-btn');
        if (settingsBtn) settingsBtn.click();
        else window.location.href = 'login.html';
      }
    });
  }

  function refreshAccount() {
    var sheet = accountSheet();
    if (!sheet) return;

    var name = sheet.querySelector('.m-account-name');
    var role = sheet.querySelector('.m-account-role');
    if (name) name.textContent = accountName();
    if (role) role.textContent = accountRole();

    var initial = document.querySelector('.m-account-initial');
    if (initial) initial.textContent = accountName().charAt(0).toUpperCase() || '?';
  }

  /** Build the fixed top bar. Only exists on mobile. */
  function buildBar() {
    if (document.querySelector('.m-bar')) return;

    bar = document.createElement('div');
    bar.className = 'm-bar';
    bar.innerHTML =
      '<button type="button" class="m-bar-btn" id="m-nav-toggle" ' +
      'aria-label="Open navigation" aria-expanded="false" aria-controls="coe-sidebar">' +
      '<span class="material-icons">menu</span></button>' +
      '<span class="m-bar-title">COE Studio</span>' +
      '<button type="button" class="m-bar-btn m-bar-account" id="m-account-toggle" ' +
      'aria-label="Your account" aria-expanded="false" aria-controls="m-account-sheet">' +
      '<span class="m-account-initial">?</span></button>';

    document.body.insertBefore(bar, document.body.firstChild);
    document.getElementById('m-nav-toggle').addEventListener('click', toggle);

    buildAccountSheet();
    document.getElementById('m-account-toggle').addEventListener('click', function (event) {
      event.stopPropagation();
      refreshAccount();
      toggleAccount();
    });

    // The name arrives from the session a moment after the page does.
    refreshAccount();
    setTimeout(refreshAccount, 1200);
  }

  function removeBar() {
    var existing = document.querySelector('.m-bar');
    if (existing) existing.remove();

    // The sheet is a sibling of the bar, not a child — remove it too, or a
    // window widened past the breakpoint keeps a stray menu on the desktop
    // layout where the real dropdown has come back.
    var sheet = accountSheet();
    if (sheet) sheet.remove();

    bar = null;
  }

  function sync() {
    if (isMobile()) {
      buildBar();
    } else {
      // Leaving mobile must not strand the page in the open state.
      close();
      removeBar();
    }
  }

  function init() {
    sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    if (!sidebar.id) sidebar.id = 'coe-sidebar';

    sync();

    // Tapping the scrim closes. The scrim is body::after, so the click lands
    // on <body> itself — only count it when the drawer is actually open and
    // the tap did not originate inside the drawer.
    document.addEventListener('click', function (event) {
      // The account sheet closes on any tap outside itself, whether or not the
      // drawer is open — so it is dismissed the same way everything else is.
      var sheet = accountSheet();
      if (sheet && sheet.classList.contains('is-open') &&
          !sheet.contains(event.target) &&
          !event.target.closest('#m-account-toggle')) {
        closeAccount();
      }

      if (!isOpen() || !isMobile()) return;
      if (sidebar.contains(event.target)) return;
      if (bar && bar.contains(event.target)) return;
      close();
    });

    // Following a nav link should reveal the page it opened.
    sidebar.addEventListener('click', function (event) {
      if (!isMobile()) return;
      if (event.target.closest('a, button[data-page]')) close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (isOpen()) close();
      closeAccount();
    });

    // Swipe left to dismiss.
    var startX = 0;
    var startY = 0;

    sidebar.addEventListener('touchstart', function (event) {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    }, { passive: true });

    sidebar.addEventListener('touchend', function (event) {
      if (!isOpen()) return;
      var dx = event.changedTouches[0].clientX - startX;
      var dy = event.changedTouches[0].clientY - startY;
      // Horizontal intent only, so it does not fight vertical scrolling.
      if (dx < -60 && Math.abs(dx) > Math.abs(dy)) close();
    }, { passive: true });

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
