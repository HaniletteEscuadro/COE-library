// Student Voice - Your Voice Matters
// Anonymous suggestions with admin approval and public status tracking.

const LOCAL_STORAGE_CONCERNS = 'coeStudentVoiceConcerns';

const CONCERN_STATUS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    ADDRESSED: 'Addressed'
};

let currentEditingConcernId = null;
const studentVoiceCurrentUser = JSON.parse(localStorage.getItem('studentWorkplaceCurrentUser') || '{}');
const studentVoiceIsAdmin = studentVoiceCurrentUser && studentVoiceCurrentUser.role === 'ADMIN';

document.addEventListener('DOMContentLoaded', function () {
    initializeStudentVoice();
});

function initializeStudentVoice() {
    const concernForm = document.getElementById('concern-form');
    const voiceTabs = document.querySelectorAll('.voice-tab-btn');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const adminVoiceTabs = document.querySelectorAll('.voice-admin-tab');
    const closeConcernModal = document.getElementById('close-concern-modal');
    const saveConcernBtn = document.getElementById('save-concern-btn');
    const rejectConcernBtn = document.getElementById('reject-concern-btn');
    const concernDetailModal = document.getElementById('concern-detail-modal');

    concernForm?.addEventListener('submit', handleConcernSubmission);

    voiceTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            switchStudentVoiceTab(this.dataset.tab);
        });
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            filterConcerns(this.dataset.filter);
        });
    });

    adminVoiceTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            switchAdminVoiceTab(this.dataset.adminTab);
        });
    });

    closeConcernModal?.addEventListener('click', () => {
        if (concernDetailModal) concernDetailModal.style.display = 'none';
    });

    saveConcernBtn?.addEventListener('click', saveConcernChanges);
    rejectConcernBtn?.addEventListener('click', rejectConcern);

    if (concernDetailModal) {
        window.addEventListener('click', function (event) {
            if (event.target === concernDetailModal) {
                concernDetailModal.style.display = 'none';
            }
        });
    }

    window.addEventListener('storage', function (event) {
        if (event.key !== LOCAL_STORAGE_CONCERNS) return;
        displayPublicBoard();
        if (studentVoiceIsAdmin) refreshAdminVoiceView();
    });

    window.addEventListener('studentVoice:concerns-updated', function () {
        displayPublicBoard();
        if (studentVoiceIsAdmin) refreshAdminVoiceView();
    });

    displayPublicBoard();
    if (studentVoiceIsAdmin) {
        displayAdminConcerns('pending');
    }
}

function handleConcernSubmission(event) {
    event.preventDefault();

    const category = document.getElementById('concern-category')?.value;
    const title = document.getElementById('concern-title')?.value.trim();
    const description = document.getElementById('concern-description')?.value.trim();

    if (!category || !title || !description) {
        showVoiceNotice('Please fill in all fields.', 'warning');
        return;
    }

    const concerns = getConcerns();
    concerns.push(normalizeConcern({
        id: generateConcernId(),
        category,
        title,
        description,
        status: CONCERN_STATUS.PENDING,
        submittedAt: new Date().toISOString(),
        response: '',
        anonymous: true
    }));
    saveConcerns(concerns);

    const successMsg = document.getElementById('concern-success-message');
    successMsg?.classList.remove('hidden');
    document.getElementById('concern-form')?.reset();

    setTimeout(() => successMsg?.classList.add('hidden'), 3000);
    logVoiceActivity(`Submitted an anonymous concern: "${title}"`);
    displayPublicBoard();
    if (studentVoiceIsAdmin) displayAdminConcerns('pending');
}

function getConcerns() {
    try {
        const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CONCERNS) || '[]');
        return Array.isArray(stored) ? stored.map(normalizeConcern) : [];
    } catch (error) {
        return [];
    }
}

function saveConcerns(concerns) {
    localStorage.setItem(LOCAL_STORAGE_CONCERNS, JSON.stringify(concerns.map(normalizeConcern)));
    window.dispatchEvent(new CustomEvent('studentVoice:concerns-updated'));
}

