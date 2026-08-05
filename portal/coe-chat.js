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
    /**
     * Turn a plain-text message body into the HTML shown in the thread.
     *
     * Everything here is built on top of escapeHtml, never instead of it: the
     * body is escaped first and the markup below is added to text that can no
     * longer contain any of its own. A message is written by another student,
     * so it is untrusted input in the ordinary sense.
     *
     * WHAT IT UNDERSTANDS
     *   https://…      becomes a link. Shared Drive folders, forms and past
     *                  papers were arriving as text you had to select and
     *                  paste, which is most of what this room is used for.
     *   > quoted line  becomes a quote block. This is what the Reply button
     *                  writes, so a reply carries what it is replying to
     *                  without needing a threads column in the database.
     *   @Name          becomes a mention chip, and a mention of you is marked
     *                  so your own name stands out in a busy room.
     *
     * Deliberately not Markdown. Half-implemented emphasis in a chat means
     * asterisks vanishing out of formulas — and this room carries formulas.
     */
    function formatBody(text, myName) {
        const safe = escapeHtml(text);
        const mine = String(myName || '').trim().toLowerCase();

        return safe.split('\n').map(function (line) {
            const quoted = /^&gt;\s?/.test(line);
            let body = quoted ? line.replace(/^&gt;\s?/, '') : line;

            // Links. The pattern stops at whitespace and at the characters that
            // are almost always sentence punctuation rather than part of a URL.
            body = body.replace(/https?:\/\/[^\s<>"']+/g, function (raw) {
                const trimmed = raw.replace(/[.,;:!?]+$/, '');
                const tail = raw.slice(trimmed.length);
                let label = trimmed.replace(/^https?:\/\//, '');
                if (label.length > 48) label = label.slice(0, 45) + '…';
                return '<a class="coe-msg-link" href="' + trimmed +
                    '" target="_blank" rel="noopener noreferrer">' + label + '</a>' + tail;
            });

            // Mentions. Names can have a space in them ("@Ana Santos"), so a
            // second capitalised word is taken when there is one.
            body = body.replace(/@([A-Za-z][\w.'-]*(?:\s+[A-Z][\w.'-]*)?)/g, function (all, name) {
                const isMe = mine && name.trim().toLowerCase() === mine;
                return '<span class="coe-mention' + (isMe ? ' is-me' : '') + '">@' + name + '</span>';
            });

            if (!body) return quoted ? '' : '<br>';
            return quoted ? '<span class="coe-msg-quote">' + body + '</span>' : body;
        }).join('\n');
    }

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
        const palette = ['#8f1d2c', '#a63347', '#1e8e3e', '#e37400', '#d93025', '#0b8043', '#63121d'];
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

        // Measured before the thread is rewritten; see the note where it is used.
        const wasAtBottom = threadAtBottom(thread);

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
                        '<div class="coe-msg-body">' + formatBody(message.body, mine && mine.name) + '</div>' +
                    '</div>' +
                    '<div class="coe-msg-tools">' +
                        '<button type="button" class="coe-msg-reply" title="Reply" aria-label="Reply to this message"' +
                            ' data-reply-name="' + escapeHtml(message.senderName) + '"' +
                            ' data-reply-body="' + escapeHtml(String(message.body || '').replace(/\s+/g, ' ').slice(0, 120)) + '">' +
                            '<span class="material-icons">reply</span></button>' +
                        (canRemove
                            ? '<button type="button" class="coe-msg-del" title="Remove message" aria-label="Remove message">' +
                                  '<span class="material-icons">close</span></button>'
                            : '') +
                    '</div>' +
                '</div>';

            lastSender = message.senderId;
            lastAt = at;
        });

        thread.innerHTML = html;

        /*
         * Newest message in view — but only if the reader was already at the
         * bottom. The comment here said exactly that and the line under it did
         * the opposite: it jumped unconditionally, so scrolling up to re-read
         * something threw you back to the newest message the moment anyone
         * typed. `atBottom` has to be measured BEFORE innerHTML is replaced,
         * which is why it is captured at the top of this function.
         *
         * When it does not jump, the "new messages" button appears instead —
         * see refreshJumpButton(). Nothing arrives silently either way.
         */
        if (wasAtBottom) {
            thread.scrollTop = thread.scrollHeight;
        }
        refreshJumpButton();
    }

    /** How close to the bottom still counts as "reading the newest". */
    const BOTTOM_SLACK = 60;

    function threadAtBottom(thread) {
        if (!thread) return true;
        return thread.scrollHeight - thread.scrollTop - thread.clientHeight <= BOTTOM_SLACK;
    }

    /**
     * Show or hide the "jump to newest" button.
     *
     * It lives outside the scrolling element — inside it, the button would
     * scroll away with the messages and be unreachable exactly when it is
     * needed. It is created once and then only toggled.
     */
    function refreshJumpButton() {
        const thread = global.document.getElementById('comm-chat-thread');
        if (!thread || !thread.parentNode) return;

        let button = global.document.getElementById('coe-chat-jump');
        if (!button) {
            button = global.document.createElement('button');
            button.type = 'button';
            button.id = 'coe-chat-jump';
            button.className = 'coe-chat-jump';
            button.innerHTML = '<span class="material-icons">arrow_downward</span> Newest messages';
            button.addEventListener('click', function () {
                thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
            });
            thread.parentNode.insertBefore(button, thread.nextSibling);
        }

        button.hidden = threadAtBottom(thread);
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

            /*
             * Reply.
             *
             * Writes the quoted line into the composer rather than opening a
             * side thread. The quote travels in the message body, so it needs
             * no reply column on the server, it survives a reload, and someone
             * reading on a phone sees the same context as everyone else.
             */
            thread.addEventListener('click', function (event) {
                const reply = event.target.closest('.coe-msg-reply');
                if (reply) {
                    const input = global.document.getElementById('comm-chat-input');
                    if (!input) return;

                    const quote = '> ' + reply.dataset.replyName + ': ' + reply.dataset.replyBody + '\n';
                    // Kept if there is already a half-written message — losing
                    // what somebody has typed to insert a quote is worse than
                    // no reply button at all.
                    input.value = quote + (input.value ? input.value.replace(/^(> .*\n)+/, '') : '');
                    input.focus();
                    input.setSelectionRange(input.value.length, input.value.length);
                    input.dispatchEvent(new global.Event('input', { bubbles: true }));
                    return;
                }

                const button = event.target.closest('.coe-msg-del');
                if (!button) return;

                const id = button.closest('.coe-msg')?.dataset.messageId;
                if (!id || !global.confirm('Remove this message for everyone?')) return;

                removeMessage(id).catch(function (error) {
                    global.showLibraryToast?.('Could not remove', error.message || 'Try again.', 'error');
                });
            });

            thread.addEventListener('scroll', refreshJumpButton, { passive: true });
        }

        /*
         * Click a name in the members rail to address them.
         *
         * The cheap half of @mentions: typing one already highlights, but only
         * if you spell the name the way its owner did. Taking it from the list
         * means the highlight is reliable, which is the whole point of a
         * mention in a room where three courses are talking at once.
         */
        const memberList = global.document.getElementById('comm-member-list');
        if (memberList && memberList.dataset.coeBound !== 'true') {
            memberList.dataset.coeBound = 'true';

            memberList.addEventListener('click', function (event) {
                const row = event.target.closest('[data-member-name], .discord-member');
                if (!row) return;

                const name = row.dataset.memberName || row.querySelector('strong')?.textContent.trim();
                const input = global.document.getElementById('comm-chat-input');
                if (!name || !input) return;

                const spacer = input.value && !/\s$/.test(input.value) ? ' ' : '';
                input.value += spacer + '@' + name + ' ';
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
                input.dispatchEvent(new global.Event('input', { bubbles: true }));
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
        // Exported so the message rendering can be checked on its own: it is a
        // pure string->string function, and it is the one part of this file
        // that turns another student's text into markup.
        formatBody,
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
