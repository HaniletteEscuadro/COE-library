document.addEventListener('DOMContentLoaded', function () {
    const addFolderBtn = document.getElementById('add-folder-btn');
    const addFolderModal = document.getElementById('add-folder-modal');
    const closeFolderModalBtn = document.getElementById('close-folder-modal-btn');
    const addFolderForm = document.getElementById('add-folder-form');
    const folderNameInput = document.getElementById('folder-name');
    const foldersList = document.getElementById('folders-list');
    const uploadFileModal = document.getElementById('upload-file-modal');
    const closeUploadModalBtn = document.getElementById('close-upload-modal-btn');
    const uploadFileForm = document.getElementById('upload-file-form');
    const fileUploadInput = document.getElementById('file-upload');
    const cameraUploadInput = document.getElementById('camera-upload');
    const uploadFileName = document.getElementById('upload-file-name');
    const libraryUploadPageForm = document.getElementById('library-upload-page-form');
    const libraryUploadFolderSelect = document.getElementById('library-upload-folder');
    const libraryUploadFolderNameInput = document.getElementById('library-upload-folder-name');
    const libraryUploadCourseSelect = document.getElementById('library-upload-course');
    const libraryUploadYearSelect = document.getElementById('library-upload-year');
    const libraryUploadMaterialCategorySelect = document.getElementById('library-upload-material-category');
    const libraryUploadLessonPageInput = document.getElementById('library-upload-lesson-page');
    const libraryUploadTitleInput = document.getElementById('library-upload-title');
    const libraryUploadDescriptionInput = document.getElementById('library-upload-description');
    const libraryUploadFolderIdInput = document.getElementById('library-upload-folder-id');
    const libraryUploadVersionInput = document.getElementById('library-upload-version');
    const libraryUploadTagsInput = document.getElementById('library-upload-tags');
    const libraryUploadDriveLinkInput = document.getElementById('library-upload-drive-link');
    const libraryUploadFileInput = document.getElementById('library-upload-file');
    const libraryUploadCameraInput = document.getElementById('library-upload-camera');
    const libraryUploadFileName = document.getElementById('library-upload-file-name');
    const libraryLinkPickerModal = document.getElementById('library-link-picker-modal');
    const libraryLinkPickerTitle = document.getElementById('library-link-picker-title');
    const libraryLinkPickerIcon = document.getElementById('library-link-picker-icon');
    const libraryLinkPickerHelp = document.getElementById('library-link-picker-help');
    const libraryLinkPickerUrlInput = document.getElementById('library-link-picker-url');
    const libraryLinkPickerCloseBtn = document.getElementById('library-link-picker-close');
    const libraryLinkPickerCancelBtn = document.getElementById('library-link-picker-cancel');
    const libraryLinkPickerAddBtn = document.getElementById('library-link-picker-add');
    const libraryCreateAttachmentBtn = document.getElementById('library-attach-create');
    const libraryLinkSourceButtons = document.querySelectorAll('[data-link-source]');
    const folderSection = document.getElementById('folder-section');
    const folderDetailSection = document.getElementById('folder-detail-section');
    const folderBackBtn = document.getElementById('folder-back-btn');
    const folderDetailTitle = document.getElementById('folder-detail-title');
    const folderDetailList = document.getElementById('folder-detail-list');
    // const folderSection = document.getElementById('folder-section'); // Removed
    // const folderDetailSection = document.getElementById('folder-detail-section'); // Removed
    // const folderBackBtn = document.getElementById('folder-back-btn'); // Removed
    // const folderDetailTitle = document.getElementById('folder-detail-title'); // Removed
    // const folderDetailList = document.getElementById('folder-detail-list'); // Removed
    const filePreviewModal = document.getElementById('file-preview-modal');
    const closePreviewModalBtn = document.getElementById('close-preview-modal-btn');
    const previewFileName = document.getElementById('preview-file-name');
    const previewFileDetails = document.getElementById('preview-file-details');
    const previewFileContent = document.getElementById('preview-file-content');
    const taskPostModal = document.getElementById('task-post-modal');
    const closeTaskPostModalBtn = document.getElementById('close-task-post-modal-btn');
    const taskPostTitle = document.getElementById('task-post-title');
    const taskPostDetails = document.getElementById('task-post-details');
    const taskPostBody = document.getElementById('task-post-body');
    const editFileModal = document.getElementById('edit-file-modal');
    const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
    const editFileForm = document.getElementById('edit-file-form');
    const editUploadDisciplineSelect = document.getElementById('edit-upload-discipline');
    const editUploadLessonInput = document.getElementById('edit-upload-lesson');
    const editFileUploadInput = document.getElementById('edit-file-upload');
    const editCameraUploadInput = document.getElementById('edit-camera-upload');
    const editFileNameDisplay = document.getElementById('edit-file-name-display');
    const editSelectedFileName = document.getElementById('edit-selected-file-name');
    const uploadedFiles = [];
    const folders = [];
    let editingFileIndex = null;
    let currentFolderIndex = null;
    const disciplineSelect = document.getElementById('discipline-select');
    const uploadDisciplineSelect = document.getElementById('upload-discipline');
    const uploadLessonInput = document.getElementById('upload-lesson');
    const LOCAL_STORAGE_TASKS = 'coeLearningTasks';
    const LOCAL_STORAGE_FILES = 'coeLearningFiles';
    const LOCAL_STORAGE_USERS = 'studentWorkplaceUsers';
    const LOCAL_STORAGE_ACCOUNT_EVENTS = 'studentWorkplaceAccountEvents';
    const LOCAL_STORAGE_PROFESSOR_LIBRARIES = 'coeProfessorLibraries';
    const LIBRARY_PROFESSOR_FOLDER_MARKER = '__prof__';
    // Anything bigger than this is stored in IndexedDB instead of localStorage.
    // 64 KB keeps small text previews inline, where they load without waiting
    // for the store, and moves every PDF, image and video out of the ~5 MB
    // localStorage quota.
    const LIBRARY_CONTENT_OFFLOAD_BYTES = 64 * 1024;
    // A file is held as a base64 data URL, which is ~1.37x its size and has to
    // fit in memory to preview. 100 MB is where that stops being comfortable;
    // anything larger belongs on Drive or YouTube as a link. Keep this in step
    // with the "up to 100 MB" hint in the upload modal.
    const LIBRARY_MAX_FILE_BYTES = 100 * 1048576;
    const taskSummaryCards = document.getElementById('task-summary-cards');
    const taskMetricsContainer = document.getElementById('task-metrics');
    const newProblemForm = document.getElementById('new-problem-form');
    const topicInput = document.getElementById('topic-input');
    const homeTodoForm = document.getElementById('home-todo-form');
    const homeTodoInput = document.getElementById('home-todo-input');
    const homeTodoDateInput = document.getElementById('home-todo-date');
    const homeTodoPrioritySelect = document.getElementById('home-todo-priority');
    const homeTodoList = document.getElementById('home-todo-list');
    const homeCompletedList = document.getElementById('home-completed-list');
    const homeTodoStats = {
        total: document.getElementById('todo-total-count'),
        pending: document.getElementById('todo-pending-count'),
        completed: document.getElementById('todo-completed-count')
    };
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const globalSearchInput = document.getElementById('global-search');
    const profileTrigger = document.getElementById('nav-profile-trigger');
    const profileMenu = document.getElementById('profile-dropdown-menu');
    // Library element compatibility: support older IDs and the new enhanced IDs
    let librarySearchInput = document.getElementById('library-search') || document.getElementById('library-search-enhanced');
    const libraryFilterType = document.getElementById('library-filter-type');
    const libraryFilterYear = document.getElementById('library-filter-year');
    const libraryFilterSubject = document.getElementById('library-filter-subject');
    const libraryFilterLesson = document.getElementById('library-filter-lesson');
    const libraryFilterTag = document.getElementById('library-filter-tag');
    const libraryFilterSort = document.getElementById('library-filter-sort');
    // const libraryFilterSort = document.getElementById('library-filter-sort'); // Handled by enhanced-library.js
    const libraryDisciplineFilter = document.getElementById('library-discipline-filter') || libraryFilterType;
    const libraryList = document.getElementById('library-list') || document.getElementById('library-cards-container');
    const libraryTotalCount = document.getElementById('library-total-count');
    const libraryDownloadCount = document.getElementById('library-download-count');
    const adminAnalyticsGrid = document.getElementById('admin-analytics-grid');
    const libraryVideoCount = document.getElementById('library-video-count') || document.getElementById('library-image-count');
    const libraryPdfCount = document.getElementById('library-pdf-count') || document.getElementById('library-text-count');
    const libraryCompletedCount = document.getElementById('library-completed-count');
    const quickCreateFolderBtn = document.getElementById('quick-create-folder');
    const quickUploadFileBtn = document.getElementById('quick-upload-file');
    const quickAddProblemBtn = document.getElementById('quick-add-problem');
    const quickOpenLibraryBtn = document.getElementById('quick-open-library');
    const shortcutLibraryBtn = document.getElementById('shortcut-library');
    const shortcutUploadBtn = document.getElementById('shortcut-upload');
    const shortcutQaBtn = document.getElementById('shortcut-qa');
    const shortcutVoiceBtn = document.getElementById('shortcut-voice');
    const shortcutAnnouncementsBtn = document.getElementById('shortcut-announcements');
    const recentActivityList = document.getElementById('recent-activity-list');
    const notificationButtons = document.querySelectorAll('.nav-icon-btn[title="Notifications"]');
    const messagesButtons = document.querySelectorAll('.nav-icon-btn[title="Messages"]');
    const accountListContainer = document.getElementById('account-list');
    const LOCAL_STORAGE_CURRENT_USER = 'studentWorkplaceCurrentUser';
    const currentUser = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CURRENT_USER) || 'null');
    const currentUsername = currentUser?.username || '';
    const currentRole = (currentUser?.role || 'STUDENT').toUpperCase();
    const isAdmin = currentRole === 'ADMIN';
    const isFaculty = currentRole === 'FACULTY';
    const LOCAL_STORAGE_ORG_INTERESTS = 'coeOrgInterests';
    const LOCAL_STORAGE_MODULE_SECURITY_LOGS = 'coeModuleSecurityLogs';
    const orgOfficerMap = {
        ORG_OFFICER_PICE: 'PICE',
        ORG_OFFICER_IIEE: 'IIEE'
    };
    const officerOrg = orgOfficerMap[currentRole] || '';
    const isOrgOfficer = Boolean(officerOrg);
    const canPublishAnnouncements = isAdmin || isOrgOfficer;
    const canAccessAdminPanel = isAdmin || isOrgOfficer;
    let currentOrgAdminFilter = officerOrg || 'all';
    const taskComposerCard = document.querySelector('#tasks-panel .problem-card');
    const topAccountName = document.getElementById('top-account-name');
    const topAccountRole = document.getElementById('top-account-role');
    const topAccountAvatar = document.getElementById('top-account-avatar');
    const sidebarAccountRole = document.getElementById('sidebar-account-role');
    const mobileSidebarBtn = document.getElementById('mobile-sidebar-btn');
    const smartRefreshBtn = document.getElementById('smart-refresh-btn');
    const roleWorkspaceKicker = document.getElementById('role-workspace-kicker');
    const roleWorkspaceTitle = document.getElementById('role-workspace-title');
    const roleWorkspaceDescription = document.getElementById('role-workspace-description');
    const roleActionPrimary = document.getElementById('role-action-primary');
    const roleActionSecondary = document.getElementById('role-action-secondary');
    const roleActionTertiary = document.getElementById('role-action-tertiary');
    const refreshDashboardBtn = document.getElementById('refresh-dashboard-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminAccountLogs = document.getElementById('admin-account-logs');
    const adminSecurityLogList = document.getElementById('admin-security-log-list');
    const adminCreateAccountForm = document.getElementById('admin-create-account-form');
    const adminCreateUsernameInput = document.getElementById('admin-create-username');
    const adminCreateNameInput = document.getElementById('admin-create-name');
    const adminCreatePasswordInput = document.getElementById('admin-create-password');
    const adminCreateCourseSelect = document.getElementById('admin-create-course');
    const adminCreateRoleSelect = document.getElementById('admin-create-role');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const clearStorageBtn = document.getElementById('clear-storage-btn');
    const profileForm = document.getElementById('profile-form');
    const profileNameInput = document.getElementById('profile-name-input');
    const profileCourseSelect = document.getElementById('profile-course-select');
    const profilePictureInput = document.getElementById('profile-picture-input');
    const profilePictureName = document.getElementById('profile-picture-name');
    const settingsProfileAvatar = document.getElementById('settings-profile-avatar');
    const settingsProfileName = document.getElementById('settings-profile-name');
    const settingsProfileMeta = document.getElementById('settings-profile-meta');
    const welcomeUserName = document.getElementById('welcome-user-name');
    const welcomeUserMeta = document.getElementById('welcome-user-meta');
    const settingsProfileCourse = document.getElementById('settings-profile-course');
    const settingsProfileRole = document.getElementById('settings-profile-role');
    const settingsProfileStatus = document.getElementById('settings-profile-status');
    const logoutCurrentBtn = document.getElementById('logout-current-btn');
    const homeTodos = [];
    const activityLog = [];
    const MAX_ACTIVITY_ITEMS = 6;
    let activitySaveTimer = null;
    const LOCAL_STORAGE_HOME_TODOS = 'coeHomeTodos';
    const LOCAL_STORAGE_ACTIVITY = 'coeRecentActivity';
    const lessonSelect = document.getElementById('lesson-select');
    const DEMO_ACCOUNT_USERNAMES = new Set([
        '@matt',
        '@panahon',
        '@faculty.coe',
        '@engr.rssll',
        '@asnawe',
        '@espera',
        '@dianalan'
    ]);
    // `classContributors` lived here. Its only reader was the dead leaderboard
    // removed further down, so it was an array nothing ever read.
    const contributorsGrid = document.getElementById('contributors-grid');
    const addLessonBtn = document.getElementById('add-lesson-btn');
    const problemPhotoUploadInput = document.getElementById('problem-photo-upload');
    const problemPhotoCameraUploadInput = document.getElementById('problem-photo-camera-upload');
    const problemPhotoFileName = document.getElementById('problem-photo-file-name');
    const solutionUploadInput = document.getElementById('solution-upload');
    const solutionCameraUploadInput = document.getElementById('solution-camera-upload');
    const selectedFileName = document.getElementById('selected-file-name');
    const tasks = [];
    const LIBRARY_RENDER_DELAY_MS = 120;
    let libraryRenderTimer = null;

    const pageLinks = document.querySelectorAll('.sidebar-nav a[data-page]');
    const pagePanels = document.querySelectorAll('.page-panel');
    const menuButtons = document.querySelectorAll('.top-menu-button');
    const inlinePageButtons = document.querySelectorAll('button[data-page]:not(.top-menu-button)');
    const adminNavLink = document.querySelector('.sidebar-nav a[data-page="admin"]');
    const adminNavItem = document.querySelector('.admin-nav-item');
    const adminTopButton = document.querySelector('.top-menu-button[data-page="admin"]');
    const LOCAL_STORAGE_FOLDERS = 'coeLearningFolders';

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    if (taskComposerCard && !isAdmin) {
        taskComposerCard.classList.add('hidden');
    }

    function updateSidebarToggleState() {
        if (!sidebarToggleBtn || !sidebar) return;
        const isCollapsed = sidebar.classList.contains('collapsed');
        const icon = sidebarToggleBtn.querySelector('.material-icons');
        if (icon) icon.textContent = isCollapsed ? 'folder' : 'folder_open';
        sidebarToggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
        sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Open sidebar tabs' : 'Fold sidebar tabs');
        sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Open sidebar tabs' : 'Fold sidebar tabs');
    }

    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
        if (!link.getAttribute('title')) link.setAttribute('title', link.textContent.trim());
    });

    sidebarToggleBtn?.addEventListener('click', function() {
        sidebar?.classList.toggle('collapsed');
        updateSidebarToggleState();
    });

    updateSidebarToggleState();

    function setMobileSidebar(open) {
        sidebar?.classList.toggle('mobile-open', open);
        document.body.classList.toggle('sidebar-overlay-active', open);
        mobileSidebarBtn?.setAttribute('aria-expanded', String(open));
    }

    mobileSidebarBtn?.addEventListener('click', function (event) {
        event.stopPropagation();
        setMobileSidebar(!sidebar?.classList.contains('mobile-open'));
    });

    document.addEventListener('click', function (event) {
        if (!sidebar?.classList.contains('mobile-open')) return;
        const clickedInsideSidebar = sidebar.contains(event.target);
        const clickedToggle = mobileSidebarBtn?.contains(event.target);
        if (!clickedInsideSidebar && !clickedToggle) setMobileSidebar(false);
    });

    function updateClock() {
        const clockDate = document.getElementById('clock-date');
        const clockTime = document.getElementById('clock-time');
        if (!clockDate || !clockTime) return;
        const now = new Date();
        clockDate.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        clockTime.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    function refreshAdminDashboard() {
        displayAccountList();
        displayAdminLogs();
        renderAdminAnalytics();
        /*
         * The Library Overview card lives on this page now, not at the top of
         * the Library tab. Its counts used to be refreshed as a side effect of
         * drawing the library, which no longer happens if an admin opens this
         * page and never visits the library — the card would show whatever the
         * numbers were at page load, or zeros.
         */
        window.updateLibraryDashboard?.();
        renderOrgAdminInterests();
        renderModuleSecurityLogs();
        applyOrgOfficerAdminView();
        if (window.studentVoiceManager) window.studentVoiceManager.displayAdminConcerns('pending');
        if (window.qaManager) window.qaManager.displayAdminModeration();
    }

    function applyOrgOfficerAdminView() {
        const adminPanel = document.getElementById('admin-panel');
        if (!adminPanel) return;
        adminPanel.classList.toggle('org-officer-admin-view', isOrgOfficer);

        if (!isOrgOfficer) return;

        const title = adminPanel.querySelector('.admin-command-hero h2');
        const copy = adminPanel.querySelector('.admin-command-hero p');
        const status = adminPanel.querySelector('.admin-status-pill');
        if (title) title.textContent = `${officerOrg} Officer Panel`;
        if (copy) copy.textContent = `Review ${officerOrg} membership applicants only. Full admin tools are hidden for organization officers.`;
        if (status) status.innerHTML = `<span class="material-icons">verified_user</span> ${officerOrg} officer mode`;

        adminPanel.querySelectorAll('.admin-panel-card').forEach(card => {
            if (!card.classList.contains('admin-org-card')) card.style.display = 'none';
        });
        adminPanel.querySelectorAll('.admin-column').forEach(column => {
            if (!column.querySelector('.admin-org-card')) column.style.display = 'none';
        });
        const quickGrid = adminPanel.querySelector('.admin-hero-quickgrid');
        if (quickGrid) quickGrid.style.display = 'none';

        document.querySelectorAll('[data-org-admin-filter]').forEach(button => {
            const filter = button.getAttribute('data-org-admin-filter');
            button.hidden = filter !== officerOrg;
        });

        const piceCount = document.getElementById('admin-org-pice')?.closest('span');
        const iieeCount = document.getElementById('admin-org-iiee')?.closest('span');
        if (piceCount) piceCount.hidden = officerOrg !== 'PICE';
        if (iieeCount) iieeCount.hidden = officerOrg !== 'IIEE';

        const clearBtn = document.getElementById('admin-org-clear-btn');
        if (clearBtn) clearBtn.textContent = `Clear ${officerOrg} List`;
    }

    function applyAvatarImage(element, imageUrl, fallbackText) {
        if (!element) return;
        if (imageUrl) {
            element.style.backgroundImage = `url('${imageUrl}')`;
            element.style.setProperty('--avatar-image', `url('${imageUrl}')`);
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            element.textContent = '';
            element.classList.add('has-image');
        } else {
            element.style.backgroundImage = '';
            element.style.removeProperty('--avatar-image');
            element.classList.remove('has-image');
            element.textContent = fallbackText ? fallbackText.charAt(0).toUpperCase() : '';
        }
    }

    function getProfileMetaLabel() {
        const metaParts = [];
        if (currentUser?.discipline) metaParts.push(currentUser.discipline);
        if (currentUser?.year) metaParts.push(currentUser.year);
        if (currentUser?.role) metaParts.push(getRoleDisplayName(currentUser.role));
        return metaParts.length ? metaParts.join(' | ') : 'Visitor';
    }

    function getRoleDisplayName(value) {
        const role = String(value || 'STUDENT').toUpperCase();
        if (role === 'ORG_OFFICER_PICE') return 'PICE Officer';
        if (role === 'ORG_OFFICER_IIEE') return 'IIEE Officer';
        return role.charAt(0) + role.slice(1).toLowerCase();
    }

    function getCourseDisplayName(value) {
        if (value === 'CE') return 'Civil Engineering';
        if (value === 'EE') return 'Electrical Engineering';
        return value || 'COE';
    }

    function updateProfileSnapshots() {
        const name = currentUser?.name || currentUser?.username || 'Guest';
        const role = getRoleDisplayName(currentUser?.role || 'Student');
        const course = currentUser?.discipline || 'COE';
        applyAvatarImage(topAccountAvatar, currentUser?.profilePicture || '', name);
        applyAvatarImage(settingsProfileAvatar, currentUser?.profilePicture || '', name);
        if (topAccountName) topAccountName.textContent = name;
        if (topAccountRole) topAccountRole.textContent = getProfileMetaLabel();
        if (sidebarAccountRole) sidebarAccountRole.textContent = getProfileMetaLabel();
        if (settingsProfileName) settingsProfileName.textContent = name;
        if (settingsProfileMeta) settingsProfileMeta.textContent = getProfileMetaLabel();
        if (welcomeUserName) welcomeUserName.textContent = name;
        if (welcomeUserMeta) welcomeUserMeta.textContent = `${getCourseDisplayName(course)} | ${role}`;
        if (settingsProfileCourse) settingsProfileCourse.textContent = getCourseDisplayName(course);
        if (settingsProfileRole) settingsProfileRole.textContent = role;
        if (settingsProfileStatus) settingsProfileStatus.textContent = currentUsername ? 'Active' : 'Guest';
    }

    function setTopAccountPanel() {
        if (!topAccountName || !topAccountRole || !topAccountAvatar) return;
        updateProfileSnapshots();
        enhanceDashboardHeroPanels();
    }

    function enhanceDashboardHeroPanels() {
        const homeHero = document.getElementById('home-page');

        document.querySelectorAll('.coe-dashboard-hero').forEach(hero => {
            if (hero !== homeHero) hero.classList.remove('coe-dashboard-hero');
        });

        document.querySelectorAll('.dashboard-welcome').forEach(welcome => {
            if (!homeHero?.contains(welcome)) welcome.remove();
        });

        if (!homeHero) return;

        homeHero.classList.add('coe-dashboard-hero');
        const existingHomeWelcome = homeHero.querySelector(':scope .hero-welcome');
        if (existingHomeWelcome) {
            existingHomeWelcome.classList.add('dashboard-welcome');
        }
    }

    function displayAdminLogs() {
        if (!adminAccountLogs) return;
        const accounts = initStoredUsers();
        if (!accounts.length) {
            adminAccountLogs.innerHTML = '<p class="empty-accounts">No account logs available.</p>';
            return;
        }
        adminAccountLogs.innerHTML = accounts.map(account => `
            <div class="admin-log-item">
                <div>
                    <h4>${escapeHtml(account.username)}</h4>
                    <p>${escapeHtml(account.name || 'No name provided')} | ${escapeHtml(account.role || 'STUDENT')} | Course: ${escapeHtml(account.discipline || 'N/A')}</p>
                </div>
                <div>
                    <p>${escapeHtml(account.email || 'No email')}</p>
                    <p>Created: ${escapeHtml(account.createdAt || 'N/A')}</p>
                </div>
            </div>
        `).join('');
    }

    function hideAdminLinksIfNeeded() {
        if (!canAccessAdminPanel) {
            if (adminNavLink) adminNavLink.style.display = 'none';
            if (adminNavItem) adminNavItem.style.display = 'none';
            if (adminTopButton) adminTopButton.style.display = 'none';
        }
        if (!isAdmin) {
            const adminItems = document.querySelectorAll('.admin-only');
            adminItems.forEach(item => item.style.display = 'none');
        }
    }

    function setPageAccess(pageKey) {
        if (pageKey === 'admin' && !canAccessAdminPanel) {
            alert('Only administrators and organization officers can access this page.');
            return false;
        }
        return true;
    }

    function setActiveNav(pageKey) {
        pageLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === pageKey);
        });
        document.querySelectorAll('.priority-nav-item[data-page]').forEach(button => {
            const isActive = button.getAttribute('data-page') === pageKey;
            button.classList.toggle('primary', isActive);
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }

    function showPage(pageKey) {
        if (pageKey === 'library-upload') {
            const folderId = (typeof currentFolderId !== 'undefined' && currentFolderId !== 'all') ? currentFolderId : undefined;
            if (typeof window.openLibraryUploadModal === 'function') {
                window.openLibraryUploadModal(folderId);
                setActiveNav('library');
                return;
            }
            pageKey = 'library';
        }
        if (!setPageAccess(pageKey)) return;
        pagePanels.forEach(panel => panel.classList.add('hidden'));
        const selectedPanels = document.querySelectorAll(`.page-panel[data-page="${pageKey}"]`);
        if (selectedPanels.length) {
            selectedPanels.forEach(panel => panel.classList.remove('hidden'));
        } else {
            pageKey = 'home';
            document.querySelectorAll('.page-panel[data-page="home"]').forEach(panel => panel.classList.remove('hidden'));
        }
        if (pageKey === 'home') {
            renderHomeUploadProgress();
            renderHomeReviewQueue();
            renderHomeSchedule();
            displayHomeDashboardStats();
        }
        if (pageKey === 'calendar') renderCalendarDashboard();
        if (pageKey === 'admin') refreshAdminDashboard();
        setActiveNav(pageKey);
        revealPage(pageKey);
    }

    /**
     * Put the newly opened page at the top of the screen.
     *
     * Switching tabs only swapped which panel carried `.hidden`; the scroll
     * position was left exactly where it was. On a laptop that is a small
     * annoyance. On a phone it is the difference between the feature working
     * and not: the pages are long, so tapping "Announcements" while halfway
     * down the Library dropped you into the middle of the announcements — past
     * the heading, sometimes past the last card into empty space — and the
     * screen looked broken or blank until you thought to scroll up.
     *
     * `scrollTo` on the window covers the normal layout. `.main-content` is
     * checked as well because it becomes the scrolling element in some of the
     * panel layouts, and scrolling the window there does nothing at all.
     *
     * `behavior: 'auto'` rather than 'smooth' on purpose: a page change should
     * be instant. Animating it means the user watches the old page slide away,
     * which reads as lag on a cheap phone.
     */
    function revealPage(pageKey) {
        const panel = document.querySelector(`.page-panel[data-page="${pageKey}"]:not(.hidden)`);

        try {
            window.scrollTo({ top: 0, behavior: 'auto' });
        } catch (error) {
            window.scrollTo(0, 0);
        }

        document.querySelectorAll('.main-content, .page-panel').forEach(node => {
            if (node.scrollTop) node.scrollTop = 0;
        });

        // Move the reading position to the new page, so a screen reader
        // announces it and the keyboard's next Tab lands inside it rather than
        // back at the top of the navigation.
        if (panel) {
            panel.setAttribute('tabindex', '-1');
            panel.focus({ preventScroll: true });
        }
    }

    document.querySelectorAll('[data-org-tab]').forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.getAttribute('data-org-tab');
            document.querySelectorAll('[data-org-tab]').forEach(button => {
                button.classList.toggle('active', button === this);
            });
            document.querySelectorAll('[data-org-content]').forEach(content => {
                content.classList.toggle('active', content.getAttribute('data-org-content') === targetTab);
            });
        });
    });

    function getOrgInterests() {
        try {
            const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ORG_INTERESTS) || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch (error) {
            console.warn('Unable to load organization interests', error);
            return [];
        }
    }

    function saveOrgInterests(interests) {
        localStorage.setItem(LOCAL_STORAGE_ORG_INTERESTS, JSON.stringify(interests));
    }

    function renderOrgAdminInterests(filter = currentOrgAdminFilter) {
        currentOrgAdminFilter = isOrgOfficer ? officerOrg : (filter || 'all');
        const interests = getOrgInterests();
        const adminList = document.getElementById('admin-org-interest-list');
        const totalEl = document.getElementById('admin-org-total');
        const piceEl = document.getElementById('admin-org-pice');
        const iieeEl = document.getElementById('admin-org-iiee');
        const visibleInterests = isOrgOfficer ? interests.filter(item => item.org === officerOrg) : interests;

        if (totalEl) totalEl.textContent = String(visibleInterests.length);
        if (piceEl) piceEl.textContent = String(interests.filter(item => item.org === 'PICE').length);
        if (iieeEl) iieeEl.textContent = String(interests.filter(item => item.org === 'IIEE').length);

        document.querySelectorAll('[data-org-admin-filter]').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-org-admin-filter') === currentOrgAdminFilter);
        });

        if (!adminList) return;

        const filtered = interests
            .map((item, index) => ({ item, index }))
            .filter(entry => {
                if (isOrgOfficer) return entry.item.org === officerOrg;
                return currentOrgAdminFilter === 'all' || entry.item.org === currentOrgAdminFilter;
            })
            .reverse();

        adminList.replaceChildren();

        if (!filtered.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-concerns';
            empty.textContent = currentOrgAdminFilter === 'all'
                ? 'No organization applicants yet.'
                : `No ${currentOrgAdminFilter} applicants yet.`;
            adminList.appendChild(empty);
            return;
        }

        filtered.forEach(({ item, index }) => {
            const row = document.createElement('article');
            row.className = 'org-admin-applicant';

            const badge = document.createElement('span');
            badge.className = `org-admin-badge ${item.org === 'PICE' ? 'is-pice' : 'is-iiee'}`;
            badge.textContent = item.org || 'ORG';

            const details = document.createElement('div');
            const name = document.createElement('strong');
            const meta = document.createElement('small');
            const submitted = document.createElement('em');
            name.textContent = item.studentName || 'Unnamed applicant';
            meta.textContent = `${item.yearLevel || 'Year not set'} | ${item.interest || 'Interest not set'}`;
            submitted.textContent = `Submitted ${item.date || 'recently'}${item.username ? ` by ${item.username}` : ''}`;
            details.append(name, meta, submitted);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'icon-btn-small org-admin-remove-btn';
            removeBtn.title = 'Remove applicant';
            removeBtn.setAttribute('aria-label', 'Remove applicant');
            removeBtn.setAttribute('data-org-interest-index', String(index));
            removeBtn.innerHTML = '<span class="material-icons">delete</span>';

            row.append(badge, details, removeBtn);
            adminList.appendChild(row);
        });
    }

    document.querySelectorAll('[data-org-admin-filter]').forEach(button => {
        button.addEventListener('click', function () {
            if (isOrgOfficer) {
                renderOrgAdminInterests(officerOrg);
                return;
            }
            renderOrgAdminInterests(this.getAttribute('data-org-admin-filter') || 'all');
        });
    });

    document.getElementById('admin-org-refresh-btn')?.addEventListener('click', function () {
        renderOrgAdminInterests();
    });

    document.getElementById('admin-org-clear-btn')?.addEventListener('click', function () {
        const targetLabel = isOrgOfficer ? `${officerOrg} applicant records` : 'all PICE and IIEE applicant records';
        if (!confirm(`Clear ${targetLabel}?`)) return;
        const nextInterests = isOrgOfficer
            ? getOrgInterests().filter(item => item.org !== officerOrg)
            : [];
        saveOrgInterests(nextInterests);
        renderOrgAdminInterests();
    });

    document.getElementById('admin-org-interest-list')?.addEventListener('click', function (event) {
        const removeBtn = event.target.closest?.('[data-org-interest-index]');
        if (!removeBtn) return;

        const removeIndex = Number(removeBtn.getAttribute('data-org-interest-index'));
        if (!Number.isInteger(removeIndex)) return;

        const interests = getOrgInterests();
        if (isOrgOfficer && interests[removeIndex]?.org !== officerOrg) return;
        interests.splice(removeIndex, 1);
        saveOrgInterests(interests);
        renderOrgAdminInterests();
    });

    document.querySelectorAll('[data-org-interest]').forEach(form => {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            const formData = new FormData(form);
            const org = form.getAttribute('data-org-interest');
            const studentName = String(formData.get('studentName') || '').trim();
            const yearLevel = String(formData.get('yearLevel') || '').trim();
            const interest = String(formData.get('interest') || '').trim();

            if (!studentName || !yearLevel || !interest) return;

            const interests = getOrgInterests();
            interests.push({
                org,
                studentName,
                yearLevel,
                interest,
                username: currentUsername,
                date: new Date().toLocaleString()
            });
            saveOrgInterests(interests);
            renderOrgAdminInterests();
            form.reset();
            alert(`${org} interest submitted. Admins can review it in the Admin Panel.`);
        });
    });

    renderOrgAdminInterests();

    let currentSecurityLogFilter = 'all';

    function getModuleSecurityLogs() {
        try {
            const logs = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MODULE_SECURITY_LOGS) || '[]');
            return Array.isArray(logs) ? logs : [];
        } catch (error) {
            console.warn('Unable to load module security logs', error);
            return [];
        }
    }

    function saveModuleSecurityLogs(logs) {
        localStorage.setItem(LOCAL_STORAGE_MODULE_SECURITY_LOGS, JSON.stringify((logs || []).slice(0, 200)));
    }

    function logProtectedMaterialEvent(action, material = {}, extra = {}) {
        const logs = getModuleSecurityLogs();
        logs.unshift({
            id: `module-log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            action: String(action || 'OPEN').toUpperCase(),
            materialId: material.id || '',
            materialTitle: material.title || material.name || 'Untitled material',
            materialCourse: material.discipline || material.course || '',
            materialSubject: material.subject || material.topic || '',
            username: currentUser?.username || currentUsername || 'Unknown user',
            name: currentUser?.name || currentUser?.username || 'Unknown user',
            role: getRoleDisplayName(currentUser?.role || currentRole || 'STUDENT'),
            createdAt: new Date().toISOString(),
            detail: extra.detail || '',
            source: extra.source || 'library'
        });
        saveModuleSecurityLogs(logs);
        renderModuleSecurityLogs();
    }

    window.logProtectedMaterialEvent = logProtectedMaterialEvent;

    /** Icon and wording per event type, so a row reads as a sentence. */
    const SECURITY_ACTIONS = {
        SCREENSHOT_ATTEMPT: { icon: 'screenshot_monitor', label: 'Capture attempt', tone: 'danger', verb: 'tried to capture' },
        DOWNLOAD_BLOCKED: { icon: 'block', label: 'Download blocked', tone: 'danger', verb: 'was blocked downloading' },
        DOWNLOAD: { icon: 'download', label: 'Download', tone: 'warn', verb: 'downloaded' },
        OPEN_LINK: { icon: 'open_in_new', label: 'Opened link', tone: 'info', verb: 'opened the link for' },
        OPEN: { icon: 'visibility', label: 'Opened', tone: 'info', verb: 'opened' },
        ACCESS: { icon: 'visibility', label: 'Viewed', tone: 'info', verb: 'viewed' },
        RIGHT_CLICK_BLOCKED: { icon: 'do_not_touch', label: 'Right-click blocked', tone: 'warn', verb: 'right-clicked' },
        PRINT_BLOCKED: { icon: 'print_disabled', label: 'Print blocked', tone: 'danger', verb: 'tried to print' }
    };

    function describeSecurityAction(action) {
        return SECURITY_ACTIONS[action] ||
            { icon: 'shield', label: String(action || 'Event').replaceAll('_', ' '), tone: 'info', verb: 'acted on' };
    }

    /** "3 minutes ago" — the column an operator actually scans. */
    function securityTimeAgo(iso) {
        const then = new Date(iso || 0).getTime();
        if (!Number.isFinite(then) || then <= 0) return '';

        const seconds = Math.floor((Date.now() - then) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
        return new Date(then).toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    let securityLogSearch = '';

    function renderModuleSecurityLogs(filter = currentSecurityLogFilter) {
        currentSecurityLogFilter = filter || 'all';
        const logs = getModuleSecurityLogs();

        const setText = (id, value) => {
            const node = document.getElementById(id);
            if (node) node.textContent = String(value);
        };

        const captures = logs.filter(log => log.action === 'SCREENSHOT_ATTEMPT').length;
        const transfers = logs.filter(log => log.action === 'DOWNLOAD' || log.action === 'OPEN_LINK').length;
        // Distinct people, which is the figure that says whether one account is
        // responsible for everything or the whole college is.
        const people = new Set(logs.map(log => log.username || log.name).filter(Boolean)).size;

        setText('security-log-total', logs.length);
        setText('security-log-screenshots', captures);
        setText('security-log-downloads', transfers);
        setText('security-log-people', people);

        // A capture attempt is the one event worth colouring. With none, the
        // tile stays quiet rather than showing a red 0.
        document.getElementById('seclog-stat-screenshots')?.classList.toggle('is-quiet', captures === 0);

        // Per-filter counts on the buttons, so an empty tab is visible before
        // it is pressed.
        document.querySelectorAll('[data-seclog-count]').forEach(node => {
            const key = node.getAttribute('data-seclog-count');
            node.textContent = String(key === 'all' ? logs.length : logs.filter(log => log.action === key).length);
        });

        document.querySelectorAll('[data-security-log-filter]').forEach(button => {
            button.classList.toggle('is-on', button.getAttribute('data-security-log-filter') === currentSecurityLogFilter);
        });

        const stamp = document.getElementById('seclog-updated');
        if (stamp) stamp.textContent = logs.length ? `Updated ${securityTimeAgo(new Date().toISOString())}` : 'No activity';

        if (!adminSecurityLogList) return;

        const needle = securityLogSearch.trim().toLowerCase();
        const filtered = logs.filter(log => {
            if (currentSecurityLogFilter !== 'all' && log.action !== currentSecurityLogFilter) return false;
            if (!needle) return true;
            return [log.name, log.username, log.role, log.materialTitle, log.materialSubject, log.materialCourse, log.detail]
                .filter(Boolean).join(' ').toLowerCase().includes(needle);
        });

        adminSecurityLogList.replaceChildren();

        if (!filtered.length) {
            const empty = document.createElement('p');
            empty.className = 'seclog-empty';
            empty.textContent = needle
                ? `Nothing matches "${securityLogSearch.trim()}".`
                : currentSecurityLogFilter === 'all'
                    ? 'No security events recorded yet.'
                    : `No ${describeSecurityAction(currentSecurityLogFilter).label.toLowerCase()} events yet.`;
            adminSecurityLogList.appendChild(empty);
            return;
        }

        filtered.slice(0, 120).forEach(log => {
            const meta = describeSecurityAction(log.action);

            const row = document.createElement('article');
            row.className = `seclog-row is-${meta.tone}`;

            // --- the icon -------------------------------------------------
            const mark = document.createElement('span');
            mark.className = 'seclog-mark';
            const icon = document.createElement('span');
            icon.className = 'material-icons';
            icon.textContent = meta.icon;
            mark.appendChild(icon);

            // --- the sentence ---------------------------------------------
            const body = document.createElement('div');
            body.className = 'seclog-body';

            const line = document.createElement('p');
            line.className = 'seclog-line';
            const who = document.createElement('strong');
            who.textContent = log.name || log.username || 'Unknown account';
            const what = document.createElement('span');
            what.textContent = ` ${meta.verb} `;
            const which = document.createElement('em');
            which.textContent = log.materialTitle || 'an untitled module';
            line.append(who, what, which);

            const sub = document.createElement('p');
            sub.className = 'seclog-sub';
            const parts = [
                log.role || 'User',
                [log.materialCourse, log.materialSubject].filter(Boolean).join(' · '),
                log.detail
            ].filter(Boolean);
            sub.textContent = parts.join('  ·  ');

            body.append(line, sub);

            // --- when -----------------------------------------------------
            const when = document.createElement('div');
            when.className = 'seclog-when';
            const rel = document.createElement('span');
            rel.className = 'seclog-rel';
            rel.textContent = securityTimeAgo(log.createdAt);
            const abs = document.createElement('time');
            abs.className = 'seclog-abs';
            const at = new Date(log.createdAt || Date.now());
            abs.dateTime = at.toISOString();
            abs.textContent = at.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            when.append(rel, abs);

            const tag = document.createElement('span');
            tag.className = 'seclog-tag';
            tag.textContent = meta.label;

            row.append(mark, body, tag, when);
            adminSecurityLogList.appendChild(row);
        });

        if (filtered.length > 120) {
            const more = document.createElement('p');
            more.className = 'seclog-more';
            more.textContent = `Showing the newest 120 of ${filtered.length} events.`;
            adminSecurityLogList.appendChild(more);
        }
    }

    document.getElementById('seclog-search')?.addEventListener('input', function () {
        securityLogSearch = this.value || '';
        renderModuleSecurityLogs();
    });

    document.querySelectorAll('[data-security-log-filter]').forEach(button => {
        button.addEventListener('click', function () {
            renderModuleSecurityLogs(this.getAttribute('data-security-log-filter') || 'all');
        });
    });

    document.getElementById('admin-security-refresh-btn')?.addEventListener('click', function () {
        renderModuleSecurityLogs();
    });

    document.getElementById('admin-security-clear-btn')?.addEventListener('click', function () {
        if (!confirm('Clear all module security logs?')) return;
        saveModuleSecurityLogs([]);
        renderModuleSecurityLogs();
    });

    renderModuleSecurityLogs();

    function logoutCurrentUser() {
        if (!confirm('Logout and return to login page?')) return;

        localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER);

        // Clearing the cached user is not signing out: the session cookie is
        // what the server trusts, so it has to be revoked too or the next visit
        // walks straight back in.
        if (window.CoeApi?.isServed()) {
            /*
             * Leave for the login page whether or not the call succeeds.
             *
             * Without the catch, a request that fails — a dropped phone signal
             * is the ordinary case — left the cached user already deleted and
             * the redirect never running: the screen sits there looking signed
             * in, and tapping again does nothing. Going anyway is the safer
             * half of a bad situation, and the login page re-checks the session
             * on arrival, so a cookie that outlived the request is caught
             * there.
             */
            window.CoeApi.logout()
                .catch(function (error) {
                    console.warn('[logout] the server was not reached', error);
                })
                .then(function () {
                    window.location.href = 'login.html';
                });
            return;
        }

        window.location.href = 'login.html';
    }

    profileTrigger?.addEventListener('click', function(e) {
        e.stopPropagation();
        profileMenu?.classList.toggle('active');
    });

    // Global fallback handler (capture phase) to ensure important UI tabs respond
    // This catches clicks early and triggers the appropriate page/tab actions
    document.addEventListener('click', function(e) {
        try {
            const courseTab = e.target.closest && e.target.closest('.course-tab');
            if (courseTab) {
                e.preventDefault();
                e.stopPropagation();
                // Visual active state
                document.querySelectorAll('#library-course-tabs .course-tab').forEach(t => t.classList.remove('active'));
                courseTab.classList.add('active');
                if (typeof switchLibraryCourse === 'function') switchLibraryCourse(courseTab.dataset.course);
                return;
            }

            const qaTab = e.target.closest && e.target.closest('.qa-tab-btn');
            if (qaTab) {
                e.preventDefault();
                e.stopPropagation();
                document.querySelectorAll('.qa-tab-btn').forEach(t => t.classList.remove('active'));
                qaTab.classList.add('active');
                if (typeof switchQATab === 'function') switchQATab(qaTab.dataset.qaTab);
                return;
            }

            const pageLink = e.target.closest && e.target.closest('a[data-page], button[data-page]');
            if (pageLink && pageLink.dataset && pageLink.dataset.page) {
                const pageKey = pageLink.dataset.page;
                e.preventDefault();
                e.stopPropagation();
                if (typeof showPage === 'function') showPage(pageKey);
                return;
            }
        } catch (err) {
            // swallow errors for fallback handler
            console.error('Fallback click handler error', err);
        }
    }, true);

    // Temporary click inspector: outlines the top element under the cursor and logs details
    function installClickInspector() {
        if (window.__clickInspectorInstalled) return;
        window.__clickInspectorInstalled = true;
        const outline = document.createElement('div');
        outline.style.position = 'absolute';
        outline.style.border = '3px dashed rgba(255,0,80,0.95)';
        outline.style.background = 'rgba(255,0,80,0.06)';
        outline.style.pointerEvents = 'none';
        outline.style.zIndex = 99999999;
        outline.style.transition = 'opacity 0.2s ease';
        outline.style.opacity = '0';
        document.body.appendChild(outline);

        function showOutlineFor(el, x, y) {
            if (!el || el === document.documentElement || el === document.body) return;
            const r = el.getBoundingClientRect();
            outline.style.left = (r.left + window.scrollX) + 'px';
            outline.style.top = (r.top + window.scrollY) + 'px';
            outline.style.width = r.width + 'px';
            outline.style.height = r.height + 'px';
            outline.style.opacity = '1';
            setTimeout(() => outline.style.opacity = '0', 2200);
        }

        document.addEventListener('mousedown', function (e) {
            try {
                const topEl = document.elementFromPoint(e.clientX, e.clientY);
                const nearestTab = topEl && topEl.closest ? topEl.closest('.course-tab, .qa-tab-btn, [data-page], .tree-toggle, .tree-leaf') : null;
                const info = {
                    coords: { x: e.clientX, y: e.clientY },
                    topElement: topEl && (topEl.id || topEl.className || topEl.tagName),
                    topEl: topEl,
                    nearestInteractive: nearestTab && (nearestTab.getAttribute('data-page') || nearestTab.className || nearestTab.id),
                    computed: topEl ? window.getComputedStyle(topEl).getPropertyValue('pointer-events') + ', z-index:' + window.getComputedStyle(topEl).getPropertyValue('z-index') : ''
                };
                console.log('Click inspector:', info);
                showOutlineFor(topEl, e.clientX, e.clientY);
            } catch (err) {
                console.error('Click inspector error', err);
            }
        }, true);

        console.info('Click inspector installed — click a non-responsive tab to log the top element and highlight it.');
    }

    if (localStorage.getItem('coeDebugClickInspector') === 'true') {
        installClickInspector();
    }

    profileMenu?.addEventListener('click', function (e) {
        const anchor = e.target.closest('a');
        if (!anchor) return;
        e.preventDefault();
        const action = anchor.dataset.action;
        const pageKey = anchor.dataset.page;

        if (action === 'logout') {
            logoutCurrentUser();
            return;
        }

        if (action === 'change-picture') {
            profilePictureInput?.click();
            return;
        }

        if (action === 'view-profile' || pageKey === 'settings') {
            showPage('settings');
            return;
        }

        if (pageKey) {
            showPage(pageKey);
        }
    });

    // Notifications dropdown
    const LOCAL_STORAGE_NOTIFICATIONS = 'coeNotifications';
    function loadNotifications() {
        return JSON.parse(localStorage.getItem(LOCAL_STORAGE_NOTIFICATIONS) || '[]');
    }

    function saveNotifications(items) {
        localStorage.setItem(LOCAL_STORAGE_NOTIFICATIONS, JSON.stringify(items || []));
    }

    function getUnreadCount() {
        const items = loadNotifications();
        return items.filter(i => !i.read).length;
    }

    function renderNotificationsDropdown(anchor) {
        let dropdown = document.getElementById('notifications-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'notifications-dropdown';
            dropdown.className = 'notifications-dropdown';
            document.body.appendChild(dropdown);
        }

        const items = loadNotifications();
        if (!items.length) {
            dropdown.innerHTML = '<div class="no-notifs">No notifications</div>';
        } else {
            dropdown.innerHTML = items.map((n, i) => `
                <div class="notif-item ${n.read ? 'read' : 'unread'}" data-index="${i}">
                    <div class="notif-message">${escapeHtml(n.message)}</div>
                    <div class="notif-meta">${new Date(n.time).toLocaleString()}</div>
                </div>
            `).join('');
        }

        // position below anchor
        const rect = anchor.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        dropdown.style.left = (rect.left + window.scrollX - 120) + 'px';
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.notif-item').forEach(el => {
            el.addEventListener('click', function () {
                const idx = Number(this.getAttribute('data-index'));
                const items = loadNotifications();
                if (items[idx]) items[idx].read = true;
                saveNotifications(items);
                renderNotificationBadges();
                // Example action: open announcements page
                showPage('announcements');
                dropdown.style.display = 'none';
            });
        });
    }

    function renderNotificationBadges() {
        const count = getUnreadCount();
        document.querySelectorAll('.notification-badge').forEach(b => {
            b.textContent = count > 0 ? String(count) : '';
            b.style.display = count > 0 ? 'inline-block' : 'none';
        });
        notificationButtons.forEach(button => {
            button.classList.toggle('has-unread', count > 0);
        });
    }

    function addNotification(message, metadata = {}) {
        const items = loadNotifications();
        items.unshift({
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            message: String(message || 'New notification'),
            time: new Date().toISOString(),
            read: false,
            ...metadata
        });
        saveNotifications(items.slice(0, 80));
        renderNotificationBadges();
    }

    function notifyUploadEvent(file) {
        if (!file) return;
        const fileLabel = escapeHtml(file.title || file.name || 'New upload');
        const uploader = escapeHtml(file.uploadedBy || file.ownerUsername || 'Uploader');
        const message = `${uploader} uploaded: ${fileLabel}`;
        addNotification(message, { type: 'file', fileId: file.id });
    }

    const LOCAL_STORAGE_ANNOUNCEMENTS = 'coeAnnouncements';
    const LOCAL_STORAGE_ANNOUNCEMENT_STATE = 'coeAnnouncementState';
    const announcementSearchInput = document.getElementById('announcement-search');
    const announcementTagFilter = document.getElementById('announcement-filter-tag');
    const announcementCourseFilter = document.getElementById('announcement-filter-course');
    const announcementDateFilter = document.getElementById('announcement-filter-date');
    const announcementSortSelect = document.getElementById('announcement-sort');
    const announcementCompactToggle = document.getElementById('announcement-compact-toggle');
    const announcementCouncilTabs = document.querySelectorAll('[data-announcement-course-tab]');
    const announcementAdminForm = document.getElementById('announcement-admin-form');
    const announcementTitleInput = document.getElementById('announcement-title');
    const announcementTagInput = document.getElementById('announcement-tag');
    const announcementCourseInput = document.getElementById('announcement-course');
    const announcementEventDateInput = document.getElementById('announcement-event-date');
    const announcementSummaryInput = document.getElementById('announcement-summary');
    const announcementDetailsInput = document.getElementById('announcement-details');
    const announcementRelatedPageInput = document.getElementById('announcement-related-page');
    const announcementPinnedInput = document.getElementById('announcement-pinned');
    const homeAnnouncementsList = document.getElementById('home-announcements-list');
    const homeAnnouncementsPanel = document.getElementById('home-announcements-panel');
    const homeAnnouncementChart = document.getElementById('home-announcement-chart');
    const homeAchievementForm = document.getElementById('home-achievement-form');
    const homeAchievementTitleInput = document.getElementById('home-achievement-title');
    const homeAchievementDescriptionInput = document.getElementById('home-achievement-description');
    const homeAchievementCategoryInput = document.getElementById('home-achievement-category');
    const homeAchievementImageInput = document.getElementById('home-achievement-image');
    const homeAchievementImageName = document.getElementById('home-achievement-image-name');
    const homeAchievementsList = document.getElementById('home-achievements-list');
    const homeReviewPanel = document.getElementById('home-review-panel');
    const homeReviewQueueList = document.getElementById('home-review-queue-list');
    const homeProgressPanel = document.getElementById('home-progress-panel');
    const homeUploadProgressList = document.getElementById('home-upload-progress-list');
    const homeSchedulePanel = document.getElementById('home-schedule-panel');
    const homeScheduleTimeline = document.getElementById('home-schedule-timeline');
    const homeScheduleBadge = document.getElementById('home-schedule-badge');
    const announcementsList = document.getElementById('announcements-list');
    let announcementsCompact = false;
    let announcementCouncilFilter = 'all';
    const LOCAL_STORAGE_SCHEDULE = 'coeSchedule';
    const LOCAL_STORAGE_CALENDAR_AGENDAS = 'coeCalendarAgendas';
    const LOCAL_STORAGE_COE_ACHIEVEMENTS = 'coeHomeAchievements';

    const seedAnnouncements = [
        {
            id: 'ann-midterm-exams',
            title: 'Midterm Exams',
            tag: 'Exam',
            course: 'CE',
            postedAt: '2026-05-15',
            eventDate: '2026-05-20',
            summary: '1st year CE midterm exams will be held in Lab A.',
            details: 'Bring your calculator, review notes, PPE, and student ID. Related reviewers are available in the CE library folders.',
            relatedPage: 'library',
            pinned: true
        },
        {
            id: 'ann-ee-lab-closed',
            title: 'EE Lab Closed Emergency',
            tag: 'Emergency',
            course: 'EE',
            postedAt: '2026-05-16',
            eventDate: '2026-05-16',
            summary: 'The EE lab is closed today due to safety checks.',
            details: 'Lab activities are paused until clearance is posted. Students with urgent concerns should use the Q&A Hub or message their instructor.',
            relatedPage: 'qa-hub',
            pinned: false
        },
        {
            id: 'ann-scholarship-deadline',
            title: 'Scholarship Deadline',
            tag: 'General',
            course: 'CE/EE',
            postedAt: '2026-05-15',
            eventDate: '2026-05-30',
            summary: 'Apply before May 30 to avoid processing delays.',
            details: 'Prepare your enrollment record, grades, and required forms before submitting. Late applications may move to the next review cycle.',
            relatedPage: 'announcements',
            pinned: false
        },
        {
            id: 'ann-reviewer-request',
            title: 'Reviewer Requests Open',
            tag: 'General',
            course: 'CE/EE',
            postedAt: '2026-05-18',
            eventDate: '2026-05-22',
            summary: 'Students may request missing reference books or reviewers this week.',
            details: 'Use the upload or Q&A shortcuts to suggest materials, missing topics, or cloud links that should be added to ENGIdocs.',
            relatedPage: 'library-upload',
            pinned: false
        }
    ];
    let announcements = loadAnnouncements();

    function loadAnnouncements() {
        try {
            const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ANNOUNCEMENTS) || '[]');
            return Array.isArray(saved) ? saved.map(normalizeAnnouncement) : [];
        } catch (error) {
            return [];
        }
    }

    function saveAnnouncements() {
        localStorage.setItem(LOCAL_STORAGE_ANNOUNCEMENTS, JSON.stringify(announcements));
    }

    function normalizeAnnouncement(item) {
        const courseMap = {
            PICE: 'CE',
            IIEE: 'EE',
            'PICE/IIEE': 'CE/EE'
        };
        return {
            id: item.id || `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: item.title || 'Untitled Announcement',
            tag: item.tag || 'General',
            course: courseMap[item.course] || item.course || 'CE/EE',
            postedAt: item.postedAt || localDayKey(),
            eventDate: item.eventDate || localDayKey(),
            summary: item.summary || '',
            details: item.details || '',
            relatedPage: item.relatedPage || 'announcements',
            pinned: Boolean(item.pinned),
            createdBy: item.createdBy || 'Admin'
        };
    }

    function loadAnnouncementState() {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_STORAGE_ANNOUNCEMENT_STATE) || '{}');
        } catch (error) {
            return {};
        }
    }

    function saveAnnouncementState(state) {
        localStorage.setItem(LOCAL_STORAGE_ANNOUNCEMENT_STATE, JSON.stringify(state || {}));
    }

    function getAnnouncementState(id) {
        return loadAnnouncementState()[id] || {};
    }

    function updateAnnouncementState(id, patch) {
        const state = loadAnnouncementState();
        state[id] = { ...(state[id] || {}), ...patch };
        saveAnnouncementState(state);
        if (patch.read) {
            const notifications = loadNotifications();
            const notification = notifications.find(item => item.id === `announcement-${id}`);
            if (notification) {
                notification.read = true;
                saveNotifications(notifications);
            }
        }
        renderAnnouncements();
    }

    function isAnnouncementPinned(item) {
        const state = getAnnouncementState(item.id);
        return typeof state.pinned === 'boolean' ? state.pinned : item.pinned;
    }

    function isAnnouncementRead(item) {
        return Boolean(getAnnouncementState(item.id).read);
    }

    function formatAnnouncementDate(value) {
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime())
            ? value
            : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getAnnouncementIcon(tag) {
        if (tag === 'Emergency') return 'priority_high';
        if (tag === 'Exam') return 'assignment';
        return 'campaign';
    }

    function announcementMatchesCouncil(item, council) {
        if (!council || council === 'all') return true;
        return (item.course || '').includes(council);
    }

    function isNewAnnouncement(item) {
        const posted = new Date(`${item.postedAt}T00:00:00`);
        if (Number.isNaN(posted.getTime())) return false;
        const ageMs = Date.now() - posted.getTime();
        return ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24 * 7 && !isAnnouncementRead(item);
    }

    function getFilteredAnnouncements() {
        const query = announcementSearchInput?.value.trim().toLowerCase() || '';
        const tag = announcementTagFilter?.value || '';
        const course = announcementCourseFilter?.value || '';
        const dateFilter = announcementDateFilter?.value || '';
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const weekFromNow = new Date(now);
        weekFromNow.setDate(now.getDate() + 7);

        return announcements
            .filter(item => {
                const eventDate = new Date(`${item.eventDate}T00:00:00`);
                const text = `${item.title} ${item.tag} ${item.course} ${item.summary} ${item.details}`.toLowerCase();
                const matchesQuery = !query || text.includes(query);
                const matchesTag = !tag || item.tag === tag;
                const matchesCourse = !course || item.course.includes(course);
                const matchesCouncil = announcementMatchesCouncil(item, announcementCouncilFilter);
                const matchesDate = !dateFilter ||
                    (dateFilter === 'today' && eventDate.toDateString() === now.toDateString()) ||
                    (dateFilter === 'week' && eventDate >= now && eventDate <= weekFromNow) ||
                    (dateFilter === 'past' && eventDate < now);
                return matchesQuery && matchesTag && matchesCourse && matchesCouncil && matchesDate;
            })
            .sort((left, right) => {
                const leftPinned = isAnnouncementPinned(left) ? 1 : 0;
                const rightPinned = isAnnouncementPinned(right) ? 1 : 0;
                if (leftPinned !== rightPinned) return rightPinned - leftPinned;
                const sort = announcementSortSelect?.value || 'recent';
                if (sort === 'urgent') {
                    const priority = { Emergency: 3, Exam: 2, General: 1 };
                    return (priority[right.tag] || 0) - (priority[left.tag] || 0);
                }
                if (sort === 'course') {
                    return left.course.localeCompare(right.course) || left.title.localeCompare(right.title);
                }
                return new Date(right.postedAt) - new Date(left.postedAt);
            });
    }

    function renderAnnouncementCard(item, compact = false) {
        const pinned = isAnnouncementPinned(item);
        const read = isAnnouncementRead(item);
        const expanded = Boolean(getAnnouncementState(item.id).expanded) && !compact;
        const urgent = item.tag === 'Emergency';
        const newBadge = isNewAnnouncement(item) ? '<span class="announcement-new-badge">New</span>' : '';
        const adminActions = isAdmin
            ? `<button class="announcement-action-btn danger" data-announcement-action="delete" title="Delete"><span class="material-icons">delete</span></button>`
            : '';
        return `
            <article class="announcement-card ${pinned ? 'pinned' : ''} ${urgent ? 'urgent' : ''} ${read ? 'read' : 'unread'} ${compact ? 'compact' : ''} ${expanded ? 'expanded' : ''}" data-announcement-id="${escapeHtml(item.id)}">
                <button class="announcement-expand-area" type="button" data-announcement-action="toggle">
                    <span class="announcement-card-icon material-icons">${getAnnouncementIcon(item.tag)}</span>
                    <span class="announcement-card-body">
                        <span class="announcement-card-header">
                            <h4>${escapeHtml(item.title)}</h4>
                            <span class="announcement-header-badges">
                                ${newBadge}
                                <span class="announcement-tag ${item.tag.toLowerCase()}">${escapeHtml(item.tag)}</span>
                            </span>
                        </span>
                        <span class="announcement-meta-line">${escapeHtml(item.course)} | Posted ${formatAnnouncementDate(item.postedAt)} | Event ${formatAnnouncementDate(item.eventDate)} | By ${escapeHtml(item.createdBy || 'Admin')}</span>
                        <span class="announcement-summary">${escapeHtml(item.summary)}</span>
                        ${expanded ? `<span class="announcement-details">${escapeHtml(item.details)}</span>` : ''}
                    </span>
                </button>
                <div class="announcement-card-footer">
                    <span class="announcement-time">${expanded ? 'Tap to collapse' : 'Tap for details'}</span>
                    <div class="announcement-card-actions">
                        <button class="announcement-action-btn ${read ? 'active' : ''}" data-announcement-action="read" title="Mark as read"><span class="material-icons">${read ? 'done_all' : 'done'}</span></button>
                        <button class="announcement-action-btn ${pinned ? 'active' : ''}" data-announcement-action="pin" title="Pin"><span class="material-icons">${pinned ? 'push_pin' : 'push_pin'}</span></button>
                        <button class="announcement-action-btn" data-announcement-action="share" title="Share"><span class="material-icons">ios_share</span></button>
                        <button class="announcement-action-btn" data-announcement-action="related" data-page="${escapeHtml(item.relatedPage)}" title="Open related page"><span class="material-icons">open_in_new</span></button>
                        ${adminActions}
                    </div>
                </div>
            </article>
        `;
    }

    function handleAnnouncementAction(event) {
        const actionButton = event.target.closest('[data-announcement-action]');
        if (!actionButton) return;
        const card = event.target.closest('[data-announcement-id]');
        const id = card?.dataset.announcementId;
        const item = announcements.find(announcement => announcement.id === id);
        if (!item) return;
        const action = actionButton.dataset.announcementAction;
        event.preventDefault();
        event.stopPropagation();
        const state = getAnnouncementState(id);
        if (action === 'toggle') updateAnnouncementState(id, { expanded: !state.expanded });
        if (action === 'read') updateAnnouncementState(id, { read: true });
        if (action === 'pin') updateAnnouncementState(id, { pinned: !isAnnouncementPinned(item) });
        if (action === 'related') showPage(actionButton.dataset.page || 'library');
        if (action === 'delete' && isAdmin) {
            if (!confirm('Delete this announcement for everyone?')) return;

            saveNotifications(loadNotifications().filter(notification => notification.id !== `announcement-${id}`));

            /*
             * The server first, when there is one.
             *
             * Splicing the local array was all this used to do, and the board
             * is server-backed — so the next sync (a socket event, a page
             * change) refetched the notice and put it straight back. The card
             * disappeared for about a second and returned, for everyone
             * including the administrator who deleted it.
             *
             * The list is not touched here on the server path: the delete
             * broadcasts `announcement:deleted`, coe-board.js refetches, and
             * the bridge replaces the array. One direction in, one out.
             */
            if (window.CoeBoard?.ready) {
                window.CoeBoard.deleteAnnouncement(id)
                    .then(function () {
                        window.showLibraryToast?.('Deleted', 'Removed from the board for everyone.', 'success');
                    })
                    .catch(function (error) {
                        window.showLibraryToast?.(
                            error && error.status === 403 ? 'Not allowed' : 'Could not delete',
                            (error && error.message) || 'Try again.',
                            'error'
                        );
                    });
            } else {
                // No server: the portal is running off the filesystem.
                announcements = announcements.filter(announcement => announcement.id !== id);
                saveAnnouncements();
                renderAnnouncements();
            }
        }
        if (action === 'share') {
            const shareText = `${item.title}: ${item.summary}`;
            if (navigator.clipboard) navigator.clipboard.writeText(shareText);
            alert('Announcement summary copied for sharing.');
        }
    }

    function syncAnnouncementNotifications() {
        const notifications = loadNotifications();
        let changed = false;
        announcements
            .filter(item => item.tag === 'Emergency')
            .forEach(item => {
                const notificationId = `announcement-${item.id}`;
                if (!notifications.some(notification => notification.id === notificationId)) {
                    notifications.unshift({
                        id: notificationId,
                        message: `Emergency: ${item.title}`,
                        time: `${item.postedAt}T08:00:00`,
                        read: isAnnouncementRead(item),
                        important: true
                    });
                    changed = true;
                }
            });
        if (changed) saveNotifications(notifications);
        renderNotificationBadges();
    }

    function renderHomeAnnouncementChart(items) {
        if (!homeAnnouncementChart) return;
        if (!items.length) {
            homeAnnouncementChart.innerHTML = '';
            return;
        }

        const counts = [
            { label: 'CE', value: items.filter(item => announcementMatchesCouncil(item, 'CE')).length, className: 'ce' },
            { label: 'EE', value: items.filter(item => announcementMatchesCouncil(item, 'EE')).length, className: 'ee' },
            { label: 'New', value: items.filter(isNewAnnouncement).length, className: 'new' }
        ];
        const max = Math.max(1, ...counts.map(item => item.value));

        homeAnnouncementChart.innerHTML = counts.map(item => `
            <div class="announcement-chart-row">
                <span>${escapeHtml(item.label)}</span>
                <div class="announcement-chart-track">
                    <strong class="${item.className}" style="width:${Math.max(10, (item.value / max) * 100)}%"></strong>
                </div>
                <em>${item.value}</em>
            </div>
        `).join('');
    }

    function loadHomeAchievements() {
        try {
            const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_COE_ACHIEVEMENTS) || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch (error) {
            return [];
        }
    }

    function saveHomeAchievements(items) {
        localStorage.setItem(LOCAL_STORAGE_COE_ACHIEVEMENTS, JSON.stringify(items));
    }

    function renderHomeAchievements() {
        if (!homeAchievementsList) return;
        const achievements = loadHomeAchievements()
            .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
            .slice(0, 8);

        if (homeAchievementForm) {
            homeAchievementForm.hidden = !isAdmin;
        }

        homeAchievementsList.innerHTML = achievements.length
            ? achievements.map(item => `
                <article class="home-achievement-post">
                    <div class="home-achievement-post-top">
                        <span class="home-post-avatar"><span class="material-icons">school</span></span>
                        <div>
                            <strong>${escapeHtml(item.author || 'COE Admin')}</strong>
                            <small>${escapeHtml(formatDate(item.createdAt || new Date().toISOString()))}</small>
                        </div>
                        ${isAdmin ? `<button type="button" class="home-achievement-delete" data-achievement-id="${escapeHtml(item.id || '')}" title="Delete post"><span class="material-icons">delete</span></button>` : ''}
                    </div>
                    <div class="home-achievement-post-body">
                        <span class="home-achievement-chip">${escapeHtml(item.category || 'Achievement')}</span>
                        <h4>${escapeHtml(item.title || 'COE Achievement')}</h4>
                        <p>${escapeHtml(item.description || '')}</p>
                        ${item.imageContent ? `<img class="home-achievement-image" src="${escapeHtml(item.imageContent)}" alt="${escapeHtml(item.title || 'COE achievement image')}">` : ''}
                    </div>
                </article>
            `).join('')
            : '<div class="empty-home-section">No COE achievements posted yet.</div>';
    }

    function renderAnnouncements() {
        const filtered = getFilteredAnnouncements();

        /*
         * The home newsfeed carousel.
         *
         * Fed the whole board, not `filtered` — the search box and the tag and
         * course dropdowns belong to the Announcements page, and a student who
         * left a filter set there would otherwise come back to Home and find
         * the top of the page showing one notice, or none, for no visible
         * reason. The feed does its own pinned-first ordering and its own cap.
         *
         * Optional call: coe-newsfeed.js is a separate file, and the board must
         * keep rendering if it fails to load.
         */
        window.CoeNewsfeed?.setItems(announcements);
        if (homeAnnouncementsList) {
            const homeItems = announcements
                .slice()
                .sort((left, right) => (isAnnouncementPinned(right) ? 1 : 0) - (isAnnouncementPinned(left) ? 1 : 0) || new Date(right.postedAt) - new Date(left.postedAt))
                .slice(0, 3);
            renderHomeAnnouncementChart(homeItems);
            homeAnnouncementsList.innerHTML = homeItems.length
                ? homeItems.map(item => renderAnnouncementCard(item, false)).join('')
                : '<div class="empty-home-section">No announcements yet.</div>';
            if (homeAnnouncementsPanel) {
                homeAnnouncementsPanel.style.display = '';
            }
        }
        if (announcementsList) {
            announcementsList.classList.toggle('compact-mode', announcementsCompact);
            announcementsList.innerHTML = filtered.length
                ? filtered.map(item => renderAnnouncementCard(item, announcementsCompact)).join('')
                : '<p class="empty-library">No announcements match the current filters.</p>';
        }
        syncAnnouncementNotifications();
        syncDashboardNotifications();
        renderSmartWorkspace();
        displayHomeDashboardStats();
        renderCommunicationFeed();
        renderHomeAchievements();
    }

    function renderCommunicationFeed() {
        if (typeof window.refreshCommunicationAnnouncements === 'function') {
            window.refreshCommunicationAnnouncements();
        }
    }

    function initRealtimeCommunicationLegacy() {
        const panel = document.getElementById('messages-panel');
        if (!panel || panel.dataset.commReady === 'true') return;
        panel.dataset.commReady = 'true';

        const storageKey = 'coeRealtimeMessages';
        const voicePresenceKey = 'coeRealtimeVoicePresence';
        const channelConfig = {
            general: {
                label: 'General',
                title: 'General COE Lobby',
                meta: 'All-course academic coordination'
            },
            ce: {
                label: 'CE Studio',
                title: 'Civil Engineering Group Chat',
                meta: 'Structures, surveying, hydraulics, and design coordination'
            },
            ee: {
                label: 'EE Lab',
                title: 'Electrical Engineering Group Chat',
                meta: 'Circuits, machines, electronics, and lab troubleshooting'
            }
        };
        const disciplineKey = String(currentUser?.discipline || '').toLowerCase();
        const defaultChannel = disciplineKey === 'ee' ? 'ee' : (disciplineKey === 'ce' ? 'ce' : 'general');
        let activeChannel = channelConfig[defaultChannel] ? defaultChannel : 'general';

        const channelButtons = panel.querySelectorAll('[data-comm-channel]');
        const chatThread = document.getElementById('comm-chat-thread');
        const chatForm = document.getElementById('comm-chat-form');
        const chatInput = document.getElementById('comm-chat-input');
        const channelTitle = document.getElementById('comm-channel-title');
        const channelMeta = document.getElementById('comm-channel-meta');
        const activeChannelBadge = document.getElementById('comm-active-channel-badge');
        const unreadCount = document.getElementById('comm-unread-count');
        const onlineCount = document.getElementById('comm-online-count');
        const liveChatCount = document.getElementById('comm-live-chat-count');
        const groupCount = document.getElementById('comm-group-count');
        const voiceCount = document.getElementById('comm-voice-count');
        const videoCount = document.getElementById('comm-video-count');
        const voiceStatus = document.getElementById('comm-voice-status');
        const videoStatus = document.getElementById('comm-video-status');

        function seedMessages() {
            const now = Date.now();
            return [
                {
                    id: 'seed-general-1',
                    channel: 'general',
                    author: 'Faculty Desk',
                    role: 'Faculty',
                    body: 'Office hours and consultation rooms are monitored today.',
                    time: new Date(now - 1000 * 60 * 38).toISOString()
                },
                {
                    id: 'seed-general-2',
                    channel: 'general',
                    author: 'COE Council',
                    role: 'Admin',
                    body: 'Use the course rooms for quick group coordination before lab sessions.',
                    time: new Date(now - 1000 * 60 * 24).toISOString()
                },
                {
                    id: 'seed-ce-1',
                    channel: 'ce',
                    author: 'Engr. Reyes',
                    role: 'Faculty',
                    body: 'CE groups may post design-review blockers here before joining voice.',
                    time: new Date(now - 1000 * 60 * 18).toISOString()
                },
                {
                    id: 'seed-ce-2',
                    channel: 'ce',
                    author: 'CE 3A',
                    role: 'Student',
                    body: 'Our surveying notes are ready for peer checking.',
                    time: new Date(now - 1000 * 60 * 11).toISOString()
                },
                {
                    id: 'seed-ee-1',
                    channel: 'ee',
                    author: 'Engr. Santos',
                    role: 'Faculty',
                    body: 'EE Circuit Review is open for lab troubleshooting and short voice huddles.',
                    time: new Date(now - 1000 * 60 * 21).toISOString()
                },
                {
                    id: 'seed-ee-2',
                    channel: 'ee',
                    author: 'EE 2B',
                    role: 'Student',
                    body: 'Can someone confirm the transformer equivalent circuit assumptions?',
                    time: new Date(now - 1000 * 60 * 9).toISOString()
                }
            ];
        }

        function loadCommunicationMessages() {
            try {
                const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
                return Array.isArray(parsed) && parsed.length ? parsed : seedMessages();
            } catch (error) {
                console.error('Unable to load communication messages:', error);
                return seedMessages();
            }
        }

        let messages = loadCommunicationMessages();

        function saveCommunicationMessages() {
            localStorage.setItem(storageKey, JSON.stringify(messages.slice(-80)));
        }

        function formatCommTime(value) {
            const date = new Date(value);
            return Number.isNaN(date.getTime())
                ? 'Now'
                : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function getInitials(name) {
            return String(name || 'COE')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part.charAt(0).toUpperCase())
                .join('') || 'CO';
        }

        function renderCommunicationStats() {
            const voiceButtons = panel.querySelectorAll('[data-comm-voice]');
            const videoButtons = panel.querySelectorAll('[data-comm-video]');
            const uniqueAuthors = new Set(messages.map(item => item.author).filter(Boolean));
            if (onlineCount) onlineCount.textContent = String(Math.max(18, uniqueAuthors.size + 12));
            if (liveChatCount) liveChatCount.textContent = String(messages.length);
            if (groupCount) groupCount.textContent = String(Object.keys(channelConfig).length);
            if (voiceCount) voiceCount.textContent = String(voiceButtons.length);
            if (videoCount) videoCount.textContent = String(videoButtons.length);
        }

        function renderChat() {
            const config = channelConfig[activeChannel] || channelConfig.general;
            const channelMessages = messages.filter(item => item.channel === activeChannel);
            if (channelTitle) channelTitle.textContent = config.title;
            if (channelMeta) channelMeta.textContent = config.meta;
            if (activeChannelBadge) activeChannelBadge.textContent = config.label;
            if (unreadCount) unreadCount.textContent = String(channelMessages.filter(item => !item.self).length);

            channelButtons.forEach(button => {
                button.classList.toggle('active', button.dataset.commChannel === activeChannel);
            });

            if (chatThread) {
                chatThread.innerHTML = channelMessages.length
                    ? channelMessages.map(item => {
                        const isMine = Boolean(item.self);
                        return `
                            <article class="comm-message ${isMine ? 'is-mine' : ''}">
                                <span class="comm-message-avatar">${escapeHtml(getInitials(item.author))}</span>
                                <div class="comm-message-bubble">
                                    <div class="comm-message-meta">
                                        <strong>${escapeHtml(item.author || 'COE Member')}</strong>
                                        <span>${escapeHtml(item.role || 'Member')}</span>
                                        <time>${escapeHtml(formatCommTime(item.time))}</time>
                                    </div>
                                    <p>${escapeHtml(item.body)}</p>
                                </div>
                            </article>
                        `;
                    }).join('')
                    : '<p class="empty-library">No messages in this course room yet.</p>';
                chatThread.scrollTop = chatThread.scrollHeight;
            }

            renderCommunicationStats();
        }

        channelButtons.forEach(button => {
            button.addEventListener('click', function () {
                const channel = this.dataset.commChannel;
                if (!channelConfig[channel]) return;
                activeChannel = channel;
                renderChat();
            });
        });

        chatForm?.addEventListener('submit', function (event) {
            event.preventDefault();
            const body = chatInput?.value.trim();
            if (!body) return;

            const author = currentUser?.name || currentUser?.username || 'COE Member';
            messages.push({
                id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                channel: activeChannel,
                author,
                role: currentRole.charAt(0) + currentRole.slice(1).toLowerCase(),
                body,
                time: new Date().toISOString(),
                self: true
            });
            saveCommunicationMessages();
            if (chatInput) chatInput.value = '';
            addActivity(`Posted in ${channelConfig[activeChannel].label}: "${body.slice(0, 48)}${body.length > 48 ? '...' : ''}"`, { type: 'communication' });
            renderChat();
        });

        panel.querySelectorAll('[data-comm-voice]').forEach(button => {
            button.addEventListener('click', function () {
                const room = this.dataset.commVoice || 'Voice channel';
                panel.querySelectorAll('[data-comm-voice]').forEach(item => {
                    item.classList.remove('active');
                    item.textContent = 'Join';
                });
                this.classList.add('active');
                this.textContent = 'Joined';
                if (voiceStatus) voiceStatus.textContent = 'Joined';
                addActivity(`Joined voice channel: ${room}`, { type: 'communication' });
            });
        });

        panel.querySelectorAll('[data-comm-video]').forEach(button => {
            button.addEventListener('click', function () {
                const room = this.dataset.commVideo || 'Video room';
                panel.querySelectorAll('[data-comm-video]').forEach(item => item.classList.remove('active'));
                this.classList.add('active');
                if (videoStatus) videoStatus.textContent = room;
                addActivity(`Opened video consultation room: ${room}`, { type: 'communication' });
            });
        });

        saveCommunicationMessages();
        renderCommunicationFeed();
        renderChat();
    }

    function initRealtimeCommunication() {
        const panel = document.getElementById('messages-panel');
        if (!panel || panel.dataset.commReady === 'true') return;
        panel.dataset.commReady = 'true';

        const storageKey = 'coeRealtimeMessages';
        const workspace = panel.querySelector('.discord-workspace');
        const serverTitle = document.getElementById('comm-server-title');
        const serverMeta = document.getElementById('comm-server-meta');
        const channelList = document.getElementById('comm-text-channel-list');
        const voiceRoomList = document.getElementById('comm-voice-room-list');
        const videoRoomList = document.getElementById('comm-video-room-list');
        const chatThread = document.getElementById('comm-chat-thread');
        const chatForm = document.getElementById('comm-chat-form');
        const chatInput = document.getElementById('comm-chat-input');
        const messageSearch = document.getElementById('comm-message-search');
        const channelTitle = document.getElementById('comm-channel-title');
        const channelTopic = document.getElementById('comm-channel-topic');
        const channelIcon = document.getElementById('comm-channel-icon');
        const pinnedStrip = document.getElementById('comm-pinned-strip');
        const pinCount = document.getElementById('comm-pin-count');
        const onlineCount = document.getElementById('comm-online-count');
        const studentCount = document.getElementById('comm-student-count');
        const facultyCount = document.getElementById('comm-faculty-count');
        const adminCount = document.getElementById('comm-admin-count');
        const memberList = document.getElementById('comm-member-list');
        const fileInput = document.getElementById('comm-file-upload');
        const imageInput = document.getElementById('comm-image-upload');
        const emojiBtn = document.getElementById('comm-emoji-btn');
        const gifBtn = document.getElementById('comm-gif-btn');
        const voiceMessageBtn = document.getElementById('comm-voice-message-btn');
        const typingIndicator = document.getElementById('comm-typing-indicator');
        const typingText = document.getElementById('comm-typing-text');
        const favoriteChannelBtn = document.getElementById('comm-favorite-channel');
        const favoriteCount = document.getElementById('comm-favorite-count');
        const clearSearchBtn = document.getElementById('comm-clear-search');
        const roomStatus = document.getElementById('comm-room-status');
        const roomPresence = document.getElementById('comm-room-presence');
        const emojiPicker = document.getElementById('comm-emoji-picker');
        const composerPreview = document.getElementById('comm-composer-preview');

        const serverConfig = {
            coe: {
                short: 'COE',
                title: 'COE Live Chats',
                meta: 'Separate rooms for General, Electrical Engineering, and Civil Engineering.',
                channels: [
                    { id: 'general', name: 'General Chat', label: 'All COE students', icon: 'forum', topic: 'General room for announcements, reminders, and questions for everyone.' },
                    { id: 'ee', name: 'EE Live Chat', label: 'Electrical Engineering only', icon: 'electric_bolt', topic: 'Electrical Engineering room for EE questions, lab updates, circuits, power, and machines.' },
                    { id: 'ce', name: 'CE Live Chat', label: 'Civil Engineering only', icon: 'architecture', topic: 'Civil Engineering room for CE questions, plans, surveying, structures, and project coordination.' }
                ],
                voice: [],
                video: []
            }
        };

        const fakeCommunicationAuthors = new Set([
            'Dean Office',
            'COE Council',
            'Faculty Desk',
            'Library Moderator',
            'Engr. Reyes',
            'Engr. Santos',
            'CE 3A Lead',
            'EE 2B Lead',
            'Alyssa M.',
            'Marco D.',
            'Nina P.',
            'Paolo R.',
            'CE 3A',
            'EE 2B'
        ]);

        const disciplineKey = String(currentUser?.discipline || '').toLowerCase();
        let activeServer = 'coe';
        let activeChannel = 'general';
        let joinedVoiceRoom = '';
        let joinedVideoRoom = '';
        const voicePresenceKey = 'coeRealtimeVoicePresence';
        const favoriteChannelsKey = 'coeCommunicationFavoriteChannels';
        const readStateKey = 'coeCommunicationReadState';
        const currentDeviceIdKey = 'coeCommunicationDeviceId';
        const maxInlineAttachmentSize = 2.5 * 1024 * 1024;
        let voicePresence = loadVoicePresence();
        let typingTimer = null;
        let editingMessageId = '';
        let pendingAttachment = null;
        let mediaRecorder = null;
        let recorderChunks = [];
        let remoteTypingTimer = null;
        let favoriteChannels = loadFavoriteChannels();
        let readState = loadReadState();
        let communicationChannel = null;
        const currentDeviceId = getCommunicationDeviceId();

        try {
            communicationChannel = 'BroadcastChannel' in window ? new BroadcastChannel('coe-communication-live') : null;
        } catch (error) {
            console.warn('Communication live channel unavailable:', error);
        }

        function getCurrentServer() {
            return serverConfig[activeServer] || serverConfig.coe;
        }

        function getCurrentChannel() {
            return getCurrentServer().channels.find(channel => channel.id === activeChannel) || getCurrentServer().channels[0];
        }

        function getInitials(name) {
            return String(name || 'COE')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part.charAt(0).toUpperCase())
                .join('') || 'CO';
        }

        function normalizeRole(role) {
            const raw = String(role || 'Student').toUpperCase();
            if (raw === 'ADMIN') return 'Admin';
            if (raw === 'FACULTY') return 'Faculty';
            if (raw === 'COUNCIL') return 'Council';
            if (raw === 'ORG_OFFICER_PICE') return 'PICE Officer';
            if (raw === 'ORG_OFFICER_IIEE') return 'IIEE Officer';
            return raw.charAt(0) + raw.slice(1).toLowerCase();
        }

        function getCurrentRoleLabel() {
            return normalizeRole(currentRole || currentUser?.role || 'Student');
        }

        function isMessageFromCurrent(message) {
            const authorUsername = String(message?.authorUsername || message?.username || '').toLowerCase();
            const authorName = String(message?.author || '').toLowerCase();
            const currentName = String(currentUser?.name || '').toLowerCase();
            return Boolean(currentUsername && authorUsername === currentUsername.toLowerCase()) ||
                Boolean(currentName && authorName === currentName);
        }

        function getAccountServer(account) {
            const discipline = String(account?.discipline || account?.course || '').toUpperCase();
            if (discipline.includes('EE')) return 'ee';
            if (discipline.includes('CE')) return 'ce';
            return 'coe';
        }

        function getAccountStatus(account) {
            if (currentUsername && String(account?.username || '').toLowerCase() === currentUsername.toLowerCase()) return 'online';
            const role = normalizeRole(account?.role || account?.type || 'Student');
            if (role === 'Faculty') return 'busy';
            if (role === 'Admin' || role === 'Council') return 'online';
            return 'idle';
        }

        function getRegisteredCommunicationMembers() {
            const accounts = initStoredUsers();
            const seen = new Set();
            return accounts
                .filter(account => account && account.username)
                .map(account => ({
                    id: String(account.username || account.name || '').toLowerCase(),
                    name: account.name || account.username,
                    username: account.username,
                    role: normalizeRole(account.role || account.type || 'Student'),
                    server: getAccountServer(account),
                    status: getAccountStatus(account),
                    self: currentUsername && String(account.username || '').toLowerCase() === currentUsername.toLowerCase()
                }))
                .filter(member => {
                    if (!member.id || seen.has(member.id)) return false;
                    seen.add(member.id);
                    return true;
                });
        }

        function getCurrentPresenceMember() {
            const members = getRegisteredCommunicationMembers();
            return members.find(member => member.self) || {
                id: currentUsername || currentUser?.username || currentUser?.name || 'current-user',
                name: currentUser?.name || currentUser?.username || 'Current User',
                username: currentUser?.username || currentUsername || '',
                role: getCurrentRoleLabel(),
                server: activeServer,
                status: 'online',
                self: true
            };
        }

        function getCommunicationDeviceId() {
            let deviceId = localStorage.getItem(currentDeviceIdKey);
            if (!deviceId) {
                deviceId = `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                localStorage.setItem(currentDeviceIdKey, deviceId);
            }
            return deviceId;
        }

        function loadFavoriteChannels() {
            try {
                const parsed = JSON.parse(localStorage.getItem(favoriteChannelsKey) || '[]');
                return new Set(Array.isArray(parsed) ? parsed : []);
            } catch (error) {
                console.error('Unable to load communication favorites:', error);
                return new Set();
            }
        }

        function saveFavoriteChannels() {
            localStorage.setItem(favoriteChannelsKey, JSON.stringify([...favoriteChannels]));
        }

        function loadReadState() {
            try {
                const parsed = JSON.parse(localStorage.getItem(readStateKey) || '{}');
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            } catch (error) {
                console.error('Unable to load communication read state:', error);
                return {};
            }
        }

        function saveReadState() {
            localStorage.setItem(readStateKey, JSON.stringify(readState));
        }

        function getChannelKey(serverKey = activeServer, channelId = activeChannel) {
            return `${serverKey}:${channelId}`;
        }

        function markChannelRead(serverKey = activeServer, channelId = activeChannel) {
            readState[getChannelKey(serverKey, channelId)] = new Date().toISOString();
            saveReadState();
        }

        function isChannelFavorite(serverKey = activeServer, channelId = activeChannel) {
            return favoriteChannels.has(getChannelKey(serverKey, channelId));
        }

        function broadcastCommunication(type, payload = {}) {
            const event = {
                type,
                payload,
                deviceId: currentDeviceId,
                time: new Date().toISOString()
            };
            communicationChannel?.postMessage(event);
            localStorage.setItem('coeCommunicationLastEvent', JSON.stringify(event));
        }

        function formatFileSize(size) {
            const value = Number(size || 0);
            if (!value) return '0 KB';
            if (value < 1024) return `${value} B`;
            if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
            return `${(value / (1024 * 1024)).toFixed(1)} MB`;
        }

        function loadVoicePresence() {
            try {
                const parsed = JSON.parse(localStorage.getItem(voicePresenceKey) || '{}');
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            } catch (error) {
                console.error('Unable to load voice presence:', error);
                return {};
            }
        }

        function saveVoicePresence() {
            localStorage.setItem(voicePresenceKey, JSON.stringify(voicePresence));
        }

        function getVoiceRoomKey(server, roomId) {
            return `${server}:${roomId}`;
        }

        function removeCurrentVoicePresence() {
            const current = getCurrentPresenceMember();
            Object.keys(voicePresence).forEach(roomKey => {
                if (voicePresence[roomKey] && voicePresence[roomKey][current.id]) {
                    delete voicePresence[roomKey][current.id];
                    if (!Object.keys(voicePresence[roomKey]).length) delete voicePresence[roomKey];
                }
            });
        }

        function joinVoiceRoom(roomId) {
            const current = getCurrentPresenceMember();
            removeCurrentVoicePresence();
            const roomKey = getVoiceRoomKey(activeServer, roomId);
            voicePresence[roomKey] = {
                ...(voicePresence[roomKey] || {}),
                [current.id]: {
                    id: current.id,
                    name: current.name,
                    username: current.username,
                    role: current.role,
                    status: 'online',
                    joinedAt: new Date().toISOString()
                }
            };
            joinedVoiceRoom = roomId;
            saveVoicePresence();
        }

        function leaveVoiceRoom() {
            removeCurrentVoicePresence();
            joinedVoiceRoom = '';
            saveVoicePresence();
        }

        function getVoiceParticipants(server, roomId) {
            const registeredIds = new Set(getRegisteredCommunicationMembers().map(member => member.id));
            const room = voicePresence[getVoiceRoomKey(server, roomId)] || {};
            return Object.values(room)
                .filter(member => registeredIds.has(member.id))
                .sort((left, right) => String(left.name).localeCompare(String(right.name)));
        }

        function getJoinedVoiceRoomForServer(server) {
            const current = getCurrentPresenceMember();
            const roomPrefix = `${server}:`;
            const joinedKey = Object.keys(voicePresence).find(roomKey => roomKey.startsWith(roomPrefix) && voicePresence[roomKey]?.[current.id]);
            return joinedKey ? joinedKey.slice(roomPrefix.length) : '';
        }

        function seedMessages() {
            return [];
        }

        function normalizeCommunicationServerChannel(message) {
            const legacyServer = String(message.server || '').toLowerCase();
            const legacyChannel = String(message.channel || 'general').toLowerCase();
            if (legacyServer === 'ce' || legacyChannel === 'ce') return { server: 'coe', channel: 'ce' };
            if (legacyServer === 'ee' || legacyChannel === 'ee') return { server: 'coe', channel: 'ee' };
            if (legacyServer === 'coe' && serverConfig.coe.channels.some(item => item.id === legacyChannel)) {
                return { server: 'coe', channel: legacyChannel };
            }
            return { server: 'coe', channel: serverConfig.coe.channels.some(item => item.id === legacyChannel) ? legacyChannel : 'general' };
        }

        function normalizeMessage(message) {
            const normalizedTarget = normalizeCommunicationServerChannel(message);
            return {
                ...message,
                server: normalizedTarget.server,
                channel: normalizedTarget.channel,
                role: normalizeRole(message.role),
                status: message.status || (message.self ? 'online' : 'idle'),
                self: isMessageFromCurrent(message),
                reactions: Array.isArray(message.reactions) ? message.reactions : [],
                edited: Boolean(message.edited),
                deletedAt: message.deletedAt || '',
                deliveredAt: message.deliveredAt || message.time || new Date().toISOString(),
                seenAt: message.seenAt || (message.self ? message.time : ''),
                attachmentType: message.attachmentType || '',
                attachmentUrl: message.attachmentUrl || '',
                attachmentSize: Number(message.attachmentSize || 0)
            };
        }

        function loadCommunicationMessages() {
            try {
                const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
                if (!Array.isArray(parsed)) return seedMessages();
                return parsed
                    .map(normalizeMessage)
                    .filter(message => !String(message.id || '').startsWith('seed-'))
                    .filter(message => !fakeCommunicationAuthors.has(message.author || ''));
            } catch (error) {
                console.error('Unable to load communication messages:', error);
                return seedMessages();
            }
        }

        let messages = loadCommunicationMessages();

        function saveCommunicationMessages() {
            localStorage.setItem(storageKey, JSON.stringify(messages.slice(-120)));
        }

        function formatCommTime(value) {
            const date = new Date(value);
            return Number.isNaN(date.getTime())
                ? 'Now'
                : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function announcementToMessage(item) {
            return {
                id: `announcement-${item.id}`,
                server: 'coe',
                channel: 'announcements',
                author: item.createdBy || 'Faculty Desk',
                authorUsername: '',
                role: item.createdBy === 'Admin' ? 'Admin' : 'Faculty',
                status: 'online',
                body: `${item.title}: ${item.summary || item.details || 'New announcement posted.'}`,
                time: `${item.postedAt || localDayKey()}T08:00:00`,
                pinned: Boolean(item.pinned || item.tag === 'Emergency'),
                reactions: [{ icon: getAnnouncementIcon(item.tag || 'General'), count: item.tag === 'Emergency' ? 12 : 4 }],
                announcement: true
            };
        }

        function getAnnouncementMessages() {
            const items = Array.isArray(announcements) ? announcements : [];
            return items.map(announcementToMessage);
        }

        function getAllCommunicationMessages() {
            return [...messages, ...getAnnouncementMessages()];
        }

        function getChannelUnreadCount(serverKey, channelId) {
            const lastRead = new Date(readState[getChannelKey(serverKey, channelId)] || 0).getTime();
            return getAllCommunicationMessages()
                .filter(item => item.server === serverKey && item.channel === channelId && !isMessageFromCurrent(item))
                .filter(item => new Date(item.time || 0).getTime() > lastRead)
                .length;
        }

        function getVisibleMessages() {
            const query = (messageSearch?.value || '').trim().toLowerCase();
            return getAllCommunicationMessages()
                .filter(item => item.server === activeServer && item.channel === activeChannel)
                .filter(item => !query || `${item.author} ${item.role} ${item.body} ${item.attachmentLabel || ''}`.toLowerCase().includes(query))
                .sort((left, right) => new Date(left.time) - new Date(right.time));
        }

        function getPinnedMessages() {
            return getVisibleMessages().filter(item => item.pinned);
        }

        function getMembersForServer() {
            return getRegisteredCommunicationMembers()
                .sort((left, right) => {
                    if (left.self !== right.self) return left.self ? -1 : 1;
                    return left.name.localeCompare(right.name);
                });
        }

        function renderServers() {
            panel.querySelectorAll('[data-comm-server]').forEach(button => {
                const server = button.dataset.commServer;
                const unread = (serverConfig[server]?.channels || []).reduce((sum, channel) => sum + getChannelUnreadCount(server, channel.id), 0);
                button.classList.toggle('active', server === activeServer);
                const badge = button.querySelector('.discord-badge');
                if (badge) {
                    badge.textContent = String(unread);
                    badge.classList.toggle('is-zero', unread === 0);
                }
            });
        }

        function renderChannels() {
            const server = getCurrentServer();
            joinedVoiceRoom = getJoinedVoiceRoomForServer(activeServer);
            if (serverTitle) serverTitle.textContent = server.title;
            if (serverMeta) serverMeta.textContent = server.meta;

            if (channelList) {
                const sortedChannels = [...server.channels].sort((left, right) => {
                    const leftFavorite = isChannelFavorite(activeServer, left.id);
                    const rightFavorite = isChannelFavorite(activeServer, right.id);
                    if (leftFavorite !== rightFavorite) return leftFavorite ? -1 : 1;
                    return 0;
                });
                channelList.innerHTML = sortedChannels.map(channel => {
                    const unread = getChannelUnreadCount(activeServer, channel.id);
                    return `
                        <button type="button" class="discord-channel ${channel.id === activeChannel ? 'active' : ''} ${isChannelFavorite(activeServer, channel.id) ? 'is-favorite' : ''}" data-comm-channel="${escapeHtml(channel.id)}">
                            <span class="material-icons">${escapeHtml(channel.icon)}</span>
                            <span class="discord-channel-copy">
                                <strong>${escapeHtml(channel.name)}</strong>
                                <small>${escapeHtml(channel.label || channel.topic || '')}</small>
                            </span>
                            ${unread ? `<em>${escapeHtml(String(unread))}</em>` : `<i class="comm-favorite-dot">${isChannelFavorite(activeServer, channel.id) ? '★' : ''}</i>`}
                        </button>
                    `;
                }).join('');
            }

            if (voiceRoomList) {
                voiceRoomList.innerHTML = server.voice.map(room => {
                    const participants = getVoiceParticipants(activeServer, room.id);
                    const participantMarkup = participants.length
                        ? `<div class="discord-room-people">${participants.map(member => `<span class="discord-room-person"><em>${escapeHtml(getInitials(member.name))}</em>${escapeHtml(member.name)}</span>`).join('')}</div>`
                        : '<div class="discord-room-empty">No one inside</div>';
                    return `
                        <button type="button" class="discord-room ${joinedVoiceRoom === room.id ? 'active' : ''}" data-comm-voice="${escapeHtml(room.id)}">
                            <span class="material-icons">volume_up</span>
                            <span>
                                <strong>${escapeHtml(room.name)}</strong>
                                <small>${participants.length ? `${participants.length} inside` : 'No one inside'}</small>
                                ${participantMarkup}
                            </span>
                            <i>${joinedVoiceRoom === room.id ? 'Leave' : (participants.length ? 'Live' : 'Join')}</i>
                        </button>
                    `;
                }).join('');
            }

            if (videoRoomList) {
                videoRoomList.innerHTML = server.video.map(room => `
                    <button type="button" class="discord-room discord-video-room ${joinedVideoRoom === room.id ? 'active' : ''}" data-comm-video="${escapeHtml(room.id)}">
                        <span class="material-icons">video_camera_front</span>
                        <span><strong>${escapeHtml(room.name)}</strong><small>${escapeHtml(room.detail)}</small></span>
                        <i>${escapeHtml(room.status)}</i>
                    </button>
                `).join('');
            }
        }

        function renderPinnedMessages() {
            const pinned = getPinnedMessages();
            if (pinCount) pinCount.textContent = String(pinned.length);
            if (!pinnedStrip) return;

            pinnedStrip.innerHTML = pinned.length
                ? pinned.slice(0, 3).map(item => `
                    <button type="button" class="discord-pin-card" data-comm-jump-message="${escapeHtml(item.id)}">
                        <span class="material-icons">push_pin</span>
                        <strong>${escapeHtml(item.author)}</strong>
                        <small>${escapeHtml(item.body)}</small>
                    </button>
                `).join('')
                : `
                    <div class="discord-pin-empty">
                        <span class="material-icons">push_pin</span>
                        <small>No pinned messages in this channel.</small>
                    </div>
                `;
        }

        function renderAttachment(item) {
            if (!item.attachmentLabel) return '';
            const label = escapeHtml(item.attachmentLabel);
            const size = item.attachmentSize ? ` · ${escapeHtml(formatFileSize(item.attachmentSize))}` : '';

            if (item.attachmentType === 'image' && item.attachmentUrl) {
                return `
                    <figure class="comm-attachment-card is-image">
                        <img src="${escapeHtml(item.attachmentUrl)}" alt="${label}">
                        <figcaption><span class="material-icons">image</span>${label}${size}</figcaption>
                    </figure>
                `;
            }

            if (item.attachmentType === 'voice' && item.attachmentUrl) {
                return `
                    <div class="comm-attachment-card is-voice">
                        <span class="material-icons">graphic_eq</span>
                        <div>
                            <strong>${label}</strong>
                            <audio controls src="${escapeHtml(item.attachmentUrl)}"></audio>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="discord-attachment">
                    <span class="material-icons">draft</span>
                    <span>${label}${size}</span>
                </div>
            `;
        }

        function renderMessage(item) {
            const isMine = Boolean(item.self);
            const isDeleted = Boolean(item.deletedAt);
            const reactions = item.reactions && item.reactions.length
                ? item.reactions.map(reaction => `
                    <button type="button" class="discord-reaction" data-comm-react="${escapeHtml(item.id)}" data-reaction-icon="${escapeHtml(reaction.icon)}">
                        <span class="material-icons">${escapeHtml(reaction.icon)}</span>
                        <em>${escapeHtml(String(reaction.count || 0))}</em>
                    </button>
                `).join('')
                : `
                    <button type="button" class="discord-reaction" data-comm-react="${escapeHtml(item.id)}" data-reaction-icon="thumb_up">
                        <span class="material-icons">add_reaction</span>
                        <em>0</em>
                    </button>
                `;
            const statusLabel = item.seenAt ? 'Seen' : (item.deliveredAt ? 'Delivered' : 'Sending');
            const statusIcon = item.seenAt ? 'done_all' : (item.deliveredAt ? 'done' : 'schedule');

            return `
                <article class="discord-message ${isMine ? 'is-mine' : ''} ${item.pinned ? 'is-pinned' : ''} ${isDeleted ? 'is-deleted' : ''}" data-message-id="${escapeHtml(item.id)}">
                    <span class="discord-avatar status-${escapeHtml(item.status || 'online')}">${escapeHtml(getInitials(item.author))}</span>
                    <div class="discord-message-content">
                        <div class="discord-message-meta">
                            <strong>${escapeHtml(item.author || 'COE Member')}</strong>
                            <span class="discord-role role-${escapeHtml(String(item.role || 'student').toLowerCase())}">${escapeHtml(item.role || 'Student')}</span>
                            <time>${escapeHtml(formatCommTime(item.time))}</time>
                            ${item.edited && !isDeleted ? '<small class="comm-edited-label">Edited</small>' : ''}
                            <button type="button" class="discord-pin-toggle ${item.pinned ? 'active' : ''}" data-comm-pin="${escapeHtml(item.id)}" title="Pin message">
                                <span class="material-icons">push_pin</span>
                            </button>
                        </div>
                        ${item.replyText ? `<div class="discord-reply"><span class="material-icons">subdirectory_arrow_right</span>${escapeHtml(item.replyText)}</div>` : ''}
                        <p>${isDeleted ? 'Message deleted' : escapeHtml(item.body || '')}</p>
                        ${isDeleted ? '' : renderAttachment(item)}
                        <div class="discord-message-tools">
                            <div class="discord-reactions">${reactions}</div>
                            <button type="button" class="discord-reply-btn" data-comm-reply="${escapeHtml(item.id)}"><span class="material-icons">reply</span> Reply</button>
                            ${isMine && !isDeleted ? `<button type="button" class="discord-reply-btn" data-comm-edit="${escapeHtml(item.id)}"><span class="material-icons">edit</span> Edit</button>` : ''}
                            ${isMine && !isDeleted ? `<button type="button" class="discord-reply-btn danger" data-comm-delete="${escapeHtml(item.id)}"><span class="material-icons">delete</span> Delete</button>` : ''}
                        </div>
                        ${isMine ? `<div class="comm-message-status"><span class="material-icons">${statusIcon}</span>${statusLabel}</div>` : ''}
                    </div>
                </article>
            `;
        }

        function renderChat() {
            const channel = getCurrentChannel();
            const visibleMessages = getVisibleMessages();
            if (channelTitle) channelTitle.textContent = channel.name;
            if (channelTopic) channelTopic.textContent = channel.topic;
            if (channelIcon) channelIcon.textContent = channel.icon;
            if (chatInput) chatInput.placeholder = `Message #${channel.name}`;
            if (roomStatus) roomStatus.textContent = `${channel.name} is live`;
            if (roomPresence) {
                const visibleCount = visibleMessages.length;
                const onlineMembers = getMembersForServer().length;
                roomPresence.textContent = `${onlineMembers} online · ${visibleCount} messages · synced locally in real time`;
            }
            if (favoriteChannelBtn) {
                favoriteChannelBtn.classList.toggle('active', isChannelFavorite());
                favoriteChannelBtn.title = isChannelFavorite() ? 'Remove favorite' : 'Favorite room';
            }
            if (favoriteCount) favoriteCount.textContent = String(favoriteChannels.size);

            if (chatThread) {
                chatThread.innerHTML = visibleMessages.length
                    ? visibleMessages.map(renderMessage).join('')
                    : `
                        <div class="discord-empty-state">
                            <span class="material-icons">forum</span>
                            <strong>No messages found</strong>
                            <p>Try another search or start the conversation in #${escapeHtml(channel.name)}.</p>
                        </div>
                    `;
                chatThread.scrollTop = chatThread.scrollHeight;
            }
            renderPinnedMessages();
        }

        function setTypingIndicator(active, label = '') {
            if (!typingIndicator) return;
            typingIndicator.hidden = !active;
            if (typingText) {
                const displayName = label || currentUser?.name || currentUser?.username || 'You';
                typingText.textContent = active ? `${displayName} is typing...` : '';
            }
        }

        function showRemoteTyping(name) {
            clearTimeout(remoteTypingTimer);
            setTypingIndicator(true, name || 'Someone');
            remoteTypingTimer = setTimeout(() => setTypingIndicator(false), 1600);
        }

        function syncCommunicationMessages() {
            messages = loadCommunicationMessages();
            renderAll();
        }

        function renderMembers() {
            const members = getMembersForServer();
            const students = members.filter(member => member.role === 'Student').length;
            const faculty = members.filter(member => member.role === 'Faculty').length;
            const admins = members.filter(member => member.role === 'Admin' || member.role === 'Council').length;
            if (onlineCount) onlineCount.textContent = String(members.length);
            if (studentCount) studentCount.textContent = String(students);
            if (facultyCount) facultyCount.textContent = String(faculty);
            if (adminCount) adminCount.textContent = String(admins);
            if (!memberList) return;

            const roleOrder = ['Admin', 'Faculty', 'Council', 'Student'];
            const memberMarkup = roleOrder.map(role => {
                const group = members.filter(member => member.role === role);
                if (!group.length) return '';
                return `
                    <section class="discord-member-group">
                        <h3>${escapeHtml(role)} - ${group.length}</h3>
                        ${group.map(member => `
                            <article class="discord-member">
                                <span class="discord-avatar status-${escapeHtml(member.status || 'online')}">${escapeHtml(getInitials(member.name))}</span>
                                <div>
                                    <strong>${escapeHtml(member.self ? `${member.name} (You)` : member.name)}</strong>
                                    <small>${escapeHtml(role)} | ${escapeHtml(member.server.toUpperCase())} | ${escapeHtml(member.status || 'online')}</small>
                                </div>
                            </article>
                        `).join('')}
                    </section>
                `;
            }).join('');
            memberList.innerHTML = memberMarkup || `
                <div class="discord-member-empty">
                    <span class="material-icons">person_off</span>
                    <strong>No accounts yet</strong>
                    <small>Registered COE accounts will appear here once created.</small>
                </div>
            `;
        }

        function renderAll() {
            renderServers();
            renderChannels();
            renderChat();
            renderMembers();
        }

        function setMobileFocus(focus) {
            panel.querySelectorAll('[data-comm-mobile]').forEach(button => {
                button.classList.toggle('active', button.dataset.commMobile === focus);
            });
            workspace?.classList.remove('mobile-focus-servers', 'mobile-focus-channels', 'mobile-focus-chat', 'mobile-focus-members');
            workspace?.classList.add(`mobile-focus-${focus}`);
        }

        function switchServer(serverKey) {
            if (!serverConfig[serverKey]) return;
            activeServer = 'coe';
            setMobileFocus('chat');
            renderAll();
        }

        function switchChannel(channelKey) {
            if (!getCurrentServer().channels.some(channel => channel.id === channelKey)) return;
            activeChannel = channelKey;
            markChannelRead();
            setMobileFocus('chat');
            renderAll();
        }

        function renderComposerPreview() {
            if (!composerPreview) return;

            if (editingMessageId) {
                composerPreview.hidden = false;
                composerPreview.innerHTML = `
                    <span class="material-icons">edit</span>
                    <strong>Editing message</strong>
                    <button type="button" data-comm-cancel-edit>Cancel</button>
                `;
                return;
            }

            if (!pendingAttachment) {
                composerPreview.hidden = true;
                composerPreview.innerHTML = '';
                return;
            }

            const icon = pendingAttachment.type === 'image'
                ? 'image'
                : pendingAttachment.type === 'voice'
                    ? 'graphic_eq'
                    : 'draft';
            composerPreview.hidden = false;
            composerPreview.innerHTML = `
                <span class="material-icons">${icon}</span>
                <strong>${escapeHtml(pendingAttachment.label)}</strong>
                <small>${escapeHtml(formatFileSize(pendingAttachment.size))}</small>
                <button type="button" data-comm-remove-attachment>Remove</button>
            `;
        }

        function readFileAsDataUrl(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error('Unable to read file.'));
                reader.readAsDataURL(file);
            });
        }

        async function prepareAttachment(file, preferredType = '') {
            if (!file) return;
            if (file.size > maxInlineAttachmentSize) {
                alert(`For this offline communication tab, uploads are limited to ${formatFileSize(maxInlineAttachmentSize)}.`);
                return;
            }

            const type = preferredType || (file.type.startsWith('image/') ? 'image' : (file.type.startsWith('audio/') || file.type === 'video/webm' ? 'voice' : 'file'));
            let url = '';
            if (type === 'image' || type === 'voice') {
                url = await readFileAsDataUrl(file);
            }
            pendingAttachment = {
                label: file.name || (type === 'voice' ? 'Voice message.webm' : 'Attachment'),
                type,
                url,
                size: file.size,
                mime: file.type || 'application/octet-stream'
            };
            renderComposerPreview();
        }

        function updateExistingMessage(body) {
            const message = messages.find(item => item.id === editingMessageId);
            const trimmed = String(body || '').trim();
            if (!message || !trimmed) return false;

            message.body = trimmed;
            message.edited = true;
            message.editedAt = new Date().toISOString();
            saveCommunicationMessages();
            broadcastCommunication('message:update', { id: message.id });
            editingMessageId = '';
            renderComposerPreview();
            renderAll();
            return true;
        }

        function appendMessage(body, attachment = pendingAttachment) {
            const trimmed = String(body || '').trim();
            if (editingMessageId) {
                updateExistingMessage(trimmed);
                return;
            }
            if (!trimmed && !attachment) return;
            const now = new Date().toISOString();
            messages.push({
                id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                server: activeServer,
                channel: activeChannel,
                author: currentUser?.name || currentUser?.username || 'COE Member',
                authorUsername: currentUsername || currentUser?.username || '',
                role: getCurrentRoleLabel(),
                status: 'online',
                body: trimmed || `Shared ${attachment?.label || 'an attachment'}`,
                attachmentLabel: attachment?.label || '',
                attachmentType: attachment?.type || '',
                attachmentUrl: attachment?.url || '',
                attachmentSize: attachment?.size || 0,
                attachmentMime: attachment?.mime || '',
                time: now,
                deliveredAt: now,
                seenAt: now,
                self: true,
                reactions: [{ icon: 'thumb_up', count: 0 }]
            });
            pendingAttachment = null;
            markChannelRead();
            saveCommunicationMessages();
            renderComposerPreview();
            broadcastCommunication('message:new', { server: activeServer, channel: activeChannel });
            const activityLabel = trimmed || attachment?.label || 'attachment';
            addActivity(`Posted in ${getCurrentServer().short} #${getCurrentChannel().name}: "${activityLabel.slice(0, 48)}${activityLabel.length > 48 ? '...' : ''}"`, { type: 'communication' });
            renderAll();
        }

        panel.addEventListener('click', function (event) {
            const serverButton = event.target.closest('[data-comm-server]');
            if (serverButton) {
                switchServer(serverButton.dataset.commServer);
                return;
            }

            const channelButton = event.target.closest('[data-comm-channel]');
            if (channelButton) {
                switchChannel(channelButton.dataset.commChannel);
                return;
            }

            const voiceButton = event.target.closest('[data-comm-voice]');
            if (voiceButton) {
                const roomId = voiceButton.dataset.commVoice || '';
                const leavingCurrentRoom = joinedVoiceRoom === roomId;
                if (leavingCurrentRoom) {
                    leaveVoiceRoom();
                    addActivity(`Left voice channel: ${voiceButton.textContent.trim()}`, { type: 'communication' });
                } else {
                    joinVoiceRoom(roomId);
                    addActivity(`Joined voice channel: ${voiceButton.textContent.trim()}`, { type: 'communication' });
                }
                renderAll();
                return;
            }

            const videoButton = event.target.closest('[data-comm-video]');
            if (videoButton) {
                joinedVideoRoom = videoButton.dataset.commVideo || '';
                addActivity(`Opened video consultation room: ${videoButton.textContent.trim()}`, { type: 'communication' });
                renderChannels();
                return;
            }

            const pinButton = event.target.closest('[data-comm-pin]');
            if (pinButton) {
                const id = pinButton.dataset.commPin;
                const message = messages.find(item => item.id === id);
                if (message) {
                    message.pinned = !message.pinned;
                    saveCommunicationMessages();
                    broadcastCommunication('message:update', { id });
                    renderAll();
                }
                return;
            }

            const reactionButton = event.target.closest('[data-comm-react]');
            if (reactionButton) {
                const id = reactionButton.dataset.commReact;
                const icon = reactionButton.dataset.reactionIcon || 'thumb_up';
                const message = messages.find(item => item.id === id);
                if (message) {
                    const reaction = (message.reactions || []).find(item => item.icon === icon);
                    if (reaction) reaction.count = Number(reaction.count || 0) + 1;
                    else message.reactions = [...(message.reactions || []), { icon, count: 1 }];
                    saveCommunicationMessages();
                    broadcastCommunication('message:update', { id });
                    renderAll();
                }
                return;
            }

            const replyButton = event.target.closest('[data-comm-reply]');
            if (replyButton) {
                const id = replyButton.dataset.commReply;
                const message = getVisibleMessages().find(item => item.id === id);
                if (message && chatInput) {
                    chatInput.value = `Replying to ${message.author}: `;
                    chatInput.focus();
                }
                return;
            }

            const editButton = event.target.closest('[data-comm-edit]');
            if (editButton) {
                const id = editButton.dataset.commEdit;
                const message = messages.find(item => item.id === id);
                if (message && chatInput) {
                    editingMessageId = id;
                    chatInput.value = message.body || '';
                    chatInput.focus();
                    renderComposerPreview();
                }
                return;
            }

            const deleteButton = event.target.closest('[data-comm-delete]');
            if (deleteButton) {
                const id = deleteButton.dataset.commDelete;
                const message = messages.find(item => item.id === id);
                if (message && confirm('Delete this message?')) {
                    message.deletedAt = new Date().toISOString();
                    message.body = '';
                    message.attachmentLabel = '';
                    message.attachmentUrl = '';
                    message.attachmentType = '';
                    saveCommunicationMessages();
                    broadcastCommunication('message:update', { id });
                    renderAll();
                }
                return;
            }

            const jumpButton = event.target.closest('[data-comm-jump-message]');
            if (jumpButton && chatThread) {
                const target = Array.from(chatThread.querySelectorAll('[data-message-id]')).find(item => item.dataset.messageId === jumpButton.dataset.commJumpMessage);
                target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target?.classList.add('is-highlighted');
                setTimeout(() => target?.classList.remove('is-highlighted'), 1200);
                return;
            }

            if (event.target.closest('#comm-open-pins')) {
                pinnedStrip?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }

            if (event.target.closest('#comm-open-members')) {
                setMobileFocus('members');
                return;
            }

            if (event.target.closest('#comm-favorite-channel')) {
                const key = getChannelKey();
                if (favoriteChannels.has(key)) favoriteChannels.delete(key);
                else favoriteChannels.add(key);
                saveFavoriteChannels();
                renderAll();
                return;
            }

            if (event.target.closest('#comm-clear-search')) {
                if (messageSearch) messageSearch.value = '';
                renderChat();
                return;
            }

            if (event.target.closest('[data-comm-remove-attachment]')) {
                pendingAttachment = null;
                renderComposerPreview();
                return;
            }

            if (event.target.closest('[data-comm-cancel-edit]')) {
                editingMessageId = '';
                if (chatInput) chatInput.value = '';
                renderComposerPreview();
                return;
            }

            const emojiOption = event.target.closest('[data-comm-emoji]');
            if (emojiOption && chatInput) {
                chatInput.value = `${chatInput.value}${chatInput.value ? ' ' : ''}${emojiOption.dataset.commEmoji || ''}`;
                chatInput.focus();
                if (emojiPicker) emojiPicker.hidden = true;
                chatInput.dispatchEvent(new Event('input'));
                return;
            }

            const mobileButton = event.target.closest('[data-comm-mobile]');
            if (mobileButton) {
                const focus = mobileButton.dataset.commMobile || 'chat';
                setMobileFocus(focus);
            }
        });

        chatForm?.addEventListener('submit', function (event) {
            event.preventDefault();
            const draft = chatInput?.value || '';
            appendMessage(draft.trim() || pendingAttachment ? draft : '👍');
            if (!editingMessageId && chatInput) chatInput.value = '';
            setTypingIndicator(false);
        });

        messageSearch?.addEventListener('input', renderChat);

        chatInput?.addEventListener('input', function () {
            clearTimeout(typingTimer);
            const hasDraft = Boolean(this.value.trim());
            setTypingIndicator(false);
            if (hasDraft) {
                broadcastCommunication('typing', {
                    server: activeServer,
                    channel: activeChannel,
                    name: currentUser?.name || currentUser?.username || 'COE Member'
                });
                typingTimer = setTimeout(() => setTypingIndicator(false), 1600);
            }
        });

        emojiBtn?.addEventListener('click', function () {
            if (!emojiPicker) return;
            emojiPicker.hidden = !emojiPicker.hidden;
        });

        gifBtn?.addEventListener('click', function () {
            if (!chatInput) return;
            chatInput.value = `${chatInput.value}${chatInput.value ? ' ' : ''}[GIF]`;
            chatInput.focus();
            chatInput.dispatchEvent(new Event('input'));
        });

        voiceMessageBtn?.addEventListener('click', async function () {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                this.classList.remove('is-recording');
                setTypingIndicator(false);
                return;
            }

            if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
                pendingAttachment = {
                    label: 'Voice message - 0:12',
                    type: 'voice',
                    url: '',
                    size: 0,
                    mime: 'audio/webm'
                };
                renderComposerPreview();
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                recorderChunks = [];
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.addEventListener('dataavailable', event => {
                    if (event.data.size) recorderChunks.push(event.data);
                });
                mediaRecorder.addEventListener('stop', async () => {
                    stream.getTracks().forEach(track => track.stop());
                    const blob = new Blob(recorderChunks, { type: 'audio/webm' });
                    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                    await prepareAttachment(file, 'voice');
                    mediaRecorder = null;
                });
                mediaRecorder.start();
                this.classList.add('is-recording');
                setTypingIndicator(true);
            } catch (error) {
                console.error('Unable to record voice message:', error);
                alert('Microphone permission is needed to record a voice message.');
            }
        });

        fileInput?.addEventListener('change', async function () {
            const file = this.files?.[0];
            if (!file) return;
            await prepareAttachment(file, 'file');
            this.value = '';
        });

        imageInput?.addEventListener('change', async function () {
            const file = this.files?.[0];
            if (!file) return;
            await prepareAttachment(file, 'image');
            this.value = '';
        });

        function handleCommunicationEvent(event) {
            if (!event || event.deviceId === currentDeviceId) return;
            const payload = event.payload || {};
            if (event.type === 'typing') {
                if (payload.server === activeServer && payload.channel === activeChannel) {
                    showRemoteTyping(payload.name);
                }
                return;
            }
            if (event.type === 'message:new' || event.type === 'message:update') {
                syncCommunicationMessages();
            }
        }

        communicationChannel?.addEventListener('message', event => {
            handleCommunicationEvent(event.data);
        });

        window.addEventListener('storage', event => {
            if (event.key === storageKey) syncCommunicationMessages();
            if (event.key === 'coeCommunicationLastEvent' && event.newValue) {
                try {
                    handleCommunicationEvent(JSON.parse(event.newValue));
                } catch (error) {
                    console.error('Unable to read communication event:', error);
                }
            }
        });

        window.refreshCommunicationAnnouncements = renderAll;
        markChannelRead();
        renderComposerPreview();
        saveCommunicationMessages();
        renderAll();
    }

    function loadScheduleItems() {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_STORAGE_SCHEDULE) || '[]');
        } catch (error) {
            return [];
        }
    }

    function loadCalendarAgendas() {
        try {
            const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CALENDAR_AGENDAS) || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch (error) {
            return [];
        }
    }

    function saveCalendarAgendas(agendas) {
        localStorage.setItem(LOCAL_STORAGE_CALENDAR_AGENDAS, JSON.stringify(agendas));
    }

    /**
     * The signed-in student's own calendar entries.
     *
     * Read-only here, and never written: `coe-calendar.js` owns this key and
     * keeps it in step with `/api/calendar`. It is a render cache, the same way
     * `coeLearningFiles` is for the library — writing to it from this side
     * would be overwritten by the next sync without ever reaching the server.
     */
    function loadPersonalCalendar() {
        if (window.CoeCalendar) return window.CoeCalendar.entries || [];

        try {
            const saved = JSON.parse(localStorage.getItem('coeMyCalendar') || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Today as "YYYY-MM-DD" in the *viewer's* timezone.
     *
     * `toISOString()` converts to UTC first, so in Manila (UTC+8) it returns
     * yesterday's date until 8am — which would file a morning entry on the
     * wrong day and hide it from the Today list that same morning.
     */
    function localDayKey(date) {
        const value = date ? new Date(date) : new Date();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${value.getFullYear()}-${month}-${day}`;
    }

    function renderHomeUploadProgress() {
        if (!homeUploadProgressList || !homeProgressPanel) return;
        const uploads = isAdmin
            ? uploadedFiles.slice(-6).reverse()
            : uploadedFiles.filter(file => (file.ownerUsername || '').toLowerCase() === currentUsername.toLowerCase()).slice(-6).reverse();

        if (!uploads.length) {
            homeUploadProgressList.innerHTML = '<div class="empty-home-section">No submissions yet.</div>';
            return;
        }

        homeUploadProgressList.innerHTML = uploads.map(file => {
            const status = file.approved === false ? 'Pending' : (file.approved === 'rejected' ? 'Rejected' : 'Published');
            const statusClass = file.approved === false ? 'status-pending' : (file.approved === 'rejected' ? 'status-rejected' : 'status-published');
            return `
                <article class="course-card upload-card">
                    <div class="course-info">
                        <span class="course-tag ${statusClass}">${escapeHtml(status)}</span>
                        <h4>${escapeHtml(file.title || file.name || 'Uploaded Material')}</h4>
                        <p>${escapeHtml(file.lesson || file.subject || 'No lesson assigned')}</p>
                    </div>
                    <div class="course-meta">
                        <span>${escapeHtml(file.uploadedBy || file.ownerUsername || 'Unknown uploader')}</span>
                        <span>${escapeHtml(formatDate(file.uploadedAt || file.lastModified || new Date().toISOString()))}</span>
                    </div>
                </article>
            `;
        }).join('');
    }

    function getActiveUserCount() {
        return initStoredUsers().filter(user => ['STUDENT', 'FACULTY', 'ADMIN'].includes((user.role || '').toUpperCase())).length;
    }

    function getPendingUploads() {
        return uploadedFiles.filter(file => file.approved === false);
    }

    function getSubmissionCount() {
        return uploadedFiles.length;
    }

    function renderHomeReviewQueue() {
        if (!homeReviewPanel || !homeReviewQueueList) return;
        if (!isAdmin) {
            homeReviewPanel.style.display = 'none';
            return;
        }
        const pending = getPendingUploads().slice(-5).reverse();
        homeReviewPanel.style.display = '';
        if (!pending.length) {
            homeReviewQueueList.innerHTML = '<div class="empty-home-section">No pending upload reviews.</div>';
            return;
        }
        homeReviewQueueList.innerHTML = pending.map(file => `
            <article class="course-card review-card">
                <div class="course-info">
                    <span class="course-tag status-pending">Pending</span>
                    <h4>${escapeHtml(file.title || file.name || 'Uploaded Material')}</h4>
                    <p>${escapeHtml(file.lesson || file.subject || 'No lesson')}</p>
                    <div class="course-meta">
                        <span>${escapeHtml(file.uploadedBy || file.ownerUsername || 'Unknown')}</span>
                        <span>${escapeHtml(formatDate(file.uploadedAt || file.lastModified || new Date().toISOString()))}</span>
                    </div>
                </div>
                <div class="review-actions">
                    <button type="button" class="action-btn review-approve-btn" data-upload-id="${escapeHtml(file.id)}">Approve</button>
                    <button type="button" class="action-btn outline review-reject-btn" data-upload-id="${escapeHtml(file.id)}">Reject</button>
                </div>
            </article>
        `).join('');
        homeReviewQueueList.querySelectorAll('.review-approve-btn').forEach(button => {
            button.addEventListener('click', function () {
                approveUploadById(this.dataset.uploadId);
            });
        });
        homeReviewQueueList.querySelectorAll('.review-reject-btn').forEach(button => {
            button.addEventListener('click', function () {
                rejectUploadById(this.dataset.uploadId);
            });
        });
    }

    function approveUploadById(uploadId) {
        const file = uploadedFiles.find(item => item.id === uploadId);
        if (!file) return;
        file.approved = true;
        file.reviewNotes = file.reviewNotes || '';
        saveFiles();
        addActivity(`Approved upload: ${file.title || file.name}`);
        renderHomeUploadProgress();
        renderHomeReviewQueue();
        displayHomeDashboardStats();
        syncDashboardNotifications();
    }

    function rejectUploadById(uploadId) {
        const file = uploadedFiles.find(item => item.id === uploadId);
        if (!file) return;
        file.approved = 'rejected';
        file.reviewNotes = 'Rejected by admin for review.';
        saveFiles();
        addActivity(`Rejected upload: ${file.title || file.name}`);
        renderHomeUploadProgress();
        renderHomeReviewQueue();
        displayHomeDashboardStats();
        syncDashboardNotifications();
    }

    function renderHomeSchedule() {
        if (!homeSchedulePanel || !homeScheduleTimeline) return;
        const scheduleItems = loadScheduleItems();
        const showSchedule = Array.isArray(scheduleItems) && scheduleItems.length > 0;
        homeSchedulePanel.style.display = showSchedule ? '' : 'none';
        if (!showSchedule) return;
        if (homeScheduleBadge) {
            homeScheduleBadge.textContent = formatDate(new Date().toISOString());
        }
        homeScheduleTimeline.innerHTML = scheduleItems.map(item => `
            <article class="timeline-entry">
                <span class="timeline-time">${escapeHtml(item.time || '')}</span>
                <div class="timeline-content">
                    <strong>${escapeHtml(item.title || 'Scheduled Session')}</strong>
                    <span>${escapeHtml([item.location, item.course].filter(Boolean).join(' • '))}</span>
                </div>
            </article>
        `).join('');
    }

    function renderCalendarDashboard() {
        const heroDay = document.getElementById('calendar-hero-day');
        const heroDate = document.getElementById('calendar-hero-date');
        const totalEl = document.getElementById('calendar-total-events');
        const deadlineEl = document.getElementById('calendar-deadline-count');
        const scheduleEl = document.getElementById('calendar-schedule-count');
        const announcementEl = document.getElementById('calendar-announcement-count');
        const todayList = document.getElementById('calendar-today-list');
        const upcomingList = document.getElementById('calendar-upcoming-list');
        const monthGrid = document.getElementById('calendar-month-grid');
        const agendaDateInput = document.getElementById('calendar-agenda-date');
        const agendaForm = document.getElementById('calendar-agenda-form');
        if (!heroDay || !heroDate || !todayList || !upcomingList || !monthGrid) return;

        const mineList = document.getElementById('calendar-mine-list');
        const mineDateInput = document.getElementById('calendar-mine-date');

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const scheduleItems = loadScheduleItems();
        const agendaItems = loadCalendarAgendas();
        const personalItems = loadPersonalCalendar();

        function parseCalendarDate(value, fallback = new Date()) {
            if (!value) return new Date(fallback);
            const raw = String(value);
            const date = raw.includes('T') ? new Date(raw) : new Date(`${raw}T00:00:00`);
            return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
        }

        /*
         * The day an event falls on, in the viewer's own timezone.
         *
         * This used to be `setHours(0,0,0,0)` followed by `toISOString()`, and
         * those two lines contradict each other: the first moves to local
         * midnight, the second converts that instant to UTC. In Manila (UTC+8)
         * local midnight on the 5th *is* 16:00 UTC on the 4th, so every date on
         * this screen was rendered one day early — the "Today" list matched
         * yesterday's key, and the 14-day strip put each day's items in the
         * square to its left.
         *
         * It went unnoticed while the only inputs were an admin agenda typed
         * into the same broken function on both sides, so the two errors
         * cancelled. They stop cancelling as soon as anything else supplies a
         * real date, which the personal calendar and the announcement board
         * both do.
         *
         * localDayKey() reads the local calendar fields directly, so there is
         * no conversion to get wrong.
         */
        function eventDateKey(date) {
            return localDayKey(date);
        }

        function formatCalendarDate(date) {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        }

        if (agendaDateInput && !agendaDateInput.value) {
            agendaDateInput.value = eventDateKey(now);
        }
        if (mineDateInput && !mineDateInput.value) {
            mineDateInput.value = eventDateKey(now);
        }
        if (agendaForm) {
            agendaForm.classList.toggle('hidden', !isAdmin);
        }

        const agendaEvents = agendaItems.map(item => ({
            type: 'Agenda',
            icon: 'flag',
            title: item.title || 'Daily agenda',
            detail: item.target ? `Target: ${item.target}` : 'Daily target',
            date: parseCalendarDate(item.date),
            page: 'calendar',
            id: item.id
        }));

        const scheduleEvents = scheduleItems.map(item => ({
            type: 'Schedule',
            icon: 'schedule',
            title: item.title || 'Scheduled Session',
            detail: [item.time, item.location, item.course].filter(Boolean).join(' | ') || 'Official schedule',
            date: parseCalendarDate(item.date || item.eventDate || item.start || new Date()),
            page: 'calendar'
        }));

        const announcementEvents = announcements.map(item => ({
            type: item.tag || 'Announcement',
            icon: getAnnouncementIcon(item.tag),
            title: item.title || 'Announcement',
            detail: [item.course, item.summary].filter(Boolean).join(' | '),
            date: parseCalendarDate(item.eventDate || item.postedAt),
            page: item.relatedPage || 'announcements',
            kind: 'announcement'
        }));

        /*
         * The student's own entries.
         *
         * `parseCalendarDate` is given the stored "YYYY-MM-DD" and builds a
         * local-midnight Date from it, so an entry made for the 5th compares
         * equal to the 5th's key however far east the phone is.
         */
        const personalEvents = personalItems.map(item => ({
            type: 'My Plan',
            icon: item.done ? 'task_alt' : 'push_pin',
            title: item.title || 'My plan',
            detail: item.detail || '',
            date: parseCalendarDate(item.date),
            page: 'calendar',
            id: item.id,
            done: Boolean(item.done),
            kind: 'personal'
        }));

        const events = [...agendaEvents, ...scheduleEvents, ...announcementEvents, ...personalEvents]
            .sort((left, right) => left.date - right.date);

        const todayKey = eventDateKey(now);
        /*
         * Everything that lands on this date, not just the admin's agenda.
         *
         * The list used to be agenda-only, so an announcement dated today and a
         * student's own reminder for today both existed on the screen — one in
         * the timeline below, one in a card beside it — while the box actually
         * headed "today" said there was nothing on. This is the box people
         * read; it now holds the college's notices and the student's own plans
         * alongside the agenda.
         */
        const todayEvents = events.filter(item => eventDateKey(item.date) === todayKey);
        const upcomingEvents = events
            .filter(item => item.date >= now)
            .slice(0, 8);

        heroDay.textContent = now.toLocaleDateString([], { weekday: 'long' });
        heroDate.textContent = now.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
        if (totalEl) totalEl.textContent = events.length;
        if (deadlineEl) deadlineEl.textContent = todayEvents.length;
        if (scheduleEl) scheduleEl.textContent = scheduleEvents.length;
        if (announcementEl) announcementEl.textContent = announcementEvents.length;

        function renderEvent(event) {
            /*
             * Two different delete controls, and they are not interchangeable.
             *
             * The agenda one is admin-only and removes the item for the whole
             * college. The personal one is the owner's own and reaches nobody
             * else — so it is offered to every account, because on a personal
             * entry every account *is* the owner. Marking them with different
             * attributes keeps the two click handlers from ever crossing.
             */
            const controls = event.kind === 'personal'
                ? `<span class="calendar-mine-actions">
                        <button type="button" class="calendar-mine-toggle" data-plan-id="${escapeHtml(event.id || '')}"
                                data-plan-done="${event.done ? '1' : '0'}"
                                title="${event.done ? 'Mark as not done' : 'Mark as done'}"
                                aria-label="${event.done ? 'Mark as not done' : 'Mark as done'}">
                            <span class="material-icons">${event.done ? 'check_circle' : 'radio_button_unchecked'}</span>
                        </button>
                        <button type="button" class="calendar-mine-delete" data-plan-id="${escapeHtml(event.id || '')}"
                                title="Remove from my calendar" aria-label="Remove from my calendar">
                            <span class="material-icons">close</span>
                        </button>
                   </span>`
                : (event.type === 'Agenda' && isAdmin
                    ? `<span class="calendar-agenda-delete" data-agenda-id="${escapeHtml(event.id || '')}" title="Delete agenda">delete</span>`
                    : '');

            return `
                <div class="calendar-event-row${event.done ? ' is-done' : ''}">
                    <button type="button" class="calendar-event-item" data-page="${escapeHtml(event.page)}">
                        <span class="material-icons">${escapeHtml(event.icon)}</span>
                        <span>
                            <strong>${escapeHtml(event.title)}</strong>
                            <small>${escapeHtml(event.type)} | ${escapeHtml(formatCalendarDate(event.date))}${event.detail ? ` | ${escapeHtml(event.detail)}` : ''}</small>
                        </span>
                    </button>
                    ${controls}
                </div>
            `;
        }

        todayList.innerHTML = todayEvents.length
            ? todayEvents.map(renderEvent).join('')
            : `<p class="empty-home-section">Nothing on for today${isAdmin ? '. Add an agenda above.' : '. Add your own plan in "My Plan".'}</p>`;
        upcomingList.innerHTML = upcomingEvents.length
            ? upcomingEvents.map(renderEvent).join('')
            : '<p class="empty-home-section">No upcoming events yet.</p>';

        // --- My Plan ---------------------------------------------------------
        //
        // Sorted with the soonest first and finished ones sunk to the bottom,
        // so what is still to do is what is at the top of the card.
        if (mineList) {
            const minePending = personalEvents.filter(item => !item.done);
            const mineDone = personalEvents.filter(item => item.done);
            const mineOrdered = [...minePending, ...mineDone];

            mineList.innerHTML = mineOrdered.length
                ? mineOrdered.map(renderEvent).join('')
                : '<p class="empty-home-section">Nothing planned yet. Add a reminder above — only you can see it.</p>';
        }

        monthGrid.innerHTML = Array.from({ length: 14 }, (_, index) => {
            const date = new Date(now);
            date.setDate(now.getDate() + index);
            const count = events.filter(item => eventDateKey(item.date) === eventDateKey(date)).length;
            return `
                <div class="calendar-day-cell ${count ? 'has-events' : ''}">
                    <span>${escapeHtml(date.toLocaleDateString([], { weekday: 'short' }))}</span>
                    <strong>${date.getDate()}</strong>
                    <small>${count ? `${count} item${count === 1 ? '' : 's'}` : 'Clear'}</small>
                </div>
            `;
        }).join('');
    }

    document.getElementById('calendar-agenda-form')?.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!isAdmin) {
            alert('Only admins can set calendar agenda items.');
            return;
        }
        const dateInput = document.getElementById('calendar-agenda-date');
        const titleInput = document.getElementById('calendar-agenda-title');
        const targetInput = document.getElementById('calendar-agenda-target');
        const date = String(dateInput?.value || '').trim();
        const title = String(titleInput?.value || '').trim();
        const target = String(targetInput?.value || '').trim();
        if (!date || !title || !target) return;

        const agendas = loadCalendarAgendas();
        agendas.push({
            id: `agenda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date,
            title,
            target,
            ownerUsername: currentUsername,
            createdAt: new Date().toISOString()
        });
        saveCalendarAgendas(agendas);
        titleInput.value = '';
        targetInput.value = '';
        addActivity(`Added calendar agenda: ${title}`, { type: 'calendar' });
        renderCalendarDashboard();
    });

    document.getElementById('calendar-today-list')?.addEventListener('click', function (event) {
        const deleteButton = event.target.closest('.calendar-agenda-delete');
        if (!deleteButton) return;
        event.preventDefault();
        event.stopPropagation();
        if (!isAdmin) return;
        const agendaId = deleteButton.getAttribute('data-agenda-id');
        if (!agendaId) return;
        const agendas = loadCalendarAgendas().filter(item => item.id !== agendaId);
        saveCalendarAgendas(agendas);
        renderCalendarDashboard();
    });

    /* =====================================================================
       MY PLAN — the student's own calendar
       ---------------------------------------------------------------------
       Everything here goes through window.CoeCalendar, which owns the
       `/api/calendar` calls and the localStorage mirror this file reads.
       Writing the mirror directly from here would look like it worked and be
       overwritten by the next sync, without ever reaching the server.
       ===================================================================== */

    /** coe-calendar.js needs to redraw after a save; the function is in here. */
    window.renderCalendarDashboard = renderCalendarDashboard;

    document.getElementById('calendar-mine-form')?.addEventListener('submit', function (event) {
        event.preventDefault();

        const dateInput = document.getElementById('calendar-mine-date');
        const titleInput = document.getElementById('calendar-mine-title');
        const detailInput = document.getElementById('calendar-mine-detail');
        const submitBtn = event.currentTarget.querySelector('button[type="submit"]');

        const date = String(dateInput?.value || '').trim() || localDayKey();
        const title = String(titleInput?.value || '').trim();
        const detail = String(detailInput?.value || '').trim();

        if (title.length < 2) {
            window.showLibraryToast?.('Needs a name', 'Give this plan a short title.', 'error');
            return;
        }

        if (!window.CoeCalendar) {
            window.showLibraryToast?.('Not ready', 'The calendar is still loading. Try again in a moment.', 'error');
            return;
        }

        if (submitBtn) submitBtn.disabled = true;

        window.CoeCalendar.add({ date, title, detail })
            .then(function () {
                // The date is deliberately left as it is: adding three things
                // to the same day is the common case, and clearing it would
                // mean re-picking the date every time.
                if (titleInput) titleInput.value = '';
                if (detailInput) detailInput.value = '';
                window.showLibraryToast?.('Added to your calendar', title, 'success');
            })
            .catch(function (error) {
                window.showLibraryToast?.('Could not save', (error && error.message) || 'Try again.', 'error');
            })
            .then(function () {
                if (submitBtn) submitBtn.disabled = false;
            });
    });

    document.getElementById('calendar-mine-clear')?.addEventListener('click', function () {
        const scopeSelect = document.getElementById('calendar-mine-clear-scope');
        const scope = String(scopeSelect?.value || 'past');

        const wording = scope === 'all'
            ? 'Remove every entry from your calendar?'
            : scope === 'done'
                ? 'Remove the entries you have already ticked off?'
                : 'Remove entries from days that have already passed?';

        if (!confirm(`${wording}\n\nThis only affects your own calendar.`)) return;
        if (!window.CoeCalendar) return;

        window.CoeCalendar.clear(scope)
            .then(function (result) {
                const count = (result && result.cleared) || 0;
                window.showLibraryToast?.(
                    count ? 'Calendar cleared' : 'Nothing to clear',
                    count ? `${count} ${count === 1 ? 'entry' : 'entries'} removed.` : 'No entries matched.',
                    count ? 'success' : 'info'
                );
            })
            .catch(function (error) {
                window.showLibraryToast?.('Could not clear', (error && error.message) || 'Try again.', 'error');
            });
    });

    /*
     * Delegated on the document, not on one list.
     *
     * A personal entry is drawn in three places — Today, the Upcoming timeline
     * and the My Plan card — and binding per list would leave the same button
     * working in one of them and dead in the others.
     */
    document.addEventListener('click', function (event) {
        const removeBtn = event.target.closest('.calendar-mine-delete');
        const toggleBtn = event.target.closest('.calendar-mine-toggle');
        if (!removeBtn && !toggleBtn) return;

        event.preventDefault();
        event.stopPropagation();

        if (!window.CoeCalendar) return;

        if (removeBtn) {
            const id = removeBtn.getAttribute('data-plan-id');
            if (!id) return;
            window.CoeCalendar.remove(id).catch(function (error) {
                window.showLibraryToast?.('Could not remove', (error && error.message) || 'Try again.', 'error');
            });
            return;
        }

        const id = toggleBtn.getAttribute('data-plan-id');
        if (!id) return;
        const done = toggleBtn.getAttribute('data-plan-done') === '1';
        window.CoeCalendar.setDone(id, !done).catch(function (error) {
            window.showLibraryToast?.('Could not update', (error && error.message) || 'Try again.', 'error');
        });
    });

    function syncDashboardNotifications() {
        const notifications = loadNotifications();
        const scheduleItems = loadScheduleItems();
        const userUploads = uploadedFiles.filter(file => (file.ownerUsername || '').toLowerCase() === currentUsername.toLowerCase());
        const announcementCount = announcements.length;

        function ensureNotification(id, message) {
            const index = notifications.findIndex(item => item.id === id);
            if (index >= 0) {
                notifications[index].message = message;
                notifications[index].time = new Date().toISOString();
            } else {
                notifications.unshift({ id, message, time: new Date().toISOString(), read: false });
            }
        }

        function removeNotification(id) {
            const index = notifications.findIndex(item => item.id === id);
            if (index >= 0) {
                notifications.splice(index, 1);
            }
        }

        if (userUploads.length) {
            ensureNotification('notif-upload', `Track Progress: ${userUploads.length} upload${userUploads.length === 1 ? '' : 's'} available.`);
        } else {
            removeNotification('notif-upload');
        }

        if (Array.isArray(scheduleItems) && scheduleItems.length) {
            ensureNotification('notif-schedule', `Today’s Schedule announced (${scheduleItems.length} item${scheduleItems.length === 1 ? '' : 's'}).`);
        } else {
            removeNotification('notif-schedule');
        }

        if (announcementCount) {
            ensureNotification('notif-announcement', `${announcementCount} announcement${announcementCount === 1 ? '' : 's'} posted.`);
        } else {
            removeNotification('notif-announcement');
        }

        saveNotifications(notifications);
        renderNotificationBadges();
    }

    function displayHomeDashboardStats() {
        function readStoredArray(key) {
            try {
                const value = JSON.parse(localStorage.getItem(key) || '[]');
                return Array.isArray(value) ? value : [];
            } catch (error) {
                return [];
            }
        }

        const pendingTodos = homeTodos.filter(todo => !todo.completed).length;
        const completedTodos = homeTodos.filter(todo => todo.completed).length;
        const focusScore = homeTodos.length ? Math.round((completedTodos / homeTodos.length) * 100) : 0;
        const questionCount = readStoredArray('coeQAHubQuestions').length;
        const concernCount = readStoredArray('coeStudentVoiceConcerns').length;
        const activeDays = new Set(activityLog.map(item => {
            const date = item.time instanceof Date ? item.time : new Date(item.time);
            return Number.isNaN(date.getTime()) ? '' : date.toDateString();
        }).filter(Boolean)).size;
        const ceUploads = uploadedFiles.filter(file => file.discipline === 'CE').length;
        const eeUploads = uploadedFiles.filter(file => file.discipline === 'EE').length;
        const nextTodo = homeTodos.filter(todo => !todo.completed && todo.dueDate).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

        document.getElementById('home-pending-count')?.replaceChildren(document.createTextNode(String(pendingTodos)));
        document.getElementById('home-completed-count')?.replaceChildren(document.createTextNode(String(completedTodos)));
        document.getElementById('home-active-users-count')?.replaceChildren(document.createTextNode(String(getActiveUserCount())));
        document.getElementById('home-submissions-count')?.replaceChildren(document.createTextNode(String(homeTodos.length + uploadedFiles.length)));
        document.getElementById('home-material-count')?.replaceChildren(document.createTextNode(String(uploadedFiles.length)));
        document.getElementById('home-announcements-count')?.replaceChildren(document.createTextNode(String(announcements.length)));
        document.getElementById('home-active-days-count')?.replaceChildren(document.createTextNode(String(activeDays)));
        const focusEl = document.getElementById('home-focus-score');
        const metricProgressItems = document.querySelectorAll('.overview-metrics-grid .metric-progress');
        if (focusEl) focusEl.textContent = `${focusScore}%`;
        else if (metricProgressItems[0]) metricProgressItems[0].textContent = `Focus score ${focusScore}%`;
        const deadlineEl = document.getElementById('home-deadline-summary');
        const deadlineText = nextTodo ? `Next: ${formatDate(nextTodo.dueDate)}` : 'No upcoming deadlines';
        if (deadlineEl) deadlineEl.textContent = deadlineText;
        else if (metricProgressItems[1]) metricProgressItems[1].textContent = deadlineText;
        const libraryEl = document.getElementById('home-library-summary');
        const libraryText = `${uploadedFiles.length} material${uploadedFiles.length === 1 ? '' : 's'}`;
        if (libraryEl) libraryEl.textContent = libraryText;
        else if (metricProgressItems[2]) metricProgressItems[2].textContent = libraryText;
        const contributionEl = document.getElementById('home-contribution-summary');
        const contributionText = `${folders.length} folder${folders.length === 1 ? '' : 's'} | CE ${ceUploads} | EE ${eeUploads}`;
        if (contributionEl) contributionEl.textContent = contributionText;
        else if (metricProgressItems[3]) metricProgressItems[3].textContent = contributionText;

        document.getElementById('home-system-library-count')?.replaceChildren(document.createTextNode(String(uploadedFiles.length)));
        document.getElementById('home-system-qa-count')?.replaceChildren(document.createTextNode(String(questionCount)));
        document.getElementById('home-system-voice-count')?.replaceChildren(document.createTextNode(String(concernCount)));
        document.getElementById('home-system-task-count')?.replaceChildren(document.createTextNode(String(tasks.length)));
        document.getElementById('feature-library-count')?.replaceChildren(document.createTextNode(String(uploadedFiles.length)));
        document.getElementById('feature-qa-count')?.replaceChildren(document.createTextNode(String(questionCount)));
        document.getElementById('feature-voice-count')?.replaceChildren(document.createTextNode(String(concernCount)));
        document.getElementById('feature-account-count')?.replaceChildren(document.createTextNode(String(getActiveUserCount())));
        document.getElementById('analytics-preview-focus')?.replaceChildren(document.createTextNode(`${focusScore}%`));
        document.getElementById('analytics-preview-library')?.replaceChildren(document.createTextNode(String(uploadedFiles.length)));
        document.getElementById('analytics-preview-output')?.replaceChildren(document.createTextNode(String(tasks.length + uploadedFiles.length + questionCount + concernCount)));
        renderCommandCenter({
            pendingTodos,
            completedTodos,
            focusScore,
            questionCount,
            concernCount,
            nextTodo,
            announcementCount: announcements.length,
            materialCount: uploadedFiles.length
        });
        renderRoleWorkspace();
        renderSmartWorkspace({ focusScore, questionCount, concernCount, ceUploads, eeUploads });
        renderSmartToday({
            pendingTodos,
            completedTodos,
            focusScore,
            questionCount,
            concernCount,
            nextTodo,
            announcementCount: announcements.length,
            materialCount: uploadedFiles.length,
            scheduleCount: loadScheduleItems().length
        });
    }

    function renderSmartToday(stats = {}) {
        const pendingTodos = Number(stats.pendingTodos || 0);
        const materialCount = Number(stats.materialCount || 0);
        const questionCount = Number(stats.questionCount || 0);
        const announcementCount = Number(stats.announcementCount || 0);
        const scheduleCount = Number(stats.scheduleCount || 0);
        const concernCount = Number(stats.concernCount || 0);
        const nextTodo = stats.nextTodo;
        const titleEl = document.getElementById('home-smart-title');
        const descriptionEl = document.getElementById('home-smart-description');
        const actionEl = document.getElementById('home-smart-action');
        const reasonEl = document.getElementById('home-smart-reason');
        const actionBtn = document.getElementById('home-smart-action-btn');
        const listEl = document.getElementById('home-smart-list');

        let smart = {
            title: 'Your next best move is ready.',
            description: 'COE Studio checks your tasks, materials, questions, and updates to suggest what to open first.',
            action: 'Open Tasks',
            reason: 'Start with pending academic work, then move to study resources.',
            page: 'tasks',
            icon: 'arrow_forward'
        };

        if (currentRole === 'ADMIN') {
            smart = {
                title: 'Admin priorities are grouped for quick action.',
                description: 'Moderation, accounts, announcements, and analytics are treated as the highest-priority workflow.',
                action: 'Open Admin Center',
                reason: `${getPendingUploads().length} upload review${getPendingUploads().length === 1 ? '' : 's'}, ${concernCount} voice item${concernCount === 1 ? '' : 's'}, and ${announcementCount} announcement${announcementCount === 1 ? '' : 's'} are being tracked.`,
                page: 'admin',
                icon: 'admin_panel_settings'
            };
        } else if (currentRole === 'FACULTY') {
            smart = {
                title: 'Faculty support is ready for today.',
                description: 'Course materials, Q&A, and calendar updates are surfaced first for guidance work.',
                action: questionCount ? 'Open Q&A Hub' : 'Review Library',
                reason: questionCount ? `${questionCount} question${questionCount === 1 ? '' : 's'} posted for academic support.` : `${materialCount} material${materialCount === 1 ? '' : 's'} are available for review.`,
                page: questionCount ? 'qa-hub' : 'library',
                icon: questionCount ? 'forum' : 'auto_stories'
            };
        } else if (pendingTodos > 0) {
            smart = {
                title: `${pendingTodos} task${pendingTodos === 1 ? '' : 's'} should lead your day.`,
                description: nextTodo ? `Closest deadline: ${formatDate(nextTodo.dueDate)}.` : 'No dated deadline found, so use priority and effort to choose the first task.',
                action: 'Open Task Board',
                reason: `${stats.focusScore || 0}% focus score based on completed home tasks.`,
                page: 'tasks',
                icon: 'task_alt'
            };
        } else if (scheduleCount > 0 || announcementCount > 0) {
            smart = {
                title: 'Official updates are available.',
                description: `${scheduleCount} schedule item${scheduleCount === 1 ? '' : 's'} and ${announcementCount} announcement${announcementCount === 1 ? '' : 's'} are live.`,
                action: scheduleCount ? 'Open Calendar' : 'Open Announcements',
                reason: 'Check dates and notices before starting study work.',
                page: scheduleCount ? 'calendar' : 'announcements',
                icon: scheduleCount ? 'event_available' : 'campaign'
            };
        } else if (materialCount > 0) {
            smart = {
                title: 'You are clear to study.',
                description: 'No urgent task is blocking the home flow, so the library becomes the best next step.',
                action: 'Open Library',
                reason: `${materialCount} material${materialCount === 1 ? '' : 's'} ready for review.`,
                page: 'library',
                icon: 'auto_stories'
            };
        }

        if (titleEl) titleEl.textContent = smart.title;
        if (descriptionEl) descriptionEl.textContent = smart.description;
        if (actionEl) actionEl.textContent = smart.action;
        if (reasonEl) reasonEl.textContent = smart.reason;
        if (actionBtn) {
            actionBtn.dataset.page = smart.page;
            actionBtn.setAttribute('title', smart.action);
            const iconEl = actionBtn.querySelector('.material-icons');
            if (iconEl) iconEl.textContent = smart.icon;
        }
        if (listEl) {
            const items = [
                ['task_alt', 'Task load', `${pendingTodos} pending | ${stats.completedTodos || 0} completed`],
                ['auto_stories', 'Study bank', `${materialCount} material${materialCount === 1 ? '' : 's'} available`],
                ['forum', 'Support signals', `${questionCount} Q&A | ${concernCount} voice item${concernCount === 1 ? '' : 's'}`],
                ['campaign', 'Updates', `${announcementCount} announcement${announcementCount === 1 ? '' : 's'} | ${scheduleCount} schedule item${scheduleCount === 1 ? '' : 's'}`]
            ];
            listEl.innerHTML = items.map(([icon, label, detail]) => `
                <article>
                    <span class="material-icons">${escapeHtml(icon)}</span>
                    <div>
                        <strong>${escapeHtml(label)}</strong>
                        <small>${escapeHtml(detail)}</small>
                    </div>
                </article>
            `).join('');
        }
    }

    function renderCommandCenter(stats = {}) {
        const focusScore = Number(stats.focusScore || 0);
        const pendingTodos = Number(stats.pendingTodos || 0);
        const materialCount = Number(stats.materialCount || 0);
        const questionCount = Number(stats.questionCount || 0);
        const announcementCount = Number(stats.announcementCount || 0);
        const nextTodo = stats.nextTodo;
        const titleEl = document.getElementById('command-center-title');
        const descriptionEl = document.getElementById('command-center-description');
        const focusEl = document.getElementById('command-focus-value');
        const progressFill = document.getElementById('command-progress-fill');
        const taskMeta = document.getElementById('command-task-meta');
        const libraryMeta = document.getElementById('command-library-meta');
        const qaMeta = document.getElementById('command-qa-meta');
        const announcementMeta = document.getElementById('command-announcement-meta');

        let title = 'Your COE dashboard is ready for today.';
        let description = 'Start with the most important item, then check materials, Q&A, and announcements.';

        if (pendingTodos > 0) {
            title = `${pendingTodos} task${pendingTodos === 1 ? '' : 's'} need attention.`;
            description = nextTodo
                ? `Closest deadline is ${formatDate(nextTodo.dueDate)}. Clear one priority item first.`
                : 'Open your task board and close the most important academic item first.';
        } else if (materialCount > 0) {
            title = 'Your study resources are organized.';
            description = 'Use the library, Q&A Hub, and announcements to keep learning momentum steady.';
        }

        if (currentRole === 'ADMIN') {
            title = 'Admin dashboard is ready.';
            description = 'Review accounts, announcements, analytics, and student submissions in one place.';
        } else if (currentRole === 'FACULTY') {
            title = 'Faculty workspace is ready.';
            description = 'Guide students through materials, answers, and official course updates.';
        }

        if (titleEl) titleEl.textContent = title;
        if (descriptionEl) descriptionEl.textContent = description;
        if (focusEl) focusEl.textContent = `${focusScore}%`;
        if (progressFill) progressFill.style.width = `${Math.min(100, Math.max(0, focusScore))}%`;
        if (taskMeta) taskMeta.textContent = pendingTodos ? `${pendingTodos} pending task${pendingTodos === 1 ? '' : 's'}` : 'No pending tasks';
        if (libraryMeta) libraryMeta.textContent = `${materialCount} material${materialCount === 1 ? '' : 's'} ready`;
        if (qaMeta) qaMeta.textContent = `${questionCount} question${questionCount === 1 ? '' : 's'} posted`;
        if (announcementMeta) announcementMeta.textContent = `${announcementCount} announcement${announcementCount === 1 ? '' : 's'}`;
    }

    function configureRoleAction(button, icon, label, pageKey) {
        if (!button) return;
        button.dataset.page = pageKey;
        const iconEl = button.querySelector('.material-icons');
        const labelEl = button.querySelector('span:not(.material-icons)');
        if (iconEl) iconEl.textContent = icon;
        if (labelEl) labelEl.textContent = label;
    }

    function renderRoleWorkspace() {
        const roleConfig = {
            ADMIN: {
                kicker: 'Admin View',
                title: 'Run the COE workspace with confidence.',
                description: 'Review activity, moderate student submissions, publish notices, and keep accounts organized.',
                actions: [
                    ['admin_panel_settings', 'Admin Center', 'admin'],
                    ['campaign', 'Publish Notice', 'announcements'],
                    ['leaderboard', 'Analytics', 'analytics']
                ]
            },
            FACULTY: {
                kicker: 'Faculty View',
                title: 'Guide learning materials and student support.',
                description: 'Keep library resources current, answer course questions, and monitor academic activity without extra clutter.',
                actions: [
                    ['auto_stories', 'Review Library', 'library'],
                    ['quiz', 'Answer Questions', 'qa-hub'],
                    ['calendar_month', 'Calendar', 'calendar']
                ]
            },
            ORG_OFFICER_PICE: {
                kicker: 'PICE Officer View',
                title: 'Review PICE membership interest.',
                description: 'Open the officer panel to see students who applied for PICE only.',
                actions: [
                    ['admin_panel_settings', 'PICE Applicants', 'admin'],
                    ['diversity_3', 'Organizations', 'organizations'],
                    ['campaign', 'CE Notices', 'announcements']
                ]
            },
            ORG_OFFICER_IIEE: {
                kicker: 'IIEE Officer View',
                title: 'Review IIEE membership interest.',
                description: 'Open the officer panel to see students who applied for IIEE only.',
                actions: [
                    ['admin_panel_settings', 'IIEE Applicants', 'admin'],
                    ['diversity_3', 'Organizations', 'organizations'],
                    ['campaign', 'EE Notices', 'announcements']
                ]
            },
            STUDENT: {
                kicker: 'Student View',
                title: 'Stay on top of coursework and engineering resources.',
                description: 'Continue learning, ask for help, track tasks, and keep up with official COE announcements.',
                actions: [
                    ['library_books', 'Open Library', 'library'],
                    ['task_alt', 'Today\'s Tasks', 'tasks'],
                    ['record_voice_over', 'Student Voice', 'student-voice']
                ]
            }
        };
        const config = roleConfig[currentRole] || roleConfig.STUDENT;
        if (roleWorkspaceKicker) roleWorkspaceKicker.textContent = config.kicker;
        if (roleWorkspaceTitle) roleWorkspaceTitle.textContent = config.title;
        if (roleWorkspaceDescription) roleWorkspaceDescription.textContent = config.description;
        [roleActionPrimary, roleActionSecondary, roleActionTertiary].forEach((button, index) => {
            const [icon, label, page] = config.actions[index];
            configureRoleAction(button, icon, label, page);
        });
    }

    function renderSmartWorkspace(stats = {}) {
        const completedTodos = homeTodos.filter(todo => todo.completed).length;
        const computedFocusScore = homeTodos.length ? Math.round((completedTodos / homeTodos.length) * 100) : 0;
        const fallbackQuestionCount = (() => {
            try {
                const items = JSON.parse(localStorage.getItem('coeQAHubQuestions') || '[]');
                return Array.isArray(items) ? items.length : 0;
            } catch (error) {
                return 0;
            }
        })();
        const fallbackConcernCount = (() => {
            try {
                const items = JSON.parse(localStorage.getItem('coeStudentVoiceConcerns') || '[]');
                return Array.isArray(items) ? items.length : 0;
            } catch (error) {
                return 0;
            }
        })();
        const fallbackCeUploads = uploadedFiles.filter(file => file.discipline === 'CE').length;
        const fallbackEeUploads = uploadedFiles.filter(file => file.discipline === 'EE').length;
        const focusScore = typeof stats.focusScore === 'number' ? stats.focusScore : computedFocusScore;
        const questionCount = typeof stats.questionCount === 'number' ? stats.questionCount : fallbackQuestionCount;
        const concernCount = typeof stats.concernCount === 'number' ? stats.concernCount : fallbackConcernCount;
        const ceUploads = typeof stats.ceUploads === 'number' ? stats.ceUploads : fallbackCeUploads;
        const eeUploads = typeof stats.eeUploads === 'number' ? stats.eeUploads : fallbackEeUploads;
        const latestAnnouncement = announcements
            .slice()
            .sort((a, b) => new Date(b.postedAt || b.eventDate || 0) - new Date(a.postedAt || a.eventDate || 0))[0];
        const smartLibraryTitle = document.getElementById('smart-library-title');
        const smartLibraryDetail = document.getElementById('smart-library-detail');
        const smartAnnouncementTitle = document.getElementById('smart-announcement-title');
        const smartAnnouncementDetail = document.getElementById('smart-announcement-detail');
        const smartStateTitle = document.getElementById('smart-state-title');
        const smartStateDetail = document.getElementById('smart-state-detail');

        if (smartLibraryTitle) {
            smartLibraryTitle.textContent = uploadedFiles.length
                ? `${uploadedFiles.length} material${uploadedFiles.length === 1 ? '' : 's'} ready`
                : 'Browse COE materials';
        }
        if (smartLibraryDetail) {
            smartLibraryDetail.textContent = uploadedFiles.length
                ? `CE ${ceUploads} | EE ${eeUploads} across ${folders.length} folder${folders.length === 1 ? '' : 's'}.`
                : 'Upload or browse references, handouts, videos, and lessons for CE and EE.';
        }
        if (smartAnnouncementTitle) {
            smartAnnouncementTitle.textContent = latestAnnouncement
                ? latestAnnouncement.title
                : 'No urgent notices';
        }
        if (smartAnnouncementDetail) {
            smartAnnouncementDetail.textContent = latestAnnouncement
                ? `${latestAnnouncement.tag || 'General'} | ${latestAnnouncement.course || 'COE'} | Event ${formatDate(latestAnnouncement.eventDate || latestAnnouncement.postedAt)}`
                : 'Official updates will appear here as soon as they are posted.';
        }
        if (smartStateTitle) {
            smartStateTitle.textContent = 'Saved data loaded';
        }
        if (smartStateDetail) {
            smartStateDetail.textContent = `${focusScore}% focus, ${questionCount} Q&A posts, ${concernCount} student voice item${concernCount === 1 ? '' : 's'}.`;
        }
    }

    [announcementSearchInput, announcementTagFilter, announcementCourseFilter, announcementDateFilter, announcementSortSelect].forEach(control => {
        control?.addEventListener('input', renderAnnouncements);
        control?.addEventListener('change', renderAnnouncements);
    });
    announcementCouncilTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            announcementCouncilFilter = this.dataset.announcementCourseTab || 'all';
            announcementCouncilTabs.forEach(item => {
                item.classList.toggle('active', item === this);
            });
            renderAnnouncements();
        });
    });
    announcementCompactToggle?.addEventListener('click', function () {
        announcementsCompact = !announcementsCompact;
        this.classList.toggle('active', announcementsCompact);
        renderAnnouncements();
    });

    /* =====================================================================
       CLEARING OLD NOTICES
       ---------------------------------------------------------------------
       Nothing on the board expires by itself — `expiresAt` exists on the
       model but the portal's composer never sets it — so a semester's
       notices pile up and the useful ones sink. This is the broom, and it is
       an administrator's alone: it removes notices for the whole college.
       ===================================================================== */

    const announcementSweep = document.getElementById('announcement-sweep');
    if (announcementSweep) announcementSweep.hidden = !isAdmin;

    document.getElementById('announcement-sweep-btn')?.addEventListener('click', function () {
        if (!isAdmin) return;

        const ageSelect = document.getElementById('announcement-sweep-age');
        const days = Number(ageSelect?.value || 30);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        if (!window.CoeBoard?.ready) {
            window.showLibraryToast?.('Not connected', 'The shared board is not loaded yet.', 'error');
            return;
        }

        const confirmed = confirm(
            `Remove every notice posted more than ${days} days ago?\n\n` +
            'Pinned notices are kept. This clears the board for everyone and cannot be undone from here.'
        );

        if (!confirmed) return;

        const button = this;
        const label = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="material-icons">hourglass_top</span>Clearing…';

        window.CoeBoard.clearAnnouncementsBefore(cutoff.toISOString())
            .then(function (result) {
                const cleared = result.cleared || 0;
                window.showLibraryToast?.(
                    cleared ? 'Board cleared' : 'Nothing to clear',
                    cleared
                        ? `${cleared} old ${cleared === 1 ? 'notice' : 'notices'} removed` +
                          (result.failed ? `, ${result.failed} could not be.` : '.')
                        : `No unpinned notices older than ${days} days.`,
                    cleared ? 'success' : 'info'
                );
            })
            .catch(function (error) {
                window.showLibraryToast?.('Could not clear', (error && error.message) || 'Try again.', 'error');
            })
            .then(function () {
                button.disabled = false;
                button.innerHTML = label;
            });
    });
    announcementAdminForm?.classList.toggle('hidden', !canPublishAnnouncements);
    if (announcementAdminForm && canPublishAnnouncements) {
        const publisherBadge = document.getElementById('announcement-publisher-badge');
        if (publisherBadge) {
            publisherBadge.textContent = isAdmin ? 'Admin publisher' : `${officerOrg} publisher`;
        }
        if (isOrgOfficer && announcementCourseInput) {
            announcementCourseInput.value = officerOrg === 'PICE' ? 'CE' : 'EE';
            announcementCourseInput.disabled = true;
        }
    }
    if (announcementEventDateInput) {
        announcementEventDateInput.value = localDayKey();
    }
    announcementAdminForm?.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!canPublishAnnouncements) {
            alert('Only admins, PICE officers, and IIEE officers can publish announcements.');
            return;
        }
        const lockedOrgCourse = officerOrg === 'PICE' ? 'CE' : (officerOrg === 'IIEE' ? 'EE' : '');
        const announcement = normalizeAnnouncement({
            id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: announcementTitleInput?.value.trim(),
            tag: announcementTagInput?.value || 'General',
            course: lockedOrgCourse || announcementCourseInput?.value || 'CE/EE',
            postedAt: localDayKey(),
            eventDate: announcementEventDateInput?.value || localDayKey(),
            summary: announcementSummaryInput?.value.trim(),
            details: announcementDetailsInput?.value.trim(),
            relatedPage: announcementRelatedPageInput?.value || 'announcements',
            pinned: Boolean(announcementPinnedInput?.checked),
            createdBy: isOrgOfficer ? `${officerOrg} Officer` : (currentUser?.name || currentUser?.username || 'Admin')
        });
        // --- Shared board -------------------------------------------------
        //
        // Posted to the server so every account sees it. The row comes back
        // through the socket like everyone else's, so nothing is inserted
        // locally here — what appears is what the server accepted.
        if (window.CoeBoard?.ready) {
            window.CoeBoard.postAnnouncement(announcement)
                .then(function () {
                    window.showLibraryToast?.('Announcement posted', 'Everyone signed in can see it now.', 'success');
                })
                .catch(function (error) {
                    window.showLibraryToast?.('Could not post', error.message || 'Try again.', 'error');
                });

            announcementAdminForm.reset();
            if (isOrgOfficer && announcementCourseInput) {
                announcementCourseInput.value = lockedOrgCourse;
                announcementCourseInput.disabled = true;
            }
            if (announcementEventDateInput) {
                announcementEventDateInput.value = localDayKey();
            }
            return;
        }

        announcements.unshift(announcement);
        saveAnnouncements();
        announcementAdminForm.reset();
        if (isOrgOfficer && announcementCourseInput) {
            announcementCourseInput.value = lockedOrgCourse;
            announcementCourseInput.disabled = true;
        }
        if (announcementEventDateInput) {
            announcementEventDateInput.value = localDayKey();
        }
        renderAnnouncements();
    });
    homeAnnouncementsList?.addEventListener('click', handleAnnouncementAction);
    announcementsList?.addEventListener('click', handleAnnouncementAction);
    homeAchievementForm?.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!isAdmin) {
            alert('Only admins can post COE achievements.');
            return;
        }
        const title = homeAchievementTitleInput?.value.trim() || '';
        const description = homeAchievementDescriptionInput?.value.trim() || '';
        if (!title || !description) return;
        const imageFile = homeAchievementImageInput?.files?.[0] || null;

        function saveAchievement(image = {}) {
            const achievements = loadHomeAchievements();
            achievements.unshift({
                id: `achievement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                title,
                description,
                category: homeAchievementCategoryInput?.value || 'Achievement',
                author: currentUser?.name || currentUser?.username || 'COE Admin',
                imageContent: image.content || '',
                imageName: imageFile?.name || '',
                createdAt: new Date().toISOString()
            });
            saveHomeAchievements(achievements);
            homeAchievementForm.reset();
            if (homeAchievementImageName) homeAchievementImageName.textContent = 'No image selected';
            addActivity(`Posted COE achievement: ${title}`, { type: 'announcement' });
            renderHomeAchievements();
        }

        if (imageFile) {
            if (!imageFile.type.startsWith('image/')) {
                alert('Please choose an image file for the achievement post.');
                return;
            }
            readFileForPreview(imageFile, saveAchievement);
            return;
        }

        saveAchievement();
    });
    homeAchievementsList?.addEventListener('click', function (event) {
        const deleteButton = event.target.closest('.home-achievement-delete');
        if (!deleteButton) return;
        if (!isAdmin) return;
        const achievementId = deleteButton.getAttribute('data-achievement-id');
        if (!achievementId) return;
        if (!confirm('Delete this COE achievement post?')) return;
        const achievements = loadHomeAchievements().filter(item => item.id !== achievementId);
        saveHomeAchievements(achievements);
        renderHomeAchievements();
    });
    homeAchievementImageInput?.addEventListener('change', function () {
        if (homeAchievementImageName) {
            homeAchievementImageName.textContent = this.files?.[0]?.name || 'No image selected';
        }
    });

    notificationButtons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            renderNotificationsDropdown(this);
        });
    });

    document.addEventListener('click', function () {
        const dd = document.getElementById('notifications-dropdown');
        if (dd) dd.style.display = 'none';
    });

    messagesButtons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            showPage('messages');
        });
    });

    // ensure badge initial state
    if (!localStorage.getItem(LOCAL_STORAGE_NOTIFICATIONS)) {
        saveNotifications([]);
    }
    renderNotificationBadges();

    document.addEventListener('click', function() {
        profileMenu?.classList.remove('active');
        document.getElementById('profile-dropdown-menu')?.classList.remove('active'); // Use direct ID for profileMenu
    });

    globalSearchInput?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const query = this.value.trim().toLowerCase();
            if (!query) return;
            const announcementMatch = announcements.some(item =>
                `${item.title} ${item.tag} ${item.course} ${item.summary} ${item.details}`.toLowerCase().includes(query)
            );
            if (announcementMatch) {
                showPage('announcements');
                if (announcementSearchInput) announcementSearchInput.value = query;
                renderAnnouncements();
                return;
            }
            showPage('library');
            if (librarySearchInput) {
                librarySearchInput.value = query;
                scheduleLibraryRender();
            }
        }
    });

    pageLinks.forEach(link => {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            const pageKey = this.getAttribute('data-page');
            if (pageKey) showPage(pageKey);
            setMobileSidebar(false);
        });
    });

    menuButtons.forEach(button => {
        button.addEventListener('click', function () {
            const pageKey = this.getAttribute('data-page');
            if (pageKey) showPage(pageKey);
        });
    });

    inlinePageButtons.forEach(button => {
        button.addEventListener('click', function () {
            const pageKey = this.getAttribute('data-page');
            if (pageKey) showPage(pageKey);
        });
    });

    document.querySelectorAll('.feature-suite-card[data-page]').forEach(card => {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.addEventListener('click', function () {
            showPage(this.getAttribute('data-page'));
        });
        card.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                showPage(this.getAttribute('data-page'));
            }
        });
    });

    logoutBtn?.addEventListener('click', logoutCurrentUser);
    logoutCurrentBtn?.addEventListener('click', logoutCurrentUser);

    quickCreateFolderBtn?.addEventListener('click', function () {
        addFolderModal.style.display = 'block';
    });

    quickUploadFileBtn?.addEventListener('click', function () {
        if (currentFolderId && currentFolderId !== 'all' && typeof window.openLibraryUploadModal === 'function') {
            window.openLibraryUploadModal(currentFolderId);
            return;
        }
        // The currentFolderId is managed by enhanced-library.js
        // if (currentFolderId && currentFolderId !== 'all' && typeof window.openLibraryUploadModal === 'function') {
        //     window.openLibraryUploadModal(currentFolderId);
        //     return;
        // }
        if (folders.length === 0) {
            addFolderModal.style.display = 'block';
            addActivity('Opened folder creation because no folders exist yet.');
            return;
        }
        if (typeof window.openLibraryUploadModal === 'function') {
            window.openLibraryUploadModal();
            return;
        }
        showPage('library');
    });

    quickAddProblemBtn?.addEventListener('click', function () {
        showPage('tasks');
    });

    quickOpenLibraryBtn?.addEventListener('click', function () {
        showPage('library');
    });

    shortcutLibraryBtn?.addEventListener('click', function () {
        showPage('library');
    });
    shortcutUploadBtn?.addEventListener('click', function () {
        if (currentFolderId && currentFolderId !== 'all' && typeof window.openLibraryUploadModal === 'function') {
            window.openLibraryUploadModal(currentFolderId);
            return;
        }
        // The currentFolderId is managed by enhanced-library.js
        // if (currentFolderId && currentFolderId !== 'all' && typeof window.openLibraryUploadModal === 'function') {
        //     window.openLibraryUploadModal(currentFolderId);
        //     return;
        // }
        if (typeof window.openLibraryUploadModal === 'function') {
            window.openLibraryUploadModal();
            return;
        }
        showPage('library');
    });
    shortcutQaBtn?.addEventListener('click', function () {
        showPage('qa-hub');
    });
    shortcutVoiceBtn?.addEventListener('click', function () {
        showPage('student-voice');
    });
    shortcutAnnouncementsBtn?.addEventListener('click', function () {
        showPage('announcements');
    });
    /*
     * The Analytics tab is gone — it was three placeholder tiles reading
     * "Focus / Library / Output" off the same numbers the home dashboard and
     * the admin page already show. The admin page keeps its own Platform
     * Analytics card, which is the one with real per-upload breakdowns.
     *
     * showPage('analytics') would now fall through to Home, so nothing is
     * broken by a stale link; the listener is removed rather than left to
     * short-circuit so the next person does not go looking for the panel.
     */

    refreshDashboardBtn?.addEventListener('click', refreshDashboard);
    smartRefreshBtn?.addEventListener('click', refreshDashboard);

    // Enhanced library controls listeners
    librarySearchInput = librarySearchInput || document.getElementById('library-search-enhanced');
    librarySearchInput?.addEventListener('input', scheduleLibraryRender);
    libraryFilterType?.addEventListener('change', scheduleLibraryRender);
    libraryFilterYear?.addEventListener('change', scheduleLibraryRender);
    libraryFilterYear?.addEventListener('change', () => { window.enhancedLibrary.populateSubjectFilter(); scheduleLibraryRender(); }); // Call enhancedLibrary's populateSubjectFilter
    libraryFilterSubject?.addEventListener('change', scheduleLibraryRender);
    libraryFilterLesson?.addEventListener('change', scheduleLibraryRender);
    libraryFilterSort?.addEventListener('change', scheduleLibraryRender);
    // libraryFilterSort?.addEventListener('change', scheduleLibraryRender); // Handled by enhanced-library.js
    libraryDisciplineFilter?.addEventListener('change', scheduleLibraryRender);
    recentActivityList?.addEventListener('click', function (event) {
        const button = event.target.closest('.activity-view-btn');
        if (!button) return;

        const activityIndex = parseInt(button.getAttribute('data-activity-index'), 10);
        const activity = activityLog[activityIndex];
        if (activity?.taskId) {
            const taskIndex = findTaskIndexByActivity(activity);
            if (taskIndex >= 0) {
                openTaskPostModal(tasks[taskIndex].id, taskIndex);
                return;
            }
        } else {
            const fileIndex = activity?.fileId
                ? findUploadedFileIndex(activity.fileId)
                : (typeof activity?.fileIndex === 'number' ? activity.fileIndex : -1);
            if (fileIndex >= 0) {
                openFilePreviewModal(fileIndex);
                return;
            }
        }

        alert('This recent activity item is no longer available.');
    });

    themeToggleBtn?.addEventListener('click', toggleTheme);
    clearStorageBtn?.addEventListener('click', function () {
        if (confirm('Clear all saved app data? This will remove folders, uploads, tasks, activity, and registered accounts.')) {
            localStorage.clear();
            location.reload();
        }
    });
    profilePictureInput?.addEventListener('change', function () {
        if (!profilePictureName) return;
        const selectedFile = this.files?.[0];
        profilePictureName.textContent = selectedFile ? selectedFile.name : (currentUser?.profilePicture ? 'Current photo saved' : 'Keep current photo');

        if (selectedFile && settingsProfileAvatar) {
            const reader = new FileReader();
            reader.onload = function () {
                applyAvatarImage(settingsProfileAvatar, reader.result, '');
            };
            reader.readAsDataURL(selectedFile);
        } else {
            if (currentUser?.profilePicture) {
                applyAvatarImage(settingsProfileAvatar, currentUser.profilePicture, '');
            } else {
                applyAvatarImage(settingsProfileAvatar, '', currentUser?.name || currentUser?.username || 'Guest');
            }
        }
    });

    loadSavedTheme();
    setTopAccountPanel();
    populateProfileForm();
    hideAdminLinksIfNeeded();
    displayAdminLogs();
    
    // Removed old folder and library list listeners
    // foldersList?.addEventListener('click', ...);
    // function handleLibraryAction(event) { ... }
    // libraryList?.addEventListener('click', handleLibraryAction);
    // folderDetailList?.addEventListener('click', handleLibraryAction);

    // Legacy wrapper functions and removed duplicate library helpers have been cleaned up.
    // These are now handled by enhanced-library.js

    // Removed old bookmark functions
    // const LOCAL_STORAGE_BOOKMARKS = 'coeLibraryBookmarks';
    // let bookmarks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BOOKMARKS) || '[]');
    // function saveBookmarks() { ... }
    // function renderBookmarks() { ... }
    // function toggleBookmark(index) { ... }

    // Removed old folder list and detail section
    // const folders = [];
    // foldersList?.addEventListener('click', ...);
    // folderBackBtn.addEventListener('click', ...);
    // function openFolderDetail(folderIndex) { ... }
    // function renameFolder(folderIndex) { ... }

    // Removed old displayFolders
    // function displayFolders() { ... }

    // Removed old displayLibrary
    // function displayLibrary() { ... }

    // Removed old populateLibraryFilterOptions
    // function populateLibraryFilterOptions() { ... }

    // Removed old openFilePreviewModal
    // function openFilePreviewModal(fileIndex) { ... }

    // Removed old openEditFileModal
    // function openEditFileModal(fileIndex) { ... }

    // Removed old deleteUploadedFile
    // function deleteUploadedFile(fileIndex) { ... }

    // Removed old attachLibraryCardListeners
    // function attachLibraryCardListeners() { ... }

    // Removed old downloadLibraryFile
    // function downloadLibraryFile(index) { ... }

    // Removed old toggleFavoriteFile
    // function toggleFavoriteFile(index) { ... }

    // Removed old commentLibraryFile
    // function commentLibraryFile(index) { ... }

    // Removed old renderBookmarks
    // renderBookmarks();

    // Removed old loadSavedState for folders and bookmarks
    // if (savedFolders) { ... }
    // if (savedBookmarks) { ... }

    // Removed old clearLoadedState for folders
    // folders.length = 0;

    // Removed old saveFolders
    // function saveFolders() { ... }

    // Removed old refreshDashboard for folders and bookmarks
    // displayFolders();
    // populateLibraryUploadFolders();
    // displayLibrary();

    // Removed old addFolderForm submit listener
    // addFolderForm.addEventListener('submit', ...);

    // Removed old openFileUploadModal
    // function openFileUploadModal(folderIndex) { ... }

    // Removed duplicate broken openLibraryUploadModal block
    // window.openLibraryUploadModal = openLibraryUploadModal; // This is now the main function

    // Removed old uploadFileForm submit listener
    // uploadFileForm.addEventListener('submit', ...);

    // Removed old addFolderForm submit listener
    // addFolderForm.addEventListener('submit', ...);

    // Removed old profileForm, adminCreateAccountForm, uploadFileForm, libraryUploadPageForm, newProblemForm submit listeners
    // These will be re-added if they need to trigger displayMembers

    // Removed old displayRecentActivity (duplicate)
    // function displayRecentActivity() { ... }

    // Removed old loadSavedState (duplicate)
    // function loadSavedState() { ... }

    // Removed old uploadMaterialToLibrary (duplicate)
    // function uploadMaterialToLibrary({ folderIndex, folderId, course, subject, year, lessonName, file, onComplete }) { ... }

    // Removed old openFolderDetail (duplicate)
    // function openFolderDetail(folderIndex) { ... }

    // Removed old openFilePreviewModal (duplicate)
    // function openFilePreviewModal(fileIndex) { ... }

    // Removed old deleteUploadedFile (duplicate)
    // function deleteUploadedFile(fileIndex) { ... }

    // Removed old openTaskPostModal (duplicate)
    // function openTaskPostModal(taskId, fallbackIndex = null) { ... }

    // Removed old displayTaskSummary (duplicate)
    // function displayTaskSummary() { ... }

    // Removed old displayAdminLogs (duplicate)
    // function displayAdminLogs() { ... }

    // Removed old displayAccountList (duplicate)
    // function displayAccountList() { ... }

    // Removed old displayMembers (duplicate)
    // function displayMembers() { ... }

    // Initial folder, library, task summary, and home displays
    // loadSavedState(); // This is called at the end of DOMContentLoaded
    // displayFolders(); // Removed
    // populateLibraryUploadFolders(); // Called in refreshDashboard
    // displayLibrary(); // Removed, enhancedLibrary.displayMaterialCards is called
    // displayTaskSummary(); // Called in refreshDashboard
    // displayHomeTodos(); // Called in refreshDashboard
    // renderHomeUploadProgress(); // Called in refreshDashboard
    // renderHomeReviewQueue(); // Called in refreshDashboard
    // renderHomeSchedule(); // Called in refreshDashboard
    // syncDashboardNotifications(); // Called in refreshDashboard
    // displayMembers(); // Called in refreshDashboard
    // displayHomeDashboardStats(); // Called in refreshDashboard
    // renderAnnouncements(); // Called in refreshDashboard
    // displayAccountList(); // Called in refreshDashboard
    // showPage('home'); // Called in refreshDashboard

    // The following functions are now handled by enhanced-library.js or are no longer needed
    // const folders = []; // Removed
    // foldersList?.addEventListener('click', ...); // Removed
    // function handleLibraryAction(event) { ... } // Removed
    // libraryList?.addEventListener('click', handleLibraryAction); // Removed
    // folderDetailList?.addEventListener('click', handleLibraryAction); // Removed

    // The following functions are now handled by enhanced-library.js or are no longer needed
    // function displayFolders() { ... } // Removed
    // function displayLibrary() { ... } // Removed
    // function renameFolder(folderIndex) { ... } // Removed
    // function openFolderDetail(folderIndex) { ... } // Removed
    // function openFilePreviewModal(fileIndex) { ... } // Renamed to openFilePreviewModalFromScripts
    // function openEditFileModal(fileIndex) { ... } // Renamed to openEditFileModalFromScripts
    // function deleteUploadedFile(fileIndex) { ... } // Renamed to deleteUploadedFileFromScripts
    // function attachLibraryCardListeners() { ... } // Removed
    // function downloadLibraryFile(index) { ... } // Removed
    // function toggleFavoriteFile(index) { ... } // Removed
    // function commentLibraryFile(index) { ... } // Removed
    // function populateLibraryFilterOptions() { ... } // Removed
    // const LOCAL_STORAGE_BOOKMARKS = 'coeLibraryBookmarks'; // Removed
    // let bookmarks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BOOKMARKS) || '[]'); // Removed
    // function saveBookmarks() { ... } // Removed
    // function renderBookmarks() { ... } // Removed
    // function toggleBookmark(index) { ... } // Removed
    // renderBookmarks(); // Removed

    // The following are now handled by enhanced-library.js
    // librarySearchInput?.addEventListener('input', scheduleLibraryRender);
    // libraryFilterType?.addEventListener('change', scheduleLibraryRender);
    // libraryFilterYear?.addEventListener('change', scheduleLibraryRender);
    // libraryFilterSubject?.addEventListener('change', scheduleLibraryRender);
    // libraryFilterLesson?.addEventListener('change', scheduleLibraryRender);
    // libraryFilterTag?.addEventListener('change', scheduleLibraryRender);
    // libraryFilterSort?.addEventListener('change', scheduleLibraryRender);
    // libraryDisciplineFilter?.addEventListener('change', scheduleLibraryRender);

    // The following are now handled by enhanced-library.js
    // function populateLibraryUploadFolders() { ... }
    // function resolveLibraryUploadFolderIndex() { ... }
    // function uploadMaterialToLibrary({ folderIndex, course, subject, lessonName, file, onComplete }) { ... }
    // libraryUploadPageForm?.addEventListener('submit', ...);
    // addFolderForm.addEventListener('submit', ...); // This is a duplicate, the first one is kept.

    // The following are now handled by enhanced-library.js
    // function displayRecentActivity() { ... } // Removed duplicate
    // function loadSavedState() { ... } // Removed duplicate
    // function uploadMaterialToLibrary({ folderIndex, folderId, course, subject, year, lessonName, file, onComplete }) { ... } // Removed duplicate
    // function openFolderDetail(folderIndex) { ... } // Removed duplicate
    // function openFilePreviewModal(fileIndex) { ... } // Removed duplicate
    // function deleteUploadedFile(fileIndex) { ... } // Removed duplicate
    // function openTaskPostModal(taskId, fallbackIndex = null) { ... } // Removed duplicate
    // function displayTaskSummary() { ... } // Removed duplicate
    // function displayAdminLogs() { ... } // Removed duplicate
    // function displayAccountList() { ... } // Removed duplicate
    // function displayMembers() { ... } // Removed duplicate

    // Initial rendering is handled once at the end of DOMContentLoaded.
    // Call enhancedLibrary's initial population functions
    if (window.enhancedLibrary) {
        window.enhancedLibrary.populateLibraryFolderTree();
        window.enhancedLibrary.populateYearFilter();
        window.enhancedLibrary.populateTypeFilter();
        window.enhancedLibrary.displayMaterialCards('all'); // Display all materials initially
        window.enhancedLibrary.updateBookmarksList();
        window.enhancedLibrary.updateLibraryStats();
    }






































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































    function handleTodoToggle(event) {
        const input = event.target.closest('.todo-item-label input');
        if (!input) return;

        const index = parseInt(input.getAttribute('data-index'), 10);
        if (Number.isNaN(index) || !homeTodos[index]) return;

        homeTodos[index].completed = input.checked;
        saveHomeTodos();
        displayHomeTodos();
    }

    function handleTodoDelete(event) {
        const button = event.target.closest('.todo-delete-btn');
        if (!button) return;

        const index = parseInt(button.getAttribute('data-index'), 10);
        if (Number.isNaN(index) || !homeTodos[index]) return;

        homeTodos.splice(index, 1);
        saveHomeTodos();
        displayHomeTodos();
    }

    homeTodoList?.addEventListener('change', handleTodoToggle);
    homeCompletedList?.addEventListener('change', handleTodoToggle);
    homeTodoList?.addEventListener('click', handleTodoDelete);
    homeCompletedList?.addEventListener('click', handleTodoDelete);

    taskSummaryCards?.addEventListener('click', function (event) {
        const viewButton = event.target.closest('.task-view-btn');
        if (viewButton) {
            const taskId = viewButton.getAttribute('data-task-id');
            const taskIndex = parseInt(viewButton.getAttribute('data-index'), 10);
            if (taskId) {
                openTaskPostModal(taskId, taskIndex);
            }
            return;
        }

        const deleteButton = event.target.closest('.task-delete-btn');
        if (deleteButton) {
            const index = parseInt(deleteButton.getAttribute('data-index'), 10);
            if (!Number.isNaN(index)) {
                removeTaskAtIndex(index);
            }
        }
    });

    taskSummaryCards?.addEventListener('submit', function (event) {
        const submissionForm = event.target.closest('.student-task-submit-form');
        if (!submissionForm) return;

        event.preventDefault();
        const taskIndex = parseInt(submissionForm.getAttribute('data-index'), 10);
        const task = tasks[taskIndex];
        if (Number.isNaN(taskIndex) || !task || isAdmin) return;

        const answerInput = submissionForm.querySelector('.student-task-answer');
        const solutionInput = submissionForm.querySelector('.student-task-solution');
        const submittedAnswer = String(answerInput?.value || '').trim();
        if (!submittedAnswer) {
            alert('Please enter your answer before submitting.');
            return;
        }

        const expectedAnswer = normalizeAnswerForChecking(task.answer);
        const normalizedSubmitted = normalizeAnswerForChecking(submittedAnswer);
        const selectedSolutionFile = solutionInput?.files?.[0] || null;

        // --- Shared board ---------------------------------------------------
        //
        // Handing work in goes to the server. Note what does NOT happen here:
        // the submission is broadcast to staff only, never to the shared room,
        // so one student cannot see who else has submitted or what they wrote.
        if (window.CoeBoard?.ready) {
            window.CoeBoard.submitWork(task, submittedAnswer, selectedSolutionFile)
                .then(function (result) {
                    window.showLibraryToast?.('Submitted', result.message || 'Your work was handed in.', 'success');
                    submissionForm.reset();
                })
                .catch(function (error) {
                    window.showLibraryToast?.('Could not submit', error.message || 'Try again.', 'error');
                });
            return;
        }

        function saveSubmission(solutionPreview) {
            normalizeTaskRecord(task);
            const previousSubmission = getTaskSubmission(task);
            const submissionRecord = {
                username: currentUsername,
                name: currentUser?.name || currentUsername || 'Student',
                answer: submittedAnswer,
                correct: Boolean(expectedAnswer && normalizedSubmitted === expectedAnswer),
                submittedAt: new Date().toISOString(),
                solutionFileName: selectedSolutionFile?.name || previousSubmission?.solutionFileName || '',
                solutionContent: solutionPreview?.content || previousSubmission?.solutionContent || '',
                solutionPreviewType: solutionPreview?.previewType || previousSubmission?.solutionPreviewType || 'text',
                solutionFileType: solutionPreview?.fileType || previousSubmission?.solutionFileType || ''
            };

            const existingIndex = task.submissions.findIndex(function (submission) {
                return String(submission.username || '').toLowerCase() === String(currentUsername || '').toLowerCase();
            });
            if (existingIndex >= 0) {
                task.submissions.splice(existingIndex, 1, submissionRecord);
            } else {
                task.submissions.push(submissionRecord);
            }

            saveTasks();
            addActivity(`${submissionRecord.correct ? 'Correct' : 'Wrong'} task submission: ${task.title || 'Untitled Problem'}`, {
                type: 'task',
                taskId: task.id,
                taskTitle: task.title || 'Untitled Problem',
                taskOwnerUsername: task.ownerUsername
            });
            displayTaskSummary();
            displayMembers();
            alert(submissionRecord.correct ? 'Correct answer. Your solution was submitted.' : 'Submitted, but the answer did not match the saved key.');
        }

        if (selectedSolutionFile) {
            readFileForPreview(selectedSolutionFile, saveSubmission);
        } else {
            saveSubmission({ content: '', previewType: 'text', fileType: '' });
        }
    });

    accountListContainer?.addEventListener('click', function (event) {
        const toggleButton = event.target.closest('.account-role-toggle-btn');
        if (toggleButton) {
            const username = toggleButton.getAttribute('data-username');
            const nextRole = toggleButton.getAttribute('data-next-role');
            if (username && nextRole) {
                updateStoredUserRole(username, nextRole);
            }
            return;
        }

        const deleteButton = event.target.closest('.account-delete-btn');
        if (!deleteButton) return;

        const username = deleteButton.getAttribute('data-username');
        if (!username) return;

        const users = getStoredUsers();
        const role = (users.find(user => user.username.toLowerCase() === username.toLowerCase()) || {}).role || 'STUDENT';
        const adminUsers = users.filter(user => (user.role || user.type || 'STUDENT').toUpperCase() === 'ADMIN');
        if (role.toUpperCase() === 'ADMIN' && adminUsers.length <= 1) {
            alert('Cannot remove the last admin account.');
            return;
        }

        if (confirm(`Delete account ${username}?`)) {
            deleteStoredUser(username);
        }
    });

    function renderAdminAnalytics() {
        if (!adminAnalyticsGrid) return;

        const files = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FILES) || '[]');
        const activityItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ACTIVITY) || '[]');

        const uploadsByYear = files.reduce((acc, file) => {
            const year = file.year || 'Unassigned';
            acc[year] = (acc[year] || 0) + 1;
            return acc;
        }, {});

        const uploadsByType = files.reduce((acc, file) => {
            const type = file.materialCategory || file.displayType || file.type || 'Other';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        const uploaders = files.reduce((acc, file) => {
            const uploader = file.uploadedBy || file.ownerUsername || 'Unknown';
            acc[uploader] = (acc[uploader] || 0) + 1;
            return acc;
        }, {});

        const topUploaders = Object.entries(uploaders)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);

        const recentLessons = Array.from(new Set(files
            .filter(file => file.lesson)
            .sort((a, b) => new Date(b.uploadedAt || b.lastModified) - new Date(a.uploadedAt || a.lastModified))
            .slice(0, 8)
            .map(file => file.lesson)))
            .slice(0, 5);

        const now = new Date();
        const weeklyTrend = Array.from({ length: 4 }, (_, index) => {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (7 * index));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
            const count = files.filter(file => {
                const date = new Date(file.uploadedAt || file.lastModified);
                return date >= weekStart && date <= weekEnd;
            }).length;
            return { label, count };
        }).reverse();

        const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
            const month = new Date(now.getFullYear(), now.getMonth() - index, 1);
            const label = month.toLocaleString('default', { month: 'short' });
            const count = files.filter(file => {
                const date = new Date(file.uploadedAt || file.lastModified);
                return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
            }).length;
            return { label, count };
        }).reverse();

        const totalUploads = files.length;
        const totalActivity = activityItems.length;

        adminAnalyticsGrid.innerHTML = `
            <div class="analytics-row-top">
                <div class="stat-bubble">
                    <span class="material-icons" style="color:#8f1d2c">cloud_upload</span>
                    <div>
                        <strong>${totalUploads}</strong>
                        <small>Total Uploads</small>
                    </div>
                </div>
                <div class="stat-bubble">
                    <span class="material-icons" style="color:#8f1d2c">people</span>
                    <div>
                        <strong>${topUploaders.length}</strong>
                        <small>Active Uploaders</small>
                    </div>
                </div>
                <div class="stat-bubble">
                    <span class="material-icons" style="color:#8f6a12">schedule</span>
                    <div>
                        <strong>${monthlyTrend.reduce((sum, month) => sum + month.count, 0)}</strong>
                        <small>Last 6 Months</small>
                    </div>
                </div>
                <div class="stat-bubble">
                    <span class="material-icons" style="color:#a63347">folder</span>
                    <div>
                        <strong>${Object.keys(uploadsByType).length}</strong>
                        <small>Material Categories</small>
                    </div>
                </div>
            </div>
            <div class="analytics-row-bars">
                <div class="analytics-progress-item">
                    <div class="progress-meta">
                        <span>Uploads by Year</span>
                        <strong>${Object.values(uploadsByYear).reduce((sum, count) => sum + count, 0)}</strong>
                    </div>
                    <div class="analytics-list">
                        ${Object.entries(uploadsByYear).map(([year, count]) => `<div class="analytics-list-item"><span>${escapeHtml(year)}</span><strong>${count}</strong></div>`).join('')}
                    </div>
                </div>
                <div class="analytics-progress-item">
                    <div class="progress-meta">
                        <span>Uploads by Type</span>
                        <strong>${Object.values(uploadsByType).reduce((sum, count) => sum + count, 0)}</strong>
                    </div>
                    <div class="analytics-list">
                        ${Object.entries(uploadsByType).map(([type, count]) => `<div class="analytics-list-item"><span>${escapeHtml(type)}</span><strong>${count}</strong></div>`).join('')}
                    </div>
                </div>
            </div>
            <div class="analytics-row-insights">
                <div class="insight-col">
                    <h4><span class="material-icons">star</span> Most Active Uploaders</h4>
                    <ul class="admin-insight-list">
                        ${topUploaders.length ? topUploaders.map(([u, count]) => `<li><span>${escapeHtml(u)}</span><strong>${count}</strong></li>`).join('') : '<li>No uploader activity</li>'}
                    </ul>
                </div>
                <div class="insight-col">
                    <h4><span class="material-icons">menu_book</span> Recent Lessons</h4>
                    <ul class="admin-insight-list">
                        ${recentLessons.length ? recentLessons.map(lesson => `<li><span>${escapeHtml(lesson)}</span></li>`).join('') : '<li>No recent lessons</li>'}
                    </ul>
                </div>
            </div>
            <div class="analytics-extra">
                <div class="extra-col">
                    <h4>Upload Trends (Weeks)</h4>
                    <div class="trend-list">
                        ${weeklyTrend.map(item => `<div class="trend-step"><span>${escapeHtml(item.label)}</span><strong>${item.count}</strong></div>`).join('')}
                    </div>
                </div>
                <div class="extra-col">
                    <h4>Upload Trends (Months)</h4>
                    <div class="trend-list">
                        ${monthlyTrend.map(item => `<div class="trend-step"><span>${escapeHtml(item.label)}</span><strong>${item.count}</strong></div>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    window.refreshAdminDashboard = refreshAdminDashboard;

    function scheduleLibraryRender() {
        if (libraryRenderTimer) {
            clearTimeout(libraryRenderTimer);
        }

        libraryRenderTimer = setTimeout(function () {
            if (window.enhancedLibrary?.displayMaterialCards) {
                window.enhancedLibrary.displayMaterialCards(window.currentFolderId || 'all');
            } else {
                displayLibrary();
            }
            libraryRenderTimer = null;
        }, LIBRARY_RENDER_DELAY_MS);
    }

    function normalizeFolderName(value) {
        return String(value || '').trim().replace(/\s+/g, ' ');
    }

    function findFolderIndexByName(name, excludedIndex = -1) {
        return folders.findIndex(function (folder, index) {
            return index !== excludedIndex && normalizeFolderName(folder.name).toLowerCase() === name.toLowerCase();
        });
    }

    function getSafeDriveUrl(value) {
        try {
            const parsedUrl = new URL(String(value || ''));
            const hostname = parsedUrl.hostname.toLowerCase();
            const isSafeHost = hostname === 'drive.google.com' || hostname === 'docs.google.com';
            const isSafeProtocol = parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
            return isSafeHost && isSafeProtocol ? parsedUrl.toString() : '';
        } catch (error) {
            return '';
        }
    }

    function isSafeImageSource(value) {
        return /^(data:image\/[a-z0-9.+-]+;base64,|https?:\/\/)/i.test(String(value || ''));
    }

    function getLibraryFilters() {
        return {
            query: librarySearchInput ? librarySearchInput.value.trim().toLowerCase() : '',
            type: libraryFilterType ? libraryFilterType.value : '',
            year: libraryFilterYear ? libraryFilterYear.value : '',
            subject: libraryFilterSubject ? libraryFilterSubject.value.trim() : '',
            lesson: libraryFilterLesson ? libraryFilterLesson.value.trim() : '',
            tag: libraryFilterTag ? libraryFilterTag.value : '',
            sort: libraryFilterSort ? libraryFilterSort.value : 'recent',
            discipline: libraryDisciplineFilter ? libraryDisciplineFilter.value : 'All'
        };
    }

    function getLibraryPreviewText(uploaded) {
        if (uploaded.previewType === 'image') {
            return 'Image preview available in Review.';
        }

        if (uploaded.previewType === 'link') {
            return 'Google Drive link available in Review.';
        }

        const rawContent = String(uploaded.content || '').trim();
        if (!rawContent || rawContent === 'Preview not available for this file type.') {
            return 'Preview not available for this file type.';
        }

        return `${rawContent.slice(0, 120)}${rawContent.length > 120 ? '...' : ''}`;
    }

    function getFileIcon(uploaded) {
        const type = String(uploaded.materialCategory || uploaded.displayType || uploaded.type || '').toLowerCase();
        if (type.includes('video')) return 'play_circle';
        if (type.includes('pdf')) return 'picture_as_pdf';
        if (type.includes('image')) return 'image';
        if (type.includes('link')) return 'link';
        if (type.includes('lesson')) return 'menu_book';
        if (type.includes('handout') || type.includes('reference')) return 'description';
        return 'insert_drive_file';
    }

    function canManageUploadedFile(file) {
        const ownerUsername = String(file?.ownerUsername || '').toLowerCase();
        return isAdmin || Boolean(ownerUsername && ownerUsername === currentUsername.toLowerCase());
    }

    function renderLibraryCard(uploaded) {
        const folderName = folders[uploaded.folderIndex] ? folders[uploaded.folderIndex].name : (uploaded.folderName || 'Unknown');
        const previewText = getLibraryPreviewText(uploaded);
        const commentCount = Array.isArray(uploaded.comments) ? uploaded.comments.length : 0;
        const favoriteClass = uploaded.favorite ? 'favorite-active' : '';
        const ownerActions = canManageUploadedFile(uploaded)
            ? `<button class="edit-file-btn" data-index="${uploaded.sourceIndex}">Edit</button><button class="delete-file-btn" data-index="${uploaded.sourceIndex}">Delete</button>`
            : '';

        return `
            <div class="library-card">
                <div class="library-card-icon">
                    <span class="material-icons">${getFileIcon(uploaded)}</span>
                </div>
                <div class="library-card-info">
                    <div class="library-card-top">
                        <h3>${escapeHtml(uploaded.title || uploaded.name || 'Untitled File')}</h3>
                        <span class="library-file-badge">${escapeHtml(uploaded.materialCategory || uploaded.displayType || uploaded.type || 'Material')}</span>
                    </div>
                    <p class="library-card-description">${escapeHtml(uploaded.description || uploaded.summary || 'No description provided.')}</p>
                    <div class="library-card-meta">
                        <span>${escapeHtml(uploaded.uploadedBy || uploaded.ownerUsername || 'Unknown')}</span>
                        ${uploaded.professorName ? `<span>${escapeHtml(uploaded.professorName)}</span>` : ''}
                        <span>${escapeHtml(formatDate(uploaded.uploadedAt || uploaded.lastModified || new Date().toISOString()))}</span>
                        <span>${escapeHtml(uploaded.lesson || 'General')}</span>
                    </div>
                </div>
                <div class="library-card-actions">
                    <button class="view-file-btn" data-index="${uploaded.sourceIndex}">View</button>
                    <button class="download-file-btn" data-index="${uploaded.sourceIndex}">Download</button>
                    <button class="favorite-file-btn ${favoriteClass}" data-index="${uploaded.sourceIndex}">${uploaded.favorite ? '★ Favorited' : '☆ Favorite'}</button>
                    <button class="comment-file-btn" data-index="${uploaded.sourceIndex}">Comment${commentCount ? ' (' + commentCount + ')' : ''}</button>
                    ${ownerActions}
                </div>
            </div>
        `;
    }

    function displayFolders() {
        if (!foldersList) return;

        if (!folders.length) {
            foldersList.innerHTML = '<p class="empty-folder-detail">No folders yet. Create one to organize uploads.</p>';
            return;
        }

        foldersList.innerHTML = folders.map(function (folder, index) {
            return `
                <div class="folder-card">
                    <div class="folder-card-info">
                        <h3>${escapeHtml(folder.name)}</h3>
                    </div>
                    <div class="folder-card-actions">
                        <button class="view-folder-btn" data-index="${index}">Open Folder</button>
                        <button class="upload-file-btn" data-index="${index}">Upload File</button>
                        <button class="rename-folder-btn" data-index="${index}">Rename</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function displayLibrary() {
        if (!libraryList) return;
        if (window.enhancedLibrary?.displayMaterialCards) {
            window.enhancedLibrary.displayMaterialCards(window.currentFolderId || 'all');
            window.enhancedLibrary.updateLibraryStats?.();
            return;
        }

        const filters = getLibraryFilters();
        const { query, type, year, subject, lesson, tag, sort, discipline } = filters;
        populateLibraryFilterOptions();

        const filteredFiles = uploadedFiles
            .map(function (file, index) {
                return { ...file, sourceIndex: index };
            })
            .filter(function (file) {
                const matchesDiscipline = !discipline || discipline === 'All' || file.discipline === discipline;
                const normalizedType = String(file.materialCategory || file.type || file.displayType || '').toLowerCase();
                const matchesType = !type || type === '' || normalizedType.includes(String(type || '').toLowerCase());
                const matchesYear = !year || year === '' || String(file.year || '').toLowerCase().includes(String(year || '').toLowerCase());
                const matchesSubject = !subject || subject === '' || (file.subject || '').toLowerCase().includes(subject.toLowerCase());
                const matchesLesson = !lesson || lesson === '' || (file.lesson || '').toLowerCase().includes(lesson.toLowerCase());
                const matchesTag = !tag || tag === '' || Array.isArray(file.tags) && file.tags.some(t => t.toLowerCase() === tag.toLowerCase());
                const searchable = `${file.title || file.name || ''} ${file.uploadedBy || file.ownerUsername || ''} ${file.professorName || ''} ${file.professorUsername || ''} ${file.discipline || ''} ${file.lesson || ''} ${file.type || ''} ${file.subject || ''} ${Array.isArray(file.tags) ? file.tags.join(' ') : ''}`.toLowerCase();
                const matchesQuery = !query || searchable.includes(query);
                return matchesDiscipline && matchesType && matchesYear && matchesSubject && matchesLesson && matchesTag && matchesQuery;
            })
            .sort(function (left, right) {
                if (sort === 'recent') {
                    return (new Date(right.uploadedAt || right.lastModified) - new Date(left.uploadedAt || left.lastModified));
                }
                if (sort === 'oldest') {
                    return (new Date(left.uploadedAt || left.lastModified) - new Date(right.uploadedAt || right.lastModified));
                }
                if (sort === 'mostviewed') {
                    return (Number(right.views || 0) - Number(left.views || 0));
                }
                if (sort === 'uploader') {
                    return String(right.uploadedBy || right.ownerUsername || '').localeCompare(String(left.uploadedBy || left.ownerUsername || ''));
                }
                if (sort === 'name') {
                    return String(left.title || left.name || '').localeCompare(String(right.title || right.name || ''));
                }
                return `${left.discipline || ''}${left.lesson || ''}${left.title || left.name || ''}`.localeCompare(`${right.discipline || ''}${right.lesson || ''}${right.title || right.name || ''}`);
            });

        if (libraryTotalCount) {
            libraryTotalCount.textContent = String(filteredFiles.length);
        }
        if (libraryVideoCount) {
            libraryVideoCount.textContent = String(filteredFiles.filter(file => (file.type || '').toLowerCase().includes('video')).length);
        }
        if (libraryPdfCount) {
            libraryPdfCount.textContent = String(filteredFiles.filter(file => (file.type || '').toLowerCase().includes('pdf') || (file.type || '').toLowerCase().includes('handout')).length);
        }
        if (libraryDownloadCount) {
            libraryDownloadCount.textContent = String(filteredFiles.reduce((sum, file) => sum + (Number(file.downloads) || 0), 0));
        }
        if (libraryCompletedCount) {
            libraryCompletedCount.textContent = String(filteredFiles.filter(file => file.completed).length);
        }

        if (!filteredFiles.length) {
            libraryList.innerHTML = '<p class="empty-library">No files match your search or filter.</p>';
            return;
        }

        const groupedByCourse = filteredFiles.reduce(function (accumulator, file) {
            const courseKey = file.discipline || 'Unassigned';
            const lessonKey = file.lesson || 'General';

            if (!accumulator[courseKey]) {
                accumulator[courseKey] = {};
            }

            if (!accumulator[courseKey][lessonKey]) {
                accumulator[courseKey][lessonKey] = [];
            }

            accumulator[courseKey][lessonKey].push(file);
            return accumulator;
        }, {});

        libraryList.innerHTML = Object.keys(groupedByCourse).sort().map(function (courseKey) {
            const lessons = groupedByCourse[courseKey];
            const lessonMarkup = Object.keys(lessons).sort().map(function (lessonKey) {
                const cards = lessons[lessonKey].map(renderLibraryCard).join('');
                return `
                    <div class="library-lesson-group">
                        <div class="library-lesson-header">
                            <span class="material-icons">menu_book</span>
                            <h4>${escapeHtml(lessonKey)}</h4>
                        </div>
                        <div class="library-list">${cards}</div>
                    </div>
                `;
            }).join('');

            return `
                <section class="library-course-group">
                    <div class="library-course-header">
                        <div class="library-course-folder">
                            <span class="material-icons">folder</span>
                            <div>
                                <h3>${escapeHtml(courseKey)} Folder</h3>
                                <p>${Object.values(lessons).flat().length} material(s)</p>
                            </div>
                        </div>
                    </div>
                    ${lessonMarkup}
                </section>
            `;
        }).join('');
        attachLibraryCardListeners();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatFileSize(size) {
        const normalizedSize = Number(size) || 0;
        return `${Math.max(1, Math.round(normalizedSize / 1024))} KB`;
    }

    function renameFolder(folderIndex) {
        const folder = folders[folderIndex];
        if (!folder) return;

        const nextName = prompt('Enter a new folder name', folder.name);
        if (!nextName) return;

        const trimmedName = normalizeFolderName(nextName);
        if (!trimmedName) {
            alert('Folder name cannot be empty.');
            return;
        }

        if (findFolderIndexByName(trimmedName, folderIndex) >= 0) {
            alert('A folder with that name already exists.');
            return;
        }

        folder.name = trimmedName;
        saveFolders();
        displayFolders();
        populateLibraryUploadFolders();
        displayLibrary();
        if (currentFolderIndex === folderIndex && !folderDetailSection.classList.contains('hidden')) {
            openFolderDetail(folderIndex);
        }
        addActivity(`Renamed folder to ${trimmedName}`);
    }

    function scheduleActivitySave() {
        if (activitySaveTimer) {
            clearTimeout(activitySaveTimer);
        }
        activitySaveTimer = setTimeout(function () {
            localStorage.setItem(LOCAL_STORAGE_ACTIVITY, JSON.stringify(activityLog));
            activitySaveTimer = null;
        }, 120);
    }

    function addActivity(message, metadata = {}) {
        activityLog.unshift({ message, time: new Date(), ...metadata });
        if (activityLog.length > MAX_ACTIVITY_ITEMS) {
            activityLog.length = MAX_ACTIVITY_ITEMS;
        }
        scheduleActivitySave();
        displayRecentActivity();
    }
    window.addActivity = addActivity;

    function getAccountEvents() {
        try {
            const events = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ACCOUNT_EVENTS) || '[]');
            return Array.isArray(events) ? events : [];
        } catch (error) {
            console.error('Unable to parse account events:', error);
            return [];
        }
    }

    function saveAccountEvents(events) {
        localStorage.setItem(LOCAL_STORAGE_ACCOUNT_EVENTS, JSON.stringify((events || []).slice(0, 80)));
    }

    function addAccountEvent(type, username, detail = '') {
        const events = getAccountEvents();
        events.unshift({
            id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            type,
            username: username || 'Unknown',
            detail,
            createdAt: new Date().toISOString()
        });
        saveAccountEvents(events);
        displayAdminLogs();
    }

    function displayRecentActivity() {
        if (!recentActivityList) return;

        recentActivityList.innerHTML = '';
        if (activityLog.length === 0) {
            recentActivityList.innerHTML = '<p class="empty-activity">No activity yet. Start by adding tasks or uploading material.</p>';
            return;
        }

        const taskIds = new Set(tasks.map(task => task.id));
        recentActivityList.innerHTML = activityLog.map((item, index) => {
            const canViewTask = item.type === 'task'
                ? findTaskIndexByActivity(item) >= 0
                : Boolean(item.taskId && taskIds.has(item.taskId));
            const canViewFile = item.fileId
                ? findUploadedFileIndex(item.fileId) >= 0
                : (typeof item.fileIndex === 'number' && Boolean(uploadedFiles[item.fileIndex]));
            const canView = canViewTask || canViewFile;
            const timeLabel = item.time instanceof Date
                ? item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
            <div class="activity-item">
                <div class="activity-main">
                    <span class="activity-message">${item.message}</span>
                    <span class="activity-time">${timeLabel}</span>
                </div>
                ${canView ? `<button class="activity-view-btn" data-activity-index="${index}">View</button>` : ''}
            </div>`;
        }).join('');
    }

    function getStoredUsers() {
        const stored = localStorage.getItem(LOCAL_STORAGE_USERS);
        if (!stored) return [];
        try {
            const parsed = JSON.parse(stored) || [];
            return parsed
                .filter(user => user && user.username)
                .map(user => ({
                    ...user,
                    email: user.email || '',
                    status: (user.status || 'ACTIVE').toUpperCase(),
                    createdAt: user.createdAt || new Date().toLocaleDateString(),
                    createdAtIso: user.createdAtIso || user.createdAt || '',
                    lastLoginAt: user.lastLoginAt || '',
                    loginCount: Number(user.loginCount || 0),
                    failedAttempts: Number(user.failedAttempts || 0),
                    role: (user.role || user.type || (String(user.username).toLowerCase() === 'admin' ? 'ADMIN' : 'STUDENT')).toUpperCase()
                }));
        } catch (error) {
            console.error('Unable to parse stored users:', error);
            return [];
        }
    }

    function saveStoredUsers(users) {
        localStorage.setItem(LOCAL_STORAGE_USERS, JSON.stringify(users));
        if (contributorsGrid) {
            setTimeout(displayMembers, 0);
        }
    }

    function syncCurrentUser(updatedUser) {
        Object.assign(currentUser, updatedUser);
        localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify(currentUser));
        setTopAccountPanel();
    }

    function populateProfileForm() {
        if (!profileNameInput || !profileCourseSelect) return;
        profileNameInput.value = currentUser?.name || currentUser?.username || '';
        profileCourseSelect.value = currentUser?.discipline || 'CE';
        if (profilePictureName) {
            profilePictureName.textContent = currentUser?.profilePicture ? 'Current photo saved' : 'Keep current photo';
        }
    }

    function initStoredUsers() {
        const users = getStoredUsers();
        const currentUsernameKey = currentUsername.toLowerCase();
        const mergedUsersByName = new Map();

        users.forEach(user => {
            const usernameKey = String(user.username || '').toLowerCase();
            if (!usernameKey) return;
            if (DEMO_ACCOUNT_USERNAMES.has(usernameKey) && usernameKey !== currentUsernameKey) return;
            mergedUsersByName.set(usernameKey, user);
        });

        if (currentUser?.username) {
            const currentKey = currentUser.username.toLowerCase();
            mergedUsersByName.set(currentKey, {
                ...mergedUsersByName.get(currentKey),
                ...currentUser,
                role: currentUser.role || 'STUDENT'
            });
        }

        const mergedUsers = Array.from(mergedUsersByName.values());
        if (JSON.stringify(mergedUsers) !== JSON.stringify(users)) {
            saveStoredUsers(mergedUsers);
        }
        return mergedUsers;
    }

    function deleteStoredUser(username) {
        const users = getStoredUsers();
        const deletedUser = users.find(user => user.username.toLowerCase() === username.toLowerCase());
        const filtered = users.filter(user => user.username.toLowerCase() !== username.toLowerCase());
        saveStoredUsers(filtered);
        addAccountEvent('ACCOUNT_DELETED', username, deletedUser ? `Removed ${deletedUser.role || 'STUDENT'} account` : 'Removed account');
        displayAccountList();
        displayAdminLogs();
        displayMembers();
    }

    function updateStoredUserRole(username, nextRole) {
        const users = getStoredUsers();
        const userIndex = users.findIndex(user => user.username.toLowerCase() === username.toLowerCase());
        if (userIndex === -1) return;

        const currentRole = (users[userIndex].role || 'STUDENT').toUpperCase();
        const adminUsers = users.filter(user => (user.role || 'STUDENT').toUpperCase() === 'ADMIN');
        if (currentRole === 'ADMIN' && nextRole !== 'ADMIN' && adminUsers.length <= 1) {
            alert('Cannot demote the last admin account.');
            return;
        }

        users[userIndex].role = nextRole;
        saveStoredUsers(users);
        addAccountEvent('ROLE_UPDATED', username, `Changed role from ${currentRole} to ${nextRole}`);

        if (currentUsername.toLowerCase() === username.toLowerCase()) {
            syncCurrentUser(users[userIndex]);
        }

        displayAccountList();
        displayAdminLogs();
        displayMembers();
    }

    function updateAdminMetrics(accounts) {
        const totalEl = document.getElementById('admin-total-accounts');
        const adminEl = document.getElementById('admin-count-admin');
        const studentEl = document.getElementById('admin-count-student');
        const facultyEl = document.getElementById('admin-count-faculty');
        if (!totalEl || !adminEl || !studentEl) return;

        const adminCount = accounts.filter(account => (account.role || account.type || 'STUDENT').toUpperCase() === 'ADMIN').length;
        const facultyCount = accounts.filter(account => (account.role || account.type || 'STUDENT').toUpperCase() === 'FACULTY').length;
        const studentCount = accounts.filter(account => (account.role || account.type || 'STUDENT').toUpperCase() === 'STUDENT').length;

        totalEl.textContent = accounts.length;
        adminEl.textContent = adminCount;
        studentEl.textContent = studentCount;
        if (facultyEl) facultyEl.textContent = facultyCount;
    }

    function displayAccountList() {
        if (!accountListContainer) return;
        if (!isAdmin) {
            accountListContainer.innerHTML = '<p class="empty-accounts">Only admins can view registered accounts.</p>';
            return;
        }
        accountListContainer.innerHTML = '';

        const accounts = initStoredUsers();
        if (accounts.length === 0) {
            accountListContainer.innerHTML = '<p class="empty-accounts">No registered accounts found yet.</p>';
            return;
        }

        accountListContainer.innerHTML = accounts.map(function (account) {
            const role = (account.role || account.type || 'STUDENT').toUpperCase();
            const permissions = role === 'ADMIN'
                ? ['Manage Accounts', 'View Reports', 'Upload Materials', 'Create Tasks']
                : ['View Tasks', 'Upload Files', 'Submit Problems'];

            return `
                <div>
                    <h4>${escapeHtml(account.username)}</h4>
                    <p>${escapeHtml(account.name || account.username)}</p>
                    <div class="permission-list">
                        ${permissions.map(permission => `<span class="permission-chip">${escapeHtml(permission)}</span>`).join('')}
                    </div>
                </div>
                <div class="account-meta">
                    <span class="account-role ${role === 'ADMIN' ? 'role-admin' : 'role-student'}">${escapeHtml(role)}</span>
                    <button class="account-role-toggle-btn" data-username="${escapeHtml(account.username)}" data-next-role="${role === 'ADMIN' ? 'STUDENT' : 'ADMIN'}">
                        <span class="material-icons">swap_horiz</span>
                    </button>
                    <button class="account-delete-btn" data-username="${escapeHtml(account.username)}"><span class="material-icons">delete</span></button>
                </div>
            `;
        }).map(function (markup) {
            return `<div class="account-item">${markup}</div>`;
        }).join('');

        updateAdminMetrics(accounts);
    }

    /*
     * Default LIGHT, not dark.
     *
     * This was the cause of the unreadable text across the workspace, and it is
     * worth spelling out because the symptom looks nothing like the cause.
     *
     * `body.dark-theme` was applied to every visitor on their first load. But
     * the launch styles at the end of styles.css paint every panel white with
     * `!important` regardless of the theme, so the class said dark while the
     * page rendered light. Around sixty rules across ten stylesheets key off
     * that class and set near-white text for a dark surface that is not there —
     * `coe-contrast.css` alone forces every h1..h6 inside a panel to #f0e6e2,
     * which is why announcement titles were showing at a contrast ratio of 1.23
     * against the white card behind them. Effectively invisible.
     *
     * The class now matches what is actually on screen. The toggle still works;
     * only the starting value changed, and a visitor who has already chosen a
     * theme keeps their choice.
     */
    function loadSavedTheme() {
        applyTheme(localStorage.getItem('coeTheme') || 'light');
    }

    function applyTheme(theme) {
        const selectedTheme = theme === 'light' ? 'light' : 'dark';
        document.body.classList.toggle('dark-theme', selectedTheme === 'dark');
        document.body.classList.toggle('light-theme', selectedTheme === 'light');
        localStorage.setItem('coeTheme', selectedTheme);
        updateThemeLabel();
    }

    function toggleTheme() {
        applyTheme(document.body.classList.contains('dark-theme') ? 'light' : 'dark');
    }

    function updateThemeLabel() {
        if (!themeToggleBtn) return;
        themeToggleBtn.textContent = document.body.classList.contains('dark-theme') ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }

    function renderHomeStats() {
        if (!homeTodoStats.total || !homeTodoStats.pending || !homeTodoStats.completed) return;
        homeTodoStats.total.textContent = homeTodos.length;
        homeTodoStats.pending.textContent = homeTodos.filter(todo => !todo.completed).length;
        homeTodoStats.completed.textContent = homeTodos.filter(todo => todo.completed).length;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function priorityLabelClass(priority) {
        return priority === 'High' ? 'priority-high' : priority === 'Low' ? 'priority-low' : 'priority-normal';
    }

    function displayHomeTodos() {
        if (!homeTodoList || !homeCompletedList) {
            renderHomeStats();
            displayHomeDashboardStats();
            return;
        }
        homeTodoList.innerHTML = '';
        homeCompletedList.innerHTML = '';

        renderHomeStats();
        displayHomeDashboardStats();

        const activeTodos = homeTodos
            .map((todo, index) => ({ ...todo, index }))
            .filter(todo => !todo.completed);
        const completedTodos = homeTodos
            .map((todo, index) => ({ ...todo, index }))
            .filter(todo => todo.completed);

        function createTodoCard(todo) {
            return `
                <div class="todo-item-main">
                    <label class="todo-item-label">
                        <input type="checkbox" data-index="${todo.index}" ${todo.completed ? 'checked' : ''}>
                        <span class="todo-item-text ${todo.completed ? 'completed' : ''}">${escapeHtml(todo.text)}</span>
                    </label>
                    <div class="todo-item-meta">
                        <span class="todo-meta-date">Due ${formatDate(todo.dueDate)}</span>
                        <span class="todo-priority ${priorityLabelClass(todo.priority)}">${escapeHtml(todo.priority)}</span>
                    </div>
                </div>
                <button class="todo-delete-btn" data-index="${todo.index}">Delete</button>
            `;
        }

        if (activeTodos.length === 0) {
            homeTodoList.innerHTML = '<p class="empty-tasks">No active tasks yet. Add a task to start your day.</p>';
        } else {
            homeTodoList.innerHTML = activeTodos.map(function (todo) {
                return `<div class="todo-item">${createTodoCard(todo)}</div>`;
            }).join('');
        }

        if (completedTodos.length === 0) {
            homeCompletedList.innerHTML = '<p class="empty-tasks">No completed tasks yet.</p>';
        } else {
            homeCompletedList.innerHTML = completedTodos.map(function (todo) {
                return `<div class="todo-item">${createTodoCard(todo)}</div>`;
            }).join('');
        }
    }

    /*
     * `buildContributorLeaderboard` and a second `displayMembers` used to sit
     * here. Both were dead: a later `function displayMembers()` declaration
     * further down this file shadows this one entirely, so the leaderboard has
     * never rendered — the same trap that produced the two commented-out
     * `displayMembers` stubs earlier in the file.
     *
     * Worth removing rather than renaming. It drew each account's username,
     * name, discipline and role into #contributors-grid, which contradicts the
     * promise printed at the top of that page: "No account details are shown
     * anywhere on this page." Left in place, reordering the two declarations —
     * or deleting the wrong one — would have started leaking names.
     */

    if (homeTodoDateInput) {
        homeTodoDateInput.value = new Date().toISOString().split('T')[0];
    }

    homeTodoForm?.addEventListener('submit', function (event) {
        event.preventDefault();

        const text = homeTodoInput?.value.trim();
        const dueDate = homeTodoDateInput?.value;
        const priority = homeTodoPrioritySelect?.value || 'Normal';
        if (!text || !dueDate) return;

        homeTodos.push({ text, dueDate, priority, completed: false });
        saveHomeTodos();
        if (homeTodoInput) homeTodoInput.value = '';
        if (homeTodoDateInput) homeTodoDateInput.value = new Date().toISOString().split('T')[0];
        if (homeTodoPrioritySelect) homeTodoPrioritySelect.value = 'Normal';
        displayHomeTodos();
    });

    profileForm?.addEventListener('submit', function (event) {
        event.preventDefault();
        const nextName = profileNameInput?.value.trim();
        const nextCourse = profileCourseSelect?.value || 'CE';
        if (!nextName) return;

        function commitProfile(profilePicture = currentUser.profilePicture || '') {
            const users = getStoredUsers();
            const userIndex = users.findIndex(user => user.username.toLowerCase() === currentUsername.toLowerCase());
            if (userIndex === -1) return;

            const updatedUser = {
                ...users[userIndex],
                name: nextName,
                discipline: nextCourse,
                profilePicture
            };

            users[userIndex] = updatedUser;
            saveStoredUsers(users);
            syncCurrentUser(updatedUser);
            populateProfileForm();
            profilePictureInput.value = '';
            if (profilePictureName) profilePictureName.textContent = updatedUser.profilePicture ? 'Current photo saved' : 'Keep current photo';
            alert('Profile updated successfully.');
        }

        const selectedImage = profilePictureInput?.files?.[0];
        if (!selectedImage) {
            commitProfile();
            return;
        }

        const reader = new FileReader();
        reader.onload = function () {
            commitProfile(reader.result);
        };
        reader.onerror = function () {
            alert('Could not read the selected profile picture.');
        };
        reader.readAsDataURL(selectedImage);
    });

    adminCreateAccountForm?.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!isAdmin) {
            alert('Admin access only.');
            return;
        }

        const username = adminCreateUsernameInput?.value.trim();
        const name = adminCreateNameInput?.value.trim();
        const password = adminCreatePasswordInput?.value.trim();
        const course = adminCreateCourseSelect?.value || 'CE';
        const role = adminCreateRoleSelect?.value || 'STUDENT';

        if (!username || !name || !password) {
            alert('Please complete all account fields.');
            return;
        }

        const normalizedUsername = username.startsWith('@') ? username : `@${username}`;
        const users = getStoredUsers();
        if (users.some(user => user.username.toLowerCase() === normalizedUsername.toLowerCase())) {
            alert('That username already exists.');
            return;
        }

        users.push({
            id: `user-${Date.now()}`,
            username: normalizedUsername,
            password,
            role,
            name,
            discipline: course,
            email: '',
            status: 'ACTIVE',
            createdAt: new Date().toLocaleDateString(),
            createdAtIso: new Date().toISOString(),
            lastLoginAt: '',
            loginCount: 0,
            failedAttempts: 0
        });

        saveStoredUsers(users);
        addAccountEvent('ACCOUNT_CREATED', normalizedUsername, `Admin created ${role} account`);
        displayAccountList();
        displayAdminLogs();
        adminCreateAccountForm.reset();
        alert(`Account ${normalizedUsername} created successfully.`);
    });

    folderBackBtn.addEventListener('click', function () {
        folderDetailSection.classList.add('hidden');
        folderSection.classList.remove('hidden');
    });

    function openFolderDetail(folderIndex) {
        const folder = folders[folderIndex];
        if (!folder) return;

        currentFolderIndex = folderIndex;
        folderDetailTitle.textContent = folder.name;
        folderDetailList.innerHTML = '';

        const filesInFolder = uploadedFiles
            .map((file, index) => ({ ...file, index }))
            .filter(file => file.folderIndex === folderIndex);

        if (filesInFolder.length === 0) {
            folderDetailList.innerHTML = '<p class="empty-folder-detail">No files inside this folder yet.</p>';
        } else {
            folderDetailList.innerHTML = filesInFolder.map(function (file) {
                const ownerActions = canManageUploadedFile(file)
                    ? `
                        <button class="edit-file-btn" data-index="${file.index}">Edit</button>
                        <button class="delete-file-btn" data-index="${file.index}">Delete</button>
                    `
                    : '';
                return `
                    <div class="folder-detail-item-info">
                        <h4>${escapeHtml(file.name || 'Untitled File')}</h4>
                        <p>Course: ${file.discipline || 'Unknown'} • ${file.type || 'Unknown'} • ${Math.round(file.size / 1024)} KB</p>
                    </div>
                    <div class="folder-detail-actions">
                        <button class="review-file-btn" data-index="${file.index}">Review</button>
                        ${ownerActions}
                    </div>
                `;
                folderDetailList.appendChild(item);
            });

            folderDetailList.querySelectorAll('.review-file-btn').forEach(button => {
                button.addEventListener('click', function () {
                    const fileIndex = parseInt(this.getAttribute('data-index'), 10);
                    openFilePreviewModal(fileIndex);
                });
            });

            folderDetailList.querySelectorAll('.edit-file-btn').forEach(button => {
                button.addEventListener('click', function () {
                    const fileIndex = parseInt(this.getAttribute('data-index'), 10);
                    openEditFileModal(fileIndex);
                });
            });

            folderDetailList.querySelectorAll('.delete-file-btn').forEach(button => {
                button.addEventListener('click', function () {
                    const fileIndex = parseInt(this.getAttribute('data-index'), 10);
                    deleteUploadedFile(fileIndex);
                    openFolderDetail(folderIndex);
                });
            });
        }

        folderSection.classList.add('hidden');
        folderDetailSection.classList.remove('hidden');
    }

    function openFilePreviewModal(fileIndex) {
        const uploaded = uploadedFiles[fileIndex];
        if (!uploaded) return;

        previewFileName.textContent = uploaded.name;
        previewFileDetails.textContent = `Course: ${uploaded.discipline || 'Unknown'} • Folder: ${folders[uploaded.folderIndex] ? folders[uploaded.folderIndex].name : 'Unknown'} | Type: ${uploaded.type || 'Unknown'} | Uploaded: ${uploaded.lastModified}`;
        if (uploaded.previewType === 'image' && uploaded.content) {
            previewFileContent.innerHTML = `<img src="${uploaded.content}" alt="${uploaded.name}" style="max-width:100%;max-height:420px;display:block;margin:0 auto;border-radius:12px;">`;
        } else if (uploaded.previewType === 'link' && uploaded.externalUrl) {
            previewFileContent.innerHTML = `<a href="${uploaded.externalUrl}" target="_blank" rel="noopener noreferrer">Open Google Drive Link</a>`;
        } else {
            previewFileContent.textContent = uploaded.content || 'No preview available for this file type.';
        }
        filePreviewModal.style.display = 'block';
    }

    function openEditFileModal(fileIndex) {
        const uploaded = uploadedFiles[fileIndex];
        if (!uploaded) return;
        if (!canManageUploadedFile(uploaded)) {
            alert('Only the uploader or an admin can edit this material.');
            return;
        }

        editingFileIndex = fileIndex;
        editUploadDisciplineSelect.value = uploaded.discipline || 'CE';
        editUploadLessonInput.value = uploaded.lesson || 'General';
        editFileNameDisplay.textContent = `Current file: ${uploaded.name}`;
        editFileUploadInput.value = '';
        editCameraUploadInput.value = '';
        if (editSelectedFileName) editSelectedFileName.textContent = 'No file selected';
        editFileModal.style.display = 'block';
    }

    function deleteUploadedFile(fileIndex) {
        if (!uploadedFiles[fileIndex]) return;
        if (!canManageUploadedFile(uploadedFiles[fileIndex])) {
            alert('Only the uploader or an admin can delete this material.');
            return;
        }
        if (!confirm('Are you sure you want to delete this uploaded file?')) return;

        const [removed] = uploadedFiles.splice(fileIndex, 1);
        // Drop the body too, or a deleted video keeps its disk space forever.
        if (removed?.id) window.CoeLibraryStorage?.removeContent(removed.id);
        saveFiles();
        displayLibrary();
        if (currentFolderIndex !== null && !folderDetailSection.classList.contains('hidden')) {
            openFolderDetail(currentFolderIndex);
        }
    }

    window.openFilePreviewModalFromScripts = function (fileIndex) {
        openFilePreviewModal(fileIndex);
    };

    window.openEditFileModalFromScripts = function (fileIndex) {
        openEditFileModal(fileIndex);
    };

    window.deleteUploadedFileFromScripts = function (fileIndex) {
        deleteUploadedFile(fileIndex);
        if (window.enhancedLibrary) {
            window.enhancedLibrary.displayMaterialCards(window.currentFolderId);
            window.enhancedLibrary.updateLibraryStats();
            window.enhancedLibrary.updateBookmarksList();
        }
        displayMembers();
    };

    // --- Library helpers: attach listeners, bookmarks, actions ---
    function attachLibraryCardListeners() {
        if (!libraryList) return;
        libraryList.querySelectorAll('.view-file-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                openMaterialDetail(idx);
            });
        });
        libraryList.querySelectorAll('.download-file-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                downloadLibraryFile(idx);
            });
        });
        libraryList.querySelectorAll('.favorite-file-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                toggleFavoriteFile(idx);
            });
        });
        libraryList.querySelectorAll('.comment-file-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                commentLibraryFile(idx);
            });
        });
        libraryList.querySelectorAll('.edit-file-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                openEditFileModal(idx);
            });
        });
        libraryList.querySelectorAll('.delete-file-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                deleteUploadedFile(idx);
            });
        });
    }

    function downloadLibraryFile(index) {
        const uploaded = uploadedFiles[index];
        if (!uploaded) return;
        if (uploaded.externalUrl) {
            window.open(uploaded.externalUrl, '_blank');
        } else if (typeof uploaded.content === 'string' && uploaded.content.startsWith('data:')) {
            const link = document.createElement('a');
            link.href = uploaded.content;
            link.download = uploaded.name || uploaded.title || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else if (uploaded.content) {
            const blob = new Blob([uploaded.content], { type: uploaded.fileType || 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = uploaded.name || uploaded.title || 'download.txt';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            alert('Download unavailable for this material.');
            return;
        }
        uploaded.downloads = Number(uploaded.downloads || 0) + 1;
        saveFiles();
        displayLibrary();
    }

    function toggleFavoriteFile(index) {
        const uploaded = uploadedFiles[index];
        if (!uploaded) return;
        uploaded.favorite = !uploaded.favorite;
        saveFiles();
        displayLibrary();
    }

    function commentLibraryFile(index) {
        const uploaded = uploadedFiles[index];
        if (!uploaded) return;
        const commentText = prompt('Add a comment for this material:', '');
        if (!commentText) return;
        uploaded.comments = Array.isArray(uploaded.comments) ? uploaded.comments : [];
        uploaded.comments.push({
            text: commentText.trim(),
            author: currentUser.name || currentUsername || 'Guest',
            time: new Date().toISOString()
        });
        saveFiles();
        displayLibrary();
        addActivity(`Commented on ${uploaded.title || uploaded.name}`, { type: 'file', fileId: uploaded.id });
    }

    function populateLibraryFilterOptions() {
        if (!libraryFilterSubject || !libraryFilterLesson || !libraryFilterTag) return;

        const subjects = Array.from(new Set(uploadedFiles.map(f => (f.subject || '').trim()).filter(Boolean))).sort();
        const lessons = Array.from(new Set(uploadedFiles.map(f => (f.lesson || '').trim()).filter(Boolean))).sort();
        const tags = Array.from(new Set(uploadedFiles.flatMap(f => Array.isArray(f.tags) ? f.tags : []).map(tag => String(tag || '').trim()).filter(Boolean))).sort();

        const preserveValue = (select, value) => {
            const previous = value || select.value;
            select.innerHTML = `<option value="">${select === libraryFilterSubject ? 'All Subjects' : select === libraryFilterLesson ? 'All Lessons' : 'All Tags'}</option>` + (select === libraryFilterSubject ? subjects : select === libraryFilterLesson ? lessons : tags).map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
            if (previous && Array.from(select.options).some(opt => opt.value === previous)) {
                select.value = previous;
            }
        };

        preserveValue(libraryFilterSubject, libraryFilterSubject.value);
        preserveValue(libraryFilterLesson, libraryFilterLesson.value);
        preserveValue(libraryFilterTag, libraryFilterTag.value);
    }

    const LOCAL_STORAGE_BOOKMARKS = 'coeLibraryBookmarks';
    let bookmarks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BOOKMARKS) || '[]');

    function saveBookmarks() {
        localStorage.setItem(LOCAL_STORAGE_BOOKMARKS, JSON.stringify(bookmarks));
        renderBookmarks();
    }

    function renderBookmarks() {
        const container = document.getElementById('bookmarks-list');
        if (!container) return;
        if (!bookmarks.length) {
            container.innerHTML = '<p class="empty-state">No bookmarks yet</p>';
            return;
        }
        container.innerHTML = bookmarks.map(b => {
            return `<div class="bookmark-item"><button class="bookmark-open" data-index="${b.index}">${escapeHtml(b.title)}</button></div>`;
        }).join('');
        container.querySelectorAll('.bookmark-open').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                openMaterialDetail(idx);
            });
        });
    }

    function toggleBookmark(index) {
        if (typeof index !== 'number') {
            const idxInput = document.getElementById('detail-material-index');
            index = idxInput ? Number(idxInput.value || -1) : -1;
        }
        if (typeof index !== 'number' || index < 0) return;
        const existing = bookmarks.find(b => b.index === index);
        if (existing) {
            bookmarks = bookmarks.filter(b => b.index !== index);
        } else {
            const file = uploadedFiles[index];
            if (!file) return;
            bookmarks.push({ index, title: file.name || 'Untitled' });
        }
        saveBookmarks();
        alert('Bookmark updated.');
    }

    function toggleMaterialComplete(index) {
        if (typeof index !== 'number') {
            const idxInput = document.getElementById('detail-material-index');
            index = idxInput ? Number(idxInput.value || -1) : -1;
        }
        const file = uploadedFiles[index];
        if (!file) return;
        file.completed = !file.completed;
        saveFiles();
        displayLibrary();
    }

    function downloadMaterial() {
        const idx = Number(document.getElementById('detail-material-index')?.value || -1);
        const file = uploadedFiles[idx];
        if (!file) return alert('File not found');
        if (file.previewType === 'link' && file.externalUrl) {
            window.open(file.externalUrl, '_blank');
            return;
        }
        if (!file.content) return alert('No downloadable content available.');
        const a = document.createElement('a');
        a.href = file.content;
        a.download = file.name || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function generatePreviewNotes() {
        const idx = Number(document.getElementById('detail-material-index')?.value || -1);
        const file = uploadedFiles[idx];
        const result = document.getElementById('preview-notes-result');
        if (!file || !result) return;
        result.textContent = 'Reading preview...';
        setTimeout(() => {
            result.textContent = 'Preview notes: ' + (String(file.content || '').slice(0, 180) || 'No readable preview available.');
        }, 600);
    }

    function openMaterialDetail(index) {
        const uploaded = uploadedFiles[index];
        const modal = document.getElementById('material-detail-modal');
        if (!uploaded || !modal) return;
        document.getElementById('detail-material-title').textContent = uploaded.name || 'Untitled';
        document.getElementById('detail-material-metadata').textContent = [uploaded.discipline || 'N/A', uploaded.subject || '', uploaded.professorName || '', uploaded.lesson || ''].filter(Boolean).join(' | ');
        document.getElementById('detail-type').textContent = uploaded.type || 'Unknown';
        document.getElementById('detail-lesson').textContent = uploaded.lesson || '';
        document.getElementById('detail-subject').textContent = uploaded.subject || '';
        document.getElementById('detail-date').textContent = uploaded.uploadedAt || uploaded.lastModified || '';
        document.getElementById('detail-uploader').textContent = uploaded.uploadedBy || uploaded.ownerUsername || '';
        document.getElementById('detail-views').textContent = uploaded.views || 0;
        document.getElementById('detail-preview').innerHTML = uploaded.previewType === 'image' ? `<img src="${uploaded.content}" style="max-width:100%;border-radius:8px;">` : (uploaded.previewType === 'link' ? `<a href="${uploaded.externalUrl}" target="_blank">Open link</a>` : `<pre style="white-space:pre-wrap">${escapeHtml(String(uploaded.content || 'No preview'))}</pre>`);
        // store index for actions
        let idxInput = document.getElementById('detail-material-index');
        if (!idxInput) {
            idxInput = document.createElement('input');
            idxInput.type = 'hidden';
            idxInput.id = 'detail-material-index';
            modal.querySelector('.material-detail-content').appendChild(idxInput);
        }
        idxInput.value = String(index);
        modal.style.display = 'block';
    }


    // Render bookmarks on load
    renderBookmarks();

    function loadSavedState() {
        const savedTasks = localStorage.getItem(LOCAL_STORAGE_TASKS);
        const savedFiles = localStorage.getItem(LOCAL_STORAGE_FILES);
        const savedActivity = localStorage.getItem(LOCAL_STORAGE_ACTIVITY);
        const savedFolders = localStorage.getItem(LOCAL_STORAGE_FOLDERS);
        const savedHomeTodos = localStorage.getItem(LOCAL_STORAGE_HOME_TODOS);

        if (savedTasks) {
            try {
                let shouldPersistTasks = false;
                JSON.parse(savedTasks).forEach(savedTask => {
                    const beforeNormalize = JSON.stringify(savedTask);
                    tasks.push(normalizeTaskRecord(savedTask));
                    if (beforeNormalize !== JSON.stringify(savedTask)) {
                        shouldPersistTasks = true;
                    }
                });
                if (shouldPersistTasks) {
                    saveTasks();
                }
            } catch (error) {
                console.error('Unable to load saved tasks:', error);
            }
        }

        if (savedFiles) {
            try {
                let shouldPersistFiles = false;
                JSON.parse(savedFiles).forEach(savedFile => {
                    const beforeNormalize = JSON.stringify(savedFile);
                    uploadedFiles.push(normalizeUploadedFileRecord(savedFile));
                    if (beforeNormalize !== JSON.stringify(savedFile)) {
                        shouldPersistFiles = true;
                    }
                });
                if (shouldPersistFiles) {
                    saveFiles();
                }
            } catch (error) {
                console.error('Unable to load saved files:', error);
            }
        }

        if (savedFolders) {
            try {
                JSON.parse(savedFolders).forEach(savedFolder => folders.push(savedFolder));
            } catch (error) {
                console.error('Unable to load saved folders:', error);
            }
        }

        if (savedHomeTodos) {
            try {
                JSON.parse(savedHomeTodos).forEach(savedTodo => homeTodos.push(savedTodo));
            } catch (error) {
                console.error('Unable to load saved home to-dos:', error);
            }
        }

        if (savedActivity) {
            try {
                JSON.parse(savedActivity).forEach(savedItem => {
                    activityLog.push({
                        ...savedItem,
                        time: savedItem.time ? new Date(savedItem.time) : new Date()
                    });
                });
            } catch (error) {
                console.error('Unable to load saved activity:', error);
            }
        }
    }

    function clearLoadedState() {
        tasks.length = 0;
        uploadedFiles.length = 0;
        folders.length = 0;
        homeTodos.length = 0;
        activityLog.length = 0;
        currentFolderIndex = null;
    }

    function saveTasks() {
        localStorage.setItem(LOCAL_STORAGE_TASKS, JSON.stringify(tasks));
    }

    /**
     * Persist the library.
     *
     * SPLIT STORAGE
     * -------------
     * localStorage holds the file LIST, because every read path in the app is
     * synchronous and expects it to be there on page load. IndexedDB holds the
     * heavy `content` payloads, because localStorage caps out at roughly 5 MB
     * per origin and base64 inflates a file by ~37% - a single video lecture
     * is larger than the entire quota.
     *
     * A previous attempt at this split was reverted because nothing put the
     * content back on read, so files saved fine and then opened empty. The
     * read path exists now: CoeLibraryStorage keeps a synchronous mirror of
     * the store, and getAllLibraryFiles() / hydrateLibraryContent() below put
     * the content back onto the records. `contentRef` marks the rows whose
     * body lives in IndexedDB so hydration knows which ones to fill.
     *
     * Quota failures are still possible for the metadata itself. They are
     * reported rather than thrown, and the entry that would not fit is rolled
     * back so memory matches disk.
     *
     * @returns {boolean} true when the write succeeded
     */
    function saveFiles() {
        const store = window.CoeLibraryStorage;
        const canOffload = Boolean(store?.isAvailable());

        // Metadata-only copies. The originals in `uploadedFiles` keep their
        // content, so anything already on screen carries on working.
        const buildRow = function (file) {
            const content = typeof file.content === 'string' ? file.content : '';
            const heavy = canOffload && content.length > LIBRARY_CONTENT_OFFLOAD_BYTES && file.previewType !== 'link';

            if (!heavy) {
                return Object.assign({}, file, { contentRef: '' });
            }

            store.putContent(file.id, content, file.previewType);
            return Object.assign({}, file, { content: '', contentRef: 'idb' });
        };

        let rows = uploadedFiles.map(buildRow);

        try {
            localStorage.setItem(LOCAL_STORAGE_FILES, JSON.stringify(rows));
            return true;
        } catch (error) {
            const isQuota =
                error && (error.name === 'QuotaExceededError' ||
                          error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                          error.code === 22 || error.code === 1014);

            console.error('[library] could not save files', error);

            // Shed the newest entries until what remains fits, so the array in
            // memory always matches what is actually stored.
            let restored = false;
            while (uploadedFiles.length > 0 && !restored) {
                const dropped = uploadedFiles.pop();
                if (dropped?.id && canOffload) store.removeContent(dropped.id);
                rows = uploadedFiles.map(buildRow);
                try {
                    localStorage.setItem(LOCAL_STORAGE_FILES, JSON.stringify(rows));
                    restored = true;
                } catch (retryError) {
                    /* keep shedding */
                }
            }

            if (isQuota) {
                const usedMb = Math.round((JSON.stringify(rows).length / 1048576) * 10) / 10;
                window.showLibraryToast?.(
                    'Upload failed - browser storage is full',
                    `The material list holds about ${usedMb} MB and this browser allows roughly 5 MB. ` +
                    'Delete some materials first.',
                    'error'
                );
            } else {
                window.showLibraryToast?.('Upload failed', 'The material could not be saved.', 'error');
            }

            return false;
        }
    }

    /**
     * Put IndexedDB content back onto the in-memory records after boot.
     *
     * loadSavedState() runs synchronously from localStorage, so at that point
     * every offloaded record has an empty `content`. Once the store's cache
     * has filled, fill them in and re-render whichever library view is up.
     */
    function hydrateLibraryContent() {
        const store = window.CoeLibraryStorage;
        if (!store?.isAvailable()) return;

        store.ready().then(function () {
            let filled = 0;
            uploadedFiles.forEach(function (file) {
                if (file.content || !file.contentRef) return;
                const content = store.getCachedContent(file.id);
                if (!content) return;
                file.content = content;
                filled += 1;
            });

            if (!filled) return;
            displayLibrary();
        }).catch(function (error) {
            console.warn('[library] stored file contents could not be loaded', error);
        });
    }

    /**
     * Reject a file that cannot fit before it is read.
     *
     * Content lives in localStorage, which browsers cap at roughly 5 MB per
     * origin, and base64 inflates a file by about 37%. Checking here means the
     * user gets a specific message instead of watching the browser read a
     * large file only for the write to fail afterwards.
     */
    /* =====================================================================
       RESTORED HELPERS - UPLOAD, FOLDERS, TASKS
       ---------------------------------------------------------------------
       WHY THIS BLOCK EXISTS

       An earlier clean-up replaced a large span of this file with the
       "// Removed old ..." comments around line 3940, but the functions were
       never put back. Everything below was still being *called*.

       The first one to bite was line 3813:

           smartRefreshBtn?.addEventListener('click', refreshDashboard);

       #smart-refresh-btn exists in index.html, so the optional chain does not
       short-circuit and `refreshDashboard` is evaluated -> ReferenceError.
       That throw happened inside this single DOMContentLoaded callback, so
       every statement after it was abandoned - including the two upload
       submit listeners at the bottom of the file. The upload modal opened and
       the Upload button did nothing at all, for every file type.

       Reconstructed from their call sites: behaviour is equivalent rather
       than byte-identical to the originals.
       ===================================================================== */

    // --- Dashboard -------------------------------------------------------

    function refreshDashboard() {
        displayFolders();
        populateLibraryUploadFolders();
        displayLibrary();
        displayTaskSummary();
        displayHomeTodos();
        renderHomeUploadProgress();
        renderHomeReviewQueue();
        renderHomeSchedule();
        renderCalendarDashboard();
        syncDashboardNotifications();
        displayMembers();
        displayHomeDashboardStats();
        renderAnnouncements();
        displayAccountList();
        displayRecentActivity();
        window.showLibraryToast?.('Workspace refreshed', 'Everything is up to date.', 'info');
    }

    // --- Folders ---------------------------------------------------------

    function saveFolders() {
        localStorage.setItem(LOCAL_STORAGE_FOLDERS, JSON.stringify(folders));
    }

    function populateLibraryUploadFolders() {
        if (!libraryUploadFolderSelect) return;

        const previous = libraryUploadFolderSelect.value;
        libraryUploadFolderSelect.innerHTML =
            '<option value="">No folder</option>' +
            folders.map(function (folder, index) {
                return `<option value="${index}">${escapeHtml(folder.name)}</option>`;
            }).join('');

        if (previous && folders[parseInt(previous, 10)]) {
            libraryUploadFolderSelect.value = previous;
        }
    }

    /**
     * Which plain folder the library upload page is aiming at.
     *
     * A name typed into #library-upload-folder-name wins, and creates the
     * folder when it does not exist yet, so a user is never told "choose a
     * folder first" after naming one. Otherwise the hidden select is used.
     * Returns -1 when there is no plain-folder target at all, which is the
     * normal case for a tree folder upload (those carry a folderId instead).
     */
    function resolveLibraryUploadFolderIndex() {
        const typedName = normalizeFolderName(libraryUploadFolderNameInput?.value || '');

        if (typedName) {
            let index = findFolderIndexByName(typedName);
            if (index < 0) {
                folders.push({ name: typedName });
                saveFolders();
                displayFolders();
                index = folders.length - 1;
                populateLibraryUploadFolders();
                addActivity(`Created folder: ${typedName}`);
            }
            return index;
        }

        const selected = parseInt(libraryUploadFolderSelect?.value ?? '', 10);
        return Number.isNaN(selected) ? -1 : selected;
    }

    // --- Library folder ids ----------------------------------------------

    /**
     * Split a tree folder id into its parts.
     *
     * enhanced-library.js owns the id format, so its parser is used when it is
     * loaded (it is, both files are deferred and this only runs on click). The
     * fallback below covers the case where that file failed to load, so an
     * upload still lands somewhere sensible instead of throwing.
     */
    function parseLibraryFolderId(folderId) {
        const empty = {
            course: '', courseLabel: '', yearShort: '', year: '',
            subject: '', category: '', lesson: '',
            professorKey: '', professorName: '', isProfessorLibrary: false
        };

        if (!folderId || folderId === 'all') return empty;

        if (typeof window.parseFolderParts === 'function') {
            try {
                return Object.assign({}, empty, window.parseFolderParts(folderId) || {});
            } catch (error) {
                console.warn('[library] folder id could not be parsed by the library parser', error);
            }
        }

        // Fallback: COURSE-Year-Subject[-__prof__-Key][-Category][-__lesson__-Lesson]
        const knownCategories = ['Reference Books', 'Handouts', 'Video Lectures', 'Lessons', 'GDrive Links'];
        const parts = String(folderId).split('-');
        const professorMarkerIndex = parts.indexOf(LIBRARY_PROFESSOR_FOLDER_MARKER);
        const lessonMarkerIndex = parts.indexOf('__lesson__');
        const lastPart = parts[parts.length - 1];
        const hasCategory = knownCategories.includes(lastPart);

        // A lesson folder sits inside a category, so the segment before the
        // marker may be one. Kept in step with parseFolderParts in
        // enhanced-library.js, which is the parser this normally delegates to.
        const categoryBeforeLesson = lessonMarkerIndex > 2 &&
            knownCategories.includes(parts[lessonMarkerIndex - 1])
                ? parts[lessonMarkerIndex - 1]
                : '';

        const subjectEnd = professorMarkerIndex > -1
            ? professorMarkerIndex
            : (lessonMarkerIndex > -1
                ? (categoryBeforeLesson ? lessonMarkerIndex - 1 : lessonMarkerIndex)
                : (hasCategory ? parts.length - 1 : undefined));

        const yearShort = parts[1] || '';
        let professorKey = '';
        if (professorMarkerIndex > -1) {
            const tail = parts.slice(professorMarkerIndex + 1, hasCategory ? -1 : undefined).join('-');
            try {
                professorKey = decodeURIComponent(tail);
            } catch (error) {
                professorKey = tail;
            }
        }

        return Object.assign({}, empty, {
            course: parts[0] || '',
            yearShort,
            year: yearShort ? `${yearShort} Year` : '',
            subject: parts.length > 2 ? parts.slice(2, subjectEnd).join('-') : '',
            category: categoryBeforeLesson || (hasCategory ? lastPart : ''),
            lesson: lessonMarkerIndex > -1 ? parts.slice(lessonMarkerIndex + 1).join('-') : '',
            professorKey,
            professorName: professorKey,
            isProfessorLibrary: professorMarkerIndex > -1
        });
    }

    /** Human-readable destination, used in toasts and the activity log. */
    function formatLibraryFolderLabel(folderId) {
        if (!folderId || folderId === 'all') return '';

        const parts = parseLibraryFolderId(folderId);
        const label = [
            parts.courseLabel || parts.course,
            parts.year,
            parts.subject,
            parts.professorName,
            parts.category,
            parts.lesson
        ].filter(Boolean).join(' / ');

        return label || String(folderId);
    }

    /**
     * Whose professor folder an upload belongs to.
     *
     * Inside a professor folder the folder wins, so a material dropped into
     * "Engr. Cruz" is filed under Engr. Cruz whoever uploaded it. Outside one,
     * a faculty uploader is credited so their own folder appears in the tree.
     */
    function getProfessorInfoForUpload(folderId, metadata = {}) {
        const parts = parseLibraryFolderId(folderId);

        const info = {
            course: parts.course || metadata.course || '',
            year: parts.year || metadata.year || '',
            subject: parts.subject || metadata.subject || '',
            professorName: parts.professorName || '',
            professorUsername: parts.professorKey || ''
        };

        if (!info.professorUsername && currentRole === 'FACULTY') {
            info.professorName = currentUser?.name || currentUsername || 'Faculty';
            info.professorUsername = currentUsername || '';
        }

        return info;
    }

    // --- Upload metadata -------------------------------------------------

    /** True while the full-page upload composer is the visible panel. */
    function isLibraryUploadPageActive() {
        const panel = document.querySelector('.page-panel[data-page="library-upload"]');
        return Boolean(panel && !panel.classList.contains('hidden'));
    }

    /** Broad file kind, from the mime type first and the extension second. */
    function getUploadDisplayType(fileName, fileType) {
        const mime = String(fileType || '').toLowerCase();
        const extension = String(fileName || '').split('.').pop().toLowerCase();

        if (mime === 'link') return 'Google Drive Link';
        if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(extension)) return 'Video';
        if (mime === 'application/pdf' || extension === 'pdf') return 'PDF';
        if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) return 'Image';
        if (['ppt', 'pptx'].includes(extension)) return 'Presentation';
        if (['xls', 'xlsx', 'csv'].includes(extension)) return 'Spreadsheet';
        return 'Document';
    }

    /** The shelf a file belongs on when nothing else has said. */
    function getDefaultMaterialCategory(displayType) {
        if (displayType === 'Video') return 'Video Lectures';
        if (displayType === 'Google Drive Link') return 'GDrive Links';
        if (displayType === 'Image') return 'Lessons';
        return 'Handouts';
    }

    /**
     * What the upload composer currently says.
     *
     * Read once per submit and passed down, never re-read per file. A batch
     * upload navigates to the library as soon as it finishes, and other
     * renders can move the page underneath a still-running read - so the
     * second file in a batch would find an empty form and lose its title,
     * course and tags.
     */
    function readUploadComposerFields() {
        const read = function (input) { return String(input?.value || '').trim(); };

        return {
            course: read(libraryUploadCourseSelect),
            year: read(libraryUploadYearSelect),
            subject: read(document.getElementById('library-upload-subject')),
            lesson: read(libraryUploadLessonPageInput),
            materialCategory: read(libraryUploadMaterialCategorySelect),
            version: read(libraryUploadVersionInput),
            tags: read(libraryUploadTagsInput).split(',').map(function (tag) { return tag.trim(); }).filter(Boolean),
            title: read(libraryUploadTitleInput),
            description: read(libraryUploadDescriptionInput)
        };
    }

    const EMPTY_COMPOSER_FIELDS = {
        course: '', year: '', subject: '', lesson: '', materialCategory: '',
        version: '', tags: [], title: '', description: ''
    };

    /**
     * Everything the library record needs that is not on the File itself.
     *
     * `composer` is a snapshot from readUploadComposerFields(). Without one,
     * the fields are read only while the upload page is actually showing: the
     * quick modal has no title or tags of its own, and pulling stale values
     * out of a hidden form is how a PDF ends up wearing the name of the last
     * thing somebody uploaded.
     *
     * Note what is NOT decided here: when the upload targets a tree folder,
     * uploadMaterialToLibrary overwrites course/year/subject/materialCategory
     * with the folder's own values. That is what makes a file land in the
     * folder it was uploaded from rather than in a shelf picked from its
     * extension - a video dropped into Handouts stays in Handouts.
     */
    function getUploadMetadata(fileName, fileType, composer) {
        const fields = composer ||
            (isLibraryUploadPageActive() ? readUploadComposerFields() : EMPTY_COMPOSER_FIELDS);
        const displayType = getUploadDisplayType(fileName, fileType);
        const baseName = String(fileName || '').replace(/\.[^.]+$/, '');

        return {
            course: fields.course || 'CE',
            year: fields.year,
            subject: fields.subject,
            lesson: fields.lesson || 'General',
            materialCategory: fields.materialCategory || getDefaultMaterialCategory(displayType),
            version: fields.version || localDayKey(),
            tags: Array.isArray(fields.tags) ? fields.tags.slice() : [],
            title: fields.title,
            description: fields.description,
            displayType,
            standardizedName: fields.title || baseName || String(fileName || '')
        };
    }

    /**
     * Called just before a submit is read.
     *
     * Fills in the defaults the composer leaves blank and records which attach
     * button opened the picker, because the link record's type depends on it.
     */
    function prepareComposerMetadata(source) {
        if (libraryUploadVersionInput && !libraryUploadVersionInput.value.trim()) {
            libraryUploadVersionInput.value = localDayKey();
        }

        if (libraryLinkPickerModal && source) {
            libraryLinkPickerModal.dataset.source = source;
        }

        if (source === 'create' && libraryUploadMaterialCategorySelect && !libraryUploadMaterialCategorySelect.value) {
            libraryUploadMaterialCategorySelect.value = 'Lessons';
        }
    }

    // --- Link picker -----------------------------------------------------

    function isSafeExternalLink(value) {
        try {
            const url = new URL(String(value || '').trim());
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    function openLibraryLinkPicker(source) {
        if (!libraryLinkPickerModal) return;

        const copy = {
            drive: { title: 'Insert files using Google Drive', icon: 'add_to_drive', help: 'or drag files to upload to <strong>My Drive</strong> and select' },
            youtube: { title: 'Insert a YouTube video', icon: 'smart_display', help: 'Paste the full watch link.' },
            notebook: { title: 'Insert a notebook link', icon: 'article', help: 'Paste the shared notebook address.' },
            gem: { title: 'Insert a study link', icon: 'link', help: 'Paste the study material address.' },
            link: { title: 'Insert a link', icon: 'link', help: 'Paste a full http or https address.' }
        };
        const chosen = copy[source] || copy.link;

        libraryLinkPickerModal.dataset.source = source || 'link';
        if (libraryLinkPickerTitle) libraryLinkPickerTitle.textContent = chosen.title;
        if (libraryLinkPickerIcon) libraryLinkPickerIcon.textContent = chosen.icon;
        if (libraryLinkPickerHelp) libraryLinkPickerHelp.innerHTML = chosen.help;
        if (libraryLinkPickerUrlInput) libraryLinkPickerUrlInput.value = libraryUploadDriveLinkInput?.value || '';

        libraryLinkPickerModal.classList.remove('hidden');
        libraryLinkPickerModal.setAttribute('aria-hidden', 'false');
        libraryLinkPickerUrlInput?.focus();
    }

    function closeLibraryLinkPicker() {
        if (!libraryLinkPickerModal) return;
        libraryLinkPickerModal.classList.add('hidden');
        libraryLinkPickerModal.setAttribute('aria-hidden', 'true');
    }

    function attachLibraryLinkFromPicker() {
        const value = String(libraryLinkPickerUrlInput?.value || '').trim();

        if (!isSafeExternalLink(value)) {
            window.showLibraryToast?.('That link is not valid', 'Use a full http or https address.', 'error');
            return;
        }

        if (libraryUploadDriveLinkInput) libraryUploadDriveLinkInput.value = value;
        if (libraryUploadFileInput) libraryUploadFileInput.value = '';
        if (libraryUploadCameraInput) libraryUploadCameraInput.value = '';
        if (libraryUploadFileName) libraryUploadFileName.textContent = value;

        prepareComposerMetadata(libraryLinkPickerModal?.dataset.source || 'link');
        closeLibraryLinkPicker();
    }

    // --- Selected file names ---------------------------------------------

    function updateSelectedSolutionFileName() {
        const file = getSelectedFile(solutionUploadInput, solutionCameraUploadInput);
        if (selectedFileName) selectedFileName.textContent = file ? file.name : 'No file selected';
    }

    function updateProblemPhotoFileName() {
        const file = getSelectedFile(problemPhotoUploadInput, problemPhotoCameraUploadInput);
        if (problemPhotoFileName) problemPhotoFileName.textContent = file ? file.name : 'No photo selected';
    }

    function updateUploadFileName() {
        const file = getSelectedFile(fileUploadInput, cameraUploadInput);
        if (uploadFileName) uploadFileName.textContent = file ? file.name : 'No file selected';
    }

    function updateEditUploadFileName() {
        const file = getSelectedFile(editFileUploadInput, editCameraUploadInput);
        if (editSelectedFileName) editSelectedFileName.textContent = file ? file.name : 'No file selected';
    }

    function updateLibraryUploadPageFileName() {
        if (!libraryUploadFileName) return;

        const picked = libraryUploadFileInput?.files;
        if (picked && picked.length) {
            libraryUploadFileName.textContent = Array.from(picked).map(function (file) { return file.name; }).join(', ');
            return;
        }

        const camera = getSelectedFile(libraryUploadCameraInput);
        libraryUploadFileName.textContent = camera ? camera.name : 'No file selected';
    }

    // --- Activity lookups ------------------------------------------------

    function findTaskIndexByActivity(activity) {
        if (!activity) return -1;

        if (activity.taskId) {
            const byId = tasks.findIndex(function (task) { return task.id === activity.taskId; });
            if (byId >= 0) return byId;
        }

        if (activity.taskTitle) {
            return tasks.findIndex(function (task) {
                return String(task.title || '') === String(activity.taskTitle);
            });
        }

        return -1;
    }

    function findUploadedFileIndex(fileId) {
        if (!fileId) return -1;
        return uploadedFiles.findIndex(function (file) { return file.id === fileId; });
    }

    // --- Home to-dos -----------------------------------------------------

    function saveHomeTodos() {
        localStorage.setItem(LOCAL_STORAGE_HOME_TODOS, JSON.stringify(homeTodos));
    }

    // --- Tasks -----------------------------------------------------------

    /** Fill in the fields task rendering assumes are present. Mutates in place. */
    function normalizeTaskRecord(task) {
        if (!task || typeof task !== 'object') return task;

        if (!task.id) task.id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (!Array.isArray(task.submissions)) task.submissions = [];

        task.discipline = task.discipline || 'CE';
        task.topic = task.topic || '';
        task.lesson = task.lesson || 'General';
        task.title = task.title || 'Untitled Problem';
        task.notes = task.notes || '';
        task.answer = task.answer || '';
        task.fileName = task.fileName || task.attachmentName || '';
        task.attachmentName = task.attachmentName || task.fileName || 'No attachment';
        task.attachmentContent = task.attachmentContent || '';
        task.attachmentPreviewType = task.attachmentPreviewType || 'text';
        task.attachmentFileType = task.attachmentFileType || '';
        task.problemPhotoContent = task.problemPhotoContent || '';
        task.problemPhotoPreviewType = task.problemPhotoPreviewType || 'text';
        task.ownerUsername = task.ownerUsername || '';

        return task;
    }

    /** Comparable form of an answer, so spacing and case never fail a match. */
    function normalizeAnswerForChecking(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[.,;:]+$/, '');
    }

    /** The signed-in student's own submission for a task, if any. */
    function getTaskSubmission(task) {
        const key = String(currentUsername || '').toLowerCase();
        if (!key) return null;

        const submissions = Array.isArray(task?.submissions) ? task.submissions : [];
        return submissions.find(function (submission) {
            return String(submission.username || '').toLowerCase() === key;
        }) || null;
    }

    /** Markup, not text: the call sites drop this straight into a template. */
    function getSubmissionStatusLabel(submission) {
        if (!submission) return '<span class="task-status-chip pending">Not submitted</span>';
        return submission.correct
            ? '<span class="task-status-chip correct">Correct</span>'
            : '<span class="task-status-chip wrong">Needs review</span>';
    }

    function getTaskAttachmentLabel(task) {
        return task?.attachmentName || task?.fileName || 'No attachment';
    }

    function getTaskSubmissionSummary(task) {
        const submissions = Array.isArray(task?.submissions) ? task.submissions : [];
        if (!submissions.length) return 'No submissions yet.';

        const correct = submissions.filter(function (submission) { return submission.correct; }).length;
        return `${submissions.length} submitted | ${correct} correct | ${submissions.length - correct} to review`;
    }

    /** Admins see every task; a student sees the ones for their own course. */
    function isStudentAssignedTask(task) {
        if (isAdmin) return true;
        if (!task?.discipline) return true;

        const course = currentUser?.discipline || currentUser?.course || '';
        if (!course) return true;

        return String(task.discipline).toUpperCase() === String(course).toUpperCase();
    }

    /* ---------------------------------------------------------------------
       RESTORED HELPERS
       These three were lost when an earlier edit removed a larger span than
       intended. They are reconstructed from their call sites, so behaviour is
       equivalent rather than byte-identical to the originals.
       --------------------------------------------------------------------- */

    /** First file across the given inputs, or null. */
    function getSelectedFile() {
        for (let i = 0; i < arguments.length; i += 1) {
            const input = arguments[i];
            const file = input && input.files && input.files[0];
            if (file) return file;
        }
        return null;
    }

    /**
     * Every file across the given inputs.
     *
     * #library-upload-file is marked `multiple`, so picking a term's worth of
     * lecture PDFs in one go is the obvious thing to do - but the submit
     * handler only ever read files[0], and the rest were dropped without a
     * word. This is what lets all of them through.
     */
    function getSelectedFiles() {
        const picked = [];
        for (let i = 0; i < arguments.length; i += 1) {
            const input = arguments[i];
            if (input && input.files) picked.push(...Array.from(input.files));
        }
        return picked;
    }

    /**
     * Read a file into something the library can preview.
     *
     * Text, images, PDFs and video are read as data URLs so they can be shown
     * back without a server. Anything else stores a placeholder — the metadata
     * is still useful even when the preview is not.
     */
    function readFileForPreview(file, onComplete) {
        if (!file) {
            onComplete({ content: '', previewType: 'text', fileType: '' });
            return;
        }

        const extension = (file.name.split('.').pop() || '').toLowerCase();
        const textTypes = ['txt', 'md', 'json', 'js', 'css', 'html', 'csv', 'xml'];
        const isText = (file.type || '').startsWith('text/') || textTypes.indexOf(extension) > -1;
        const isImage = (file.type || '').startsWith('image/');
        const isPdf = file.type === 'application/pdf' || extension === 'pdf';
        const isVideo = (file.type || '').startsWith('video/');

        if (!isText && !isImage && !isPdf && !isVideo) {
            onComplete({
                content: 'Preview not available for this file type.',
                previewType: 'text',
                fileType: file.type || extension
            });
            return;
        }

        const reader = new FileReader();

        reader.onload = function () {
            onComplete({
                content: reader.result,
                previewType: isImage ? 'image' : (isPdf ? 'pdf' : (isVideo ? 'video' : 'text')),
                fileType: file.type || extension
            });
        };

        reader.onerror = function () {
            console.error('[library] could not read', file.name, reader.error);
            window.showLibraryToast?.('Could not read that file', file.name, 'error');
            onComplete({ content: '', previewType: 'text', fileType: file.type || extension });
        };

        // Data URL for everything: it survives a JSON round-trip into storage,
        // which readAsText would not for binary formats.
        reader.readAsDataURL(file);
    }

    /**
     * Fill in every field the library expects, so downstream code never has to
     * guard against a missing property.
     */
    function normalizeUploadedFileRecord(record) {
        const source = record || {};
        const now = new Date();

        return Object.assign({}, source, {
            id: source.id || ('file-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8)),
            folderId: source.folderId || '',
            folderIndex: typeof source.folderIndex === 'number' ? source.folderIndex : -1,
            folderName: source.folderName || '',
            name: source.name || source.originalName || 'Untitled',
            originalName: source.originalName || source.name || 'Untitled',
            title: source.title || source.name || source.originalName || 'Untitled',
            description: source.description || '',
            discipline: source.discipline || 'CE',
            year: source.year || '',
            subject: source.subject || '',
            lesson: source.lesson || 'General',
            materialCategory: source.materialCategory || 'Handouts',
            version: source.version || now.toISOString().slice(0, 10),
            tags: Array.isArray(source.tags) ? source.tags : [],
            professorName: source.professorName || '',
            professorUsername: source.professorUsername || '',
            type: source.type || 'Document',
            fileType: source.fileType || '',
            size: Number(source.size || 0),
            comments: Array.isArray(source.comments) ? source.comments : [],
            favorite: Boolean(source.favorite),
            uploadedAt: source.uploadedAt || now.toISOString(),
            lastModified: source.lastModified || now.toLocaleString(),
            uploadedBy: source.uploadedBy || 'COE user',
            ownerUsername: source.ownerUsername || '',
            content: source.content || '',
            previewType: source.previewType || 'text',
            externalUrl: source.externalUrl || '',
            accessLevel: source.accessLevel || 'Shared with all users',
            downloads: Number(source.downloads || 0),
            views: Number(source.views || 0)
        });
    }
    function canStoreFile(file) {
        if (!file) return { ok: true };

        const mb = function (size) { return Math.round((size / 1048576) * 10) / 10; };

        // With IndexedDB the file body never touches localStorage, so the ~5 MB
        // origin quota does not apply to it - only the metadata row does. This
        // is what lets a video lecture be uploaded at all; the old ceiling
        // rejected every real video before it was even read.
        if (window.CoeLibraryStorage?.isAvailable()) {
            if (file.size > LIBRARY_MAX_FILE_BYTES) {
                return {
                    ok: false,
                    message:
                        `"${file.name}" is ${mb(file.size)} MB. The limit is ` +
                        `${mb(LIBRARY_MAX_FILE_BYTES)} MB per file. Compress it, or share it as a ` +
                        'Google Drive or YouTube link instead.'
                };
            }
            return { ok: true };
        }

        let used = 0;
        try {
            used = (localStorage.getItem(LOCAL_STORAGE_FILES) || '').length;
        } catch (error) {
            used = 0;
        }

        // 4.5 MB ceiling leaves headroom for the other keys sharing the quota.
        const projected = used + Math.ceil(file.size * 1.37);

        if (projected > 4.5 * 1048576) {
            return {
                ok: false,
                message:
                    `"${file.name}" is ${mb(file.size)} MB. The library already uses ` +
                    `${mb(used)} MB and this browser allows about 5 MB in total, and this ` +
                    'browser has no IndexedDB support to fall back on. Delete some materials ' +
                    'first, or upload a smaller file.'
            };
        }

        return { ok: true };
    }
    function uploadMaterialToLibrary({ folderIndex, course, subject, lessonName, file, onComplete }) {
        const uploadMetadata = getUploadMetadata(file.name, file.type);
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const textTypes = ['txt', 'md', 'json', 'js', 'css', 'html', 'csv', 'xml'];
        const isText = file.type.startsWith('text/') || textTypes.includes(fileExtension);
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf' || fileExtension === 'pdf';
        const isVideo = file.type.startsWith('video/');

        function addUploadedFile(content) {
            const uploadedFile = normalizeUploadedFileRecord({
                folderIndex,
                folderId,
                folderName: folderId ? formatLibraryFolderLabel(folderId) : (folders[folderIndex]?.name || 'Unknown'),
                discipline: uploadMetadata.course || course,
                year: uploadMetadata.year,
                subject: uploadMetadata.subject || subject || '',
                lesson: uploadMetadata.lesson || lessonName,
                materialCategory: uploadMetadata.materialCategory,
                version: uploadMetadata.version,
                tags: uploadMetadata.tags,
                name: uploadMetadata.standardizedName || file.name,
                originalName: file.name,
                title: uploadMetadata.standardizedName || file.name,
                type: uploadMetadata.displayType || file.type || fileExtension,
                fileType: file.type || fileExtension,
                size: file.size,
                lastModified: new Date(file.lastModified).toLocaleString(),
                uploadedAt: new Date().toISOString(),
                uploadedBy: currentUser.name || currentUser.username || 'Admin',
                content: content || 'Preview not available for this file type.',
                previewType: isImage ? 'image' : (isPdf ? 'pdf' : (isVideo ? 'video' : 'text')),
                ownerUsername: currentUsername,
                accessLevel: 'Shared with all users'
            });
            uploadedFiles.push(uploadedFile);
            const uploadedFileIndex = uploadedFiles.length - 1;

            saveFiles();
            addActivity(`Uploaded file: ${file.name} to ${folderId ? formatLibraryFolderLabel(folderId) : folders[folderIndex].name}`, { type: 'file', fileIndex: uploadedFileIndex, fileId: uploadedFile.id });
            displayLibrary();
            if (typeof onComplete === 'function') onComplete();
        }

        if (isText || isImage || isPdf || isVideo) {
            const reader = new FileReader();
            reader.onload = function () {
                addUploadedFile(reader.result);
            };
            reader.onerror = function () {
                addUploadedFile('Unable to load preview content.');
            };
            if (isImage) {
                reader.readAsDataURL(file);
            } else if (isPdf || isVideo) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
            return;
        }

        addUploadedFile('Preview not available for this file type.');
    }

    solutionUploadInput.addEventListener('change', updateSelectedSolutionFileName);
    solutionCameraUploadInput.addEventListener('change', updateSelectedSolutionFileName);
    problemPhotoUploadInput?.addEventListener('change', updateProblemPhotoFileName);
    problemPhotoCameraUploadInput?.addEventListener('change', updateProblemPhotoFileName);
    fileUploadInput.addEventListener('change', updateUploadFileName);
    cameraUploadInput.addEventListener('change', updateUploadFileName);
    editFileUploadInput.addEventListener('change', updateEditUploadFileName);
    editCameraUploadInput.addEventListener('change', updateEditUploadFileName);
    libraryUploadFileInput?.addEventListener('change', updateLibraryUploadPageFileName);
    libraryUploadCameraInput?.addEventListener('change', updateLibraryUploadPageFileName);
    libraryLinkSourceButtons.forEach(button => {
        button.addEventListener('click', function () {
            openLibraryLinkPicker(this.dataset.linkSource || 'drive');
        });
    });
    libraryCreateAttachmentBtn?.addEventListener('click', function () {
        prepareComposerMetadata('create');
        if (libraryUploadDriveLinkInput) libraryUploadDriveLinkInput.value = '';
        if (libraryUploadFileInput) libraryUploadFileInput.value = '';
        if (libraryUploadCameraInput) libraryUploadCameraInput.value = '';
        if (libraryUploadFileName) libraryUploadFileName.textContent = 'Class material draft';
        libraryUploadDescriptionInput?.focus();
    });
    libraryLinkPickerCloseBtn?.addEventListener('click', closeLibraryLinkPicker);
    libraryLinkPickerCancelBtn?.addEventListener('click', closeLibraryLinkPicker);
    libraryLinkPickerAddBtn?.addEventListener('click', attachLibraryLinkFromPicker);
    libraryLinkPickerModal?.addEventListener('click', function (event) {
        if (event.target === libraryLinkPickerModal) closeLibraryLinkPicker();
    });
    libraryLinkPickerUrlInput?.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            attachLibraryLinkFromPicker();
        }
    });

    newProblemForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!isAdmin) {
            alert('Only admins can create tasks.');
            return;
        }
        const selectedSolutionFile = getSelectedFile(solutionUploadInput, solutionCameraUploadInput);
        const selectedProblemPhoto = getSelectedFile(problemPhotoUploadInput, problemPhotoCameraUploadInput);
        if (!selectedSolutionFile) {
            alert('Please choose a file or take a photo for the solution before submitting.');
            return;
        }

        readFileForPreview(selectedSolutionFile, function (attachment) {
            if (selectedProblemPhoto) {
                readFileForPreview(selectedProblemPhoto, finishTaskSave);
            } else {
                finishTaskSave({ content: '', previewType: 'text', fileType: '' });
            }

            function finishTaskSave(problemPhoto) {
                const task = {
                    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    discipline: disciplineSelect.value,
                    topic: topicInput.value.trim(),
                    lesson: 'General',
                    title: document.getElementById('problem-title').value.trim(),
                    notes: document.getElementById('problem-notes').value.trim(),
                    answer: document.getElementById('final-answer').value.trim(),
                    fileName: selectedSolutionFile.name,
                    attachmentName: selectedSolutionFile.name,
                    problemPhotoContent: problemPhoto.content,
                    problemPhotoPreviewType: problemPhoto.previewType,
                    attachmentContent: attachment.content,
                    attachmentPreviewType: attachment.previewType,
                    attachmentFileType: attachment.fileType,
                    ownerUsername: currentUsername
                };

                // --- Shared board ------------------------------------------
                //
                // The whole class needs to see a published task, so it goes to
                // the server and returns through `assignment:created`.
                if (window.CoeBoard?.ready) {
                    window.CoeBoard.postTask(task)
                        .then(function () {
                            newProblemForm.reset();
                            problemPhotoCameraUploadInput.value = '';
                            solutionCameraUploadInput.value = '';
                            topicInput.value = '';
                            selectedFileName.textContent = 'No file selected';
                            if (problemPhotoFileName) problemPhotoFileName.textContent = 'No photo selected';
                            window.showLibraryToast?.('Task published', 'Every student in the course can see it now.', 'success');
                        })
                        .catch(function (error) {
                            window.showLibraryToast?.('Could not publish', error.message || 'Try again.', 'error');
                        });
                    return;
                }

                tasks.push(normalizeTaskRecord(task));
                saveTasks();
                addActivity(`Saved problem: ${task.title || 'Untitled Problem'}`, {
                    type: 'task',
                    taskId: task.id,
                    taskTitle: task.title || 'Untitled Problem',
                    taskOwnerUsername: task.ownerUsername
                });
                displayTaskSummary();

                newProblemForm.reset();
                problemPhotoCameraUploadInput.value = '';
                solutionCameraUploadInput.value = '';
                topicInput.value = '';
                selectedFileName.textContent = 'No file selected';
                if (problemPhotoFileName) problemPhotoFileName.textContent = 'No photo selected';
                alert('Problem saved successfully and added to your task summary.');
            }
        });
    });

    // Open Add Folder Modal
    addFolderBtn.addEventListener('click', function () {
        addFolderModal.style.display = 'block';
    });

    // Close Add Folder Modal
    closeFolderModalBtn.addEventListener('click', function () {
        addFolderModal.style.display = 'none';
    });

    // Close File Upload Modal
    closeUploadModalBtn.addEventListener('click', function () {
        uploadFileModal.style.display = 'none';
    });

    // Close File Preview Modal
    closePreviewModalBtn.addEventListener('click', function () {
        filePreviewModal.style.display = 'none';
    });

    closeTaskPostModalBtn?.addEventListener('click', function () {
        taskPostModal.style.display = 'none';
    });

    // Close modal if user clicks outside of it
    window.addEventListener('click', function (event) {
        if (event.target === addFolderModal) {
            addFolderModal.style.display = 'none';
        } else if (event.target === uploadFileModal) {
            uploadFileModal.style.display = 'none';
        } else if (event.target === filePreviewModal) {
            filePreviewModal.style.display = 'none';
        } else if (event.target === taskPostModal) {
            taskPostModal.style.display = 'none';
        } else if (event.target === editFileModal) {
            editFileModal.style.display = 'none';
        }
    });

    closeEditModalBtn.addEventListener('click', function () {
        editFileModal.style.display = 'none';
    });

    editFileForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (editingFileIndex === null || !uploadedFiles[editingFileIndex]) return;

        const fileRecord = uploadedFiles[editingFileIndex];
        fileRecord.discipline = editUploadDisciplineSelect.value;
        fileRecord.lesson = editUploadLessonInput.value.trim() || 'General';

        function finalizeEdit() {
            saveFiles();
            displayLibrary();
            if (currentFolderIndex !== null && !folderSection.classList.contains('hidden')) {
                openFolderDetail(currentFolderIndex);
            } else if (currentFolderIndex !== null && !folderDetailSection.classList.contains('hidden')) {
                openFolderDetail(currentFolderIndex);
            }
            editFileModal.style.display = 'none';
        }

        const selectedReplacementFile = getSelectedFile(editFileUploadInput, editCameraUploadInput);
        if (!selectedReplacementFile) {
            finalizeEdit();
            return;
        }

        const file = selectedReplacementFile;
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const textTypes = ['txt', 'md', 'json', 'js', 'css', 'html', 'csv', 'xml'];
        const isText = file.type.startsWith('text/') || textTypes.includes(fileExtension);
        const isImage = file.type.startsWith('image/');

        fileRecord.name = file.name;
        fileRecord.type = file.type || fileExtension;
        fileRecord.size = file.size;
        fileRecord.lastModified = new Date(file.lastModified).toLocaleString();

        if (isText || isImage) {
            const reader = new FileReader();
            reader.onload = function () {
                fileRecord.content = reader.result;
                fileRecord.previewType = isImage ? 'image' : 'text';
                finalizeEdit();
            };
            reader.onerror = function () {
                fileRecord.content = 'Unable to load preview content.';
                fileRecord.previewType = 'text';
                finalizeEdit();
            };
            if (isImage) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
            return;
        }

        fileRecord.content = 'Preview not available for this file type.';
        fileRecord.previewType = 'text';
        finalizeEdit();
    });

    // Create new folder
    addFolderForm.addEventListener('submit', function (event) {
        event.preventDefault();

        const newFolder = {
            name: folderNameInput.value
        };

        folders.push(newFolder);
        saveFolders();
        addActivity(`Created folder: ${newFolder.name}`);
        displayFolders();
        populateLibraryUploadFolders();
        addFolderModal.style.display = 'none';
        addFolderForm.reset();
    });

    // Open File Upload Modal
    function openFileUploadModal(folderIndex) {
        uploadFileModal.style.display = 'block';
        uploadFileForm.setAttribute('data-folder-index', folderIndex);
        uploadFileForm.removeAttribute('data-folder-id');
    }

    function openLibraryUploadModal(folderId, initialFiles) {
        // Open the library upload page so users can tag files with metadata.
        if (uploadFileModal) uploadFileModal.style.display = 'none';
        pagePanels.forEach(panel => panel.classList.add('hidden'));
        const uploadPanel = document.querySelector('.page-panel[data-page="library-upload"]');
        if (uploadPanel) uploadPanel.classList.remove('hidden');
        setActiveNav('library');

        if (libraryUploadFolderIdInput) {
            libraryUploadFolderIdInput.value = folderId || '';
        }

        if (folderId) {
            const folderInfo = parseLibraryFolderId(folderId || '');
            if (libraryUploadCourseSelect && folderInfo.course) libraryUploadCourseSelect.value = folderInfo.course;
            if (libraryUploadYearSelect && folderInfo.year) libraryUploadYearSelect.value = folderInfo.year;
            if (libraryUploadMaterialCategorySelect && folderInfo.category) libraryUploadMaterialCategorySelect.value = folderInfo.category;
            if (document.getElementById('library-upload-subject')) document.getElementById('library-upload-subject').value = folderInfo.subject || '';
            if (libraryUploadLessonPageInput) libraryUploadLessonPageInput.value = folderInfo.lesson || 'General';
            // Deliberately left blank.
            //
            // This used to prefill the title with the folder it was going into
            // — "OE 025 - CHEMISTRY FOR ENGINEERS - Reference Books" — so every
            // file in a folder ended up with the same name, and a student
            // scanning the list could not tell one from another. The folder is
            // already shown above the list; the title should say what the file
            // *is*. Left empty so the placeholder prompts for a real one, and
            // uploadMaterialToLibrary falls back to the filename.
            if (libraryUploadTitleInput) {
                libraryUploadTitleInput.value = '';
                libraryUploadTitleInput.placeholder = folderInfo.lesson && folderInfo.lesson !== 'General'
                    ? `e.g. ${folderInfo.lesson} - Problem Set`
                    : 'e.g. Chapter 5 - Equilibrium Reviewer';
            }
        } else {
            if (libraryUploadCourseSelect) libraryUploadCourseSelect.value = 'CE';
            if (libraryUploadYearSelect) libraryUploadYearSelect.value = '1st Year';
            if (libraryUploadMaterialCategorySelect) libraryUploadMaterialCategorySelect.value = 'Handouts';
            if (document.getElementById('library-upload-subject')) document.getElementById('library-upload-subject').value = '';
            if (libraryUploadLessonPageInput) libraryUploadLessonPageInput.value = 'General';
            if (libraryUploadTitleInput) libraryUploadTitleInput.value = '';
        }

        if (initialFiles && initialFiles.length && libraryUploadFileInput) {
            try {
                const dt = new DataTransfer();
                initialFiles.forEach(file => dt.items.add(file));
                libraryUploadFileInput.files = dt.files;
            } catch (error) {
                console.warn('Unable to initialize dropped files', error);
            }
        }

        if (libraryUploadFileName) libraryUploadFileName.textContent = getSelectedFile(libraryUploadFileInput, libraryUploadCameraInput)?.name || 'No file selected';
        if (libraryUploadFolderNameInput) libraryUploadFolderNameInput.value = '';
        if (libraryUploadDriveLinkInput) libraryUploadDriveLinkInput.value = '';

        showUploadDestination(folderId);
    }

    /**
     * Say where the file is about to land, at the top of the form.
     *
     * The destination used to be implicit: it lived in a hidden input, and the
     * only way to know which folder you were uploading into was to remember
     * which one you had clicked. Naming it here is the difference between
     * "upload" and "upload to CE / 1st Year / Calculus / Handouts".
     */
    function showUploadDestination(folderId) {
        const pathEl = document.getElementById('up-destination-path');
        const noteEl = document.getElementById('up-destination-note');
        if (!pathEl) return;

        pathEl.textContent = formatLibraryFolderLabel(folderId) ||
            'Library (no folder chosen — pick one in the tree to file it)';

        if (!noteEl) return;

        // Tell a student up front that their upload will be queued, rather
        // than after they have waited for it to finish.
        if (window.CoeLive?.ready && window.CoeLive.isModerated()) {
            noteEl.textContent = 'Needs admin approval before others see it';
            noteEl.hidden = false;
        } else {
            noteEl.textContent = 'Visible to everyone as soon as it uploads';
            noteEl.hidden = false;
        }
    }

    window.openLibraryUploadModal = openLibraryUploadModal;

    /**
     * Add one already-built record to the library.
     *
     * upload-ui.js used to write its pasted links straight into localStorage.
     * That looked like it worked, but `uploadedFiles` in here never learned
     * about them, so the next saveFiles() from any other upload overwrote the
     * key and the link vanished. One writer, one array.
     *
     * @returns {object|null} the stored record, or null if it could not be saved
     */
    function addLibraryRecord(record, options = {}) {
        const stored = normalizeUploadedFileRecord(record);
        uploadedFiles.push(stored);

        if (!saveFiles()) {
            const index = uploadedFiles.indexOf(stored);
            if (index >= 0) uploadedFiles.splice(index, 1);
            return null;
        }

        notifyUploadEvent(stored);
        addActivity(`Uploaded file: ${stored.title || stored.name} to ${options.destinationLabel || 'Library'}`, {
            type: 'file',
            fileIndex: uploadedFiles.length - 1,
            fileId: stored.id
        });

        if (window.enhancedLibrary?.populateLibraryFolderTree) {
            window.enhancedLibrary.populateLibraryFolderTree();
            window.enhancedLibrary.populateSubjectFilter?.();
            window.enhancedLibrary.populateLessonFilter?.();
            window.enhancedLibrary.populateTagFilter?.();
        }
        displayLibrary();

        return stored;
    }

    window.addLibraryRecord = addLibraryRecord;

    /** Folder metadata for a record built outside this file. */
    window.getLibraryFolderContext = function (folderId) {
        const parts = parseLibraryFolderId(folderId);
        const professorInfo = getProfessorInfoForUpload(folderId, parts);
        return {
            folderId: folderId || '',
            folderName: formatLibraryFolderLabel(folderId),
            course: parts.course,
            year: parts.year,
            subject: parts.subject,
            category: parts.category,
            lesson: parts.lesson,
            professorName: professorInfo.professorName,
            professorUsername: professorInfo.professorUsername
        };
    };

    uploadFileForm.addEventListener('submit', function (event) {
        event.preventDefault();

        // The attribute is only set when the modal was opened from a tree
        // folder. Falling back to the folder the library is currently showing
        // is what stops an upload started from an open folder landing loose in
        // the library instead of inside it.
        const folderId = uploadFileForm.getAttribute('data-folder-id') ||
            (window.currentFolderId && window.currentFolderId !== 'all' ? window.currentFolderId : '');
        const folderIndex = parseInt(uploadFileForm.getAttribute('data-folder-index'), 10);
        const file = getSelectedFile(fileUploadInput, cameraUploadInput);

        if (!file) {
                window.showLibraryToast?.('No file selected', 'Choose a file or take a photo first.', 'error');
            return;
        }

        const modalStorageCheck = canStoreFile(file);
        if (!modalStorageCheck.ok) {
            window.showLibraryToast?.('File is too large', modalStorageCheck.message, 'error');
            return;
        }

        const lessonName = uploadLessonInput?.value.trim() || 'General';

        if (folderId) {
            uploadMaterialToLibrary({
                folderId,
                course: parseLibraryFolderId(folderId).course,
                subject: parseLibraryFolderId(folderId).subject,
                year: parseLibraryFolderId(folderId).year,
                lessonName,
                file,
                onComplete: function () {
                    window.showLibraryToast?.(`"${file.name}" uploaded`, formatLibraryFolderLabel(folderId) || 'Library', 'success');
                    uploadFileModal.style.display = 'none';
                    uploadFileForm.reset();
                    cameraUploadInput.value = '';
                    if (uploadFileName) uploadFileName.textContent = 'No file selected';
                }
            });
            return;
        }

        if (isNaN(folderIndex) || !folders[folderIndex]) {
            window.showLibraryToast?.('Nothing to upload', 'Choose a folder and a file first.', 'error');
            return;
        }

        uploadMaterialToLibrary({
            folderIndex,
            course: uploadDisciplineSelect.value,
            lessonName,
            file,
            onComplete: function () {
                window.showLibraryToast?.('Uploaded', folders[folderIndex].name, 'success');
                uploadFileModal.style.display = 'none';
                uploadFileForm.reset();
                cameraUploadInput.value = '';
                if (uploadFileName) uploadFileName.textContent = 'No file selected';
            }
        });
    });

    libraryUploadPageForm?.addEventListener('submit', function (event) {
        event.preventDefault();
        prepareComposerMetadata(libraryUploadDriveLinkInput?.value.trim() ? (libraryLinkPickerModal?.dataset.source || 'link') : '');
        // The hidden field is filled by openLibraryUploadModal(folderId). The
        // fallback covers a composer opened some other way while a folder is
        // open, so the upload still lands in the folder on screen.
        const folderId = (libraryUploadFolderIdInput?.value.trim() || '') ||
            (window.currentFolderId && window.currentFolderId !== 'all' ? window.currentFolderId : '');
        const folderIndex = resolveLibraryUploadFolderIndex();
        const selectedFiles = getSelectedFiles(libraryUploadFileInput, libraryUploadCameraInput);
        const file = selectedFiles[0] || null;
        const subject = document.getElementById('library-upload-subject')?.value.trim() || '';
        const driveLink = libraryUploadDriveLinkInput?.value.trim() || '';
        // One read of the form, reused for every file in this submit.
        const composer = readUploadComposerFields();
        const uploadMetadata = getUploadMetadata('', 'link', composer);
        if (!file && !driveLink) {
            window.showLibraryToast?.('Nothing to upload', 'Choose a file or paste a link first.', 'error');
            return;
        }

        // Fail fast, while a useful message is still possible. Without this the
        // browser reads the whole file, then storage rejects it on write.
        const oversized = selectedFiles.map(canStoreFile).find(function (check) { return !check.ok; });
        if (oversized) {
            window.showLibraryToast?.('File is too large', oversized.message, 'error');
            return;
        }

        if (driveLink && !isSafeExternalLink(driveLink)) {
            alert('Please enter a valid http or https link.');
            return;
        }

        if (driveLink && !file) {
            const professorInfo = getProfessorInfoForUpload(folderId, uploadMetadata);
            const linkSource = libraryLinkPickerModal?.dataset.source || 'link';
            const linkOriginalName = linkSource === 'youtube' ? 'YouTube Link' :
                linkSource === 'drive' ? 'Google Drive Link' :
                linkSource === 'notebook' ? 'Notebook Link' :
                linkSource === 'gem' ? 'Study Link' : 'External Link';
            const uploadedFile = normalizeUploadedFileRecord({
                folderId: folderId || undefined,
                folderIndex: folderIndex,
                folderName: folderId ? formatLibraryFolderLabel(folderId) : '',
                discipline: professorInfo.course || uploadMetadata.course || libraryUploadCourseSelect?.value || 'CE',
                year: professorInfo.year || uploadMetadata.year,
                subject: professorInfo.subject || uploadMetadata.subject || subject,
                lesson: uploadMetadata.lesson || libraryUploadLessonPageInput?.value.trim() || 'General',
                materialCategory: uploadMetadata.materialCategory,
                version: uploadMetadata.version,
                tags: uploadMetadata.tags,
                professorName: professorInfo.professorName,
                professorUsername: professorInfo.professorUsername,
                name: uploadMetadata.standardizedName || linkOriginalName,
                originalName: linkOriginalName,
                title: uploadMetadata.title || uploadMetadata.standardizedName || linkOriginalName,
                description: uploadMetadata.description || '',
                comments: [],
                favorite: false,
                type: uploadMetadata.displayType || 'Google Drive Link',
                fileType: 'link',
                size: 0,
                uploadedAt: new Date().toISOString(),
                uploadedBy: currentUser.name || currentUser.username || 'Admin',
                lastModified: new Date().toLocaleString(),
                content: driveLink,
                previewType: 'link',
                externalUrl: driveLink,
                ownerUsername: currentUsername,
                accessLevel: 'Shared with all users',
                downloads: 0
            });
            uploadedFiles.push(uploadedFile);
            const uploadedFileIndex = uploadedFiles.length - 1;
            saveFiles();
            notifyUploadEvent(uploadedFile);
            addActivity('Added Google Drive link to the library', { type: 'file', fileIndex: uploadedFileIndex, fileId: uploadedFile.id });
            if (window.enhancedLibrary?.populateLibraryFolderTree) {
                window.enhancedLibrary.populateLibraryFolderTree();
                window.enhancedLibrary.populateSubjectFilter?.();
                window.enhancedLibrary.populateLessonFilter?.();
                window.enhancedLibrary.populateTagFilter?.();
            }
            displayLibrary();
            libraryUploadPageForm.reset();
            if (libraryUploadFileName) libraryUploadFileName.textContent = 'No file selected';
            if (libraryUploadFolderNameInput) libraryUploadFolderNameInput.value = '';
            populateLibraryUploadFolders();
            showPage('library');
            window.showLibraryToast?.("Link added to the library", formatLibraryFolderLabel(folderId) || "Library", "success");
            return;
        }

        const folderParts = parseLibraryFolderId(folderId);
        const baseUploadArgs = {
            course: composer.course || 'CE',
            subject: subject,
            lessonName: composer.lesson || 'General',
            composer
        };

        /*
         * Bulk upload.
         *
         * There is no cap on how many files may go in one submit — each is its
         * own request, so the server's 20-per-batch limit is never reached —
         * but a long batch used to run silently and then claim every file had
         * been uploaded whether or not any had failed.
         *
         * `sent` and `failed` are counted from what each upload actually
         * reported, so the closing message is the truth.
         */
        const isBatch = selectedFiles.length > 1;
        const sent = [];
        const failed = [];

        function reportProgress(done) {
            if (!isBatch) return;
            window.showLibraryToast?.(
                `Uploading ${done} of ${selectedFiles.length}…`,
                formatLibraryFolderLabel(folderId) || 'Library',
                'info'
            );
        }

        function finishPageUpload() {
            libraryUploadPageForm.reset();
            libraryUploadCameraInput.value = '';
            if (libraryUploadFileName) libraryUploadFileName.textContent = 'No file selected';
            if (libraryUploadFolderNameInput) libraryUploadFolderNameInput.value = '';
            if (libraryUploadFolderIdInput) libraryUploadFolderIdInput.value = '';
            populateLibraryUploadFolders();
            showPage('library');

            const where = formatLibraryFolderLabel(folderId) || 'Library';

            if (failed.length) {
                // Name the ones that did not make it. "38 of 40" with no list
                // leaves somebody to work out which two to try again.
                window.showLibraryToast?.(
                    `${sent.length} of ${selectedFiles.length} uploaded`,
                    `Could not upload: ${failed.map(function (f) { return f.name; }).join(', ')}`,
                    'error'
                );
                return;
            }

            const pending = sent.filter(function (s) { return s.status === 'pending'; }).length;
            const headline = isBatch
                ? `${sent.length} materials uploaded`
                : `"${file.name}" uploaded`;

            window.showLibraryToast?.(
                headline,
                pending ? `${pending} waiting for approval` : where,
                pending ? 'info' : 'success'
            );
        }

        /**
         * One at a time, in order.
         *
         * uploadMaterialToLibrary reads the file, pushes the record and calls
         * saveFiles(). Firing them all at once would have several callbacks
         * writing the same array back to storage, and the last writer would
         * win - so a batch of lecture PDFs would end up as one.
         */
        function uploadNext(index) {
            if (index >= selectedFiles.length) {
                finishPageUpload();
                return;
            }

            const current = selectedFiles[index];
            reportProgress(index + 1);

            const args = Object.assign({}, baseUploadArgs, {
                file: current,
                titleSuffix: isBatch ? current.name.replace(/\.[^.]+$/, '') : '',
                quiet: isBatch,
                onComplete: function (outcome) {
                    // Older call sites pass nothing; treat that as success so a
                    // missing outcome cannot silently inflate the failed list.
                    const result = outcome || { ok: true, name: current.name };
                    (result.ok ? sent : failed).push(result);
                    uploadNext(index + 1);
                }
            });

            if (folderId) {
                uploadMaterialToLibrary(Object.assign(args, {
                    folderId,
                    course: folderParts.course || args.course,
                    subject: folderParts.subject || args.subject,
                    year: folderParts.year || uploadMetadata.year
                }));
            } else {
                uploadMaterialToLibrary(Object.assign(args, { folderIndex }));
            }
        }

        uploadNext(0);
        return;
    });

    addFolderForm.addEventListener('submit', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        const normalizedName = normalizeFolderName(folderNameInput.value);
        if (!normalizedName) {
            alert('Folder name cannot be empty.');
            return;
        }

        if (findFolderIndexByName(normalizedName) >= 0) {
            alert('A folder with that name already exists.');
            return;
        }

        folders.push({ name: normalizedName });
        saveFolders();
        addActivity(`Created folder: ${normalizedName}`);
        displayFolders();
        populateLibraryUploadFolders();
        addFolderModal.style.display = 'none';
        addFolderForm.reset();
    }, true);

    profileForm?.addEventListener('submit', function () {
        setTimeout(displayMembers, 0);
    });

    adminCreateAccountForm?.addEventListener('submit', function () {
        setTimeout(displayMembers, 0);
    });

    uploadFileForm.addEventListener('submit', function () {
        setTimeout(displayMembers, 0);
    });

    libraryUploadPageForm?.addEventListener('submit', function () {
        setTimeout(displayMembers, 0);
    });

    newProblemForm.addEventListener('submit', function () {
        setTimeout(displayMembers, 0);
    });

    function displayRecentActivity() {
        if (!recentActivityList) return;

        recentActivityList.innerHTML = '';
        if (activityLog.length === 0) {
            recentActivityList.innerHTML = '<p class="empty-activity">No activity yet. Start by adding tasks or uploading material.</p>';
            return;
        }

        const taskIds = new Set(tasks.map(task => task.id));
        recentActivityList.innerHTML = activityLog.map(function (item, index) {
            const canViewTask = item.type === 'task'
                ? findTaskIndexByActivity(item) >= 0
                : Boolean(item.taskId && taskIds.has(item.taskId));
            const canViewFile = item.fileId
                ? findUploadedFileIndex(item.fileId) >= 0
                : (typeof item.fileIndex === 'number' && Boolean(uploadedFiles[item.fileIndex]));
            const canView = canViewTask || canViewFile;
            const timeLabel = item.time instanceof Date
                ? item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="activity-item">
                    <div class="activity-main">
                        <span class="activity-message">${escapeHtml(item.message)}</span>
                        <span class="activity-time">${escapeHtml(timeLabel)}</span>
                    </div>
                    ${canView ? `<button class="activity-view-btn" data-activity-index="${index}">View</button>` : ''}
                </div>
            `;
        }).join('');
    }

    function loadSavedState() {
        const savedTasks = localStorage.getItem(LOCAL_STORAGE_TASKS);
        const savedFiles = localStorage.getItem(LOCAL_STORAGE_FILES);
        const savedActivity = localStorage.getItem(LOCAL_STORAGE_ACTIVITY);
        const savedFolders = localStorage.getItem(LOCAL_STORAGE_FOLDERS);
        const savedHomeTodos = localStorage.getItem(LOCAL_STORAGE_HOME_TODOS);

        if (savedTasks) {
            try {
                let shouldPersistTasks = false;
                JSON.parse(savedTasks).forEach(function (savedTask) {
                    const snapshot = JSON.stringify(savedTask);
                    const normalizedTask = normalizeTaskRecord({ ...savedTask });
                    tasks.push(normalizedTask);
                    if (snapshot !== JSON.stringify(normalizedTask)) {
                        shouldPersistTasks = true;
                    }
                });
                if (shouldPersistTasks) {
                    saveTasks();
                }
            } catch (error) {
                console.error('Unable to load saved tasks:', error);
            }
        }

        if (savedFiles) {
            try {
                let shouldPersistFiles = false;
                JSON.parse(savedFiles).forEach(function (savedFile) {
                    const snapshot = JSON.stringify(savedFile);
                    const normalizedFile = normalizeUploadedFileRecord({ ...savedFile });
                    uploadedFiles.push(normalizedFile);
                    if (snapshot !== JSON.stringify(normalizedFile)) {
                        shouldPersistFiles = true;
                    }
                });
                if (shouldPersistFiles) {
                    saveFiles();
                }
            } catch (error) {
                console.error('Unable to load saved files:', error);
            }
        }

        if (savedFolders) {
            try {
                JSON.parse(savedFolders).forEach(function (savedFolder) {
                    const normalizedName = normalizeFolderName(savedFolder?.name);
                    if (!normalizedName) return;
                    folders.push({ ...savedFolder, name: normalizedName });
                });
            } catch (error) {
                console.error('Unable to load saved folders:', error);
            }
        }

        if (savedHomeTodos) {
            try {
                JSON.parse(savedHomeTodos).forEach(function (savedTodo) {
                    if (!savedTodo?.text || !savedTodo?.dueDate) return;
                    homeTodos.push({
                        text: String(savedTodo.text).trim(),
                        dueDate: savedTodo.dueDate,
                        priority: savedTodo.priority || 'Normal',
                        completed: Boolean(savedTodo.completed)
                    });
                });
            } catch (error) {
                console.error('Unable to load saved home to-dos:', error);
            }
        }

        if (savedActivity) {
            try {
                JSON.parse(savedActivity).forEach(function (savedItem) {
                    activityLog.push({
                        ...savedItem,
                        time: savedItem.time ? new Date(savedItem.time) : new Date()
                    });
                });
            } catch (error) {
                console.error('Unable to load saved activity:', error);
            }
        }
    }

    function uploadMaterialToLibrary({ folderIndex, folderId, course, subject, year, lessonName, file, titleSuffix, composer, quiet, onComplete }) {
        const uploadMetadata = getUploadMetadata(file.name, file.type, composer);

        // --- Shared library ---------------------------------------------
        //
        // When the portal is served by the app server, the material goes to the
        // database so every account sees it. The local path below is kept only
        // for opening index.html straight off the filesystem, where there is no
        // server to talk to.
        if (window.CoeLive?.ready) {
            const folderInfo = parseLibraryFolderId(folderId);

            window.CoeLive.uploadMaterial({
                folder: {
                    course: folderInfo.course || uploadMetadata.course || course || 'CE',
                    year: folderInfo.year || uploadMetadata.year || year || '',
                    subject: folderInfo.subject || uploadMetadata.subject || subject || '',
                    category: folderInfo.category || uploadMetadata.materialCategory
                },
                title: (uploadMetadata.title || uploadMetadata.standardizedName || file.name) +
                    (titleSuffix ? ` - ${titleSuffix}` : ''),
                description: uploadMetadata.description,
                tags: uploadMetadata.tags,
                lesson: folderInfo.lesson || lessonName || uploadMetadata.lesson,
                professorName: getProfessorInfoForUpload(folderId, uploadMetadata).professorName,
                file
            }).then(function (result) {
                // `quiet` during a batch: forty files would otherwise raise
                // forty toasts. The caller reports once, at the end.
                if (!quiet) {
                    window.showLibraryToast?.(
                        result.status === 'pending' ? 'Sent for approval' : `"${file.name}" uploaded`,
                        result.status === 'pending'
                            ? result.message
                            : (formatLibraryFolderLabel(folderId) || 'Library'),
                        result.status === 'pending' ? 'info' : 'success'
                    );
                }
                if (typeof onComplete === 'function') {
                    onComplete({ ok: true, name: file.name, status: result.status });
                }
            }).catch(function (error) {
                if (!quiet) {
                    window.showLibraryToast?.('Upload failed', error.message || 'Try again.', 'error');
                }
                // Still advance a batch: one rejected file must not strand the
                // remaining ones behind a callback that never fires. The
                // outcome goes back to the caller so the closing message can
                // say what actually failed instead of counting it as sent.
                if (typeof onComplete === 'function') {
                    onComplete({ ok: false, name: file.name, message: error.message || 'Upload failed' });
                }
            });

            return;
        }

        /*
         * Served by the app server, but the live layer never came up.
         *
         * The local path below writes into `coeLearningFiles`, which coe-live.js
         * treats as a render cache and REPLACES wholesale from the database on
         * every boot. On a served page that makes it a hole in the floor: the
         * card appears, the toast says "uploaded", and the file is gone at the
         * next refresh with nothing to say where it went. It is the right answer
         * only for index.html opened straight off the filesystem, where there is
         * no server to reach.
         *
         * So say so instead. A refusal the uploader can act on beats a success
         * that quietly loses their file.
         */
        if (window.CoeApi?.isServed?.()) {
            const message = 'Not signed in to the library server, so this could not be saved. Reload the page and sign in, then try again.';

            if (!quiet) {
                window.showLibraryToast?.('Upload not saved', message, 'error');
            }
            if (typeof onComplete === 'function') {
                onComplete({ ok: false, name: file.name, message });
            }
            return;
        }

        // THE FOLDER WINS.
        //
        // getMaterialsByFolder() in enhanced-library.js decides what a folder
        // contains by matching course, year, subject, category and lesson on
        // the record. So a material only appears inside the folder it was
        // uploaded from if it is stamped with that folder's own values.
        //
        // The category matters most: it is derived from the file type when
        // nothing else says otherwise, which is why a video uploaded into a
        // Handouts folder used to be filed under Video Lectures and vanish
        // from the folder the user was standing in.
        if (folderId) {
            const folderInfo = parseLibraryFolderId(folderId);
            course = folderInfo.course || course;
            year = folderInfo.year || year || uploadMetadata.year;
            subject = subject || folderInfo.subject || uploadMetadata.subject;
            uploadMetadata.materialCategory = folderInfo.category || uploadMetadata.materialCategory || 'Handouts';
            uploadMetadata.year = year;
            uploadMetadata.subject = subject;
            uploadMetadata.course = course;
            // folderInfo first: a lesson folder filters on an exact lesson
            // match, and the composer field is only pre-filled when the modal
            // was opened through openLibraryUploadModal.
            uploadMetadata.lesson = folderInfo.lesson || lessonName || uploadMetadata.lesson;
        }
        const professorInfo = getProfessorInfoForUpload(folderId, {
            ...uploadMetadata,
            course: course || uploadMetadata.course,
            year: year || uploadMetadata.year,
            subject: subject || uploadMetadata.subject
        });
        uploadMetadata.course = professorInfo.course || uploadMetadata.course || course;
        uploadMetadata.year = professorInfo.year || uploadMetadata.year || year;
        uploadMetadata.subject = professorInfo.subject || uploadMetadata.subject || subject;
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const textTypes = ['txt', 'md', 'json', 'js', 'css', 'html', 'csv', 'xml'];
        const isText = file.type.startsWith('text/') || textTypes.includes(fileExtension);
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf' || fileExtension === 'pdf';
        const isVideo = file.type.startsWith('video/');

        function addUploadedFile(content) {
            const uploadedFile = normalizeUploadedFileRecord({
                folderIndex,
                folderId,
                folderName: folderId ? formatLibraryFolderLabel(folderId) : (folders[folderIndex]?.name || `${uploadMetadata.course || course} ${uploadMetadata.year || ''}`.trim()),
                discipline: uploadMetadata.course || course,
                year: uploadMetadata.year,
                subject: uploadMetadata.subject || subject || '',
                lesson: uploadMetadata.lesson || lessonName,
                materialCategory: uploadMetadata.materialCategory,
                version: uploadMetadata.version,
                tags: uploadMetadata.tags,
                professorName: professorInfo.professorName,
                professorUsername: professorInfo.professorUsername,
                name: uploadMetadata.standardizedName || file.name,
                originalName: file.name,
                // titleSuffix keeps a batch of files apart. Without it every
                // PDF in one upload would carry the same composer title.
                title: (uploadMetadata.title || uploadMetadata.standardizedName || file.name) +
                    (titleSuffix ? ` - ${titleSuffix}` : ''),
                description: uploadMetadata.description || '',
                comments: [],
                favorite: false,
                type: uploadMetadata.displayType || file.type || fileExtension,
                fileType: file.type || fileExtension,
                size: file.size,
                lastModified: new Date(file.lastModified).toLocaleString(),
                uploadedAt: new Date().toISOString(),
                uploadedBy: currentUser.name || currentUser.username || 'Admin',
                content: content || 'Preview not available for this file type.',
                previewType: isImage ? 'image' : (isPdf ? 'pdf' : (isVideo ? 'video' : 'text')),
                ownerUsername: currentUsername,
                accessLevel: 'Shared with all users',
                downloads: 0
            });
            uploadedFiles.push(uploadedFile);
            const uploadedFileIndex = uploadedFiles.length - 1;

            saveFiles();
            const destinationLabel = folderId ? formatLibraryFolderLabel(folderId) : (folders[folderIndex]?.name || `${uploadMetadata.course || course} ${uploadMetadata.year || ''}`.trim() || 'Library');
            addActivity(`Uploaded file: ${file.name} to ${destinationLabel}`, { type: 'file', fileIndex: uploadedFileIndex, fileId: uploadedFile.id });
            notifyUploadEvent(uploadedFile);
            if (window.enhancedLibrary?.populateLibraryFolderTree) {
                window.enhancedLibrary.populateLibraryFolderTree();
                window.enhancedLibrary.populateSubjectFilter?.();
                window.enhancedLibrary.populateLessonFilter?.();
                window.enhancedLibrary.populateTagFilter?.();
            }
            displayLibrary();
            displayMembers();
            if (typeof onComplete === 'function') onComplete();
        }

        if (isText || isImage || isPdf || isVideo) {
            const reader = new FileReader();
            reader.onload = function () {
                addUploadedFile(reader.result);
            };
            reader.onerror = function () {
                addUploadedFile('Unable to load preview content.');
            };
            if (isImage) {
                reader.readAsDataURL(file);
            } else if (isPdf || isVideo) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
            return;
        }

        addUploadedFile('Preview not available for this file type.');
    }

    function openFolderDetail(folderIndex) {
        const folder = folders[folderIndex];
        if (!folder) return;

        currentFolderIndex = folderIndex;
        folderDetailTitle.textContent = folder.name;

        const filesInFolder = uploadedFiles
            .map(function (file, index) {
                return { ...file, index };
            })
            .filter(function (file) {
                return file.folderIndex === folderIndex;
            });

        folderDetailList.innerHTML = filesInFolder.length
            ? filesInFolder.map(function (file) {
                const ownerActions = canManageUploadedFile(file)
                    ? `
                            <button class="edit-file-btn" data-index="${file.index}">Edit</button>
                            <button class="delete-file-btn" data-index="${file.index}">Delete</button>
                    `
                    : '';
                return `
                    <div class="folder-detail-item">
                        <div class="folder-detail-item-info">
                            <h4>${escapeHtml(file.name || 'Untitled File')}</h4>
                            <p>Course: ${escapeHtml(file.discipline || 'Unknown')} | ${escapeHtml(file.type || 'Unknown')} | ${formatFileSize(file.size)}</p>
                        </div>
                        <div class="folder-detail-actions">
                            <button class="review-file-btn" data-index="${file.index}">Review</button>
                            ${ownerActions}
                        </div>
                    </div>
                `;
            }).join('')
            : '<p class="empty-folder-detail">No files inside this folder yet.</p>';

        folderSection.classList.add('hidden');
        folderDetailSection.classList.remove('hidden');
    }

    function openFilePreviewModal(fileIndex) {
        const uploaded = uploadedFiles[fileIndex];
        if (!uploaded) return;

        previewFileName.textContent = uploaded.name || 'File Preview';
        previewFileDetails.textContent = `Course: ${uploaded.discipline || 'Unknown'} | Folder: ${folders[uploaded.folderIndex] ? folders[uploaded.folderIndex].name : 'Unknown'} | Type: ${uploaded.type || 'Unknown'} | Uploaded: ${uploaded.lastModified}`;

        if (uploaded.previewType === 'image' && isSafeImageSource(uploaded.content)) {
            previewFileContent.innerHTML = `<img src="${escapeHtml(uploaded.content)}" alt="${escapeHtml(uploaded.name || 'Preview image')}" style="max-width:100%;max-height:420px;display:block;margin:0 auto;border-radius:12px;">`;
        } else if (uploaded.previewType === 'link') {
            const safeDriveUrl = getSafeDriveUrl(uploaded.externalUrl || uploaded.content);
            previewFileContent.innerHTML = safeDriveUrl
                ? `<a href="${escapeHtml(safeDriveUrl)}" target="_blank" rel="noopener noreferrer">Open Google Drive Link</a>`
                : 'Saved link is no longer available.';
        } else {
            previewFileContent.textContent = uploaded.content || 'No preview available for this file type.';
        }

        filePreviewModal.style.display = 'block';
    }

    function deleteUploadedFile(fileIndex) {
        const uploadedFile = uploadedFiles[fileIndex];
        if (!uploadedFile) return;
        if (!canManageUploadedFile(uploadedFile)) {
            alert('Only the uploader or an admin can delete this material.');
            return;
        }
        if (!confirm('Are you sure you want to delete this uploaded file?')) return;

        uploadedFiles.splice(fileIndex, 1);
        // Drop the body too, or a deleted video keeps its disk space forever.
        if (uploadedFile.id) window.CoeLibraryStorage?.removeContent(uploadedFile.id);
        saveFiles();
        addActivity(`Deleted file: ${uploadedFile.name || 'Untitled File'}`);
        displayLibrary();
        displayMembers();
        if (currentFolderIndex !== null && !folderDetailSection.classList.contains('hidden')) {
            openFolderDetail(currentFolderIndex);
        }
    }

    function openTaskPostModal(taskId, fallbackIndex = null) {
        let task = tasks.find(item => item.id === taskId);
        if (!task && fallbackIndex !== null && !Number.isNaN(fallbackIndex)) {
            task = tasks[fallbackIndex];
        }
        if (!task) return;
        normalizeTaskRecord(task);

        const problemPhotoMarkup = task.problemPhotoContent && isSafeImageSource(task.problemPhotoContent)
            ? `<img src="${escapeHtml(task.problemPhotoContent)}" alt="${escapeHtml(task.title || 'Problem photo')}" class="task-post-image">`
            : '<p>No problem photo attached.</p>';

        const attachmentMarkup = task.attachmentPreviewType === 'image' && isSafeImageSource(task.attachmentContent)
            ? `<img src="${escapeHtml(task.attachmentContent)}" alt="${escapeHtml(task.fileName || 'Attachment')}" class="task-post-image">`
            : `<p>${escapeHtml(getTaskAttachmentLabel(task))}</p><p>${escapeHtml(task.attachmentContent || 'No attachment preview available.')}</p>`;
        const ownSubmission = getTaskSubmission(task);
        const submissionMarkup = isAdmin
            ? `
            <div class="task-post-section">
                <strong>Student Submissions</strong>
                ${task.submissions.length
                    ? task.submissions.map(submission => `
                        <div class="task-submission-row">
                            <span>${escapeHtml(submission.name || submission.username || 'Student')}</span>
                            ${getSubmissionStatusLabel(submission)}
                            <small>${escapeHtml(submission.answer || '')}</small>
                        </div>
                    `).join('')
                    : '<p>No student submissions yet.</p>'}
            </div>`
            : `
            <div class="task-post-section">
                <strong>Your Submission</strong>
                <p>${ownSubmission ? `${ownSubmission.correct ? 'Correct' : 'Needs review'} | ${escapeHtml(ownSubmission.answer || '')}` : 'No submission yet.'}</p>
            </div>`;

        taskPostTitle.textContent = task.title || 'Problem Post';
        taskPostDetails.textContent = `${task.discipline || 'N/A'} | ${task.topic || 'No topic'} | Attachment: ${getTaskAttachmentLabel(task)}`;
        taskPostBody.innerHTML = `
            <div class="task-post-section">
                <strong>Problem Statement</strong>
                <p>${escapeHtml(task.notes || 'No working notes.')}</p>
            </div>
            <div class="task-post-section">
                <strong>Problem Photo</strong>
                ${problemPhotoMarkup}
            </div>
            ${isAdmin ? `
                <div class="task-post-section">
                    <strong>Final Answer</strong>
                    <p>${escapeHtml(task.answer || 'No final answer.')}</p>
                </div>
                <div class="task-post-section">
                    <strong>Answer Key Attachment</strong>
                    ${attachmentMarkup}
                </div>
            ` : ''}
            ${submissionMarkup}
        `;
        taskPostModal.style.display = 'block';
    }

    function removeTaskAtIndex(index) {
        const task = tasks[index];
        if (!task) return;
        if (!confirm(`Delete ${task.title || 'this problem'}?`)) return;

        tasks.splice(index, 1);
        saveTasks();
        addActivity(`Deleted problem: ${task.title || 'Untitled Problem'}`, {
            type: 'task',
            taskTitle: task.title || 'Untitled Problem',
            taskOwnerUsername: task.ownerUsername
        });
        displayTaskSummary();
        displayMembers();
    }

    function displayTaskSummary() {
        if (!taskMetricsContainer || !taskSummaryCards) return;
        const roleLabel = document.getElementById('task-dashboard-role-label');

        const visibleItems = tasks
            .map(function (task, index) {
                return { task: normalizeTaskRecord(task), index };
            })
            .filter(function (item) {
                return isStudentAssignedTask(item.task);
            });

        const totalProblems = visibleItems.length;
        const ceProblems = visibleItems.filter(item => item.task.discipline === 'CE').length;
        const eeProblems = visibleItems.filter(item => item.task.discipline === 'EE').length;
        const submittedProblems = visibleItems.filter(item => isAdmin ? item.task.submissions.length : Boolean(getTaskSubmission(item.task))).length;
        const correctProblems = visibleItems.filter(item => {
            if (isAdmin) return item.task.submissions.some(submission => submission.correct);
            return Boolean(getTaskSubmission(item.task)?.correct);
        }).length;
        const pendingProblems = Math.max(totalProblems - submittedProblems, 0);
        const attachedFiles = visibleItems.filter(function (item) {
            return item.task.attachmentName && item.task.attachmentName !== 'No file selected' && item.task.attachmentName !== 'No attachment';
        }).length;
        const completionRate = totalProblems ? Math.round((submittedProblems / totalProblems) * 100) : 0;

        if (roleLabel) {
            roleLabel.textContent = isAdmin ? 'Admin task control' : `${currentUser?.discipline || currentUser?.course || 'Student'} workspace`;
        }

        taskMetricsContainer.innerHTML = `
            <div class="metric-card task-dashboard-metric primary">
                <span class="material-icons">assignment</span>
                <div>
                    <h3>${totalProblems}</h3>
                    <p>${isAdmin ? 'Published Tasks' : 'Assigned Tasks'}</p>
                </div>
            </div>
            <div class="metric-card task-dashboard-metric">
                <span class="material-icons">done_all</span>
                <div>
                    <h3>${submittedProblems}</h3>
                    <p>${isAdmin ? 'With Submissions' : 'Submitted'}</p>
                </div>
            </div>
            <div class="metric-card task-dashboard-metric">
                <span class="material-icons">verified</span>
                <div>
                    <h3>${correctProblems}</h3>
                    <p>${isAdmin ? 'Correct Answers' : 'Correct'}</p>
                </div>
            </div>
            <div class="metric-card task-dashboard-metric">
                <span class="material-icons">trending_up</span>
                <div>
                    <h3>${completionRate}%</h3>
                    <p>${pendingProblems} pending | CE ${ceProblems} | EE ${eeProblems}</p>
                </div>
            </div>
        `;

        if (!visibleItems.length) {
            taskSummaryCards.innerHTML = isAdmin
                ? '<p class="empty-tasks">No problem entries yet. Use the Admin Task Entry form below to add your first item.</p>'
                : '<p class="empty-tasks">No tasks assigned to your course yet.</p>';
            return;
        }

        taskSummaryCards.innerHTML = visibleItems.map(function ({ task, index }) {
            const ownSubmission = getTaskSubmission(task);
            const statusClass = isAdmin
                ? (task.submissions.length ? 'submitted' : 'pending')
                : (ownSubmission?.correct ? 'correct' : (ownSubmission ? 'wrong' : 'pending'));
            const statusText = isAdmin
                ? (task.submissions.length ? `${task.submissions.length} submitted` : 'No submissions yet')
                : (ownSubmission?.correct ? 'Correct answer' : (ownSubmission ? 'Needs review' : 'Not submitted'));
            const studentSubmitMarkup = !isAdmin ? `
                    <form class="student-task-submit-form" data-index="${index}">
                        <div class="student-submit-head">
                            <span class="material-icons">edit_note</span>
                            <strong>Your solution</strong>
                        </div>
                        <div class="student-task-submit-grid">
                            <input type="text" id="student-task-answer-${index}" class="student-task-answer" placeholder="Type your final answer" value="${escapeHtml(ownSubmission?.answer || '')}" required>
                            <input type="file" class="student-task-solution" accept="image/*,.pdf,.doc,.docx,.txt,.csv" aria-label="Upload solution file">
                            <button type="submit" class="task-submit-btn">${ownSubmission ? 'Resubmit' : 'Submit'}</button>
                        </div>
                    </form>
                ` : '';
            const adminSubmissionMarkup = isAdmin ? `
                    <div class="task-admin-submissions">
                        <div>
                            <strong>Submission health</strong>
                            <p>${escapeHtml(getTaskSubmissionSummary(task))}</p>
                        </div>
                        <span class="material-icons">monitoring</span>
                    </div>
                ` : '';
            return `
                <div class="task-card task-dashboard-card ${statusClass}">
                    <div class="task-card-top">
                        <div>
                            <span class="task-course-chip ${escapeHtml((task.discipline || '').toLowerCase())}">${escapeHtml(task.discipline || 'N/A')}</span>
                            <h3>${escapeHtml(task.title || 'Untitled Problem')}</h3>
                            <p>${escapeHtml(task.topic || 'No topic')}</p>
                        </div>
                        <span class="task-status-chip ${statusClass}">${escapeHtml(statusText)}</span>
                    </div>
                    <div class="task-card-notes">
                        <strong>Problem Statement</strong>
                        <p>${escapeHtml(task.notes || 'No working notes.')}</p>
                    </div>
                    <div class="task-card-meta">${isAdmin
                        ? `<span><strong>Answer key</strong>${escapeHtml(task.answer || 'No final answer')}</span><span><strong>Reference</strong>${escapeHtml(getTaskAttachmentLabel(task))}</span>`
                        : `<span>${getSubmissionStatusLabel(ownSubmission)}</span><span><strong>Answer key</strong>Hidden from student view</span>`}</div>
                    ${adminSubmissionMarkup}
                    ${studentSubmitMarkup}
                    <div class="task-card-actions">
                        <button class="task-view-btn" data-task-id="${task.id}" data-index="${index}"><span class="material-icons">visibility</span> View</button>
                        ${isAdmin ? `<button class="task-delete-btn" data-index="${index}"><span class="material-icons">delete</span> Delete</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function displayAdminLogs() {
        if (!adminAccountLogs) return;

        // The live panel owns this once it is up: it renders the real
        // server-side login events, and this would paint over them with the
        // handful this browser happens to remember.
        if (window.CoeAdmin?.ready) return;

        if (!isAdmin) {
            adminAccountLogs.innerHTML = '<p class="empty-accounts">Only admins can view account logs.</p>';
            return;
        }
        const events = getAccountEvents();
        const labelMap = {
            ACCOUNT_CREATED: 'Account created',
            LOGIN_SUCCESS: 'Login success',
            LOGIN_FAILED: 'Login failed',
            ACCOUNT_DELETED: 'Account deleted',
            ROLE_UPDATED: 'Role updated'
        };
        adminAccountLogs.hidden = false;
        if (events.length) {
            adminAccountLogs.innerHTML = events.slice(0, 12).map(event => `
                <div class="admin-log-item">
                    <div>
                        <h4>${escapeHtml(labelMap[event.type] || 'Account event')}</h4>
                        <p>${escapeHtml(event.username || 'Unknown')} | ${escapeHtml(event.detail || 'No details')}</p>
                    </div>
                    <div>
                        <p>${escapeHtml(new Date(event.createdAt || Date.now()).toLocaleDateString())}</p>
                        <p>${escapeHtml(new Date(event.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</p>
                    </div>
                </div>
            `).join('');
            return;
        }

        const accounts = initStoredUsers();
        adminAccountLogs.innerHTML = accounts.length
            ? accounts.map(account => `
                <div class="admin-log-item">
                    <div>
                        <h4>${escapeHtml(account.username)}</h4>
                        <p>${escapeHtml(account.name || 'No name provided')} | ${escapeHtml((account.role || 'STUDENT').toUpperCase())} | Course: ${escapeHtml(account.discipline || 'N/A')}</p>
                    </div>
                    <div>
                        <p>${escapeHtml(account.email || 'No email')}</p>
                        <p>Created: ${escapeHtml(account.createdAt || 'N/A')}</p>
                    </div>
                </div>
            `).join('')
            : '<p class="empty-accounts">No account logs available.</p>';
    }

    function displayAccountList() {
        if (!accountListContainer) return;
        accountListContainer.hidden = false;

        // Once the live panel is up it owns this list. This version reads the
        // accounts that happen to exist in *this browser's* localStorage, so
        // letting it run would replace the real account list with a local one.
        if (window.CoeAdmin?.ready) return;

        if (!isAdmin) {
            accountListContainer.innerHTML = '<p class="empty-accounts">Only admins can view registered accounts.</p>';
            return;
        }

        const accounts = initStoredUsers();
        if (!accounts.length) {
            accountListContainer.innerHTML = '<p class="empty-accounts">No registered accounts found yet.</p>';
            return;
        }

        const roleCounts = accounts.reduce((acc, account) => {
            const role = (account.role || account.type || 'STUDENT').toUpperCase();
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {});

        const getNextRole = role => {
            if (role === 'STUDENT') return 'FACULTY';
            if (role === 'FACULTY') return 'ORG_OFFICER_PICE';
            if (role === 'ORG_OFFICER_PICE') return 'ORG_OFFICER_IIEE';
            if (role === 'ORG_OFFICER_IIEE') return 'ADMIN';
            return 'STUDENT';
        };

        const getRoleLabel = role => {
            if (role === 'ORG_OFFICER_PICE') return 'PICE OFFICER';
            if (role === 'ORG_OFFICER_IIEE') return 'IIEE OFFICER';
            return role;
        };

        const getPermissions = role => {
            if (role === 'ADMIN') return ['Manage Accounts', 'Moderate Boards', 'Publish Notices', 'View Reports'];
            if (role === 'FACULTY') return ['Guide Courses', 'Answer Q&A', 'Review Materials', 'Track Progress'];
            if (role === 'ORG_OFFICER_PICE') return ['View PICE Applicants', 'Review Membership Interest'];
            if (role === 'ORG_OFFICER_IIEE') return ['View IIEE Applicants', 'Review Membership Interest'];
            return ['View Tasks', 'Upload Files', 'Ask Questions', 'Submit Feedback'];
        };

        const summaryMarkup = `
            <div class="account-role-summary">
                <span><strong>${accounts.length}</strong><small>Total</small></span>
                <span><strong>${roleCounts.STUDENT || 0}</strong><small>Students</small></span>
                <span><strong>${roleCounts.FACULTY || 0}</strong><small>Faculty</small></span>
                <span><strong>${(roleCounts.ORG_OFFICER_PICE || 0) + (roleCounts.ORG_OFFICER_IIEE || 0)}</strong><small>Org Officers</small></span>
                <span><strong>${roleCounts.ADMIN || 0}</strong><small>Admins</small></span>
            </div>
        `;

        const accountMarkup = accounts.map(function (account) {
            const role = (account.role || account.type || 'STUDENT').toUpperCase();
            const nextRole = getNextRole(role);
            const lastLogin = account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleDateString() : 'Never';
            const emailLabel = account.email || 'No email saved';
            return `
                <div class="account-item">
                    <div>
                        <h4>${escapeHtml(account.username)}</h4>
                        <p>${escapeHtml(account.name || account.username)} | ${escapeHtml(emailLabel)}</p>
                        <p>Created: ${escapeHtml(account.createdAt || 'N/A')} | Last login: ${escapeHtml(lastLogin)} | Logins: ${escapeHtml(String(account.loginCount || 0))}</p>
                        <div class="permission-list">
                            ${getPermissions(role).map(permission => `<span class="permission-chip">${escapeHtml(permission)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="account-meta">
                        <span class="account-role role-${role.toLowerCase()}">${escapeHtml(getRoleLabel(role))}</span>
                        <span class="account-role role-student">${escapeHtml(account.status || 'ACTIVE')}</span>
                        <button class="account-role-toggle-btn" data-username="${escapeHtml(account.username)}" data-next-role="${escapeHtml(nextRole)}" title="Change role to ${escapeHtml(getRoleLabel(nextRole))}">
                            <span class="material-icons">swap_horiz</span>
                        </button>
                        <button class="account-delete-btn" data-username="${escapeHtml(account.username)}" title="Delete account"><span class="material-icons">delete</span></button>
                    </div>
                </div>
            `;
        }).join('');

        accountListContainer.innerHTML = summaryMarkup + accountMarkup;
        updateAdminMetrics(accounts);
    }

    function displayMembers() {
        if (!contributorsGrid) return;

        const totalContributions = tasks.length + uploadedFiles.length;
        const pendingTodos = homeTodos.filter(todo => !todo.completed).length;
        const completedTodos = homeTodos.filter(todo => todo.completed).length;
        const completionRate = homeTodos.length ? Math.round((completedTodos / homeTodos.length) * 100) : 0;
        const attachmentCount = tasks.filter(task => task.attachmentName && task.attachmentName !== 'No attachment' && task.attachmentName !== 'No file selected').length;
        const ceItems = tasks.filter(task => task.discipline === 'CE').length + uploadedFiles.filter(file => file.discipline === 'CE').length;
        const eeItems = tasks.filter(task => task.discipline === 'EE').length + uploadedFiles.filter(file => file.discipline === 'EE').length;
        const courseTotal = ceItems + eeItems;
        const cePercent = courseTotal ? Math.round((ceItems / courseTotal) * 100) : 0;
        const eePercent = courseTotal ? 100 - cePercent : 0;
        const problemPercent = totalContributions ? Math.round((tasks.length / totalContributions) * 100) : 0;
        const uploadPercent = totalContributions ? 100 - problemPercent : 0;
        const activeDays = new Set(activityLog.map(function (item) {
            const date = item.time instanceof Date ? item.time : new Date(item.time);
            return Number.isNaN(date.getTime()) ? '' : date.toDateString();
        }).filter(Boolean)).size;
        const nextTodo = homeTodos
            .filter(todo => !todo.completed && todo.dueDate)
            .sort(function (left, right) {
                return new Date(left.dueDate) - new Date(right.dueDate);
            })[0];
        // Class-wide: problems and uploads, both from the server. `completedTodos`
        // used to be added here, which let one person's private task list move a
        // figure printed under "Across the class".
        const flowScore = (tasks.length * 3) + (uploadedFiles.length * 2);
        const recentActivity = activityLog.slice(0, 4);

        /*
         * Two tiers, and — more importantly — two different SCOPES.
         *
         * The panel used to be a grid of nine identical cards, and it mixed
         * numbers that mean completely different things. `tasks` and
         * `uploadedFiles` come from the server, so they are the whole class.
         * `homeTodos` and `activityLog` are this browser's localStorage, so
         * they are one person. The page is titled "Class Contribution" and
         * says "across the whole class" — while more than half of what it
         * showed was only ever yours.
         *
         * `headline` is class-wide, `secondary` is your own, and each group
         * now says which it is. Nothing was removed; it is ranked and labelled.
         */
        const headline = [
            {
                title: 'Total contributions',
                value: String(totalContributions),
                detail: `${tasks.length} problem entr${tasks.length === 1 ? 'y' : 'ies'} · ${uploadedFiles.length} library upload${uploadedFiles.length === 1 ? '' : 's'}`,
                icon: 'workspace_premium',
                tone: 'is-primary'
            },
            {
                title: 'Library depth',
                value: String(uploadedFiles.length),
                detail: `Across ${folders.length} folder${folders.length === 1 ? '' : 's'}`,
                icon: 'library_books',
                tone: 'is-blue'
            },
            {
                title: 'Saved problems',
                value: String(tasks.length),
                detail: `${attachmentCount} with an attachment`,
                icon: 'functions',
                tone: 'is-violet'
            },
            {
                title: 'Flow score',
                value: String(flowScore),
                /*
                 * Class-wide now. It used to add `completedTodos`, which is
                 * this browser's own task list — so a composite headline
                 * figure on a class page moved when you ticked off a personal
                 * reminder. The detail line shows the arithmetic, because a
                 * score whose formula is invisible cannot be questioned.
                 */
                detail: `${tasks.length}x3 + ${uploadedFiles.length}x2`,
                icon: 'trending_up',
                tone: 'is-amber'
            }
        ];

        // Everything below reads this browser's own localStorage, so it is
        // this account's activity and nobody else's. Labelled as such by the
        // heading rendered above it.
        const secondary = [
            {
                title: 'Your active days',
                value: String(activeDays),
                detail: activeDays ? 'Days you saved something' : 'Nothing recorded yet'
            },
            {
                title: 'Your focus queue',
                value: String(pendingTodos),
                detail: `${completedTodos} closed out`
            },
            {
                title: 'Your completion rate',
                value: `${completionRate}%`,
                detail: homeTodos.length ? `${completedTodos} of ${homeTodos.length} tasks` : 'No tasks yet'
            },
            {
                title: 'Your next deadline',
                value: nextTodo ? formatDate(nextTodo.dueDate) : 'Clear',
                detail: nextTodo ? nextTodo.text : 'Nothing due'
            }
        ];

        const headlineMarkup = headline.map(function (card) {
            return `
                <article class="contrib-stat ${card.tone}">
                    <span class="contrib-stat-icon"><span class="material-icons">${escapeHtml(card.icon)}</span></span>
                    <div class="contrib-stat-body">
                        <strong class="contrib-stat-value">${escapeHtml(card.value)}</strong>
                        <span class="contrib-stat-title">${escapeHtml(card.title)}</span>
                        <small class="contrib-stat-detail">${escapeHtml(card.detail)}</small>
                    </div>
                </article>
            `;
        }).join('');

        const secondaryMarkup = secondary.map(function (card) {
            return `
                <article class="contrib-mini">
                    <span class="contrib-mini-title">${escapeHtml(card.title)}</span>
                    <strong class="contrib-mini-value">${escapeHtml(card.value)}</strong>
                    <small class="contrib-mini-detail">${escapeHtml(card.detail)}</small>
                </article>
            `;
        }).join('');

        const recentMarkup = recentActivity.length
            ? recentActivity.map(function (item) {
                const when = item.time instanceof Date ? item.time : new Date(item.time);
                const valid = !Number.isNaN(when.getTime());
                return `
                    <li class="contrib-feed-item">
                        <span class="contrib-feed-dot" aria-hidden="true"></span>
                        <span class="contrib-feed-text">${escapeHtml(item.message)}</span>
                        <time class="contrib-feed-time">${escapeHtml(valid
                            ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '')}</time>
                    </li>
                `;
            }).join('')
            : '<li class="contrib-empty">Nothing yet. Add a task or upload a material to start the feed.</li>';

        /*
         * Two separate mixes, not four bars in one list.
         *
         * "Problem entries 40% / Library uploads 60% / CE 55% / EE 45%" was
         * four bars in a column implying one shared total, when it is two
         * independent splits that each add to 100. Reading them as one made
         * the percentages look wrong.
         */
        const mixRow = function (label, count, percent, tone) {
            return `
                <div class="contrib-mix-row">
                    <div class="contrib-mix-head">
                        <span class="contrib-mix-label">${escapeHtml(label)}</span>
                        <span class="contrib-mix-figures">
                            <strong>${escapeHtml(String(count))}</strong>
                            <small>${escapeHtml(String(percent))}%</small>
                        </span>
                    </div>
                    <div class="contrib-mix-track">
                        <span class="contrib-mix-fill ${tone}" style="width:${Math.max(percent, count ? 2 : 0)}%"></span>
                    </div>
                </div>
            `;
        };

        const byType = mixRow('Problem entries', tasks.length, problemPercent, 'is-problem') +
            mixRow('Library uploads', uploadedFiles.length, uploadPercent, 'is-upload');

        const byCourse = mixRow('Civil Engineering', ceItems, cePercent, 'is-ce') +
            mixRow('Electrical Engineering', eeItems, eePercent, 'is-ee');

        const emptyMix = '<p class="contrib-empty">No contributions recorded yet.</p>';

        contributorsGrid.innerHTML = `
            <section class="contrib-group" aria-labelledby="contrib-class-heading">
                <h2 class="contrib-group-title" id="contrib-class-heading">
                    <span class="material-icons">groups</span>Across the class
                </h2>
                <div class="contrib-stats">${headlineMarkup}</div>
            </section>

            <div class="contrib-columns">
                <section class="contrib-card contrib-mix-card">
                    <header class="contrib-card-head">
                        <h2>What the class is producing</h2>
                        <p>Two independent splits: by kind of work, and by course.</p>
                    </header>

                    <div class="contrib-mix-group">
                        <h3 class="contrib-mix-title">By kind of work</h3>
                        ${totalContributions ? byType : emptyMix}
                    </div>

                    <div class="contrib-mix-group">
                        <h3 class="contrib-mix-title">By course</h3>
                        ${courseTotal ? byCourse : emptyMix}
                    </div>
                </section>

                <section class="contrib-card contrib-feed-card">
                    <header class="contrib-card-head">
                        <h2>Recent activity</h2>
                        <p>The last few things saved in this workspace.</p>
                    </header>
                    <ul class="contrib-feed">${recentMarkup}</ul>
                </section>
            </div>

            <section class="contrib-group" aria-labelledby="contrib-you-heading">
                <h2 class="contrib-group-title" id="contrib-you-heading">
                    <span class="material-icons">person</span>Your own activity
                    <small>Saved on this device only</small>
                </h2>
                <div class="contrib-minis">${secondaryMarkup}</div>
            </section>
        `;
    }

    /* =====================================================================
       BRIDGE FOR THE SHARED BOARD
       ---------------------------------------------------------------------
       `announcements` and `tasks` are declared inside this DOMContentLoaded
       closure, so nothing outside can reach them — writing to their
       localStorage keys from another file would update the cache but leave
       these arrays holding whatever they loaded at boot.
       These setters are the only way in. coe-board.js calls them after
       fetching from the server, and the existing render functions run
       unchanged.
       ===================================================================== */
    window.CoeBoardBridge = {
        setAnnouncements: function (list) {
            announcements = (list || []).map(normalizeAnnouncement);
            saveAnnouncements();
            renderAnnouncements();
            // The calendar draws announcements too, and it is not rebuilt by
            // renderAnnouncements(). Without this a notice posted while the
            // calendar was open only appeared on it after a page change — so
            // the screen most likely to be watched was the last to update.
            renderCalendarDashboard();
        },

        /** Replace in place — `tasks` is a const array other code holds a reference to. */
        setTasks: function (list) {
            tasks.length = 0;
            (list || []).forEach(function (task) { tasks.push(normalizeTaskRecord(task)); });
            saveTasks();
            displayTaskSummary();
            displayMembers();
        },

        getTasks: function () { return tasks; },
        refreshAnnouncements: function () { renderAnnouncements(); },
        refreshTasks: function () { displayTaskSummary(); }
    };

    // Initial folder, library, task summary, and home displays
    loadSavedState();
    hydrateLibraryContent();
    displayFolders();
    populateLibraryUploadFolders();
    displayLibrary();
    displayTaskSummary();
    displayHomeTodos();
    renderHomeUploadProgress();
    renderHomeReviewQueue();
    renderHomeSchedule();
    renderCalendarDashboard();
    syncDashboardNotifications();
    displayMembers();
    displayHomeDashboardStats();
    renderAnnouncements();
    initRealtimeCommunication();
    displayAccountList();
    showPage('home');
});