function normalizeConcern(concern) {
    const statusMap = {
        'Under Review': CONCERN_STATUS.APPROVED,
        Responded: CONCERN_STATUS.ADDRESSED,
        Resolved: CONCERN_STATUS.ADDRESSED
    };
    const status = statusMap[concern.status] || concern.status || CONCERN_STATUS.PENDING;

    return {
        ...concern,
        id: concern.id || generateConcernId(),
        category: concern.category || 'General Suggestion',
        title: concern.title || 'Untitled concern',
        description: concern.description || '',
        status: Object.values(CONCERN_STATUS).includes(status) ? status : CONCERN_STATUS.PENDING,
        submittedAt: concern.submittedAt || new Date().toISOString(),
        approvedAt: concern.approvedAt || '',
        addressedAt: concern.addressedAt || '',
        response: concern.response || '',
        anonymous: true
    };
}

function generateConcernId() {
    return `concern_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function displayPublicBoard() {
    const concerns = getConcerns();
    const publicConcerns = concerns.filter(isPublicConcern);
    updateConcernStats(concerns, publicConcerns);
    renderVoiceChart(concerns);
    displayApprovedConcerns(publicConcerns, getActiveConcernFilter());
}

function isPublicConcern(concern) {
    return concern.status !== CONCERN_STATUS.PENDING;
}

function updateConcernStats(allConcerns, publicConcerns) {
    const totalCount = document.getElementById('total-concerns-count');
    const pendingCount = document.getElementById('pending-concerns-count');
    const resolvedCount = document.getElementById('resolved-concerns-count');
    const mostCommon = document.getElementById('most-common-category');
    const dashboardTotal = document.getElementById('voice-dashboard-total');
    const dashboardPending = document.getElementById('voice-dashboard-pending');
    const dashboardPublic = document.getElementById('voice-dashboard-public');
    const dashboardAddressed = document.getElementById('voice-dashboard-addressed');
    const pendingTotal = allConcerns.filter(concern => concern.status === CONCERN_STATUS.PENDING).length;
    const addressedTotal = publicConcerns.filter(concern => concern.status === CONCERN_STATUS.ADDRESSED).length;

    if (totalCount) totalCount.textContent = publicConcerns.length;
    if (pendingCount) pendingCount.textContent = pendingTotal;
    if (resolvedCount) resolvedCount.textContent = addressedTotal;
    if (dashboardTotal) dashboardTotal.textContent = allConcerns.length;
    if (dashboardPending) dashboardPending.textContent = pendingTotal;
    if (dashboardPublic) dashboardPublic.textContent = publicConcerns.length;
    if (dashboardAddressed) dashboardAddressed.textContent = addressedTotal;

    if (mostCommon) {
        const categoryCounts = publicConcerns.reduce((counts, concern) => {
            counts[concern.category] = (counts[concern.category] || 0) + 1;
            return counts;
        }, {});
        const categories = Object.keys(categoryCounts);
        mostCommon.textContent = categories.length
            ? categories.sort((left, right) => categoryCounts[right] - categoryCounts[left])[0]
            : '-';
    }
}

function renderVoiceChart(concerns) {
    const chart = document.getElementById('voice-chart');
    if (!chart) return;

    const totals = [
        { label: 'Pending', value: concerns.filter(concern => concern.status === CONCERN_STATUS.PENDING).length, className: 'pending' },
        { label: 'Approved', value: concerns.filter(concern => concern.status === CONCERN_STATUS.APPROVED).length, className: 'approved' },
        { label: 'Addressed', value: concerns.filter(concern => concern.status === CONCERN_STATUS.ADDRESSED).length, className: 'addressed' }
    ];
    const max = Math.max(1, ...totals.map(item => item.value));

    chart.innerHTML = totals.map(item => `
        <div class="voice-chart-row">
            <span class="voice-chart-label">${escapeVoiceHtml(item.label)}</span>
            <div class="voice-chart-track">
                <span class="voice-chart-fill ${item.className}" style="width:${Math.max(8, (item.value / max) * 100)}%"></span>
            </div>
            <strong>${item.value}</strong>
        </div>
    `).join('');
}

function displayApprovedConcerns(concerns, filter = 'all') {
    const concernsList = document.getElementById('concerns-list');
    if (!concernsList) return;

    const filtered = filter === 'all' ? concerns : concerns.filter(concern => concern.category === filter);
    if (filtered.length === 0) {
        concernsList.innerHTML = '<p class="empty-concerns">No approved concerns match this filter yet.</p>';
        return;
    }

    const approved = filtered.filter(concern => concern.status === CONCERN_STATUS.APPROVED);
    const addressed = filtered.filter(concern => concern.status === CONCERN_STATUS.ADDRESSED);

    concernsList.innerHTML = `
        ${renderConcernGroup('Approved Concerns', approved, true)}
        ${renderConcernGroup('Addressed Concerns', addressed, addressed.length > 0)}
    `;
}

function renderConcernGroup(title, concerns, open) {
    return `
        <details class="concern-group" ${open ? 'open' : ''}>
            <summary>
                <span>${escapeVoiceHtml(title)}</span>
                <strong>${concerns.length}</strong>
            </summary>
            <div class="concern-group-list">
                ${concerns.length
                    ? concerns.map(renderPublicConcernCard).join('')
                    : '<p class="empty-concerns">Nothing in this section yet.</p>'
                }
            </div>
        </details>
    `;
}

function renderPublicConcernCard(concern) {
    return `
        <article class="concern-card" data-concern-id="${escapeVoiceHtml(concern.id)}">
            <div class="concern-header">
                <span class="concern-category ${getCategoryClass(concern.category)}">${escapeVoiceHtml(concern.category)}</span>
                <span class="concern-status ${getConcernStatusClass(concern.status)}">${escapeVoiceHtml(concern.status)}</span>
            </div>
            <h4 class="concern-title">${escapeVoiceHtml(concern.title)}</h4>
            <p class="concern-description">${escapeVoiceHtml(concern.description)}</p>
            ${concern.response ? `<div class="concern-response"><strong>Admin Response</strong><p>${escapeVoiceHtml(concern.response)}</p></div>` : ''}
            <div class="concern-meta">
                <span class="concern-date"><span class="material-icons">schedule</span>${formatVoiceDate(concern.submittedAt)}</span>
            </div>
        </article>
    `;
}

function filterConcerns(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === category);
    });
    displayApprovedConcerns(getConcerns().filter(isPublicConcern), category);
}

function getActiveConcernFilter() {
    return document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
}

function switchStudentVoiceTab(tab) {
    document.querySelectorAll('.voice-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.querySelectorAll('.voice-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}-tab`)?.classList.add('active');

    if (tab === 'board') displayPublicBoard();
}

