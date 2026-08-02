// Tanong Mo, Sagot Ko - COE Q&A Hub
// Public student Q&A board with answer votes, flags, and threaded comments.

const LOCAL_STORAGE_QUESTIONS = 'coeQAHubQuestions';
const LOCAL_STORAGE_ANSWERS = 'coeQAHubAnswers';

const QUESTION_STATUS = {
    UNANSWERED: 'Unanswered',
    ANSWERED: 'Answered',
    VERIFIED: 'Verified Answer',
    SOLVED: 'Solved'
};
const QA_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;

let currentQuestion = null;
const qaCurrentUser = JSON.parse(localStorage.getItem('studentWorkplaceCurrentUser') || '{}');

/**
 * Who may post the official reply, and approve a question onto the board.
 *
 * Faculty as well as admins — a lecturer answering questions about their own
 * subject is the point of the board. Must match QA_ANSWERER_ROLES on the
 * server, which is what actually enforces it; this only decides what the page
 * offers, so a mismatch here is a button that answers 403, not a way in.
 *
 * Still named `qaIsAdmin` because it is read in a dozen places below and the
 * meaning — "may give the official reply" — has not changed.
 */
const qaIsAdmin = Boolean(qaCurrentUser) &&
    ['ADMIN', 'FACULTY'].indexOf(String(qaCurrentUser.role || '').toUpperCase()) > -1;

document.addEventListener('DOMContentLoaded', function () {
    initializeQAHub();
});

function initializeQAHub() {
    const askQuestionBtn = document.getElementById('ask-question-btn');
    const askQuestionForm = document.getElementById('ask-question-form');
    const addAnswerForm = document.getElementById('add-answer-form');
    const myAnswersTabBtn = document.getElementById('qa-my-answers-tab-btn');
    const qaTabs = document.querySelectorAll('.qa-tab-btn');
    const closeAskModal = document.getElementById('close-ask-modal');
    const closeDetailModal = document.getElementById('close-detail-modal');
    const qaModal = document.getElementById('ask-question-modal');
    const detailModal = document.getElementById('question-detail-modal');
    const askSubmitBtn = askQuestionForm?.querySelector('button[type="submit"]');

    askQuestionBtn?.addEventListener('click', openAskQuestionModal);
    document.querySelectorAll('[data-qa-open-ask]').forEach(button => {
        button.addEventListener('click', openAskQuestionModal);
    });
    // Shown to everyone now — students have answers of their own to track, and
    // the tab is where they find out whether one was published.
    if (myAnswersTabBtn) {
        myAnswersTabBtn.hidden = false;
        myAnswersTabBtn.textContent = qaIsAdmin ? 'Admin Answers' : 'My Answers';
    }
    updateAnswerComposerAccess();

    setupFileUpload('question-file-upload', 'question-file-name');
    setupFileUpload('question-camera-upload', 'question-file-name');
    setupFileUpload('answer-file-upload', 'answer-file-name');
    setupFileUpload('answer-camera-upload', 'answer-file-name');

    askQuestionForm?.addEventListener('submit', handleAskQuestion);
    askQuestionForm?.addEventListener('invalid', function () {
        showQANotice('Complete the required fields before posting your question.', 'warning');
    }, true);
    askSubmitBtn?.addEventListener('click', function () {
        if (!askQuestionForm.checkValidity()) {
            showQANotice('Complete the required fields before posting your question.', 'warning');
            askQuestionForm.reportValidity?.();
        }
    });
    addAnswerForm?.addEventListener('submit', handleAddAnswer);

    qaTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            switchQATab(this.dataset.qaTab);
        });
    });

    closeAskModal?.addEventListener('click', () => {
        closeModal(qaModal);
    });

    closeDetailModal?.addEventListener('click', () => {
        closeModal(detailModal);
    });

    window.addEventListener('click', function (event) {
        if (event.target === qaModal) closeModal(qaModal);
        if (event.target === detailModal) closeModal(detailModal);
    });

    const filters = document.querySelectorAll('#filter-course, #filter-status, #filter-year-level, #filter-tag, #qa-sort, #qa-search');
    filters.forEach(filter => {
        filter.addEventListener('change', displayBrowseQuestions);
        filter.addEventListener('input', displayBrowseQuestions);
        filter.addEventListener('keyup', displayBrowseQuestions);
    });

    populateQATagFilter();
    displayBrowseQuestions();
}

function setupFileUpload(inputId, displayId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('change', function () {
        const displayElement = document.getElementById(displayId);
        if (!displayElement) return;
        displayElement.textContent = this.files.length > 0 ? `Selected: ${this.files[0].name}` : 'No file selected';
    });
}

function openAskQuestionModal() {
    const modal = document.getElementById('ask-question-modal');
    prepareAskQuestionForm();
    if (modal) {
        modal.style.display = 'block';
        modal.setAttribute('aria-hidden', 'false');
    }
    setTimeout(() => document.getElementById('question-title')?.focus(), 60);
}

