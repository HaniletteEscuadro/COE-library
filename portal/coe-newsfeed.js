/**
 * COE Studio — home newsfeed.
 *
 * The top of the Home tab. An auto-advancing carousel of the newest
 * announcements, so a student who opens the portal sees what is happening
 * before they see anything else.
 *
 * WHERE THE CONTENT COMES FROM
 * ----------------------------
 * Nowhere new. It is the same `announcements` array the Announcement Board
 * already draws, handed over by `renderAnnouncements()` in scripts.js. Post an
 * event on the board and it is in the newsfeed; delete it there and it is gone
 * here. There is deliberately no second place to publish — a feed with its own
 * store is a feed that goes stale the first week nobody remembers to update it.
 *
 * WHERE A SLIDE GOES WHEN YOU CLICK IT
 * ------------------------------------
 * The first URL written anywhere in the notice's summary or details. Paste the
 * Facebook event, the registration form, the Drive folder into the text and the
 * slide becomes a link to it.
 *
 * That is why the link is read out of the body rather than stored in its own
 * column: the board's `relatedPage` field never survives the server round trip
 * (`coe-board.js` posts the notice without it and hard-codes 'announcements'
 * coming back), so a link kept there would work until the page was refreshed
 * and then quietly stop. The body is the one part of a notice that is
 * guaranteed to come back exactly as it was typed.
 *
 * A notice with no URL in it is still a valid slide — it just opens the
 * Announcement Board instead, which is where the full text lives.
 *
 * TWO KINDS OF SLIDE, ON PURPOSE
 * ------------------------------
 * A slide with a link is a real `<a href>`; a slide without one is a
 * `<button data-page="announcements">`. Neither needs a click handler from this
 * file. The anchor is just an anchor, and scripts.js already has a global
 * listener that navigates anything carrying `data-page`. Middle-click and
 * "copy link address" therefore work on the slides that point somewhere, which
 * they would not if every slide were a div with an onclick.
 *
 * WHEN IT STOPS MOVING
 * --------------------
 * Motion that cannot be stopped is a barrier, not a feature. The rotation
 * pauses on hover, on keyboard focus, while a finger is down, when the browser
 * tab is in the background, and whenever the carousel is scrolled off screen.
 * It never starts at all for a visitor who has asked for reduced motion, or
 * when there is only one notice to show — the arrows and dots still work in
 * both cases, so nothing becomes unreachable.
 */