function displayAdminConcerns(status = 'pending') {
    const concerns = getConcerns();
    let filtered = concerns;
    updateAdminModerationNotice(concerns);

    if (status === 'pending') filtered = concerns.filter(concern => concern.status === CONCERN_STATUS.PENDING);
    if (status === 'approved') filtered = concerns.filter(concern => concern.status === CONCERN_STATUS.APPROVED);
    if (status === 'addressed') filtered = concerns.filter(concern => concern.status === CONCERN_STATUS.ADDRESSED);

    const container = document.getElementById(`${status}-concerns-admin`);
    if (!container) return;

    const pendingAlert = status === 'pending' ? renderPendingAdminAlert(concerns) : '';
    container.innerHTML = filtered.length
        ? `${pendingAlert}${filtered.map(renderAdminConcernCard).join('')}`
        : pendingAlert
            ? `${pendingAlert}<p class="empty-concerns">No pending concerns after this alert refreshes.</p>`
        : '<p class="empty-concerns">No concerns in this category.</p>';
}

function getAdminConcernTotals(concerns = getConcerns()) {
    return {
        pending: concerns.filter(concern => concern.status === CONCERN_STATUS.PENDING).length,
        approved: concerns.filter(concern => concern.status === CONCERN_STATUS.APPROVED).length,
        addressed: concerns.filter(concern => concern.status === CONCERN_STATUS.ADDRESSED).length,
        all: concerns.length
    };
}

function updateAdminModerationNotice(concerns = getConcerns()) {
    const totals = getAdminConcernTotals(concerns);
    const summary = document.getElementById('voice-admin-notice-summary');
    const pill = document.getElementById('voice-admin-pending-pill');

    Object.entries(totals).forEach(([key, value]) => {
        document.querySelectorAll(`[data-voice-tab-count="${key}"]`).forEach(badge => {
            badge.textContent = String(value);
            badge.classList.toggle('is-zero', value === 0);
        });
    });

    if (summary) {
        summary.textContent = totals.pending
            ? `${totals.pending} pending student submission${totals.pending === 1 ? ' needs' : 's need'} review.`
            : 'No pending student submissions.';
    }

    if (pill) {
        pill.textContent = `${totals.pending} pending`;
        pill.classList.toggle('hidden', totals.pending === 0);
        pill.classList.toggle('is-live', totals.pending > 0);
    }
}