function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function prepareAskQuestionForm() {
    const courseSelect = document.getElementById('question-course');
    const yearSelect = document.getElementById('question-year');

    if (courseSelect && !courseSelect.value) {
        const preferredCourse = String(qaCurrentUser.discipline || '').toUpperCase();
        courseSelect.value = ['CE', 'EE'].includes(preferredCourse) ? preferredCourse : 'CE';
    }

    if (yearSelect && !yearSelect.value) {
        const preferredYear = String(qaCurrentUser.year || '').trim();
        yearSelect.value = ['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(preferredYear)
            ? preferredYear
            : '1st Year';
    }
}

function handleAskQuestion(event) {
    event.preventDefault();

    const title = document.getElementById('question-title')?.value.trim();
    const description = document.getElementById('question-description')?.value.trim();
    const course = document.getElementById('question-course')?.value;
    const yearLevel = document.getElementById('question-year')?.value;
    const subject = document.getElementById('question-subject')?.value.trim();
    const lesson = document.getElementById('question-lesson')?.value.trim();
    const tags = parseTags(document.getElementById('question-tags')?.value || '');

    if (!title || !description || !course || !yearLevel || !subject) {
        showQANotice('Please fill in the required question fields.', 'warning');
        return;
    }

    const fileInput = document.getElementById('question-file-upload');
    const cameraInput = document.getElementById('question-camera-upload');
    const fileToUpload = fileInput?.files?.[0] || cameraInput?.files?.[0];

    if (fileToUpload) {
        /*
         * Two ways to carry a file, and which one is right depends on whether
         * there is a server.
         *
         * Served: hand over the File itself. coe-qa.js posts it as multipart to
         * `/api/qa/questions`, which validates the magic bytes and writes it to
         * the same storage the library uses. Base64-ing it first would inflate
         * it by a third for nothing, and the 2 MB ceiling below exists only
         * because base64 in localStorage had one.
         *
         * Standalone (index.html opened off the disk): there is nowhere to put
         * bytes but this browser, so it is read into a data URL as before.
         */
        if (window.CoeQA && window.CoeQA.ready) {
            try {
                saveQuestion(title, description, course, yearLevel, subject, lesson, tags, {
                    name: fileToUpload.name,
                    type: fileToUpload.type,
                    file: fileToUpload
                });
            } catch (error) {
                handleQASaveError(error);
            }
            return;
        }

        if (fileToUpload.size > QA_ATTACHMENT_MAX_BYTES) {
            showQANotice('Attachment is too large. Use a file under 2 MB, or post the question without the file.', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (readerEvent) {
            try {
                saveQuestion(title, description, course, yearLevel, subject, lesson, tags, {
                    name: fileToUpload.name,
                    type: fileToUpload.type,
                    data: readerEvent.target.result
                });
            } catch (error) {
                handleQASaveError(error);
            }
        };
        reader.onerror = function () {
            showQANotice('Could not read the attachment. Try a smaller file or post without it.', 'warning');
        };
        reader.readAsDataURL(fileToUpload);
        return;
    }

    try {
        saveQuestion(title, description, course, yearLevel, subject, lesson, tags, null);
    } catch (error) {
        handleQASaveError(error);
    }
}

function saveQuestion(title, description, course, yearLevel, subject, lesson, tags, attachment) {
    const question = normalizeQuestion({
        id: generateId('question'),
        title,
        description,
        course,
        yearLevel,
        subject,
        lesson,
        tags,
        attachment,
        asker: getCurrentUserKey(),
        askerName: qaCurrentUser.name || qaCurrentUser.username || 'Anonymous Student',
        status: QUESTION_STATUS.UNANSWERED,
        createdAt: new Date().toISOString(),
        bestAnswerId: null,
        flags: []
    });

    const questions = getQuestions();
    questions.push(question);
    saveQuestions(questions);

    document.getElementById('ask-question-form')?.reset();
    resetUploadLabel('question-file-name');
    const modal = document.getElementById('ask-question-modal');
    closeModal(modal);

    logQAActivity(`Posted a question: "${title}"`);
    populateQATagFilter();
    displayBrowseQuestions();
    displayMyQuestions();
    displayAdminModeration();
    showQANotice('Question posted to Tanong Mo, Sagot Ko.');
}

function getQuestions() {
    try {
        const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_QUESTIONS) || '[]');
        return Array.isArray(stored) ? stored.map(normalizeQuestion) : [];
    } catch (error) {
        return [];
    }
}

function saveQuestions(questions) {
    localStorage.setItem(LOCAL_STORAGE_QUESTIONS, JSON.stringify(questions.map(normalizeQuestion)));
}

function getAnswers() {
    try {
        const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ANSWERS) || '[]');
        return Array.isArray(stored) ? stored.map(normalizeAnswer) : [];
    } catch (error) {
        return [];
    }
}

function saveAnswers(answers) {
    localStorage.setItem(LOCAL_STORAGE_ANSWERS, JSON.stringify(answers.map(normalizeAnswer)));
}

function normalizeQuestion(question) {
    const status = Object.values(QUESTION_STATUS).includes(question.status) ? question.status : QUESTION_STATUS.UNANSWERED;
    return {
        ...question,
        id: question.id || generateId('question'),
        title: question.title || 'Untitled Question',
        description: question.description || '',
        course: question.course || 'CE',
        yearLevel: question.yearLevel || '',
        subject: question.subject || '',
        lesson: question.lesson || '',
        tags: Array.isArray(question.tags) ? question.tags.map(cleanTag).filter(Boolean) : parseTags(question.tags || ''),
        asker: question.asker || 'Anonymous',
        askerName: question.askerName || 'Anonymous Student',
        status,
        createdAt: question.createdAt || new Date().toISOString(),
        bestAnswerId: question.bestAnswerId || null,
        flags: Array.isArray(question.flags) ? question.flags : []
    };
}

function normalizeAnswer(answer) {
    return {
        ...answer,
        id: answer.id || generateId('answer'),
        questionId: answer.questionId || '',
        text: answer.text || '',
        answerer: answer.answerer || 'Anonymous',
        answererName: answer.answererName || 'Anonymous Student',
        verified: Boolean(answer.verified),
        // Defaults to APPROVED so an answer written in the standalone
        // (no-server) path is not permanently stuck behind a review that
        // nothing there can perform.
        reviewStatus: answer.reviewStatus || 'APPROVED',
        rejectionNote: answer.rejectionNote || '',
        createdAt: answer.createdAt || new Date().toISOString(),
        votes: Array.isArray(answer.votes) ? answer.votes : [],
        flags: Array.isArray(answer.flags) ? answer.flags : [],
        comments: Array.isArray(answer.comments) ? answer.comments.map(normalizeAnswerComment) : []
    };
}