(function (global) {
    'use strict';

    const doc = global.document;

    /** How long one slide holds before the next one comes in. */
    const SLIDE_MS = 6500;

    /**
     * Slides shown at most.
     *
     * The feed is a headline, not the board. Past six the dots turn into a row
     * of specks nobody can aim at, and the seventh-newest notice is not news.
     */
    const MAX_SLIDES = 6;

    /** Pixels of horizontal drag before a swipe counts as a swipe. */
    const SWIPE_THRESHOLD = 45;

    /**
     * Announcements carry a free-text tag. Each known one gets its own face so
     * consecutive slides do not look like the same slide twice — this is the
     * whole visual difference between "a feed" and "a text box that changes".
     */
    const LOOKS = {
        emergency: { icon: 'warning', label: 'Emergency' },
        urgent: { icon: 'priority_high', label: 'Urgent' },
        exam: { icon: 'edit_note', label: 'Exam' },
        event: { icon: 'event_available', label: 'Event' },
        academic: { icon: 'school', label: 'Academic' },
        org: { icon: 'diversity_3', label: 'Organization' },
        general: { icon: 'campaign', label: 'Announcement' }
    };

    let items = [];
    let index = 0;
    let timer = null;
    let paused = false;
    let offscreen = false;
    let root = null;
    let track = null;
    let dotsHost = null;
    let liveNote = null;

    function reducedMotion() {
        try {
            return global.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (error) {
            return false;
        }
    }

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function lookFor(tag) {
        return LOOKS[String(tag || '').trim().toLowerCase()] || LOOKS.general;
    }

    function toneFor(tag) {
        const key = String(tag || '').trim().toLowerCase();
        return LOOKS[key] ? key : 'general';
    }

    /**
     * The first link in the notice.
     *
     * Only http(s) is accepted. Any other scheme in a field students can type
     * into is either a mistake or an attack — `javascript:` here would run on
     * click, and the notice body is written by org officers, not just admins.
     * The URL is parsed rather than pattern-matched so a malformed one is
     * dropped instead of being pasted into an href.
     */
    function linkIn(item) {
        const text = [item && item.summary, item && item.details]
            .filter(Boolean)
            .join(' ');
        const matches = String(text).match(/https?:\/\/[^\s<>"')\]]+/gi);
        if (!matches) return '';

        for (const candidate of matches) {
            // Trailing punctuation is almost always the sentence, not the URL.
            const cleaned = candidate.replace(/[.,;:!?]+$/, '');
            try {
                const url = new URL(cleaned);
                if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
            } catch (error) {
                /* not a URL after all; try the next match */
            }
        }
        return '';
    }

    function hostOf(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch (error) {
            return 'link';
        }
    }

    /** "Today", "Tomorrow", "In 4 days", or a plain date once it is far off. */
    function whenLabel(item) {
        const raw = (item && (item.eventDate || item.postedAt)) || '';
        const date = new Date(String(raw) + 'T00:00:00');
        if (Number.isNaN(date.getTime())) return '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Math.round((date - today) / 86400000);

        if (days === 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        if (days > 1 && days <= 14) return 'In ' + days + ' days';
        if (days === -1) return 'Yesterday';

        return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }

    /**
     * One line of body text for the slide.
     *
     * The board's `summary` is the intended one-liner, but notices posted
     * through the server come back with summary and details both derived from a
     * single `body`, so the first line is the fallback. The URL is stripped out:
     * the whole slide is already the link, and a raw https:// in the middle of a
     * sentence reads as clutter.
     */
    function blurbFor(item, link) {
        let text = String((item && item.summary) || (item && item.details) || '').trim();
        if (link) {
            text = text.split(link).join(' ').replace(/\s{2,}/g, ' ').trim();
            // "Register before Friday:" — the colon was introducing the URL that
            // has just been taken out, so it is now pointing at nothing.
            text = text.replace(/[\s:;,\-–—]+$/, '');
        }
        if (text.length > 180) text = text.slice(0, 177).trimEnd() + '…';
        return text;
    }

    function slideHtml(item, position, total) {
        const link = linkIn(item);
        const look = lookFor(item.tag);
        const tone = toneFor(item.tag);
        const blurb = blurbFor(item, link);
        const when = whenLabel(item);

        const inner = '' +
            '<span class="nf-slide-glow" aria-hidden="true"></span>' +
            '<span class="nf-slide-mark" aria-hidden="true"><span class="material-icons">' + look.icon + '</span></span>' +
            '<span class="nf-slide-body">' +
                '<span class="nf-slide-tags">' +
                    '<span class="nf-chip">' + escapeHtml(look.label) + '</span>' +
                    (item.course ? '<span class="nf-chip is-quiet">' + escapeHtml(item.course) + '</span>' : '') +
                    (when ? '<span class="nf-chip is-quiet">' + escapeHtml(when) + '</span>' : '') +
                '</span>' +
                '<strong class="nf-slide-title">' + escapeHtml(item.title) + '</strong>' +
                (blurb ? '<span class="nf-slide-text">' + escapeHtml(blurb) + '</span>' : '') +
                '<span class="nf-slide-cta">' +
                    '<span class="material-icons" aria-hidden="true">' + (link ? 'open_in_new' : 'east') + '</span>' +
                    (link ? 'Open ' + escapeHtml(hostOf(link)) : 'Read on the board') +
                '</span>' +
            '</span>';

        // aria-label carries the position because the visible "2 / 5" is in the
        // dots, which a screen reader user is not looking at.
        const shared = 'class="nf-slide tone-' + tone + '" ' +
            'role="group" aria-roledescription="slide" ' +
            'aria-label="' + escapeHtml(item.title) + ' — ' + position + ' of ' + total + '"';

        if (link) {
            // rel is not optional: target="_blank" without noopener hands the
            // opened page a live handle on this one.
            return '<a ' + shared + ' href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
        }

        return '<button type="button" ' + shared + ' data-page="announcements">' + inner + '</button>';
    }

    function dotsHtml(total) {
        let html = '';
        for (let i = 0; i < total; i += 1) {
            html += '<button type="button" class="nf-dot' + (i === index ? ' is-on' : '') +
                '" data-nf-go="' + i + '" aria-label="Show item ' + (i + 1) + ' of ' + total + '"' +
                (i === index ? ' aria-current="true"' : '') + '></button>';
        }
        return html;
    }

    /**
     * Move the track and update everything that depends on which slide is up.
     *
     * `tabindex="-1"` on the off-screen slides is the part that is easy to
     * miss: without it every hidden slide stays in the tab order, so tabbing
     * past the carousel means tabbing through six invisible links while the
     * page scrolls sideways chasing focus.
     */
    function paint() {
        if (!track) return;

        const slides = track.children;
        track.style.transform = 'translate3d(-' + (index * 100) + '%, 0, 0)';

        for (let i = 0; i < slides.length; i += 1) {
            const on = i === index;
            slides[i].classList.toggle('is-current', on);
            slides[i].setAttribute('aria-hidden', on ? 'false' : 'true');
            slides[i].tabIndex = on ? 0 : -1;
        }

        if (dotsHost) {
            const dots = dotsHost.children;
            for (let i = 0; i < dots.length; i += 1) {
                const on = i === index;
                dots[i].classList.toggle('is-on', on);
                if (on) dots[i].setAttribute('aria-current', 'true');
                else dots[i].removeAttribute('aria-current');
            }
        }

        if (liveNote) liveNote.textContent = 'Item ' + (index + 1) + ' of ' + items.length;
        restartProgress();
    }

    /**
     * Re-run the timing bar from zero.
     *
     * The bar is a CSS animation, and re-adding a class does not replay one —
     * the browser sees the same animation still applied. Forcing a reflow
     * between the removal and the re-add is what makes it start over.
     */
    function restartProgress() {
        if (!root) return;
        const bar = root.querySelector('.nf-progress span');
        if (!bar) return;

        bar.classList.remove('is-running');
        void bar.offsetWidth;
        if (timer && !paused && !offscreen) bar.classList.add('is-running');
    }

    function go(next, viaUser) {
        if (!items.length) return;
        const total = items.length;
        index = ((next % total) + total) % total;
        paint();
        if (viaUser) restart();
    }

    function stop() {
        if (timer) {
            global.clearInterval(timer);
            timer = null;
        }
    }

    function start() {
        stop();
        if (items.length < 2 || reducedMotion()) {
            restartProgress();
            return;
        }
        timer = global.setInterval(function () {
            if (!paused && !offscreen) go(index + 1, false);
        }, SLIDE_MS);
        restartProgress();
    }

    /** Used after a manual move, so the new slide gets a full turn on screen. */
    function restart() {
        if (timer) start();
    }

    function bindOnce() {
        if (!root || root.dataset.nfBound === 'true') return;
        root.dataset.nfBound = 'true';

        root.addEventListener('click', function (event) {
            const dot = event.target.closest('[data-nf-go]');
            if (dot) {
                go(Number(dot.dataset.nfGo), true);
                return;
            }
            const step = event.target.closest('[data-nf-step]');
            if (step) go(index + Number(step.dataset.nfStep), true);
        });

        // Hover and focus only pause; they never advance or reset. A student
        // reading a slide should be able to finish the sentence.
        root.addEventListener('mouseenter', function () { paused = true; restartProgress(); });
        root.addEventListener('mouseleave', function () { paused = false; restartProgress(); });
        root.addEventListener('focusin', function () { paused = true; restartProgress(); });
        root.addEventListener('focusout', function () {
            if (!root.contains(doc.activeElement)) { paused = false; restartProgress(); }
        });

        root.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1, true); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1, true); }
        });

        bindSwipe();

        doc.addEventListener('visibilitychange', function () {
            offscreen = doc.hidden;
            restartProgress();
        });

        // Scrolled past, or the Home tab is hidden behind another page: no
        // reason to keep rotating, and on a phone it is battery for nothing.
        if (typeof global.IntersectionObserver === 'function') {
            new global.IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    offscreen = !entry.isIntersecting;
                    restartProgress();
                });
            }, { threshold: 0.2 }).observe(root);
        }
    }

    /**
     * Drag to change slide.
     *
     * Pointer events rather than touch events so a mouse drag and a trackpad
     * swipe behave the same as a finger. The horizontal test matters: without
     * it, a vertical scroll that starts on the carousel is read as a swipe and
     * the page fights the thumb.
     */
    function bindSwipe() {
        let startX = 0;
        let startY = 0;
        let dragging = false;

        root.addEventListener('pointerdown', function (event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            dragging = true;
            startX = event.clientX;
            startY = event.clientY;
            paused = true;
            restartProgress();
        });

        root.addEventListener('pointerup', function (event) {
            if (!dragging) return;
            dragging = false;
            paused = false;

            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
                // A drag is not a click. Without this the slide's own link
                // opens the moment the finger lifts at the end of a swipe.
                event.preventDefault();
                go(index + (dx < 0 ? 1 : -1), true);
            } else {
                restartProgress();
            }
        });

        root.addEventListener('pointercancel', function () {
            dragging = false;
            paused = false;
            restartProgress();
        });
    }

    function render() {
        root = doc.getElementById('coe-newsfeed');
        if (!root) return;

        track = root.querySelector('.nf-track');
        dotsHost = root.querySelector('.nf-dots');
        liveNote = root.querySelector('.nf-live');

        if (!items.length) {
            // Hidden rather than shown empty. An "" placeholder at the very top
            // of the home page is worse than no section at all — it is the
            // first thing every student sees, every day, saying nothing.
            root.hidden = true;
            stop();
            return;
        }

        root.hidden = false;
        if (index >= items.length) index = 0;

        track.innerHTML = items.map(function (item, i) {
            return slideHtml(item, i + 1, items.length);
        }).join('');

        if (dotsHost) dotsHost.innerHTML = dotsHtml(items.length);
        root.classList.toggle('is-single', items.length < 2);

        bindOnce();
        paint();
        start();
    }

    /**
     * Hand the feed the board's announcements.
     *
     * Pinned first, then newest — the same order the board itself uses, so the
     * top of Home and the top of Announcements never disagree about what the
     * most important notice is.
     */
    function setItems(list) {
        items = (Array.isArray(list) ? list : [])
            .filter(function (item) { return item && item.title; })
            .slice()
            .sort(function (left, right) {
                const pin = (right.pinned ? 1 : 0) - (left.pinned ? 1 : 0);
                if (pin) return pin;
                return new Date(right.postedAt || 0) - new Date(left.postedAt || 0);
            })
            .slice(0, MAX_SLIDES);

        render();
    }

    global.CoeNewsfeed = {
        setItems: setItems,
        next: function () { go(index + 1, true); },
        prev: function () { go(index - 1, true); }
    };
}(window));