function renderPendingAdminAlert(concerns) {
    const pending = concerns
        .filter(concern => concern.status === CONCERN_STATUS.PENDING)
        .sort((left, right) => new Date(right.submittedAt || 0) - new Date(left.submittedAt || 0));
    if (!pending.length) return '';

    const latest = pending[0];
    return `
        <div class="voice-admin-live-alert" role="status" aria-live="polite">
            <span class="material-icons">notifications_active</span>
            <div>
                <strong>${pending.length} new pending submission${pending.length === 1 ? '' : 's'}</strong>
                <p>Latest: ${escapeVoiceHtml(latest.title)} | ${escapeVoiceHtml(formatVoiceDate(latest.submittedAt))}</p>
            </div>
            <button type="button" onclick="window.studentVoiceManager.openConcernDetail('${escapeVoiceHtml(latest.id)}')">Review</button>
        </div>
    `;
}

function renderAdminConcernCard(concern) {
    return `
        <article class="admin-concern-card" data-concern-id="${escapeVoiceHtml(concern.id)}">
            <div class="admin-concern-header">
                <div>
                    <span class="concern-category ${getCategoryClass(concern.category)}">${escapeVoiceHtml(concern.category)}</span>
                    <h4>${escapeVoiceHtml(concern.title)}</h4>
                </div>
                <span class="concern-status ${getConcernStatusClass(concern.status)}">${escapeVoiceHtml(concern.status)}</span>
            </div>
            <p class="concern-description">${escapeVoiceHtml(concern.description)}</p>
            ${concern.response ? `<div class="concern-response"><strong>Response</strong><p>${escapeVoiceHtml(concern.response)}</p></div>` : ''}
            <div class="admin-concern-actions">
                ${concern.status === CONCERN_STATUS.PENDING ? `
                    <button class="icon-btn-success" onclick="window.studentVoiceManager.approveConcernQuick('${concern.id}')" title="Approve">
                        <span class="material-icons">check_circle</span>
                    </button>
                ` : ''}
                ${concern.status !== CONCERN_STATUS.ADDRESSED ? `
                    <button class="icon-btn-success" onclick="window.studentVoiceManager.markConcernAddressed('${concern.id}')" title="Mark addressed">
                        <span class="material-icons">task_alt</span>
                    </button>
                ` : ''}
                <button class="icon-btn-danger" onclick="window.studentVoiceManager.rejectConcernById('${concern.id}')" title="Reject">
                    <span class="material-icons">delete</span>
                </button>
                <button class="btn-view" onclick="window.studentVoiceManager.openConcernDetail('${concern.id}')">
                    <span class="material-icons">visibility</span>
                    Details
                </button>
            </div>
        </article>
    `;
}

function switchAdminVoiceTab(tab) {
    document.querySelectorAll('.voice-admin-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.adminTab === tab);
    });

    document.querySelectorAll('.admin-concerns-list').forEach(content => {
        content.classList.add('hidden');
    });

    document.getElementById(`${tab}-concerns-admin`)?.classList.remove('hidden');
    displayAdminConcerns(tab);
}

function openConcernDetail(concernId) {
    currentEditingConcernId = concernId;
    const concern = getConcerns().find(item => item.id === concernId);
    if (!concern) return;

    const category = document.getElementById('detail-category');
    const title = document.getElementById('detail-title');
    const description = document.getElementById('detail-description');
    const status = document.getElementById('detail-status');
    const date = document.getElementById('concern-detail-date');
    const statusSelect = document.getElementById('detail-status-select');
    const response = document.getElementById('detail-response');

    if (category) category.textContent = concern.category;
    if (title) title.textContent = concern.title;
    if (description) description.textContent = concern.description;
    if (status) status.textContent = concern.status;
    if (date) date.textContent = formatVoiceDate(concern.submittedAt);
    if (statusSelect) statusSelect.value = concern.status;
    if (response) response.value = concern.response || '';

    const modal = document.getElementById('concern-detail-modal');
    if (modal) modal.style.display = 'block';
}