function normalizeAnswerComment(comment) {
    return {
        id: comment.id || generateId('comment'),
        text: comment.text || '',
        commenter: comment.commenter || 'Anonymous',
        commenterName: comment.commenterName || 'Anonymous Student',
        createdAt: comment.createdAt || new Date().toISOString()
    };
}

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function displayBrowseQuestions() {
    const questionsList = document.getElementById('questions-list');
    if (!questionsList) return;

    const allQuestions = getQuestions();
    const allAnswers = getAnswers();
    let questions = applyQuestionFilters(allQuestions, allAnswers);

    updateQAStats(allQuestions, allAnswers);
    populateQATagFilter(allQuestions);

    if (questions.length === 0) {
        questionsList.innerHTML = '<p class="empty-state">No questions match your search.</p>';
        return;
    }

    questionsList.innerHTML = questions.map(question => renderQuestionCard(question, allAnswers)).join('');
}

function applyQuestionFilters(questions, answers) {
    const courseFilter = document.getElementById('filter-course')?.value || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';
    const yearFilter = document.getElementById('filter-year-level')?.value || '';
    const tagFilter = document.getElementById('filter-tag')?.value || '';
    const sort = document.getElementById('qa-sort')?.value || 'newest';
    const searchTerm = (document.getElementById('qa-search')?.value || '').trim().toLowerCase();

    return questions
        .filter(question => {
            const tags = getSearchableQuestionTags(question);
            const text = [
                question.title,
                question.description,
                question.subject,
                question.lesson,
                question.course,
                question.yearLevel,
                ...tags
            ].join(' ').toLowerCase();

            const matchesCourse = !courseFilter || question.course === courseFilter;
            const matchesStatus = !statusFilter || question.status === statusFilter;
            const matchesYear = !yearFilter || question.yearLevel === yearFilter;
            const matchesTag = !tagFilter || tags.some(tag => tag.toLowerCase() === tagFilter.toLowerCase());
            const matchesSearch = !searchTerm || text.includes(searchTerm);
            return matchesCourse && matchesStatus && matchesYear && matchesTag && matchesSearch;
        })
        .sort((left, right) => sortQuestions(left, right, answers, sort));
}

function sortQuestions(left, right, answers, sort) {
    if (sort === 'unanswered') {
        const leftUnanswered = left.status === QUESTION_STATUS.UNANSWERED ? 1 : 0;
        const rightUnanswered = right.status === QUESTION_STATUS.UNANSWERED ? 1 : 0;
        if (leftUnanswered !== rightUnanswered) return rightUnanswered - leftUnanswered;
    }

    if (sort === 'popular') {
        const leftScore = getQuestionScore(left.id, answers);
        const rightScore = getQuestionScore(right.id, answers);
        if (leftScore !== rightScore) return rightScore - leftScore;
    }

    return new Date(right.createdAt) - new Date(left.createdAt);
}

function getQuestionScore(questionId, answers = getAnswers()) {
    return answers
        .filter(answer => answer.questionId === questionId)
        .reduce((score, answer) => score + 1 + answer.votes.length + answer.comments.length, 0);
}

function renderQuestionCard(question, allAnswers) {
    const answers = getAnswersForQuestion(question.id, allAnswers);
    const answerCount = answers.length;
    const voteCount = answers.reduce((total, answer) => total + answer.votes.length, 0);
    const commentCount = answers.reduce((total, answer) => total + answer.comments.length, 0);
    const tags = getSearchableQuestionTags(question).slice(0, 6);
    const answeredClass = question.status === QUESTION_STATUS.UNANSWERED ? 'is-unanswered' : 'is-answered';
    const flagMarkup = question.flags.length ? `<span><span class="material-icons">flag</span> ${question.flags.length} Flags</span>` : '';

    /*
     * Publication state.
     *
     * A question that is not APPROVED is only in this list because the viewer
     * asked it — the API returns approved questions plus the caller's own — so
     * "only you can see this" is a fact rather than a guess. Without the badge
     * a student asks something and watches it apparently vanish.
     */
    const review = String(question.reviewStatus || 'APPROVED').toUpperCase();
    const isAwaitingReview = review === 'PENDING';
    const isRefused = review === 'REJECTED';
    const reviewMarkup = isAwaitingReview
        ? '<div class="qa-review-note is-pending"><span class="material-icons">schedule</span> Waiting for a faculty member to approve it. Only you can see this for now.</div>'
        : (isRefused
            ? '<div class="qa-review-note is-refused"><span class="material-icons">block</span> Not published. Only you can see this.</div>'
            : '');

    return `
        <article class="question-card ${answeredClass} ${isAwaitingReview ? 'is-awaiting-review' : ''} ${isRefused ? 'is-refused' : ''}" onclick="openQuestionDetail('${question.id}')">
            <div class="question-status-badge ${getQuestionStatusClass(question.status)}">
                ${escapeHtml(question.status)}
            </div>
            <h4 class="question-title">${escapeHtml(question.title)}</h4>
            ${reviewMarkup}
            <p class="question-preview">${escapeHtml(truncateText(question.description, 140))}</p>
            <div class="question-meta">
                ${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
            <div class="question-footer">
                <div class="question-stats">
                    <span><span class="material-icons">question_answer</span> ${answerCount} Answers</span>
                    <span><span class="material-icons">thumb_up</span> ${voteCount} Likes</span>
                    <span><span class="material-icons">forum</span> ${commentCount} Comments</span>
                    ${flagMarkup}
                </div>
                <span class="question-date">${formatTimeAgo(question.createdAt)}</span>
            </div>
        </article>
    `;
}

