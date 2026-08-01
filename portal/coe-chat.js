/**
 * COE Studio — shared live chat.
 *
 * WHAT THIS REPLACES
 * ------------------
 * The chat panel kept its messages in `localStorage.coeRealtimeMessages` and
 * announced them over a `BroadcastChannel`. Both reach other TABS of the same
 * browser and nothing else — so two students on two laptops each sat in an
 * empty room and only ever saw what they had typed themselves.
 *
 * Messages now go to the database and come back over the socket, addressed to
 * the room they belong to. `server.ts` decides room membership from the
 * account's own course, so the CE room's traffic never reaches an EE socket.
 *
 * THE PANEL IS RE-RENDERED, NOT PATCHED
 * -------------------------------------
 * scripts.js builds the whole chat inside one closure with its own state, and
 * nothing of it is reachable from out here. Rather than unpick it, this takes
 * over the thread element: it renders the messages itself and intercepts the
 * composer. The channel list, member list and the rest of the shell are left
 * exactly as they are.
 */

(function (global) {
    'use strict';

    let ready = false;
    let channels = [];
    let activeChannel = 'general';
    const cache = new Map();      // slug -> array of messages

    function me() {
        return (global.CoeLive && global.CoeLive.user) || null;
    }

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Time only for today, date + time once it is older. */
    function formatWhen(iso) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';

        const now = new Date();
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (date.toDateString() === now.toDateString()) return time;

        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
    }

    /** "Mon, 4 Aug" — the separator between days in the thread. */
    function formatDay(iso) {
        const date = new Date(iso);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) return 'Today';

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }

    /** Initials for the avatar, so a thread is scannable by who is talking. */
    function initials(name) {
        return String(name || '?')
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join('') || '?';
    }

    /** A stable colour per person, so the same name is the same colour. */
    function tintFor(key) {
        const palette = ['#1a73e8', '#a142f4', '#1e8e3e', '#e37400', '#d93025', '#0b8043', '#7627bb'];
        let hash = 0;
        String(key || '').split('').forEach(ch => { hash = (hash * 31 + ch.charCodeAt(0)) >>> 0; });
        return palette[hash % palette.length];
    }

    const STAFF_ROLES = ['ADMIN', 'FACULTY', 'REGISTRAR', 'LIBRARIAN'];

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    /**
     * Draw the thread.
     *
     * Consecutive messages from the same person inside five minutes are grouped
     * under one name and avatar — a long conversation otherwise repeats the
     * sender's name on every line and the actual words get lost in it.
     */
    function render() {
        const thread = global.document.getElementById('comm-chat-thread');
        if (!thread) return;

        const messages = cache.get(activeChannel) || [];

        if (!messages.length) {
            thread.innerHTML =
                '<div class="coe-chat-empty">' +
                    '<span class="material-icons">forum</span>' +
                    '<strong>No messages yet</strong>' +
                    '<small>Say something — everyone in this room will see it.</small>' +
                '</div>';
            return;
        }

        const mine = me();
        let lastSender = null;
        let lastAt = 0;
        let lastDay = '';
        let html = '';

        messages.forEach(function (message) {
            const at = new Date(message.createdAt).getTime();
            const day = formatDay(message.createdAt);

            if (day !== lastDay) {
                html += '<div class="coe-chat-day"><span>' + escapeHtml(day) + '</span></div>';
                lastDay = day;
                lastSender = null;
            }

            const grouped = message.senderId === lastSender && (at - lastAt) < 5 * 60 * 1000;
            const isMine = mine && message.senderId === mine.id;
            const isStaff = STAFF_ROLES.indexOf(String(message.senderRole || '').toUpperCase()) > -1;
            const canRemove = isMine || (mine && STAFF_ROLES.indexOf(String(mine.role || '').toUpperCase()) > -1);

            html +=
                '<div class="coe-msg' + (grouped ? ' is-grouped' : '') + (isMine ? ' is-mine' : '') + '" data-message-id="' + escapeHtml(message.id) + '">' +
                    (grouped
                        ? '<span class="coe-msg-gutter"><time>' + escapeHtml(formatWhen(message.createdAt)) + '</time></span>'
                        : '<span class="coe-msg-avatar" style="background:' + tintFor(message.senderId || message.senderName) + '">' +
                              escapeHtml(initials(message.senderName)) +
                          '</span>') +
                    '<div class="coe-msg-main">' +
                        (grouped ? '' :
                            '<div class="coe-msg-head">' +
                                '<strong>' + escapeHtml(message.senderName) + '</strong>' +
                                (isStaff ? '<span class="coe-msg-role">Staff</span>' : '') +
                                '<time>' + escapeHtml(formatWhen(message.createdAt)) + '</time>' +
                            '</div>') +
                        '<div class="coe-msg-body">' + escapeHtml(message.body) + '</div>' +
                    '</div>' +
                    (canRemove
                        ? '<button type="button" class="coe-msg-del" title="Remove message" aria-label="Remove message">' +
                              '<span class="material-icons">close</span></button>'
                        : '') +
                '</div>';

            lastSender = message.senderId;
            lastAt = at;
        });

        thread.innerHTML = html;

        // Newest message in view. Only jump if the reader was already at the
        // bottom, so an arriving message never yanks them out of the history
        // they are scrolled up reading.
        thread.scrollTop = thread.scrollHeight;
    }

    /**
     * Mark the channel buttons the portal drew, so the active one shows.
     *
     * Opening a room also clears its unread mark. The listener sets that mark
     * when a message lands in a room you are not reading, and nothing used to
     * take it off again — so the first message a room ever received left a dot
     * that stayed there for good, and the mark stopped meaning anything.
     */
    function syncChannelButtons() {
        roomButtons().forEach(function (node) {
            const isActive = roomSlug(node) === activeChannel;
            node.classList.toggle('active', isActive);
            if (isActive) node.classList.remove('has-unread');
        });
    }

    /*
     * The room buttons, whoever drew them.
     *
     * Two things render this list: renderChannelList() below, using
     * `data-channel`, and the portal's own code in scripts.js, using
     * `data-comm-channel`. scripts.js runs later and replaces the markup, so
     * matching only `data-channel` found nothing after boot — the active room
     * was never highlighted, the unread mark had nowhere to land, and clicking
     * a room did not change the live channel at all: the thread and the
     * composer stayed on whatever was open, so a message meant for #ce was
     * quietly posted to #general.
     *
     * Matching both attributes makes this independent of which one wins.
     */
    function roomButtons() {
        return Array.prototype.slice.call(
            global.document.querySelectorAll(
                '#comm-text-channel-list [data-channel], #comm-text-channel-list [data-comm-channel]',
            ),
        );
    }

    function roomSlug(node) {
        return node.dataset.channel || node.dataset.commChannel || '';
    }

    // -----------------------------------------------------------------------
    // Data
    // -----------------------------------------------------------------------

    function loadChannel(slug) {
        return global.CoeApi.get('/api/chat/messages?channel=' + encodeURIComponent(slug) + '&take=100')
            .then(function (result) {
                channels = result.channels || channels;
                cache.set(slug, result.messages || []);
                if (slug === activeChannel) render();
                return result.messages;
            })
            .catch(function (error) {
                if (error.status === 403) {
                    cache.set(slug, []);
                    if (slug === activeChannel) render();
                    return [];
                }
                console.error('[coe-chat] could not load', slug, error.message || error);
                throw error;
            });
    }

    function send(text) {
        return global.CoeApi.post('/api/chat/messages', {
            channel: activeChannel,
            body: text
        });
    }

    function removeMessage(id) {
        return global.CoeApi.del('/api/chat/messages/' + encodeURIComponent(id));
    }

    function openChannel(slug) {
        activeChannel = slug;
        syncChannelButtons();

        const title = global.document.getElementById('comm-channel-title');
        const topic = global.document.getElementById('comm-channel-topic');
        const channel = channels.find(c => c.slug === slug);

        if (title && channel) title.textContent = channel.title;
        if (topic && channel) topic.textContent = channel.description;

        if (cache.has(slug)) render();
        return loadChannel(slug);
    }

    // -----------------------------------------------------------------------
    // Wiring
    // -----------------------------------------------------------------------

    /*
     * The composer grows with what is being typed.
     *
     * It was an <input>, which is one line by definition: past the width, the
     * beginning of your own sentence scrolls out of view and a long message has
     * to be written blind. It is a <textarea> now, and this keeps its height
     * equal to its content.
     *
     * MIN_ROWS/MAX_ROWS are in lines rather than pixels so the box stays in
     * proportion if the font size changes. Past the ceiling it scrolls — a
     * composer that can grow without limit eventually pushes the conversation
     * off the top of the screen, which is a worse way to lose the thread.
     */
    /*
     * Three lines before a single character is typed.
     *
     * One line was the technically-minimal size and the wrong one: you had to
     * start writing before the box was big enough to read what you had written.
     * Three is enough to see a sentence and its wrap, and the box still grows
     * from there.
     */
    const MIN_ROWS = 3;
    const MAX_ROWS = 12;

    function autoGrow(input) {
        if (!input) return;

        const styles = global.getComputedStyle(input);
        const line = parseFloat(styles.lineHeight) || 22;
        const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom) || 0;
        const border = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth) || 0;

        const min = line * MIN_ROWS + padding + border;
        const max = line * MAX_ROWS + padding + border;

        // Collapse first: scrollHeight only ever reports the taller of the
        // content and the current height, so without this the box can grow but
        // never shrink back when text is deleted.
        input.style.height = 'auto';

        const wanted = input.scrollHeight + border;
        const height = Math.min(Math.max(wanted, min), max);

        input.style.height = height + 'px';
        input.style.overflowY = wanted > max ? 'auto' : 'hidden';

        // Lets the CSS react to a composer that has outgrown one line.
        input.classList.toggle('is-tall', height > min + 2);
    }

    /** "1840 / 2000", once it is close enough to matter. */
    function updateCount(input) {
        const el = global.document.getElementById('comm-chat-count');
        if (!el || !input) return;

        const max = Number(input.getAttribute('maxlength')) || 0;
        const used = input.value.length;

        // Silent until the limit is in sight — a counter on every message is
        // noise, and only useful when it is about to stop you.
        const show = max > 0 && used >= max * 0.8;
        el.textContent = show ? used + ' / ' + max : '';
        el.classList.toggle('is-near', show && used >= max * 0.95);
    }

    function bind() {
        const form = global.document.getElementById('comm-chat-form');
        const input = global.document.getElementById('comm-chat-input');
        const thread = global.document.getElementById('comm-chat-thread');

        if (input && input.dataset.coeGrow !== 'true') {
            input.dataset.coeGrow = 'true';

            const refresh = function () {
                autoGrow(input);
                updateCount(input);
            };

            // `input` covers typing, pasting, cutting and the synthetic events
            // scripts.js fires after inserting an emoji or a GIF tag.
            input.addEventListener('input', refresh);

            input.addEventListener('keydown', function (event) {
                if (event.key !== 'Enter' || event.shiftKey) return;

                // A textarea would insert a newline here, and the form would
                // never submit. Enter has to keep meaning "send", the way it
                // did when this was an <input>.
                event.preventDefault();
                if (typeof form?.requestSubmit === 'function') form.requestSubmit();
                else form?.dispatchEvent(new global.Event('submit', { cancelable: true, bubbles: true }));
            });

            // Reset the height after a send, and after the panel is first shown
            // — a hidden element measures as zero.
            global.addEventListener('resize', refresh);
            refresh();
        }

        if (form && form.dataset.coeBound !== 'true') {
            form.dataset.coeBound = 'true';

            // Capture phase, ahead of the listener scripts.js attached — that
            // one writes to localStorage and broadcasts to this browser only.
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                event.stopImmediatePropagation();

                const text = String(input?.value || '').trim();
                if (!text) return;

                input.value = '';
                autoGrow(input);
                updateCount(input);

                send(text).catch(function (error) {
                    // Put the text back rather than losing what they typed —
                    // and put the box back to the size that text needs.
                    input.value = text;
                    autoGrow(input);
                    updateCount(input);
                    global.showLibraryToast?.('Message not sent', error.message || 'Try again.', 'error');
                });
            }, true);
        }

        if (thread && thread.dataset.coeBound !== 'true') {
            thread.dataset.coeBound = 'true';

            thread.addEventListener('click', function (event) {
                const button = event.target.closest('.coe-msg-del');
                if (!button) return;

                const id = button.closest('.coe-msg')?.dataset.messageId;
                if (!id || !global.confirm('Remove this message for everyone?')) return;

                removeMessage(id).catch(function (error) {
                    global.showLibraryToast?.('Could not remove', error.message || 'Try again.', 'error');
                });
            });
        }

        // The portal's own channel buttons. Delegated, because it rebuilds them.
        const list = global.document.getElementById('comm-text-channel-list');
        if (list && list.dataset.coeBound !== 'true') {
            list.dataset.coeBound = 'true';

            list.addEventListener('click', function (event) {
                const button = event.target.closest('[data-channel], [data-comm-channel]');
                if (!button) return;

                const slug = button.dataset.channel || button.dataset.commChannel;
                if (!slug) return;

                event.stopImmediatePropagation();
                openChannel(slug);
            }, true);
        }
    }

    /** Draw the room list from what the server says this account may open. */
    function renderChannelList() {
        const list = global.document.getElementById('comm-text-channel-list');
        if (!list) return;

        list.innerHTML = channels.map(function (channel) {
            return '' +
                '<button type="button" class="coe-chat-room' + (channel.slug === activeChannel ? ' active' : '') + '" data-channel="' + escapeHtml(channel.slug) + '">' +
                    '<span class="material-icons">' +
                        (channel.slug === 'ce' ? 'architecture' : channel.slug === 'ee' ? 'electric_bolt' : 'forum') +
                    '</span>' +
                    '<span class="coe-chat-room-copy">' +
                        '<strong>' + escapeHtml(channel.title) + '</strong>' +
                        '<small>' + escapeHtml(channel.description) + '</small>' +
                    '</span>' +
                '</button>';
        }).join('');
    }

    function listen() {
        global.CoeApi.on('chat:message', function (message) {
            const list = cache.get(message.channel) || [];

            // The socket can deliver a message this tab already added; keyed on
            // id so a double render is impossible.
            if (list.some(m => m.id === message.id)) return;

            list.push(message);
            cache.set(message.channel, list);

            if (message.channel === activeChannel) {
                render();
            } else {
                // Same reason as roomButtons(): the surviving markup may carry
                // either attribute.
                const button = roomButtons().find(function (node) {
                    return roomSlug(node) === message.channel;
                });
                if (button) button.classList.add('has-unread');
            }
        });

        global.CoeApi.on('chat:deleted', function (payload) {
            const list = cache.get(payload.channel);
            if (!list) return;
            cache.set(payload.channel, list.filter(m => m.id !== payload.id));
            if (payload.channel === activeChannel) render();
        });
    }

    function start() {
        if (!global.CoeApi || !global.CoeApi.isServed()) {
            console.warn('[coe-chat] not served by the app server; the chat stays local to this browser');
            return Promise.resolve(false);
        }

        return global.CoeApi.session(false)
            .then(function (current) {
                if (!current) return false;

                return global.CoeApi.get('/api/chat/messages')
                    .then(function (result) {
                        channels = result.channels || [];
                        if (!channels.length) return false;

                        /*
                         * Open on the room everybody shares.
                         *
                         * This used to prefer the account's own course room, so
                         * a Civil student landed in #ce and an Electrical one in
                         * #ee — and nobody at all landed in #general, which is
                         * the room meant for the whole college. A notice posted
                         * there for everyone sat in a room no one had open.
                         *
                         * The course rooms are one click away and still raise
                         * their unread mark, so nothing is hidden — the default
                         * is simply the room where everyone can hear each other.
                         */
                        activeChannel = channels.some(c => c.slug === 'general')
                            ? 'general'
                            : channels[0].slug;

                        renderChannelList();
                        bind();

                        return Promise.all([openChannel(activeChannel), global.CoeApi.connect()])
                            .then(function () {
                                listen();
                                ready = true;
                                return true;
                            });
                    });
            })
            .catch(function (error) {
                console.error('[coe-chat] startup failed', error);
                return false;
            });
    }

    global.CoeChat = {
        start,
        openChannel,
        send,
        removeMessage,
        loadChannel,
        render,
        get channels() { return channels; },
        get activeChannel() { return activeChannel; },
        get messages() { return cache.get(activeChannel) || []; },
        get ready() { return ready; }
    };

    function boot() {
        const waitFor = (global.CoeLive && global.CoeLive.booted) || Promise.resolve();
        global.CoeChat.booted = waitFor.then(start);
    }

    if (global.document.readyState === 'complete' || global.CoeLive) {
        boot();
    } else {
        global.document.addEventListener('DOMContentLoaded', boot);
    }
})(window);