function saveConcernChanges() {
    if (!currentEditingConcernId) return;

    const concerns = getConcerns();
    const concern = concerns.find(item => item.id === currentEditingConcernId);
    if (!concern) return;

    const nextStatus = document.getElementById('detail-status-select')?.value || concern.status;
    concern.status = nextStatus;
    concern.response = document.getElementById('detail-response')?.value.trim() || '';
    if (nextStatus === CONCERN_STATUS.APPROVED && !concern.approvedAt) concern.approvedAt = new Date().toISOString();
    if (nextStatus === CONCERN_STATUS.ADDRESSED && !concern.addressedAt) concern.addressedAt = new Date().toISOString();

    saveConcerns(concerns);
    closeConcernModal();
    refreshAdminVoiceView();
    displayPublicBoard();
    logVoiceActivity(`Updated concern status to ${concern.status}: "${concern.title}"`);
    showVoiceNotice('Concern updated.');
}

function approveConcernQuick(id) {
    updateConcernStatus(id, CONCERN_STATUS.APPROVED);
}

function markConcernAddressed(id) {
    updateConcernStatus(id, CONCERN_STATUS.ADDRESSED);
}

function updateConcernStatus(id, status) {
    const concerns = getConcerns();
    const concern = concerns.find(item => item.id === id);
    if (!concern) return;

    concern.status = status;
    if (status === CONCERN_STATUS.APPROVED && !concern.approvedAt) concern.approvedAt = new Date().toISOString();
    if (status === CONCERN_STATUS.ADDRESSED && !concern.addressedAt) concern.addressedAt = new Date().toISOString();
    saveConcerns(concerns);
    refreshAdminVoiceView();
    displayPublicBoard();
    logVoiceActivity(`${status} concern: "${concern.title}"`);
}

function rejectConcernById(id) {
    if (!confirm('Reject and delete this concern permanently?')) return;
    const concerns = getConcerns();
    const concern = concerns.find(item => item.id === id);
    saveConcerns(concerns.filter(item => item.id !== id));
    refreshAdminVoiceView();
    displayPublicBoard();
    logVoiceActivity(`Rejected student concern: "${concern ? concern.title : id}"`);
}

function rejectConcern() {
    if (!currentEditingConcernId) return;
    rejectConcernById(currentEditingConcernId);
    closeConcernModal();
}

function refreshAdminVoiceView() {
    const activeTab = document.querySelector('.voice-admin-tab.active')?.dataset.adminTab || 'pending';
    switchAdminVoiceTab(activeTab);
}

function closeConcernModal() {
    const modal = document.getElementById('concern-detail-modal');
    if (modal) modal.style.display = 'none';
}

function getCategoryClass(category) {
    const classes = {
        'Academic Concern': 'category-academic',
        'Library Materials': 'category-library',
        Facilities: 'category-facilities',
        'Student Support': 'category-support',
        'General Suggestion': 'category-general'
    };
    return classes[category] || 'category-general';
}

function getConcernStatusClass(status) {
    const classes = {
        Pending: 'status-pending',
        Approved: 'status-approved',
        Addressed: 'status-addressed'
    };
    return classes[status] || 'status-pending';
}

function formatVoiceDate(isoString) {
    const date = new Date(isoString);
    return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeVoiceHtml(value) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(value ?? '').replace(/[&<>"']/g, character => map[character]);
}

function logVoiceActivity(message) {
    if (typeof window.addActivity === 'function') {
        window.addActivity(message);
    }
}

function showVoiceNotice(message, tone = 'success') {
    let notice = document.getElementById('voice-inline-notice');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'voice-inline-notice';
        notice.className = 'inline-notice';
        document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.dataset.tone = tone;
    notice.classList.add('show');
    clearTimeout(showVoiceNotice.timer);
    showVoiceNotice.timer = setTimeout(() => notice.classList.remove('show'), 2400);
}

function refreshStudentVoiceAdmin() {
    if (studentVoiceIsAdmin) displayAdminConcerns('pending');
}

window.studentVoiceManager = {
    getConcerns,
    displayAdminConcerns,
    switchAdminVoiceTab,
    openConcernDetail,
    saveConcernChanges,
    rejectConcern,
    rejectConcernById,
    approveConcernQuick,
    markConcernAddressed,
    refreshStudentVoiceAdmin,
    displayPublicBoard
};

window.openConcernDetail = openConcernDetail;