function updateQAStats(questions, answers = getAnswers()) {
    const totalCount = document.getElementById('total-questions');
    const unansweredCount = document.getElementById('unanswered-count');
    const verifiedCount = document.getElementById('verified-count');
    const dashboardTotal = document.getElementById('qa-dashboard-total');
    const dashboardUnanswered = document.getElementById('qa-dashboard-unanswered');
    const dashboardVerified = document.getElementById('qa-dashboard-verified');
    const dashboardAnswers = document.getElementById('qa-dashboard-answers');
    const unansweredTotal = questions.filter(q => q.status === QUESTION_STATUS.UNANSWERED).length;
    const verifiedTotal = answers.filter(answer => answer.verified).length;

    if (totalCount) totalCount.textContent = questions.length;
    if (unansweredCount) unansweredCount.textContent = unansweredTotal;
    if (verifiedCount) verifiedCount.textContent = verifiedTotal;
    if (dashboardTotal) dashboardTotal.textContent = questions.length;
    if (dashboardUnanswered) dashboardUnanswered.textContent = unansweredTotal;
    if (dashboardVerified) dashboardVerified.textContent = verifiedTotal;
    if (dashboardAnswers) dashboardAnswers.textContent = answers.length;
}

function getAnswersForQuestion(questionId, answers = getAnswers()) {
    return answers.filter(answer => answer.questionId === questionId);
}

function openQuestionDetail(questionId) {
    currentQuestion = getQuestions().find(question => question.id === questionId);
    if (!currentQuestion) return;

    const answers = getAnswersForQuestion(questionId);
    const title = document.getElementById('detail-question-title');
    const courseBadge = document.getElementById('detail-course-badge');
    const yearBadge = document.getElementById('detail-year-badge');
    const statusBadge = document.getElementById('detail-status-badge');
    const askerInfo = document.getElementById('detail-asker-info');
    const description = document.getElementById('detail-question-description');
    const subject = document.getElementById('qa-detail-subject');
    const lesson = document.getElementById('qa-detail-lesson');
    const askedDate = document.getElementById('detail-asked-date');
    const attachmentDiv = document.getElementById('detail-question-attachment');
    const answerCount = document.getElementById('answer-count');

    if (title) title.textContent = currentQuestion.title;
    if (courseBadge) courseBadge.textContent = currentQuestion.course;
    if (yearBadge) yearBadge.textContent = currentQuestion.yearLevel;
    if (statusBadge) {
        statusBadge.textContent = currentQuestion.status;
        statusBadge.className = `badge-status ${getQuestionStatusClass(currentQuestion.status)}`;
    }

    if (askerInfo) {
        const flagged = currentQuestion.flags.includes(getCurrentUserKey());
        askerInfo.innerHTML = `
            <div class="asker-info">
                <span class="asker-name">${escapeHtml(currentQuestion.askerName)}</span>
                <span class="asker-date">Asked ${formatTimeAgo(currentQuestion.createdAt)}</span>
                <button type="button" class="flag-link ${flagged ? 'active' : ''}" onclick="event.stopPropagation(); flagQuestion('${currentQuestion.id}')">
                    <span class="material-icons">flag</span>${flagged ? 'Flagged' : 'Flag'}
                </button>
            </div>
        `;
    }

    if (description) description.textContent = currentQuestion.description;
    if (subject) subject.textContent = currentQuestion.subject;
    if (lesson) lesson.textContent = currentQuestion.lesson || 'Not specified';
    if (askedDate) askedDate.textContent = `Asked on ${formatDate(currentQuestion.createdAt)}`;
    if (answerCount) answerCount.textContent = answers.length;

    if (attachmentDiv) {
        attachmentDiv.innerHTML = renderQaAttachment(currentQuestion.attachment, 'Question attachment', '');
    }

    displayAnswers(answers, currentQuestion.id);
    updateAnswerComposerAccess();

    const detailModal = document.getElementById('question-detail-modal');
    if (detailModal) detailModal.style.display = 'block';
}

function displayAnswers(answers) {
    const answersList = document.getElementById('answers-list');
    if (!answersList) return;

    if (answers.length === 0) {
        answersList.innerHTML = qaIsAdmin
            ? '<p class="empty-state">No admin answer yet. Add the official reply below.</p>'
            : '<p class="empty-state">No admin answer yet. Please wait for an official reply.</p>';
        return;
    }

    const sortedAnswers = answers.slice().sort(sortAnswersForDetail);
    answersList.innerHTML = sortedAnswers.map(renderAnswerCard).join('');
}

function sortAnswersForDetail(left, right) {
    const leftBest = currentQuestion?.bestAnswerId === left.id ? 1 : 0;
    const rightBest = currentQuestion?.bestAnswerId === right.id ? 1 : 0;
    if (leftBest !== rightBest) return rightBest - leftBest;
    if (left.verified !== right.verified) return Number(right.verified) - Number(left.verified);
    if (left.votes.length !== right.votes.length) return right.votes.length - left.votes.length;
    return new Date(right.createdAt) - new Date(left.createdAt);
}

