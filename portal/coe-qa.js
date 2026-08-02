/**
 * COE Studio — live shared Q&A board ("Tanong Mo, Sagot Ko").
 *
 * WHAT THIS FIXES
 * ---------------
 * Questions and answers lived in `localStorage.coeQAHubQuestions` /
 * `coeQAHubAnswers`, private to one browser. So a question you asked was
 * invisible to everyone else, and the counters on your screen — "3 answers",
 * "12 questions" — were counts of your own storage. That is exactly the
 * "sa akin lang nag-display ang count" problem.
 *
 * SAME APPROACH AS THE LIBRARY
 * ----------------------------
 * tanong-mo-sagot-ko.js reads those two keys everywhere and synchronously, so
 * rather than rewrite it, the keys are kept as a render cache filled from the
 * server, and its write functions are replaced with API calls:
 *
 *      server DB  --GET /api/qa/questions-->  cache  -->  existing rendering
 *                 <--socket question:created--
 *
 * The overrides work because tanong-mo-sagot-ko.js is a classic script: its
 * top-level `function saveQuestion(...)` IS `window.saveQuestion`, so replacing
 * that property changes what its own call sites resolve to.
 *
 * Load order matters — this file must come after tanong-mo-sagot-ko.js.
 */

(function (global) {
    'use strict';

    const QUESTIONS_KEY = 'coeQAHubQuestions';
    const ANSWERS_KEY = 'coeQAHubAnswers';

    let ready = false;

    /**
     * Which question's detail pane is open.
     *
     * Tracked here rather than read from tanong-mo-sagot-ko.js's own
     * `currentQuestion`, because that is declared `let` at the top level of a
     * classic script — which puts it in the global *lexical* scope, NOT on
     * `window`. `window.currentQuestion` is therefore permanently `undefined`,
     * and every override that guarded on it would have silently done nothing.
     *
     * `openQuestionDetail` is a plain function declaration, so it IS on window
     * and can be wrapped; that wrapper is what keeps this in step.
     */
    let openQuestionId = '';

    // -----------------------------------------------------------------------
    // Shape translation
    // -----------------------------------------------------------------------

    /**
     * Server question -> the record the board already renders.
     *
     * `asker` is the user id rather than a name: the portal compares it against
     * `getCurrentUserKey()` to decide whether to show "delete my question", and
     * an id is stable where a display name is not.
     */
    /**
     * The attachment, as a URL the browser can point at.
     *
     * The server never sends the storage key — it is the on-disk location, and
     * a client holding one could ask for any file in the store. It sends the
     * name and the type, and the bytes come from an authenticated route that
     * resolves the key itself after checking this account may see the parent.
     */
    function toPortalAttachment(type, id, record) {
        if (!record.attachmentName) return null;

        return {
            name: record.attachmentName,
            type: record.attachmentMime || '',
            size: Number(record.attachmentSize || 0),
            url: '/api/qa/attachment/' + type + '/' + encodeURIComponent(id)
        };
    }

    function toPortalQuestion(question) {
        return {
            id: question.id,
            title: question.title,
            description: question.description || '',
            course: question.course || 'CE',
            yearLevel: question.yearLevel || '',
            subject: question.subject || '',
            lesson: question.lesson || '',
            tags: Array.isArray(question.tags) ? question.tags : [],
            asker: question.askerId || '',
            askerName: question.askerName || 'Anonymous Student',
            status: question.status || 'Unanswered',
            // Publication state, separate from the answered/solved state above.
            reviewStatus: question.reviewStatus || 'APPROVED',
            createdAt: question.createdAt,
            bestAnswerId: question.bestAnswerId || null,
            flags: [],
            attachment: toPortalAttachment('question', question.id, question),
            answerCount: Number(question.answerCount || 0),
            views: Number(question.viewCount || 0)
        };
    }

    /**
     * Server answer -> the portal's answer record.
     *
     * The portal stores votes as an array of user keys and derives the count
     * from its length, so the server's `voteCount` is expanded into a
     * placeholder array of that length, with the viewer's own key present when
     * they have voted. That keeps both `answer.votes.length` and the
     * "already voted" highlight correct without touching the rendering code.
     */
    function toPortalAnswer(answer, viewerKey) {
        const votes = [];
        const total = Number(answer.voteCount || 0);

        if (answer.votedByMe && viewerKey) votes.push(viewerKey);
        while (votes.length < total) votes.push('vote-' + votes.length);

        return {
            id: answer.id,
            questionId: answer.questionId,
            text: answer.text || '',
            answerer: answer.answererId || '',
            answererName: answer.answererName || 'Anonymous Student',
            verified: Boolean(answer.verified),
            // PENDING | APPROVED | REJECTED. Whether anyone but the author and
            // the reviewers may read it — separate from `verified`, which says
            // whether it is the right answer.
            reviewStatus: answer.reviewStatus || 'APPROVED',
            rejectionNote: answer.rejectionNote || '',
            attachment: toPortalAttachment('answer', answer.id, answer),
            createdAt: answer.createdAt,
            votes,
            flags: [],
            comments: (answer.comments || []).map(comment => ({
                id: comment.id,
                text: comment.text,
                commenter: comment.commenterId || '',
                commenterName: comment.commenterName || 'Anonymous Student',
                createdAt: comment.createdAt
            }))
        };
    }

    function viewerKey() {
        const user = global.CoeLive && global.CoeLive.user;
        return (user && user.id) || '';
    }

    // -----------------------------------------------------------------------
    // Cache
    // -----------------------------------------------------------------------

    function read(key) {
        try {
            const parsed = JSON.parse(global.localStorage.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function write(key, records) {
        try {
            global.localStorage.setItem(key, JSON.stringify(records));
        } catch (error) {
            console.error('[coe-qa] could not cache', key, error);
        }
    }

    function upsert(key, record) {
        const records = read(key);
        const index = records.findIndex(item => item.id === record.id);
        if (index >= 0) records[index] = record; else records.push(record);
        write(key, records);
    }

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    let renderTimer = null;

    /** Coalesced re-render of whichever Q&A views are on screen. */
    function refresh() {
        if (renderTimer) return;

        renderTimer = global.setTimeout(function () {
            renderTimer = null;

            try {
                global.populateQATagFilter?.();
                global.displayBrowseQuestions?.();
                global.displayMyQuestions?.();
                global.displayAdminModeration?.();

                // Re-open the detail pane only if one is already showing, so a
                // live update never yanks the user into a question.
                const modal = global.document.getElementById('question-detail-modal');
                const isOpen = modal && global.getComputedStyle(modal).display !== 'none';
                if (openQuestionId && isOpen) global.openQuestionDetail?.(openQuestionId);
            } catch (error) {
                console.warn('[coe-qa] refresh failed', error);
            }
        }, 80);
    }

    // -----------------------------------------------------------------------
    // Sync
    // -----------------------------------------------------------------------

    const PAGE_SIZE = 100;
    const MAX_PAGES = 40;

    /**
     * Pull the whole board.
     *
     * Answers are fetched per question, so this is one request plus one per
     * question. That is acceptable for a class-sized board and keeps the API
     * honest about per-question permissions; if the board grows past a few
     * hundred questions this wants a batched endpoint instead.
     */
    function syncQuestions() {
        const collected = [];

        function page(number) {
            return global.CoeApi
                .get('/api/qa/questions?pageSize=' + PAGE_SIZE + '&page=' + number)
                .then(function (result) {
                    const questions = (result && result.questions) || [];
                    collected.push.apply(collected, questions);

                    const total = Number(result && result.total) || collected.length;
                    if (collected.length >= total || questions.length < PAGE_SIZE) return collected;
                    if (number >= MAX_PAGES) {
                        console.warn('[coe-qa] stopped at ' + MAX_PAGES + ' pages');
                        return collected;
                    }
                    return page(number + 1);
                });
        }

        return page(1).then(function (questions) {
            write(QUESTIONS_KEY, questions.map(toPortalQuestion));

            // Answers for every question, in parallel.
            return Promise.all(questions.map(function (question) {
                return global.CoeApi.get('/api/qa/questions/' + encodeURIComponent(question.id))
                    .then(detail => (detail.answers || []).map(a => toPortalAnswer(a, viewerKey())))
                    .catch(() => []);
            })).then(function (lists) {
                const flat = [];
                lists.forEach(list => flat.push.apply(flat, list));
                write(ANSWERS_KEY, flat);
                refresh();
                return questions.length;
            });
        });
    }

    /** Refresh one question's answers after a change to it. */
    function syncQuestion(questionId) {
        return global.CoeApi.get('/api/qa/questions/' + encodeURIComponent(questionId))
            .then(function (detail) {
                upsert(QUESTIONS_KEY, toPortalQuestion(detail.question));

                const others = read(ANSWERS_KEY).filter(a => a.questionId !== questionId);
                const mine = (detail.answers || []).map(a => toPortalAnswer(a, viewerKey()));
                write(ANSWERS_KEY, others.concat(mine));

                refresh();
            })
            .catch(function (error) {
                console.warn('[coe-qa] could not refresh question', questionId, error.message || error);
            });
    }

    // -----------------------------------------------------------------------
    // Writes — these replace the portal's localStorage versions
    // -----------------------------------------------------------------------

    /**
     * The File to send, if there is one.
     *
     * tanong-mo-sagot-ko.js hands over `{name, type, file}` when a server is
     * present and `{name, type, data}` (a base64 data URL) when it is not. Only
     * the first can be posted; the second belongs to the standalone path and
     * never reaches here.
     */
    function attachedFile(attachment) {
        return attachment && attachment.file instanceof global.File ? attachment.file : null;
    }

    function askQuestion(title, description, course, yearLevel, subject, lesson, tags, attachment) {
        const file = attachedFile(attachment);

        /*
         * Multipart when there is a file, JSON otherwise.
         *
         * The file used to be dropped here in silence: this function took seven
         * parameters, tanong-mo-sagot-ko.js called it with eight, and the
         * eighth — the attachment it had just spent a FileReader pass
         * producing — landed in nothing. The picker worked, the preview worked,
         * the question posted, and the file simply did not exist afterwards.
         */
        if (!file) {
            return global.CoeApi.post('/api/qa/questions', {
                title: title,
                description: description || '',
                course: course || 'CE',
                yearLevel: yearLevel || '',
                subject: subject || '',
                lesson: lesson || '',
                tags: Array.isArray(tags) ? tags : []
            });
        }

        const form = new global.FormData();
        form.set('title', title);
        form.set('description', description || '');
        form.set('course', course || 'CE');
        form.set('yearLevel', yearLevel || '');
        form.set('subject', subject || '');
        form.set('lesson', lesson || '');
        form.set('tags', (Array.isArray(tags) ? tags : []).join(','));
        form.set('attachment', file, file.name);

        return global.CoeApi.postForm('/api/qa/questions', form);
    }

    function answerQuestion(questionId, text, attachment) {
        const path = '/api/qa/questions/' + encodeURIComponent(questionId);
        const file = attachedFile(attachment);

        if (!file) {
            return global.CoeApi.post(path, { action: 'answer', text: text });
        }

        const form = new global.FormData();
        form.set('action', 'answer');
        form.set('text', text);
        form.set('attachment', file, file.name);

        return global.CoeApi.postForm(path, form);
    }

    /** Publish or refuse one student's answer. Administrators only. */
    function reviewAnswer(questionId, answerId, decision, note) {
        return global.CoeApi.post('/api/qa/questions/' + encodeURIComponent(questionId), {
            action: 'review-answer',
            answerId: answerId,
            decision: decision,
            note: note || undefined
        });
    }

    function listPendingAnswers() {
        return global.CoeApi.get('/api/qa/answers/pending')
            .then(result => (result && result.answers) || []);
    }

    function voteAnswer(questionId, answerId) {
        return global.CoeApi.post('/api/qa/questions/' + encodeURIComponent(questionId), {
            action: 'vote',
            answerId: answerId
        });
    }

    function commentOnAnswer(questionId, answerId, text) {
        return global.CoeApi.post('/api/qa/questions/' + encodeURIComponent(questionId), {
            action: 'comment',
            answerId: answerId,
            text: text
        });
    }

    function acceptAnswer(questionId, answerId) {
        return global.CoeApi.post('/api/qa/questions/' + encodeURIComponent(questionId), {
            action: 'accept',
            answerId: answerId
        });
    }

    function removeQuestion(questionId) {
        return global.CoeApi.del('/api/qa/questions/' + encodeURIComponent(questionId));
    }

    // -----------------------------------------------------------------------
    // Question approval queue
    // -----------------------------------------------------------------------

    /** True when this account may approve a question or post the official reply. */
    function canReview() {
        const user = global.CoeLive && global.CoeLive.user;
        const role = String((user && user.role) || '').toUpperCase();
        return role === 'ADMIN' || role === 'FACULTY';
    }

    /**
     * Questions waiting to be published.
     *
     * `reviewStatus=PENDING` is honoured only for reviewers — the route drops
     * the parameter for anyone else, who quietly gets the normal board back.
     */
    function listPendingQuestions() {
        return global.CoeApi
            .get('/api/qa/questions?reviewStatus=PENDING&pageSize=100')
            .then(result => (result && result.questions) || []);
    }

    function reviewQuestion(id, decision, note) {
        return global.CoeApi.post('/api/qa/questions/' + encodeURIComponent(id), {
            action: 'review',
            decision: decision,
            note: note || undefined
        });
    }

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    let queueBound = false;

    /**
     * Draw the queue above the question list. Hidden entirely for accounts
     * that cannot review, and when there is nothing waiting.
     */
    function renderQuestionQueue() {
        const host = global.document.getElementById('coe-qa-queue');
        if (!host) return Promise.resolve();

        if (!canReview()) {
            host.hidden = true;
            return Promise.resolve();
        }

        return listPendingQuestions().then(function (pending) {
            if (!pending.length) {
                host.hidden = true;
                host.innerHTML = '';
                return;
            }

            host.hidden = false;
            host.innerHTML =
                '<header class="coe-approval-head">' +
                    '<span class="material-icons">rule</span>' +
                    '<div>' +
                        '<strong>' + pending.length + ' question' + (pending.length === 1 ? '' : 's') + ' waiting for review</strong>' +
                        '<small>Only you and other faculty can see these. Approving puts the question on everyone\'s board.</small>' +
                    '</div>' +
                '</header>' +
                '<ul class="coe-approval-list">' +
                pending.map(function (question) {
                    const where = [question.course, question.yearLevel, question.subject]
                        .filter(Boolean).join(' / ');
                    return '' +
                        '<li class="coe-approval-item" data-question-id="' + escapeHtml(question.id) + '">' +
                            '<div class="coe-approval-info">' +
                                '<strong>' + escapeHtml(question.title) + '</strong>' +
                                '<small>' + escapeHtml(where || 'Unfiled') + ' &middot; ' +
                                    escapeHtml(question.askerName || 'Unknown') + '</small>' +
                            '</div>' +
                            '<div class="coe-approval-actions">' +
                                '<button type="button" data-review="APPROVED">Publish</button>' +
                                '<button type="button" data-review="REJECTED" class="is-reject">Refuse</button>' +
                            '</div>' +
                        '</li>';
                }).join('') +
                '</ul>';

            if (queueBound) return;
            queueBound = true;

            // One delegated listener for the life of the page, so redrawing
            // the list does not stack up handlers.
            host.addEventListener('click', function (event) {
                const button = event.target.closest('button[data-review]');
                if (!button) return;

                const item = button.closest('.coe-approval-item');
                const id = item && item.dataset.questionId;
                if (!id) return;

                const decision = button.dataset.review;
                let note;

                if (decision === 'REJECTED') {
                    note = global.prompt('Why is this not being published? The student will see this.') || '';
                    if (!note.trim()) return;
                }

                item.querySelectorAll('button').forEach(b => { b.disabled = true; });

                reviewQuestion(id, decision, note)
                    .then(function (result) {
                        global.showLibraryToast?.(
                            decision === 'APPROVED' ? 'Published' : 'Not published',
                            result.message || '',
                            decision === 'APPROVED' ? 'success' : 'info'
                        );
                        renderQuestionQueue();
                        syncQuestions();
                    })
                    .catch(function (error) {
                        item.querySelectorAll('button').forEach(b => { b.disabled = false; });
                        global.showLibraryToast?.('Could not review that', error.message || 'Try again.', 'error');
                    });
            });
        }).catch(function (error) {
            console.warn('[coe-qa] question queue unavailable', error.message || error);
        });
    }

    let answerQueueBound = false;

    /**
     * Answers waiting to be published, above the board.
     *
     * A sibling of the question queue rather than part of it: they are two
     * different decisions ("may this be asked?" and "is this answer good
     * enough to show?"), they can be non-empty independently, and mixing them
     * into one list would mean a reviewer clearing questions has to read past
     * answers to find them.
     */
    function renderAnswerQueue() {
        const host = global.document.getElementById('coe-qa-answer-queue');
        if (!host) return Promise.resolve();

        if (!canReview()) {
            host.hidden = true;
            return Promise.resolve();
        }

        return listPendingAnswers().then(function (pending) {
            if (!pending.length) {
                host.hidden = true;
                host.innerHTML = '';
                return;
            }

            host.hidden = false;
            host.innerHTML =
                '<header class="coe-approval-head">' +
                    '<span class="material-icons">rate_review</span>' +
                    '<div>' +
                        '<strong>' + pending.length + ' answer' + (pending.length === 1 ? '' : 's') +
                            ' waiting for review</strong>' +
                        '<small>Written by students. Nobody else can see them until you publish.</small>' +
                    '</div>' +
                '</header>' +
                '<ul class="coe-approval-list">' +
                pending.map(function (answer) {
                    const where = [answer.questionCourse, answer.questionSubject].filter(Boolean).join(' / ');
                    return '' +
                        '<li class="coe-approval-item" data-answer-id="' + escapeHtml(answer.id) + '"' +
                            ' data-question-id="' + escapeHtml(answer.questionId) + '">' +
                            '<div class="coe-approval-info">' +
                                '<strong>' + escapeHtml(answer.questionTitle) + '</strong>' +
                                '<small>' + escapeHtml(answer.answererName) +
                                    (where ? ' &middot; ' + escapeHtml(where) : '') + '</small>' +
                                '<p class="coe-approval-excerpt">' +
                                    escapeHtml(answer.text.length > 220 ? answer.text.slice(0, 220) + '…' : answer.text) +
                                '</p>' +
                                (answer.attachmentName
                                    ? '<a class="coe-approval-peek" target="_blank" rel="noopener" href="/api/qa/attachment/answer/' +
                                          encodeURIComponent(answer.id) + '">' +
                                          '<span class="material-icons">attachment</span>' +
                                          escapeHtml(answer.attachmentName) + '</a>'
                                    : '') +
                            '</div>' +
                            '<div class="coe-approval-actions">' +
                                '<button type="button" data-answer-review="APPROVED">Publish</button>' +
                                '<button type="button" data-answer-review="REJECTED" class="is-reject">Refuse</button>' +
                            '</div>' +
                        '</li>';
                }).join('') +
                '</ul>';

            if (answerQueueBound) return;
            answerQueueBound = true;

            host.addEventListener('click', function (event) {
                const button = event.target.closest('button[data-answer-review]');
                if (!button) return;

                const item = button.closest('.coe-approval-item');
                const answerId = item && item.dataset.answerId;
                const questionId = item && item.dataset.questionId;
                if (!answerId || !questionId) return;

                const decision = button.dataset.answerReview;
                let note;

                if (decision === 'REJECTED') {
                    note = global.prompt('Why is this answer not being published? The student will see this.') || '';
                    if (!note.trim()) return;
                }

                item.querySelectorAll('button').forEach(b => { b.disabled = true; });

                reviewAnswer(questionId, answerId, decision, note)
                    .then(function (result) {
                        global.showLibraryToast?.(
                            decision === 'APPROVED' ? 'Published' : 'Not published',
                            (result && result.message) || '',
                            decision === 'APPROVED' ? 'success' : 'info'
                        );
                        renderAnswerQueue();
                        syncQuestion(questionId);
                    })
                    .catch(function (error) {
                        item.querySelectorAll('button').forEach(b => { b.disabled = false; });
                        global.showLibraryToast?.('Could not review that', error.message || 'Try again.', 'error');
                    });
            });
        }).catch(function (error) {
            console.warn('[coe-qa] answer queue unavailable', error.message || error);
        });
    }

    // -----------------------------------------------------------------------
    // Overrides
    // -----------------------------------------------------------------------

    /**
     * Point the board's own write functions at the server.
     *
     * Each keeps the original's UI behaviour — reset the form, close the modal,
     * show the notice — and swaps only where the data goes. The re-render is
     * left to the socket event, so what appears on screen is what the server
     * actually accepted rather than an optimistic guess.
     */
    function installOverrides() {
        const notify = function (message, tone) {
            if (typeof global.showQANotice === 'function') global.showQANotice(message, tone);
        };

        // Wrap the detail opener so this module always knows which question is
        // on screen. See the note on `openQuestionId` for why the portal's own
        // `currentQuestion` cannot be read from here.
        const originalOpen = global.openQuestionDetail;

        global.openQuestionDetail = function (questionId) {
            if (questionId) {
                openQuestionId = questionId;
                // Count the view. Fire-and-forget: a failed counter must never
                // stop the question from opening.
                global.CoeApi.post('/api/qa/questions/' + encodeURIComponent(questionId), { action: 'view' })
                    .catch(function () { /* the count is not worth an error */ });
            }
            return typeof originalOpen === 'function'
                ? originalOpen.apply(this, arguments)
                : undefined;
        };

        // qaManager captured a direct reference to the original at build time,
        // so the inline onclick handlers would bypass the wrapper above.
        if (global.qaManager) {
            global.qaManager.openQuestionDetail = global.openQuestionDetail;
        }

        // Eight parameters, matching the caller. The eighth is the attachment,
        // and it used to be missing from this signature entirely.
        global.saveQuestion = function (title, description, course, yearLevel, subject, lesson, tags, attachment) {
            askQuestion(title, description, course, yearLevel, subject, lesson, tags, attachment)
                .then(function (result) {
                    global.document.getElementById('ask-question-form')?.reset();
                    global.resetUploadLabel?.('question-file-name');
                    global.closeModal?.(global.document.getElementById('ask-question-modal'));

                    // Say which of the two things happened, rather than
                    // claiming it is on the board when it is in a queue.
                    notify(
                        result && result.reviewStatus === 'PENDING'
                            ? 'Sent for review. It appears on the board once a faculty member approves it.'
                            : 'Question posted for everyone in COE.'
                    );

                    return syncQuestions();
                })
                .catch(function (error) {
                    notify(error.message || 'Could not post the question.', 'warning');
                });
        };

        /** The question the user is looking at, from the wrapper above. */
        const openQuestion = function () {
            if (openQuestionId) return openQuestionId;
            notify('Open a question first.', 'warning');
            return '';
        };

        global.saveAnswer = function (text, attachment) {
            const questionId = openQuestion();
            if (!questionId) return;

            answerQuestion(questionId, text, attachment)
                .then(function (result) {
                    global.document.getElementById('add-answer-form')?.reset();
                    global.resetUploadLabel?.('answer-file-name');

                    // Say which of the two happened. A student whose answer is
                    // held needs to know it was received, not assume it failed.
                    notify(
                        result && result.reviewStatus === 'PENDING'
                            ? 'Sent for review. It appears under the question once an administrator approves it.'
                            : 'Answer posted.'
                    );

                    return syncQuestion(questionId);
                })
                .catch(function (error) {
                    notify(error.message || 'Could not post the answer.', 'warning');
                });
        };

        /**
         * Publish or refuse a held answer, from the button on its card.
         *
         * Global because the card markup calls it with an inline `onclick`,
         * which is how every other action on that card is wired.
         */
        global.reviewAnswerDecision = function (answerId, decision) {
            const questionId = openQuestion();
            if (!questionId) return;

            let note;

            if (decision === 'REJECTED') {
                note = global.prompt('Why is this answer not being published? The student will see this.') || '';
                if (!note.trim()) return;
            }

            reviewAnswer(questionId, answerId, decision, note)
                .then(function (result) {
                    notify((result && result.message) || 'Answer reviewed.');
                    renderAnswerQueue();
                    return syncQuestion(questionId);
                })
                .catch(function (error) {
                    notify(error.message || 'Could not review that answer.', 'warning');
                });
        };

        global.toggleAnswerVote = function (answerId) {
            const questionId = openQuestion();
            if (!questionId) return;

            voteAnswer(questionId, answerId)
                .then(function () { return syncQuestion(questionId); })
                .catch(function (error) {
                    notify(error.message || 'Could not record that vote.', 'warning');
                });
        };

        global.markBestAnswer = function (answerId) {
            const questionId = openQuestion();
            if (!questionId) return;

            acceptAnswer(questionId, answerId)
                .then(function () {
                    notify('Answer accepted.');
                    return syncQuestion(questionId);
                })
                .catch(function (error) {
                    notify(error.message || 'Could not accept that answer.', 'warning');
                });
        };

        // Faculty verification goes through the same endpoint: the server
        // decides whether the acceptance also counts as a verification, based
        // on the caller's role. A student cannot verify their own answer.
        global.verifyAnswer = global.markBestAnswer;

        if (global.qaManager) {
            global.qaManager.deleteQuestion = function (questionId) {
                if (!global.confirm('Remove this question for everyone?')) return;

                removeQuestion(questionId)
                    .then(function () { notify('Question removed.'); })
                    .catch(function (error) {
                        notify(error.message || 'Could not remove that question.', 'warning');
                    });
            };

            global.qaManager.refresh = syncQuestions;
        }
    }

    // -----------------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------------

    function listen() {
        global.CoeApi.on('question:created', function (question) {
            upsert(QUESTIONS_KEY, toPortalQuestion(question));
            refresh();
        });

        // A student asking something is announced to reviewers only, through a
        // personal notification rather than the shared room — so the queue is
        // refreshed from there.
        global.CoeApi.on('notification:new', function (notification) {
            const type = String(notification.type || '');

            if (type === 'QA_PENDING') {
                renderQuestionQueue();
                return;
            }

            if (type === 'QA_ANSWER_PENDING') {
                renderAnswerQueue();
                return;
            }

            if (type === 'QA_ANSWER_APPROVED' || type === 'QA_ANSWER_REJECTED') {
                global.showLibraryToast?.(
                    notification.title || 'Answer reviewed',
                    notification.body || '',
                    type === 'QA_ANSWER_APPROVED' ? 'success' : 'error'
                );
                syncQuestions().catch(function () { /* already logged */ });
                return;
            }

            if (type === 'QA_APPROVED' || type === 'QA_REJECTED') {
                global.showLibraryToast?.(
                    notification.title || 'Question reviewed',
                    notification.body || '',
                    type === 'QA_APPROVED' ? 'success' : 'error'
                );
                // A refusal broadcasts question:deleted, which already removes
                // it; this re-sync is what restores it to the asker's own list
                // with the "not published" note.
                syncQuestions().catch(function () { /* already logged */ });
            }
        });

        global.CoeApi.on('question:updated', function (question) {
            upsert(QUESTIONS_KEY, toPortalQuestion(question));
            refresh();
        });

        global.CoeApi.on('question:deleted', function (payload) {
            write(QUESTIONS_KEY, read(QUESTIONS_KEY).filter(q => q.id !== payload.id));
            write(ANSWERS_KEY, read(ANSWERS_KEY).filter(a => a.questionId !== payload.id));
            refresh();
        });

        global.CoeApi.on('answer:created', function (answer) {
            upsert(ANSWERS_KEY, toPortalAnswer(answer, viewerKey()));
            refresh();
        });

        global.CoeApi.on('answer:updated', function (answer) {
            // Preserve the viewer's own vote flag: the broadcast carries the
            // new total but not whose vote it was, and re-deriving it from the
            // payload would make everyone's button light up.
            const existing = read(ANSWERS_KEY).find(a => a.id === answer.id);
            const mine = existing ? existing.votes.indexOf(viewerKey()) > -1 : false;
            upsert(ANSWERS_KEY, toPortalAnswer(
                Object.assign({}, answer, { votedByMe: mine, comments: existing ? existing.comments : [] }),
                viewerKey()
            ));
            refresh();
        });

        global.CoeApi.on('answer:deleted', function (payload) {
            write(ANSWERS_KEY, read(ANSWERS_KEY).filter(a => a.id !== payload.id));
            refresh();
        });

        global.CoeApi.on('answer:comment', function (comment) {
            const answers = read(ANSWERS_KEY);
            const answer = answers.find(a => a.id === comment.answerId);
            if (!answer) return;

            if (!answer.comments.some(c => c.id === comment.id)) {
                answer.comments.push({
                    id: comment.id,
                    text: comment.text,
                    commenter: comment.commenterId || '',
                    commenterName: comment.commenterName || 'Anonymous Student',
                    createdAt: comment.createdAt
                });
                write(ANSWERS_KEY, answers);
                refresh();
            }
        });
    }

    function start() {
        if (!global.CoeApi || !global.CoeApi.isServed()) {
            console.warn('[coe-qa] not served by the app server; the Q&A board stays local to this browser');
            return Promise.resolve(false);
        }

        return global.CoeApi.session(false)
            .then(function (current) {
                if (!current) return false;

                installOverrides();

                return Promise.all([syncQuestions(), global.CoeApi.connect()])
                    .then(function () {
                        listen();
                        ready = true;

                        // After `ready`, so a failure here cannot stop the
                        // board itself from working.
                        renderQuestionQueue();
                        renderAnswerQueue();
                        return true;
                    });
            })
            .catch(function (error) {
                console.error('[coe-qa] startup failed', error);
                return false;
            });
    }

    global.CoeQA = {
        start,
        syncQuestions,
        syncQuestion,
        askQuestion,
        answerQuestion,
        voteAnswer,
        commentOnAnswer,
        acceptAnswer,
        removeQuestion,
        canReview,
        listPendingQuestions,
        reviewQuestion,
        renderQuestionQueue,
        reviewAnswer,
        listPendingAnswers,
        renderAnswerQueue,
        toPortalQuestion,
        toPortalAnswer,
        get ready() { return ready; }
    };

    if (global.CoeApi && global.CoeApi.isServed()) {
        global.CoeQA.booted = start();
    }
})(window);