function renderAnswerCard(answer) {
    const isBestAnswer = currentQuestion?.bestAnswerId === answer.id;
    const hasVoted = answer.votes.includes(getCurrentUserKey());
    const hasFlagged = answer.flags.includes(getCurrentUserKey());
    const commentMarkup = answer.comments.length
        ? answer.comments.map(comment => `
            <div class="answer-comment">
                <strong>${escapeHtml(comment.commenterName)}</strong>
                <span>${escapeHtml(comment.text)}</span>
                <small>${formatTimeAgo(comment.createdAt)}</small>
            </div>
        `).join('')
        : '<p class="empty-comments">No comments yet.</p>';

    /*
     * A held answer, shown to the two people allowed to see it.
     *
     * The server only sends a PENDING answer to its author and to reviewers, so
     * reaching this branch already means the viewer is one of them. The banner
     * says which — a student needs "yours is waiting", an administrator needs
     * "this is the thing to decide about", and the buttons differ accordingly.
     */
    const pending = answer.reviewStatus === 'PENDING';
    const rejected = answer.reviewStatus === 'REJECTED';

    const reviewBanner = pending
        ? `<div class="answer-review-banner">
                <span class="material-icons">schedule</span>
                <span>${qaIsAdmin
                    ? 'Waiting for your review. Only you and the person who wrote it can see this.'
                    : 'Waiting for review. Only you and the administrators can see this for now.'}</span>
           </div>`
        : rejected
            ? `<div class="answer-review-banner is-rejected">
                    <span class="material-icons">block</span>
                    <span>Not published.${answer.rejectionNote ? ' ' + escapeHtml(answer.rejectionNote) : ''}</span>
               </div>`
            : '';

    const reviewActions = qaIsAdmin && (pending || rejected)
        ? `<button type="button" onclick="reviewAnswerDecision('${answer.id}', 'APPROVED')" class="answer-publish-btn">
                <span class="material-icons">check_circle</span>Publish
           </button>
           ${pending
                ? `<button type="button" onclick="reviewAnswerDecision('${answer.id}', 'REJECTED')" class="answer-refuse-btn">
                        <span class="material-icons">block</span>Refuse
                   </button>`
                : ''}`
        : '';

    return `
        <article class="answer-card ${isBestAnswer ? 'best-answer' : ''}${pending ? ' is-pending' : ''}${rejected ? ' is-rejected' : ''}">
            ${isBestAnswer ? '<div class="best-answer-badge"><span class="material-icons">check_circle</span> Best Answer</div>' : ''}
            ${reviewBanner}
            <div class="answer-header">
                <div class="answerer-info">
                    <span class="answerer-name">${escapeHtml(answer.answererName)}</span>
                    <span class="answerer-date">${formatTimeAgo(answer.createdAt)}${answer.verified ? ' | Verified by admin' : ''}</span>
                </div>
                <div class="answer-actions">
                    ${reviewActions}
                    ${!pending && !rejected && currentQuestion?.asker === getCurrentUserKey()
                        ? `<button type="button" onclick="markBestAnswer('${answer.id}')" class="mark-best-btn ${isBestAnswer ? 'marked' : ''}">
                            <span class="material-icons">${isBestAnswer ? 'check_circle' : 'radio_button_unchecked'}</span>
                            ${isBestAnswer ? 'Best' : 'Mark Best'}
                        </button>`
                        : ''
                    }
                    ${qaIsAdmin && !pending && !rejected
                        ? `<button type="button" onclick="verifyAnswer('${answer.id}')" class="verify-btn ${answer.verified ? 'marked' : ''}">
                            <span class="material-icons">verified</span>
                            ${answer.verified ? 'Verified' : 'Verify'}
                        </button>`
                        : ''
                    }
                </div>
            </div>
            <p class="answer-text">${escapeHtml(answer.text)}</p>
            ${renderAnswerAttachment(answer)}
            <div class="answer-engagement">
                <button type="button" class="engagement-btn ${hasVoted ? 'active' : ''}" onclick="toggleAnswerVote('${answer.id}')">
                    <span class="material-icons">thumb_up</span>
                    ${answer.votes.length}
                </button>
                <button type="button" class="engagement-btn ${hasFlagged ? 'active flag-active' : ''}" onclick="flagAnswer('${answer.id}')">
                    <span class="material-icons">flag</span>
                    ${answer.flags.length}
                </button>
                <span class="answer-comment-count"><span class="material-icons">forum</span> ${answer.comments.length} comments</span>
            </div>
            <div class="answer-comments">
                ${commentMarkup}
                <div class="comment-form">
                    <input type="text" id="answer-comment-${answer.id}" placeholder="Reply under this answer...">
                    <button type="button" onclick="addAnswerComment('${answer.id}')" title="Reply">
                        <span class="material-icons">reply</span>
                    </button>
                </div>
            </div>
        </article>
    `;
}

/**
 * Draw one attachment.
 *
 * Handles both shapes an attachment can arrive in — a `data:` URL from the
 * standalone path, and a `/api/qa/attachment/...` path from the server. Two
 * call sites (question and answer) had a copy of this each and only understood
 * the first, which is why a file uploaded through the app appeared as nothing
 * at all: the markup was drawn with `src="undefined"`.
 *
 * A non-image gets a link rather than a dead line of text. "attachment.pdf" as
 * plain text was the old behaviour, and it told a student a file existed while
 * giving them no way to open it.
 */
function renderQaAttachment(attachment, altLabel, imageClass) {
    if (!attachment) return '';

    const source = attachment.url || attachment.data || '';
    const name = attachment.name || altLabel;
    const isImage = String(attachment.type || '').startsWith('image');

    if (!source) {
        return `<p class="file-attachment"><span class="material-icons">attachment</span> ${escapeHtml(name)}</p>`;
    }

    if (isImage) {
        return `<a href="${escapeHtml(source)}" target="_blank" rel="noopener" class="qa-attachment-link">
                    <img src="${escapeHtml(source)}" alt="${escapeHtml(name)}"${imageClass ? ` class="${imageClass}"` : ''}>
                </a>`;
    }

    return `<a class="file-attachment is-link" href="${escapeHtml(source)}" target="_blank" rel="noopener">
                <span class="material-icons">attachment</span>${escapeHtml(name)}
            </a>`;
}

function renderAnswerAttachment(answer) {
    return renderQaAttachment(answer.attachment, 'Answer attachment', 'answer-attachment');
}

function handleAddAnswer(event) {
    event.preventDefault();
    if (!currentQuestion) return;

    // The admin-only gate is gone: a classmate who knows the answer may write
    // one. What keeps a wrong answer off the board is review, not silence — a
    // student's answer is held until an administrator publishes it. The server
    // enforces both halves; this only decides what the page offers.

    const answerText = document.getElementById('answer-text')?.value.trim();
    if (!answerText) {
        showQANotice('Please enter your answer.', 'warning');
        return;
    }

    const fileInput = document.getElementById('answer-file-upload');
    const cameraInput = document.getElementById('answer-camera-upload');
    const fileToUpload = fileInput?.files?.[0] || cameraInput?.files?.[0];

    if (fileToUpload) {
        // Same split as the ask form — the File itself when there is a server
        // to send it to, a data URL only when there is not.
        if (window.CoeQA && window.CoeQA.ready) {
            saveAnswer(answerText, {
                name: fileToUpload.name,
                type: fileToUpload.type,
                file: fileToUpload
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = function (readerEvent) {
            saveAnswer(answerText, {
                name: fileToUpload.name,
                type: fileToUpload.type,
                data: readerEvent.target.result
            });
        };
        reader.readAsDataURL(fileToUpload);
        return;
    }

    saveAnswer(answerText, null);
}

function saveAnswer(text, attachment) {
    const answer = normalizeAnswer({
        id: generateId('answer'),
        questionId: currentQuestion.id,
        text,
        attachment,
        answerer: getCurrentUserKey(),
        answererName: qaCurrentUser.name || qaCurrentUser.username || 'Anonymous Student',
        verified: false,
        createdAt: new Date().toISOString(),
        votes: [],
        flags: [],
        comments: []
    });

    const answers = getAnswers();
    answers.push(answer);
    saveAnswers(answers);
    updateQuestionAfterAnswer(currentQuestion.id);

    document.getElementById('add-answer-form')?.reset();
    resetUploadLabel('answer-file-name');
    logQAActivity(`Answered a question: "${currentQuestion.title}"`);
    openQuestionDetail(currentQuestion.id);
    displayBrowseQuestions();
    showQANotice('Answer posted.');
}

function updateQuestionAfterAnswer(questionId) {
    const questions = getQuestions();
    const index = questions.findIndex(question => question.id === questionId);
    if (index === -1) return;
    if (questions[index].status === QUESTION_STATUS.UNANSWERED) {
        questions[index].status = QUESTION_STATUS.ANSWERED;
    }
    saveQuestions(questions);
    currentQuestion = questions[index];
}

function markBestAnswer(answerId) {
    if (!currentQuestion) return;
    currentQuestion.bestAnswerId = currentQuestion.bestAnswerId === answerId ? null : answerId;
    currentQuestion.status = currentQuestion.bestAnswerId ? QUESTION_STATUS.SOLVED : QUESTION_STATUS.ANSWERED;
    persistCurrentQuestion();
    openQuestionDetail(currentQuestion.id);
    displayBrowseQuestions();
}

function verifyAnswer(answerId) {
    if (!currentQuestion || !qaIsAdmin) {
        showQANotice('Only admins can verify answers.', 'warning');
        return;
    }

    const answers = getAnswers();
    const answer = answers.find(item => item.id === answerId);
    if (!answer) return;

    answer.verified = !answer.verified;
    saveAnswers(answers);

    const hasVerifiedAnswer = answers.some(item => item.questionId === currentQuestion.id && item.verified);
    currentQuestion.status = hasVerifiedAnswer ? QUESTION_STATUS.VERIFIED : (currentQuestion.bestAnswerId ? QUESTION_STATUS.SOLVED : QUESTION_STATUS.ANSWERED);
    persistCurrentQuestion();
    openQuestionDetail(currentQuestion.id);
    displayBrowseQuestions();
}

function toggleAnswerVote(answerId) {
    const answers = getAnswers();
    const answer = answers.find(item => item.id === answerId);
    if (!answer) return;

    const userKey = getCurrentUserKey();
    answer.votes = toggleArrayValue(answer.votes, userKey);
    saveAnswers(answers);
    if (currentQuestion) openQuestionDetail(currentQuestion.id);
    displayBrowseQuestions();
}

function flagQuestion(questionId) {
    const questions = getQuestions();
    const question = questions.find(item => item.id === questionId);
    if (!question) return;

    question.flags = toggleArrayValue(question.flags, getCurrentUserKey());
    saveQuestions(questions);
    currentQuestion = question;
    openQuestionDetail(questionId);
    displayBrowseQuestions();
    showQANotice(question.flags.includes(getCurrentUserKey()) ? 'Question flagged for review.' : 'Question flag removed.');
}

function flagAnswer(answerId) {
    const answers = getAnswers();
    const answer = answers.find(item => item.id === answerId);
    if (!answer) return;

    answer.flags = toggleArrayValue(answer.flags, getCurrentUserKey());
    saveAnswers(answers);
    if (currentQuestion) openQuestionDetail(currentQuestion.id);
    displayBrowseQuestions();
    showQANotice(answer.flags.includes(getCurrentUserKey()) ? 'Answer flagged for review.' : 'Answer flag removed.');
}

function addAnswerComment(answerId) {
    const input = document.getElementById(`answer-comment-${answerId}`);
    const text = input?.value.trim();
    if (!text) return;

    const answers = getAnswers();
    const answer = answers.find(item => item.id === answerId);
    if (!answer) return;

    answer.comments.push(normalizeAnswerComment({
        id: generateId('comment'),
        text,
        commenter: getCurrentUserKey(),
        commenterName: qaCurrentUser.name || qaCurrentUser.username || 'Anonymous Student',
        createdAt: new Date().toISOString()
    }));
    saveAnswers(answers);
    if (input) input.value = '';
    if (currentQuestion) openQuestionDetail(currentQuestion.id);
    displayBrowseQuestions();
}

function persistCurrentQuestion() {
    if (!currentQuestion) return;
    const questions = getQuestions();
    const index = questions.findIndex(question => question.id === currentQuestion.id);
    if (index !== -1) {
        questions[index] = currentQuestion;
        saveQuestions(questions);
    }
}

function switchQATab(tab) {
    if (tab === 'my-answers' && !qaIsAdmin) {
        tab = 'my-questions';
    }
    document.querySelectorAll('.qa-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.qaTab === tab);
    });

    document.querySelectorAll('.qa-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    document.getElementById(`${tab}-tab`)?.classList.add('active');

    if (tab === 'browse') displayBrowseQuestions();
    if (tab === 'my-questions') displayMyQuestions();
    if (tab === 'my-answers') displayMyAnswers();
}

function displayMyQuestions() {
    const container = document.getElementById('my-questions-list');
    if (!container) return;
    const myQuestions = getQuestions()
        .filter(question => question.asker === getCurrentUserKey())
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const answers = getAnswers();

    container.innerHTML = myQuestions.length
        ? myQuestions.map(question => renderQuestionCard(question, answers)).join('')
        : '<p class="empty-state">You have not asked any questions yet.</p>';
}

function displayMyAnswers() {
    const container = document.getElementById('my-answers-list');
    if (!container) return;

    // No longer admin-only: students answer too, and this is where they see
    // what they wrote and whether it has been published yet.
    const myAnswers = getAnswers()
        .filter(answer => answer.answerer === getCurrentUserKey())
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const questions = getQuestions();

    if (!myAnswers.length) {
        container.innerHTML = '<p class="empty-state">You have not answered any questions yet.</p>';
        return;
    }

    container.innerHTML = myAnswers.map(answer => {
        const question = questions.find(item => item.id === answer.questionId);
        if (!question) return '';
        const isBest = question.bestAnswerId === answer.id;
        // Where a student finds out what happened to their answer. Without it
        // a held answer is indistinguishable from one that was published.
        const reviewBadge = answer.reviewStatus === 'PENDING'
            ? '<span class="badge-pending"><span class="material-icons">schedule</span> Waiting for review</span>'
            : answer.reviewStatus === 'REJECTED'
                ? '<span class="badge-rejected"><span class="material-icons">block</span> Not published</span>'
                : '';

        return `
            <article class="answer-item" onclick="openQuestionDetail('${question.id}')">
                <h4>${escapeHtml(question.title)}</h4>
                <p class="answer-preview">${escapeHtml(truncateText(answer.text, 130))}</p>
                <div class="answer-meta">
                    <span class="tag">${escapeHtml(question.course)}</span>
                    <span class="tag">${escapeHtml(question.subject)}</span>
                    <span class="tag"><span class="material-icons">thumb_up</span> ${answer.votes.length}</span>
                    ${reviewBadge}
                    ${isBest ? '<span class="badge-best"><span class="material-icons">check_circle</span> Best Answer</span>' : ''}
                </div>
                <span class="answer-date">${formatTimeAgo(answer.createdAt)}</span>
            </article>
        `;
    }).join('');
}

/**
 * The answer box, and what it says above itself.
 *
 * It used to be hidden outright from anyone who was not staff. It is now shown
 * to everybody, with the note changed from "you may not" to "yours is checked
 * first" — which is the actual rule now, and the one thing a student needs to
 * know before they spend five minutes writing a solution.
 */
function updateAnswerComposerAccess() {
    const answerSection = document.querySelector('.add-answer-section');
    if (!answerSection) return;

    answerSection.classList.remove('hidden');

    let notice = document.getElementById('student-answer-lock-note');

    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'student-answer-lock-note';
        notice.className = 'student-answer-lock-note';
        answerSection.insertAdjacentElement('beforebegin', notice);
    }

    if (qaIsAdmin) {
        notice.innerHTML =
            '<span class="material-icons">verified</span>' +
            '<div><strong>Official reply</strong>' +
            '<small>Your answer is published to everyone immediately.</small></div>';
        notice.classList.add('is-staff');
    } else {
        notice.innerHTML =
            '<span class="material-icons">rate_review</span>' +
            '<div><strong>You can answer this</strong>' +
            '<small>An administrator checks your answer before the rest of the college sees it. ' +
            'You will see it here marked "Waiting for review" in the meantime.</small></div>';
        notice.classList.remove('is-staff');
    }

    notice.hidden = false;
}

function displayAdminModeration() {
    const container = document.getElementById('admin-qa-moderation-list');
    if (!container) return;

    const questions = getQuestions();
    const answers = getAnswers();
    if (questions.length === 0) {
        container.innerHTML = '<p class="empty-state">No questions to moderate.</p>';
        return;
    }

    container.innerHTML = questions
        .slice()
        .sort((left, right) => {
            const leftFlags = left.flags.length + getAnswersForQuestion(left.id, answers).reduce((total, answer) => total + answer.flags.length, 0);
            const rightFlags = right.flags.length + getAnswersForQuestion(right.id, answers).reduce((total, answer) => total + answer.flags.length, 0);
            return rightFlags - leftFlags || new Date(right.createdAt) - new Date(left.createdAt);
        })
        .slice(0, 12)
        .map(question => {
            const answerFlags = getAnswersForQuestion(question.id, answers).reduce((total, answer) => total + answer.flags.length, 0);
            return `
                <div class="admin-mod-item">
                    <div class="mod-info">
                        <strong>${escapeHtml(question.title)}</strong>
                        <small class="mod-meta">${escapeHtml(question.course)} | ${escapeHtml(question.subject)} | ${getAnswersForQuestion(question.id, answers).length} answers | ${question.flags.length + answerFlags} flags</small>
                    </div>
                    <div class="mod-actions">
                        <button class="icon-btn" onclick="openQuestionDetail('${question.id}')" title="View">
                            <span class="material-icons">visibility</span>
                        </button>
                        ${qaIsAdmin ? `<button class="icon-btn-verify" onclick="window.qaManager.verifyAnswerForQuestion('${question.id}')" title="Verify latest answer"><span class="material-icons">verified</span></button>` : ''}
                        <button class="icon-btn-danger" onclick="window.qaManager.deleteQuestion('${question.id}')" title="Remove Question">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
}

function verifyAnswerForQuestion(questionId) {
    if (!qaIsAdmin) return;
    const answers = getAnswersForQuestion(questionId).sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const answer = answers[0];
    if (!answer) {
        showQANotice('No answers to verify for this question.', 'warning');
        return;
    }
    currentQuestion = getQuestions().find(question => question.id === questionId);
    verifyAnswer(answer.id);
    displayAdminModeration();
}

function deleteQuestion(id) {
    if (!confirm('Remove this question and its answers?')) return;
    saveQuestions(getQuestions().filter(question => question.id !== id));
    saveAnswers(getAnswers().filter(answer => answer.questionId !== id));
    displayAdminModeration();
    displayBrowseQuestions();
}

function populateQATagFilter(sourceQuestions = getQuestions()) {
    const tagFilter = document.getElementById('filter-tag');
    if (!tagFilter) return;

    const previous = tagFilter.value;
    const tags = [...new Set(sourceQuestions.flatMap(getSearchableQuestionTags))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));

    tagFilter.innerHTML = `<option value="">All Tags</option>${tags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('')}`;
    tagFilter.value = tags.includes(previous) ? previous : '';
}

function getSearchableQuestionTags(question) {
    return [
        question.course,
        question.subject,
        question.lesson,
        ...question.tags
    ].map(cleanTag).filter(Boolean);
}

function parseTags(value) {
    if (Array.isArray(value)) return value.map(cleanTag).filter(Boolean);
    return String(value || '')
        .split(/[#,]/)
        .map(cleanTag)
        .filter(Boolean);
}

function cleanTag(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function toggleArrayValue(items, value) {
    return items.includes(value) ? items.filter(item => item !== value) : [...items, value];
}

/**
 * How this browser identifies the signed-in account inside Q&A records.
 *
 * MUST be the server's user id when there is a server, and this is the single
 * most consequential line in the file.
 *
 * It used to return `username` — "@admin.emman". Meanwhile coe-qa.js fills the
 * board from the API, where `question.asker` and `answer.answerer` are the
 * server's user id ("cmsb…"). The two never matched, so every comparison of
 * "is this mine?" was false for everybody:
 *
 *   * My Questions was permanently empty, however many you had asked;
 *   * Admin Answers was permanently empty, however many you had answered —
 *     which is exactly the "hindi lumalabas yung sinagot ng admin" report;
 *   * the "you voted" highlight never lit, because coe-qa.js writes the vote
 *     marker as the same user id;
 *   * "delete my question" never offered itself to the person who asked it.
 *
 * None of it looked broken. Every list simply rendered its empty state.
 *
 * The username fallback is kept for the standalone case — index.html opened off
 * the filesystem, where there is no session and ids do not exist.
 */
function getCurrentUserKey() {
    return qaCurrentUser.id || qaCurrentUser.username || qaCurrentUser.name || 'anonymous-student';
}

function resetUploadLabel(id) {
    const label = document.getElementById(id);
    if (label) label.textContent = 'No file selected';
}

function logQAActivity(message) {
    if (typeof window.addActivity === 'function') {
        window.addActivity(message);
    }
}

function handleQASaveError(error) {
    console.error('Unable to save Q&A item:', error);
    showQANotice('Could not save this question. Try removing the attachment or using a smaller file.', 'warning');
}

function showQANotice(message, tone = 'success') {
    let notice = document.getElementById('qa-inline-notice');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'qa-inline-notice';
        notice.className = 'inline-notice';
        document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.dataset.tone = tone;
    notice.classList.add('show');
    clearTimeout(showQANotice.timer);
    showQANotice.timer = setTimeout(() => notice.classList.remove('show'), 2400);
}

function getQuestionStatusClass(status) {
    const classes = {
        [QUESTION_STATUS.UNANSWERED]: 'status-unanswered',
        [QUESTION_STATUS.ANSWERED]: 'status-answered',
        [QUESTION_STATUS.VERIFIED]: 'status-verified',
        [QUESTION_STATUS.SOLVED]: 'status-solved'
    };
    return classes[status] || 'status-unanswered';
}

function escapeHtml(value) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(value ?? '').replace(/[&<>"']/g, character => map[character]);
}

function truncateText(value, length) {
    const text = String(value || '');
    return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (Number.isNaN(seconds)) return '';
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

window.openQuestionDetail = openQuestionDetail;
window.markBestAnswer = markBestAnswer;
window.verifyAnswer = verifyAnswer;
window.toggleAnswerVote = toggleAnswerVote;
window.flagQuestion = flagQuestion;
window.flagAnswer = flagAnswer;
window.addAnswerComment = addAnswerComment;
window.switchQATab = switchQATab;

window.qaManager = {
    getQuestions,
    getAnswers,
    openQuestionDetail,
    markBestAnswer,
    verifyAnswer,
    verifyAnswerForQuestion,
    displayAdminModeration,
    deleteQuestion
};
