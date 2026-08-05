const LOCAL_STORAGE_LIBRARY_BOOKMARKS = 'coeLibraryBookmarks';
const LOCAL_STORAGE_LIBRARY_FOLDER_BOOKMARKS = 'coeLibraryFolderBookmarks';
const LOCAL_STORAGE_LIBRARY_COMMENTS = 'coeLibraryComments';
const LOCAL_STORAGE_LIBRARY_COMPLETED = 'coeLibraryCompleted';
const LOCAL_STORAGE_PROFESSOR_LIBRARIES = 'coeProfessorLibraries';
const MATERIAL_CATEGORIES = ['Reference Books', 'Handouts', 'Video Lectures', 'Lessons', 'GDrive Links'];
const FOLDER_MATERIAL_CATEGORIES = ['Reference Books', 'Handouts', 'Video Lectures'];
const LESSON_FOLDER_MARKER = '__lesson__';
const PROFESSOR_FOLDER_MARKER = '__prof__';

let currentMaterial = null;
let libraryCurrentUser = JSON.parse(localStorage.getItem('studentWorkplaceCurrentUser') || '{}');
let currentFolderId = '';
/**
 * 'list' or 'grid'.
 *
 * List is the default: a folder is a list of files, and the card grid turned
 * ten files into ten tiles you had to read one by one. The toggle is still
 * there for anyone who prefers the cards.
 */
let currentLibraryView = 'list';

function getProtectedViewerUser() {
    try {
        return JSON.parse(localStorage.getItem('studentWorkplaceCurrentUser') || '{}') || {};
    } catch (error) {
        return libraryCurrentUser || {};
    }
}

function logMaterialSecurityEvent(action, material = currentMaterial, detail = '') {
    if (typeof window.logProtectedMaterialEvent === 'function') {
        window.logProtectedMaterialEvent(action, material || {}, { detail, source: 'library' });
    }
}

function isMaterialDetailOpen() {
    const modal = document.getElementById('material-detail-modal');
    return Boolean(modal && modal.style.display !== 'none' && currentMaterial);
}

function getViewerWatermarkText() {
    const user = getProtectedViewerUser();
    const name = user.name || user.username || 'COE user';
    const role = user.role || 'STUDENT';
    return `${name} | ${role} | ${new Date().toLocaleString()}`;
}

function protectMaterialPreview(material) {
    const preview = document.getElementById('detail-preview');
    if (!preview || !material) return;

    preview.classList.add('protected-material-preview');
    preview.setAttribute('data-protected', 'true');
    preview.setAttribute('aria-label', 'Protected module preview');

    const watermark = document.createElement('div');
    watermark.className = 'protected-preview-watermark';
    watermark.textContent = getViewerWatermarkText();
    preview.appendChild(watermark);

    preview.oncontextmenu = function (event) {
        event.preventDefault();
        logMaterialSecurityEvent('RIGHT_CLICK_BLOCKED', material, 'Right-click blocked inside module preview');
        return false;
    };

    preview.querySelectorAll('.preview-link').forEach(link => {
        link.addEventListener('click', function () {
            logMaterialSecurityEvent('OPEN_LINK', material, 'Opened protected external material link');
        });
    });
}

document.addEventListener('keydown', function (event) {
    if (!isMaterialDetailOpen()) return;

    const key = String(event.key || '').toLowerCase();
    const protectedShortcut =
        event.key === 'PrintScreen' ||
        ((event.ctrlKey || event.metaKey) && ['p', 's', 'u', 'c'].includes(key));

    if (!protectedShortcut) return;

    logMaterialSecurityEvent(
        event.key === 'PrintScreen' ? 'SCREENSHOT_ATTEMPT' : 'PROTECTED_SHORTCUT_BLOCKED',
        currentMaterial,
        event.key === 'PrintScreen' ? 'PrintScreen key detected' : `Blocked shortcut ${event.ctrlKey ? 'Ctrl' : 'Meta'}+${event.key}`
    );

    if (event.key !== 'PrintScreen') {
        event.preventDefault();
        event.stopPropagation();
    }
});

document.addEventListener('copy', function (event) {
    if (!isMaterialDetailOpen()) return;
    const selection = window.getSelection?.();
    const preview = document.getElementById('detail-preview');
    if (preview && selection && preview.contains(selection.anchorNode)) {
        event.preventDefault();
        logMaterialSecurityEvent('COPY_BLOCKED', currentMaterial, 'Copy blocked inside module preview');
    }
});

window.addEventListener('beforeprint', function () {
    if (!isMaterialDetailOpen()) return;
    logMaterialSecurityEvent('PROTECTED_SHORTCUT_BLOCKED', currentMaterial, 'Print attempt detected while module preview was open');
});

// New constant for material categories to display in the tree
const MATERIAL_CATEGORIES_DISPLAY = {
    'Reference Books': 'Reference Books',
    'Handouts': 'Handouts',
    'Video Lectures': 'Video Lectures',
    'Lessons': 'Lessons',
    'GDrive Links': 'Google Drive Links'
};

const COURSE_FOLDERS = {
    'EE': 'Electrical Engineering',
    'CE': 'Civil Engineering'
};
const COURSE_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const CURRICULUM_SUBJECTS = {
    CE: {
        '1st Year': [
            'MAT 171 - CALCULUS 1',
            'PHY032 - PHYSICS FOR ENGINEERS',
            'MAT 076 - CALCULUS 2'
        ],
        '2nd Year': [
            'BES 025 - STATICS OF RIGID BODIES',
            'MAT 052 - DIFFERENTIAL EQUATION',
            'CIE 112 - FUNDAMENTALS OF SURVEYING',
            'ECO 017 - ENGINEERING ECONOMICS',
            'CIE 113 - MECHANICS OF DEFORMABLE BODIES',
            'BES 026 - DYNAMICS OF RIGID BODIES'
        ],
        '3rd Year': [
            'ECE 069 - ENGINEERING DATA ANALYSIS',
            'CIE 136 - STRUCTURAL THEORY',
            'CIE 115 - NUMERICAL SOLUTIONS TO CE PROBLEMS',
            'CIE 120 - PRINCIPLE OF REINFORCED/PRESTRESSED CONCRETE',
            'CIE 119 - PRINCIPLE OF STEEL DESIGN',
            'CIE 121 - HYDRAULICS'
        ],
        '4th Year': [
            'CIE 097 - PROFESSIONAL COURSE SPECIALIZED 1: BRIDGE DESIGN',
            'CIE 128 - PRINCIPLE OF TRANSPORTATION ENGINEERING',
            'CIE 031 - PROF COURSE SPECIALIZED 3: STRUCTURAL DESIGN OF STEEL',
            'CIE 131 - PROF COURSE 4: FOUNDATIONAL AND RETAINING WALL DESIGN'
        ]
    },
    EE: {
        '1st Year': [
            'OE 025 - CHEMISTRY FOR ENGINEERS',
            'MAT 171 - CALCULUS 1 FOR ENGINEERS',
            'PHY 032 - PHYSICS 1 FOR ENGINEERS',
            'MAT 076 - CALCULUS 2',
            'PHY 032 - PHYSICS FOR ENGINEERS'
        ],
        '2nd Year': [
            'BES 058 - ENGINEERING MECHANICS',
            'ECE 069 - ENGINEERING DATA ANALYSIS',
            'ELE 001 - ELECTRICAL CIRCUITS 1',
            'ITE 296 - COMPUTER PROGRAMMING',
            'MAT 052 - DIFFERENTIAL EQUATIONS',
            'MEE 085 - BASIC THERMODYNAMICS',
            'BES 024 - COMPUTER-AIDED DRAFTING',
            'BES 059 - FUNDAMENTALS OF DEFORMABLE BODIES',
            'ELE 002 - ELECTRICAL CIRCUITS 2',
            'ELE 117 - ELECTROMAGNETICS',
            'ELE 031 - ELECTRONIC CIRCUITS: DEVICES AND ANALYSIS',
            'MAT 168 - ENGINEERING MATH FOR EE'
        ],
        '3rd Year': [
            'BES 060 - FLUID MECHANICS',
            'BES 061 - ENVIRONMENTAL SCIENCE AND ENGINEERING',
            'ELE 032 - INDUSTRIAL ELECTRONICS',
            'ELE 094 - MATERIALS SCIENCE AND ENGINEERING',
            'ELE 095 - FUNDAMENTALS OF ELECTRONIC COMMUNICATIONS',
            'ELE 096 - ELECTRICAL MACHINES 1',
            'ITE 296 - LOGIC CIRCUITS AND SWITCHING THEORY',
            'MAT 169 - NUMERICAL METHODS AND ANALYSIS',
            'BES 057 - BASIC OCCUPATIONAL SAFETY AND HEALTH',
            'ECO 017 - ENGINEERING ECONOMICS',
            'ELE 017 - EE LAWS, CODES, AND PROFESSIONAL ETHICS',
            'ELE 097 - MICROPROCESSOR SYSTEMS',
            'ELE 098 - ELECTRICAL APPARATUS AND DEVICES',
            'ELE 099 - ELECTRICAL MACHINES 2',
            'ELE 101 - FEEDBACK CONTROL SYSTEMS'
        ],
        '4th Year': []
    }
};

// Initialize Enhanced Library
document.addEventListener('DOMContentLoaded', function() {
    initializeEnhancedLibrary();
});

function initializeEnhancedLibrary() {
    populateLibraryFolderTree(); // Build the tree initially
    document.querySelectorAll('.folder-card-group').forEach(group => group.classList.remove('hidden'));
    document.querySelectorAll('.tree-children').forEach(children => children.classList.add('hidden'));
    document.querySelectorAll('.expand-icon').forEach(icon => icon.textContent = 'expand_more');

    const courseTabs = document.querySelectorAll('.course-tab');
    courseTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            courseTabs.forEach(t => t.classList.toggle('active', t === this));
            switchLibraryCourse(this.dataset.course);
        });
    });

    // Add delegated listener as a fallback (works if buttons are re-rendered or overlapped)
    const courseTabsContainer = document.getElementById('library-course-tabs');
    if (courseTabsContainer) {
        courseTabsContainer.addEventListener('click', function(e) {
            const tab = e.target.closest('.course-tab');
            if (!tab) return;
            // Ensure visible active state
            courseTabsContainer.querySelectorAll('.course-tab').forEach(t => t.classList.toggle('active', t === tab));
            switchLibraryCourse(tab.dataset.course);
        });
    }

    // Folder tree and category click delegation
    const folderTreeNav = document.querySelector('.folder-tree');
    if (folderTreeNav) {
        folderTreeNav.addEventListener('click', function(e) {
            const actionBtn = e.target.closest('[data-library-action]');
            const toggleBtn = e.target.closest('.tree-toggle');
            const leafBtn = e.target.closest('.tree-leaf');

            if (actionBtn && folderTreeNav.contains(actionBtn)) {
                const action = actionBtn.dataset.libraryAction;
                if (action === 'create-professor-library') {
                    createProfessorLibraryForFolder(actionBtn.dataset.folder || currentFolderId);
                }
                return;
            }

            if (toggleBtn && folderTreeNav.contains(toggleBtn)) {
                // e.preventDefault(); // Allow default behavior for now, selectFolder will handle
                const childrenGroup = getTreeChildren(toggleBtn);
                if (childrenGroup) {
                    toggleFolderTree(toggleBtn, childrenGroup);
                }
                selectFolder(toggleBtn.dataset.folder, toggleBtn);
                return;
            }

            if (leafBtn && folderTreeNav.contains(leafBtn)) {
                // e.preventDefault(); // Allow default behavior for now, selectFolder will handle
                selectFolder(leafBtn.dataset.folder, leafBtn);
            }
        });
    }

    const libraryUploadBtn = document.getElementById('library-upload-btn');
    if (libraryUploadBtn) {
        libraryUploadBtn.addEventListener('click', function () {
            if (typeof window.openLibraryUploadModal === 'function') {
                window.openLibraryUploadModal(currentFolderId && currentFolderId !== 'all' ? currentFolderId : '');
                return;
            }
            alert('Upload is not available yet.');
        });
    }

    const dashboardUploadBtn = document.getElementById('library-dashboard-upload-btn');
    if (dashboardUploadBtn) {
        dashboardUploadBtn.addEventListener('click', function () {
            if (typeof window.openLibraryUploadModal === 'function') {
                window.openLibraryUploadModal('');
                return;
            }
            alert('Upload is not available yet.');
        });
    }

    const dashboardBrowseBtn = document.getElementById('library-dashboard-browse-btn');
    if (dashboardBrowseBtn) {
        dashboardBrowseBtn.addEventListener('click', function () {
            document.querySelector('.library-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    document.querySelectorAll('[data-library-quick-filter]').forEach(button => {
        button.addEventListener('click', function () {
            const quickFilter = this.dataset.libraryQuickFilter || '';
            const filterType = document.getElementById('library-filter-type');
            selectFolder('all', document.getElementById('btn-all-materials'));
            if (filterType) filterType.value = quickFilter;
            displayMaterialCards('all');
            document.querySelector('.library-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    const btnAll = document.getElementById('btn-all-materials');
    if (btnAll) {
        btnAll.addEventListener('click', function() {
            selectFolder('all', this);
        });
    }

    // The course tabs are now part of the dynamically generated tree,
    // so their event listeners are handled by the folderTreeNav listener.
    // We'll keep a function for switching course visibility.
    // const courseTabs = document.querySelectorAll('.course-tab');
    // courseTabs.forEach(tab => {
    //     tab.addEventListener('click', function() {
    //         switchLibraryCourse(this.dataset.course);
    //     });
    // });
    // Search
    const sidebarSearch = document.getElementById('library-sidebar-search');
    const searchEnhanced = document.getElementById('library-search-enhanced');
    if (sidebarSearch) {
        sidebarSearch.addEventListener('input', filterFolderTree);
    }
    if (searchEnhanced) {
        searchEnhanced.addEventListener('input', () => {
            populateLibrarySearchSuggestions();
            displayMaterialCards();
        });
        searchEnhanced.addEventListener('change', () => applySearchSuggestion(searchEnhanced.value));
    }

    // Filters
    const filterType = document.getElementById('library-filter-type');
    const filterYear = document.getElementById('library-filter-year');
    const filterSubject = document.getElementById('library-filter-subject');
    const filterLesson = document.getElementById('library-filter-lesson');
    const filterTag = document.getElementById('library-filter-tag');
    const filterSort = document.getElementById('library-filter-sort');

    if (filterType) filterType.addEventListener('change', () => displayMaterialCards());
    if (filterYear) filterYear.addEventListener('change', () => {
        populateSubjectFilter();
        displayMaterialCards();
    });
    if (filterSubject) filterSubject.addEventListener('change', () => {
        populateLessonFilter();
        populateTagFilter();
        displayMaterialCards();
    });
    if (filterLesson) filterLesson.addEventListener('change', () => displayMaterialCards());
    if (filterTag) filterTag.addEventListener('change', () => displayMaterialCards());
    if (filterSort) filterSort.addEventListener('change', () => displayMaterialCards());

    // --- Material viewer ---------------------------------------------------
    //
    // Three ways out, because a full-screen viewer that only closes from one
    // small X in the corner feels like a trap.
    const closeModal = document.getElementById('close-material-modal');
    const modal = document.getElementById('material-detail-modal');

    if (closeModal) {
        closeModal.addEventListener('click', closeMaterialDetail);
    }

    if (modal) {
        // Click the backdrop, but not the dialog itself.
        modal.addEventListener('click', event => {
            if (event.target === modal) closeMaterialDetail();
        });
    }

    const fullscreenBtn = document.getElementById('detail-fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleMaterialFullscreen);
    }

    document.addEventListener('keydown', event => {
        if (!modal || modal.style.display === 'none' || !modal.style.display) return;

        // Escape leaves fullscreen on its own; only close the modal when it is
        // the modal that is on top.
        if (event.key === 'Escape') {
            if (document.fullscreenElement || document.webkitFullscreenElement) return;
            closeMaterialDetail();
            return;
        }

        // F for fullscreen, but not while someone is typing a comment.
        if ((event.key === 'f' || event.key === 'F') && !event.ctrlKey && !event.metaKey) {
            const typing = event.target.closest('input, textarea, [contenteditable="true"]');
            if (typing) return;
            event.preventDefault();
            toggleMaterialFullscreen();
        }
    });

    // Comments form
    const commentForm = document.getElementById('add-comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', handleAddComment);
    }
    const folderContext = document.getElementById('library-folder-context');
    if (folderContext) {
        folderContext.addEventListener('click', event => {
            const uploadButton = event.target.closest('.folder-upload-btn, .upload-zone-btn');
            if (uploadButton) {
                if (typeof window.openLibraryUploadModal === 'function') {
                    window.openLibraryUploadModal(currentFolderId && currentFolderId !== 'all' ? currentFolderId : '');
                    return;
                }
                alert('Upload is not available yet.');
                return;
            }

            /*
             * Leave the folder view. Routed through selectFolder rather than
             * just dropping the class, because the folder view is not only a
             * layout — it also left the Year, Subject and Type dropdowns set to
             * this folder. Clearing the class alone would show every material
             * again under a toolbar still claiming to be filtered.
             */
            const backButton = event.target.closest('[data-action="library-back"]');
            if (backButton) {
                selectFolder('all', document.getElementById('btn-all-materials'));
                return;
            }

            const createProfessorButton = event.target.closest('[data-action="create-professor-library"]');
            if (createProfessorButton) {
                createProfessorLibraryForFolder(currentFolderId);
                return;
            }

            const button = event.target.closest('[data-action="bookmark-folder"]');
            if (!button) return;
            toggleFolderBookmark(currentFolderId || 'all');
        });

        folderContext.addEventListener('dragover', event => {
            const dropTarget = event.target.closest('.folder-upload-zone');
            if (dropTarget) {
                event.preventDefault();
                dropTarget.classList.add('drag-over');
            }
        });

        folderContext.addEventListener('dragleave', event => {
            const dropTarget = event.target.closest('.folder-upload-zone');
            if (dropTarget) {
                dropTarget.classList.remove('drag-over');
            }
        });

        folderContext.addEventListener('drop', event => {
            const dropTarget = event.target.closest('.folder-upload-zone');
            if (!dropTarget) return;
            event.preventDefault();
            dropTarget.classList.remove('drag-over');
            const droppedFiles = Array.from(event.dataTransfer.files || []);
            if (!droppedFiles.length) return;
            if (typeof window.openLibraryUploadModal === 'function') {
                window.openLibraryUploadModal(currentFolderId, droppedFiles);
            }
        });
    }

    // Initial display
    populateYearFilter();
    populateTypeFilter();
    populateSubjectFilter();
    populateLessonFilter();
    populateTagFilter();
    populateLibrarySearchSuggestions();
    updateLibraryStats();
    selectFolder('all', document.getElementById('btn-all-materials'));
    updateLibraryDashboard();

    // The first render above runs before IndexedDB has answered, so materials
    // whose body was offloaded show without a preview. Re-render once the
    // store's cache is warm.
    window.CoeLibraryStorage?.ready?.().then(() => {
        displayMaterialCards(currentFolderId || 'all');
        updateLibraryDashboard();
    }).catch(() => { /* previews stay unavailable; the list is still correct */ });
}

function getYearShortFromYear(year) {
    return String(year || '').split(' ')[0] || '';
}

function getCurriculumSubjects(course, year) {
    return CURRICULUM_SUBJECTS[course]?.[year] || [];
}

function getUploadedSubjectsForCourseYear(course, year) {
    return getAllLibraryFiles()
        .filter(file => {
            const fileYear = file.year || getYearForSubject(file.subject, file.discipline);
            return (!course || file.discipline === course) && (!year || fileYear === year);
        })
        .map(file => file.subject || file.topic)
        .filter(Boolean);
}

function getSubjectsForCourseYear(course, year) {
    const subjects = [
        ...getCurriculumSubjects(course, year),
        ...getUploadedSubjectsForCourseYear(course, year)
    ];

    return [...new Set(subjects.map(subject => String(subject || '').trim()).filter(Boolean))];
}

function getProfessorLibraryRecords() {
    try {
        const records = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFESSOR_LIBRARIES) || '[]');
        return Array.isArray(records) ? records : [];
    } catch (error) {
        return [];
    }
}

function saveProfessorLibraryRecords(records) {
    localStorage.setItem(LOCAL_STORAGE_PROFESSOR_LIBRARIES, JSON.stringify(records));
}

function encodeFolderSegment(value) {
    return encodeURIComponent(String(value || '').trim());
}

function decodeFolderSegment(value) {
    try {
        return decodeURIComponent(String(value || ''));
    } catch (error) {
        return String(value || '');
    }
}

function normalizeIdentity(value) {
    return String(value || '').trim().toLowerCase();
}

function getCurrentProfessorName() {
    return libraryCurrentUser.name || libraryCurrentUser.username || 'Faculty';
}

function isLibraryFacultyOrAdmin() {
    const role = String(libraryCurrentUser.role || '').toUpperCase();
    return role === 'FACULTY' || role === 'ADMIN';
}

function buildSubjectFolderId(course, yearShort, subject) {
    return [course, yearShort, subject].filter(Boolean).join('-');
}

function buildProfessorOverviewFolderId(course, yearShort, subject) {
    return `${buildSubjectFolderId(course, yearShort, subject)}-${PROFESSOR_FOLDER_MARKER}`;
}

function buildProfessorFolderId(course, yearShort, subject, professorKey) {
    return `${buildProfessorOverviewFolderId(course, yearShort, subject)}-${encodeFolderSegment(professorKey)}`;
}

function getProfessorLibrariesForSubject(course, year, subject) {
    const subjectKey = normalizeIdentity(subject);
    const libraries = new Map();

    getProfessorLibraryRecords()
        .filter(record =>
            record.course === course &&
            record.year === year &&
            normalizeIdentity(record.subject) === subjectKey
        )
        .forEach(record => {
            const key = normalizeIdentity(record.professorUsername || record.professorName);
            if (!key) return;
            libraries.set(key, {
                course: record.course,
                year: record.year,
                subject: record.subject,
                professorName: record.professorName || record.professorUsername || 'Faculty',
                professorUsername: record.professorUsername || '',
                createdAt: record.createdAt || ''
            });
        });

    getAllLibraryFiles()
        .filter(file => {
            const fileYear = file.year || getYearForSubject(file.subject, file.discipline);
            return file.discipline === course &&
                fileYear === year &&
                normalizeIdentity(file.subject || file.topic) === subjectKey &&
                (file.professorUsername || file.professorName);
        })
        .forEach(file => {
            const key = normalizeIdentity(file.professorUsername || file.professorName || file.ownerUsername);
            if (!key || libraries.has(key)) return;
            libraries.set(key, {
                course,
                year,
                subject,
                professorName: file.professorName || file.uploadedBy || file.ownerUsername || 'Faculty',
                professorUsername: file.professorUsername || file.ownerUsername || '',
                createdAt: file.uploadedAt || file.lastModified || ''
            });
        });

    return Array.from(libraries.values()).sort((a, b) =>
        String(a.professorName || '').localeCompare(String(b.professorName || ''))
    );
}

function getProfessorNameFromFolderParts(parts) {
    if (!parts?.professorKey) return '';
    const records = getProfessorLibrariesForSubject(parts.course, parts.year, parts.subject);
    const key = normalizeIdentity(parts.professorKey);
    const match = records.find(record => normalizeIdentity(record.professorUsername || record.professorName) === key);
    return match?.professorName || parts.professorKey;
}

function createProfessorLibraryForFolder(folderId = currentFolderId) {
    const parts = parseFolderParts(folderId);
    if (!parts.course || !parts.year || !parts.subject) {
        alert('Select a subject folder first before creating a professor folder.');
        return;
    }

    if (!isLibraryFacultyOrAdmin()) {
        alert('Only faculty or admins can create a professor folder.');
        return;
    }

    const professorUsername = libraryCurrentUser.username || getCurrentProfessorName();
    const professorName = getCurrentProfessorName();
    const records = getProfessorLibraryRecords();
    const exists = records.some(record =>
        record.course === parts.course &&
        record.year === parts.year &&
        normalizeIdentity(record.subject) === normalizeIdentity(parts.subject) &&
        normalizeIdentity(record.professorUsername || record.professorName) === normalizeIdentity(professorUsername)
    );

    if (!exists) {
        records.push({
            id: `prof-lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            course: parts.course,
            year: parts.year,
            subject: parts.subject,
            professorName,
            professorUsername,
            createdAt: new Date().toISOString()
        });
        saveProfessorLibraryRecords(records);
    }

    populateLibraryFolderTree();
    populateLibrarySearchSuggestions();
    const professorFolderId = buildProfessorFolderId(parts.course, parts.yearShort, parts.subject, professorUsername);
    const professorButton = Array.from(document.querySelectorAll('.tree-toggle, .tree-leaf'))
        .find(node => node.dataset.folder === professorFolderId);
    selectFolder(professorFolderId, professorButton || null);
    alert(exists ? 'Your professor folder already exists.' : 'Professor folder created.');
}

function createProfessorLibraryTree(course, year, subject) {
    const yearShort = getYearShortFromYear(year);
    const overviewFolderId = buildProfessorOverviewFolderId(course, yearShort, subject);
    const professorLibraries = getProfessorLibrariesForSubject(course, year, subject);
    const createAction = isLibraryFacultyOrAdmin()
        ? `
            <div class="tree-node professor-create-node">
                <button type="button" class="tree-action library-professor-create" data-library-action="create-professor-library" data-folder="${escapeHtml(buildSubjectFolderId(course, yearShort, subject))}" title="Create my professor folder">
                    <span class="material-icons">add_circle</span>
                    <span class="folder-name">Create Prof Folder</span>
                </button>
            </div>
        `
        : '';
    const professorFolders = professorLibraries.length
        ? professorLibraries.map(professor => {
            const professorKey = professor.professorUsername || professor.professorName;
            const professorFolderId = buildProfessorFolderId(course, yearShort, subject, professorKey);
            const professorCount = getMaterialsByFolder(professorFolderId).length;
            const professorCategoryFolders = FOLDER_MATERIAL_CATEGORIES.map(category => {
                const categoryFolderId = `${professorFolderId}-${category}`;
                const categoryCount = getMaterialsByFolder(categoryFolderId).length;
                return `
                    <div class="tree-node professor-type-node">
                        <button type="button" class="tree-leaf" data-folder="${escapeHtml(categoryFolderId)}" title="${course} > ${year} > ${escapeHtml(subject)} > ${escapeHtml(professor.professorName)} > ${MATERIAL_CATEGORIES_DISPLAY[category]}">
                            <span class="material-icons">${getCategoryIcon(category)}</span>
                            <span class="folder-name">${MATERIAL_CATEGORIES_DISPLAY[category]}</span>
                            <span class="folder-count">${categoryCount}</span>
                        </button>
                    </div>
                `;
            }).join('');

            return `
                <div class="tree-node professor-node">
                    <button type="button" class="tree-toggle" data-folder="${escapeHtml(professorFolderId)}" aria-expanded="false" title="${course} > ${year} > ${escapeHtml(subject)} > ${escapeHtml(professor.professorName)}">
                        <span class="material-icons expand-icon">expand_more</span>
                        <span class="material-icons">school</span>
                        <span class="folder-name">${escapeHtml(professor.professorName)}</span>
                        <span class="folder-count">${professorCount}</span>
                    </button>
                    <div class="tree-children professor-material-list hidden">
                        ${professorCategoryFolders}
                    </div>
                </div>
            `;
        }).join('')
        : `
            <div class="tree-node professor-empty-node">
                <span class="tree-muted-line">
                    <span class="material-icons">info</span>
                    <span>No prof folder yet</span>
                </span>
            </div>
        `;

    return `
        <div class="tree-node professor-library-node">
            <button type="button" class="tree-toggle" data-folder="${escapeHtml(overviewFolderId)}" aria-expanded="false" title="${course} > ${year} > ${escapeHtml(subject)} > Professor Folders">
                <span class="material-icons expand-icon">expand_more</span>
                <span class="material-icons">co_present</span>
                <span class="folder-name">Professor Folders</span>
                <span class="folder-count">${professorLibraries.length} prof${professorLibraries.length === 1 ? '' : 's'}</span>
            </button>
            <div class="tree-children hidden">
                ${createAction}
                ${professorFolders}
            </div>
        </div>
    `;
}

/** Folder id for one lesson inside a category. */
function buildCategoryLessonFolderId(subjectFolderId, category, lesson) {
    return `${subjectFolderId}-${category}-${LESSON_FOLDER_MARKER}-${lesson}`;
}

/**
 * The lessons that actually have material in a folder, with their counts.
 *
 * Derived from the materials rather than from a list of lessons someone has to
 * maintain, so a lesson folder exists exactly when tht is something in it —
 * and an empty one can never be left behind.
 *
 * Sorted numerically, so "Lesson 2" comes before "Lesson 10" rather than after.
 */
function getLessonsInFolder(folderId) {
    const counts = new Map();

    getMaterialsByFolder(folderId).forEach(material => {
        const lesson = String(material.lesson || '').trim() || 'General';
        counts.set(lesson, (counts.get(lesson) || 0) + 1);
    });

    return Array.from(counts.entries())
        .map(([lesson, count]) => ({ lesson, count }))
        .sort((a, b) => a.lesson.localeCompare(b.lesson, undefined, { numeric: true, sensitivity: 'base' }));
}

/**
 * One category, with its lessons nested under it.
 *
 * A category used to be a leaf: clicking "Reference Books" dumped every file in
 * the subject onto the screen at once. Now it opens into the lessons it
 * contains, and the middle of the screen stays empty until a lesson is picked —
 * which is the whole point of the level.
 *
 * The category itself is still selectable (a `tree-toggle` both expands and
 * selects), so "show me everything in Reference Books" is still one click.
 */
function createCategoryTreeNode(course, year, subject, subjectFolderId, category) {
    const categoryFolderId = `${subjectFolderId}-${category}`;
    const categoryCount = getMaterialsByFolder(categoryFolderId).length;
    const label = MATERIAL_CATEGORIES_DISPLAY[category] || category;
    const path = `${course} > ${year} > ${subject} > ${label}`;
    const lessons = getLessonsInFolder(categoryFolderId);

    // A single unnamed lesson is not a level worth walking through, so a
    // category whose files are all unfiled stays a plain leaf.
    const worthNesting = lessons.length > 1 ||
        (lessons.length === 1 && lessons[0].lesson !== 'General');

    if (!worthNesting) {
        return `
            <div class="tree-node type-node subject-type-node">
                <button type="button" class="tree-leaf" data-folder="${escapeHtml(categoryFolderId)}" title="${escapeHtml(path)}">
                    <span class="material-icons">${getCategoryIcon(category)}</span>
                    <span class="folder-name">${escapeHtml(label)}</span>
                    <span class="folder-count">${categoryCount}</span>
                </button>
            </div>
        `;
    }

    return `
        <div class="tree-node type-node subject-type-node has-lessons">
            <button type="button" class="tree-toggle" data-folder="${escapeHtml(categoryFolderId)}" aria-expanded="false" title="${escapeHtml(path)}">
                <span class="material-icons expand-icon">expand_more</span>
                <span class="material-icons">${getCategoryIcon(category)}</span>
                <span class="folder-name">${escapeHtml(label)}</span>
                <span class="folder-count">${lessons.length} lesson${lessons.length === 1 ? '' : 's'}</span>
            </button>
            <div class="tree-children lesson-list hidden">
                ${lessons.map(({ lesson, count }) => {
                    const lessonFolderId = buildCategoryLessonFolderId(subjectFolderId, category, lesson);
                    const lessonLabel = lesson === 'General' ? 'Unfiled' : lesson;
                    return `
                        <div class="tree-node lesson-node">
                            <button type="button" class="tree-leaf" data-folder="${escapeHtml(lessonFolderId)}" title="${escapeHtml(path + ' > ' + lessonLabel)}">
                                <span class="material-icons">${lesson === 'General' ? 'folder_open' : 'topic'}</span>
                                <span class="folder-name">${escapeHtml(lessonLabel)}</span>
                                <span class="folder-count">${count}</span>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function createSubjectMaterialTree(course, year, subject) {
    const yearShort = getYearShortFromYear(year);
    const subjectFolderId = buildSubjectFolderId(course, yearShort, subject);
    const materialCount = getMaterialsByFolder(subjectFolderId).length;

    return `
        <div class="tree-node subject-materials-node">
            <button type="button" class="tree-toggle tree-section-toggle" data-folder="${escapeHtml(subjectFolderId)}" aria-expanded="false" title="${course} > ${year} > ${escapeHtml(subject)} > Study Materials">
                <span class="material-icons expand-icon">expand_more</span>
                <span class="material-icons">inventory_2</span>
                <span class="folder-name">Study Materials</span>
                <span class="folder-count">${materialCount} item${materialCount === 1 ? '' : 's'}</span>
            </button>
            <div class="tree-children subject-material-list hidden">
                ${FOLDER_MATERIAL_CATEGORIES
                    .map(category => createCategoryTreeNode(course, year, subject, subjectFolderId, category))
                    .join('')}
            </div>
        </div>
    `;
}

function createSubjectTreeNode(course, year, subject) {
    const yearShort = getYearShortFromYear(year);
    const subjectFolderId = buildSubjectFolderId(course, yearShort, subject);
    const professorLibraries = getProfessorLibrariesForSubject(course, year, subject);
    const materialCount = getMaterialsByFolder(subjectFolderId).length;

    return `
        <div class="tree-node subject-node">
            <button type="button" class="tree-toggle" data-folder="${escapeHtml(subjectFolderId)}" aria-expanded="false" title="${course} > ${year} > ${escapeHtml(subject)}">
                <span class="material-icons expand-icon">expand_more</span>
                <span class="material-icons">menu_book</span>
                <span class="folder-name">${escapeHtml(subject)}</span>
                <span class="folder-count">${materialCount} item${materialCount === 1 ? '' : 's'} / ${professorLibraries.length} prof${professorLibraries.length === 1 ? '' : 's'}</span>
            </button>
            <div class="tree-children hidden">
                ${createSubjectMaterialTree(course, year, subject)}
                ${createProfessorLibraryTree(course, year, subject)}
            </div>
        </div>
    `;
}

function populateLibraryFolderTree() {
    const dynamicTreeContainer = document.getElementById('dynamic-folder-tree');
    if (!dynamicTreeContainer) return;

    let treeHtml = '';
    for (const [course, courseLabel] of Object.entries(COURSE_FOLDERS)) {
        treeHtml += `
            <div class="folder-card-group course-tree" data-course="${course}">
                <div class="tree-node course-node">
                    <button type="button" class="tree-toggle" data-folder="${course}" aria-expanded="false" title="${courseLabel} materials">
                        <span class="material-icons expand-icon">expand_more</span>
                        <span class="material-icons">folder</span>
                        <span class="folder-name">${course}</span>
                        <span class="folder-count">${courseLabel}</span>
                    </button>
                    <div class="tree-children hidden">
        `;
        for (const year of COURSE_YEARS) {
            const yearShort = year.split(' ')[0]; // e.g., "1st"
            const yearNumber = yearShort.replace(/\D/g, '');
            const subjectFolders = getSubjectsForCourseYear(course, year)
                .map(subject => createSubjectTreeNode(course, year, subject))
                .join('');
            treeHtml += `
                <div class="tree-node year-node">
                    <button type="button" class="tree-toggle" data-folder="${course}-${yearShort}" title="${course} ${year} materials">
                        <span class="material-icons expand-icon">expand_more</span>
                        <span class="material-icons">filter_${yearNumber}</span>
                        <span class="folder-name">${year}</span>
                    </button>
                    <div class="tree-children hidden">
                        ${subjectFolders}
                    </div>
                </div>
            `;
        }
        treeHtml += `
                </div>
                </div>
            </div>
        `;
    }
    dynamicTreeContainer.innerHTML = treeHtml;
}

function switchLibraryCourse(course) {
    const normalizedCourse = course || 'all';
    document.querySelectorAll('.folder-card-group').forEach(group => {
        group.classList.toggle('hidden', normalizedCourse !== 'all' && group.dataset.course !== normalizedCourse);
    });
    document.querySelectorAll('#library-course-tabs .course-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.course === normalizedCourse);
    });
    document.querySelectorAll('.tree-toggle, .tree-leaf').forEach(el => el.classList.remove('active'));

    if (normalizedCourse === 'all') {
        selectFolder('all', document.getElementById('btn-all-materials'));
        return;
    }

    const courseOverviewBtn = document.querySelector(`.tree-toggle[data-folder="${normalizedCourse}"]`);
    if (courseOverviewBtn) {
        courseOverviewBtn.classList.add('active');
        selectFolder(normalizedCourse, courseOverviewBtn);
    } else {
        selectFolder(normalizedCourse);
    }
}

// No longer needed as folders are built dynamically and collapsed by default
// function collapseAllLibraryFolders() {
//     document.querySelectorAll('.tree-children').forEach(child => child.classList.add('hidden'));
//     document.querySelectorAll('.tree-toggle .expand-icon').forEach(icon => icon.textContent = 'expand_more');
// }

function populateYearFilter() {
    const yearSelect = document.getElementById('library-filter-year');
    if (!yearSelect) return;

    const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
    const currentValue = yearSelect.value;
    yearSelect.innerHTML = '<option value="">All Years</option>' +
        years.map(y => `<option value="${y.split(' ')[0]}" ${y.split(' ')[0] === currentValue ? 'selected' : ''}>${y}</option>`).join('');
}

function populateTypeFilter() {
    const typeSelect = document.getElementById('library-filter-type');
    if (!typeSelect) return;

    const currentValue = typeSelect.value;
    const typeOptions = ['PDF', 'Video', 'Handouts', 'Reference Books'];
    typeSelect.innerHTML = '<option value="">All File Types</option>' +
        typeOptions.map(type => `<option value="${escapeHtml(type)}" ${type === currentValue ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('');
}

function populateSubjectFilter() {
    const subjectSelect = document.getElementById('library-filter-subject');
    if (!subjectSelect) return;
    const yearFilter = document.getElementById('library-filter-year').value;
    const selectedYear = COURSE_YEARS.find(year => getYearShortFromYear(year) === yearFilter);
    const seededSubjects = selectedYear
        ? Object.keys(COURSE_FOLDERS).flatMap(course => getCurriculumSubjects(course, selectedYear))
        : Object.keys(COURSE_FOLDERS).flatMap(course => COURSE_YEARS.flatMap(year => getCurriculumSubjects(course, year)));
    const subjects = getAllLibraryFiles()
        .filter(file => !yearFilter || String(file.year || '').startsWith(yearFilter))
        .map(file => file.subject || file.topic)
        .filter(Boolean);

    const uniqueSubjects = [...new Set([...seededSubjects, ...subjects])].sort();
    const currentValue = subjectSelect.value;
    subjectSelect.innerHTML = '<option value="">All Subjects / Topics</option>' + 
        uniqueSubjects.map(s => `<option value="${escapeHtml(s)}" ${s === currentValue ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
    populateLessonFilter();
}

function getLessonsForSubject(course, year, subject = '') {
    const uploadedLessons = getAllLibraryFiles()
        .filter(file => {
            const fileYear = file.year || getYearForSubject(file.subject, file.discipline);
            return (!course || file.discipline === course) &&
                (!year || fileYear === year) &&
                (!subject || file.subject === subject);
        })
        .map(file => file.lesson)
        .filter(Boolean);
    return [...new Set(uploadedLessons)].sort((a, b) => {
        const left = Number(String(a).match(/\d+/)?.[0] || 0);
        const right = Number(String(b).match(/\d+/)?.[0] || 0);
        if (left && right && left !== right) return left - right;
        return String(a).localeCompare(String(b));
    });
}

function populateLessonFilter() {
    const lessonSelect = document.getElementById('library-filter-lesson');
    if (!lessonSelect) return;
    const subjectFilter = document.getElementById('library-filter-subject').value;
    const uploadedFiles = getAllLibraryFiles();
    
    let lessons = uploadedFiles
        .filter(f => (!subjectFilter || f.subject === subjectFilter) && (!currentFolderId || currentFolderId === 'all' || getMaterialsByFolder(currentFolderId).some(m => m.id === f.id)))
        .map(f => f.lesson).filter(Boolean);

    const uniqueLessons = [...new Set(lessons)].sort((a, b) => {
        const left = Number(String(a).match(/\d+/)?.[0] || 0);
        const right = Number(String(b).match(/\d+/)?.[0] || 0);
        if (left && right && left !== right) return left - right;
        return String(a).localeCompare(String(b));
    });
    lessonSelect.innerHTML = '<option value="">All Lessons</option>' + 
        uniqueLessons.map(l => `<option value="${l}">${l}</option>`).join('');
}

function populateTagFilter() {
    const tagSelect = document.getElementById('library-filter-tag');
    if (!tagSelect) return;
    const uploadedFiles = getMaterialsByFolder(currentFolderId || 'all'); // Filter tags based on current folder
    const tags = uploadedFiles.flatMap(file => normalizeTags(file.tags));
    const uniqueTags = [...new Set(tags)].sort();
    const currentValue = tagSelect.value;
    tagSelect.innerHTML = '<option value="">All Tags</option>' +
        uniqueTags.map(tag => `<option value="${escapeHtml(tag)}" ${tag === currentValue ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('');
}

function populateLibrarySearchSuggestions() {
    const datalist = document.getElementById('library-search-suggestions');
    if (!datalist) return;
    const files = getAllLibraryFiles();
    const suggestions = new Set();

    Object.entries(COURSE_FOLDERS).forEach(([course, courseLabel]) => {
        suggestions.add(courseLabel);
        COURSE_YEARS.forEach(year => {
            suggestions.add(`${course} ${year}`);
            getSubjectsForCourseYear(course, year).forEach(subject => {
                suggestions.add(subject);
                getProfessorLibrariesForSubject(course, year, subject).forEach(professor => {
                    suggestions.add(professor.professorName);
                    if (professor.professorUsername) suggestions.add(professor.professorUsername);
                });
            });
            getLessonsForSubject(course, year).forEach(lesson => suggestions.add(lesson));
            FOLDER_MATERIAL_CATEGORIES.forEach(category => suggestions.add(category));
        });
        FOLDER_MATERIAL_CATEGORIES.forEach(category => suggestions.add(category));
    });

    files.forEach(file => {
        suggestions.add(getMaterialTitle(file));
        if (file.discipline) suggestions.add(file.discipline);
        if (file.year) suggestions.add(file.year);
        if (file.subject) suggestions.add(file.subject);
        if (file.topic) suggestions.add(file.topic);
        if (file.lesson) suggestions.add(file.lesson);
        if (file.professorName) suggestions.add(file.professorName);
        if (file.professorUsername) suggestions.add(file.professorUsername);
        if (file.materialCategory) suggestions.add(file.materialCategory);
        normalizeTags(file.tags).forEach(tag => suggestions.add(tag));
    });

    datalist.innerHTML = [...suggestions]
        .filter(Boolean)
        .sort()
        .slice(0, 80)
        .map(value => `<option value="${escapeHtml(value)}"></option>`)
        .join('');
}

function applySearchSuggestion(value) {
    const term = String(value || '').trim();
    if (!term) return;
    const match = findFolderForSearchTerm(term);
    if (match) {
        const target = Array.from(document.querySelectorAll('.tree-leaf, .tree-toggle'))
            .find(button => button.dataset.folder === match || button.getAttribute('onclick')?.includes(match));
        if (target) {
            revealFolderButton(target);
            selectFolder(match, target);
        } else {
            selectFolder(match);
        }
    }
}

function findFolderForSearchTerm(term) {
    const normalizedTerm = term.toLowerCase();
    for (const course of Object.keys(COURSE_FOLDERS)) {
        for (const year of COURSE_YEARS) {
            const yearShort = year.split(' ')[0];
            const subject = getSubjectsForCourseYear(course, year).find(item => item.toLowerCase() === normalizedTerm);
            if (subject) {
                return buildSubjectFolderId(course, yearShort, subject);
            }
            const lesson = getLessonsForSubject(course, year).find(item => item.toLowerCase() === normalizedTerm);
            if (lesson) {
                return `${course}-${yearShort}-${LESSON_FOLDER_MARKER}-${lesson}`;
            }
        }
    }
    const file = getAllLibraryFiles().find(item =>
        [getMaterialTitle(item), item.subject, item.topic, item.lesson, item.year, getMaterialCategory(item)]
            .filter(Boolean)
            .some(value => String(value).toLowerCase() === normalizedTerm)
    );
    if (!file) return '';
    const year = file.year || getYearForSubject(file.subject, file.discipline);
    const yearShort = year ? year.split(' ')[0] : '';
    return [file.discipline, yearShort, file.subject, getMaterialCategory(file)].filter(Boolean).join('-');
}

function revealFolderButton(button) {
    const courseTree = button.closest('.course-tree');
    if (courseTree && courseTree.classList.contains('hidden')) {
        document.querySelectorAll('.course-tree').forEach(tree => tree.classList.add('hidden'));
        courseTree.classList.remove('hidden');
        const course = courseTree.dataset.course;
        document.querySelectorAll('.course-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.course === course);
        });
    }

    let parent = button.closest('.tree-children');
    while (parent) {
        parent.classList.remove('hidden');
        const toggle = parent.previousElementSibling;
        const icon = toggle?.querySelector('.expand-icon');
        if (icon) icon.textContent = 'expand_less';
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
        parent = parent.parentElement?.closest('.tree-children');
    }
}

function getYearForSubject(subject, course) {
    const match = getAllLibraryFiles().find(file =>
        (!course || file.discipline === course) &&
        subject &&
        (file.subject === subject || file.topic === subject) &&
        file.year
    );
    return match?.year || '';
}

function getAllLibraryFiles() {
    try {
        const savedFiles = JSON.parse(localStorage.getItem('coeLearningFiles') || '[]');
        if (!Array.isArray(savedFiles)) return [];

        // Rows marked `contentRef` were saved with their body stripped out, so
        // the ~5 MB localStorage quota did not reject the upload. The body
        // lives in IndexedDB; put it back before anything tries to preview or
        // download the file. Without this a video saves and then opens blank.
        return window.CoeLibraryStorage?.hydrateRecords
            ? window.CoeLibraryStorage.hydrateRecords(savedFiles)
            : savedFiles;
    } catch (error) {
        return [];
    }
}

/**
 * Write the list back, minus any body that belongs in IndexedDB.
 *
 * Always use this instead of setItem when the array came out of
 * getAllLibraryFiles(), because that array is hydrated: writing it back
 * verbatim puts every video and PDF into the ~5 MB localStorage quota and the
 * write throws.
 */
function saveLibraryFiles(files) {
    const rows = window.CoeLibraryStorage?.stripForStorage
        ? window.CoeLibraryStorage.stripForStorage(files)
        : files;

    try {
        localStorage.setItem('coeLearningFiles', JSON.stringify(rows));
        return true;
    } catch (error) {
        console.error('[library] could not save the material list', error);
        window.showLibraryToast?.('Could not save', 'Browser storage is full.', 'error');
        return false;
    }
}

function normalizeTags(tags) {
    if (Array.isArray(tags)) return tags.map(tag => String(tag).trim()).filter(Boolean);
    return String(tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
}

function getMaterialTitle(material) {
    return material.title || material.name || 'Untitled Material';
}

function getMaterialCategory(material) {
    if (material.materialCategory) {
        return String(material.materialCategory).toLowerCase().includes('reviewer') ? 'Handouts' : material.materialCategory;
    }
    if (material.type === 'Google Drive Link' || material.type === 'Link') return 'GDrive Links';
    if (material.type === 'Video') return 'Video Lectures';
    if (material.type === 'PDF' || String(material.fileType || '').includes('pdf')) return 'Handouts';
    if (String(material.type || '').toLowerCase().includes('reviewer')) return 'Handouts';
    return 'Lessons';
}

function getDisplayType(material) {
    const type = String(material.type || '').toLowerCase();
    if (type.includes('google') || type === 'link') return 'Google Drive Link';
    if (type.includes('video')) return 'Video';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('image')) return 'Image';
    if (type.includes('reviewer')) return 'Reviewer';
    if (type.includes('reference')) return 'Reference Book';
    if (type.includes('lesson')) return 'Lesson';
    return material.type || 'Document';
}

function getCategoryIcon(category) {
    const icons = {
        'Reference Books': 'auto_stories',
        'Handouts': 'fact_check',
        'Video Lectures': 'smart_display',
        'Lessons': 'menu_book',
        'GDrive Links': 'add_to_drive'
    };
    return icons[category] || 'folder';
}

function getMaterialSource(material) {
    return material.file || material.content || material.externalUrl || '';
}

/**
 * Can this source be dropped into an <iframe> or <video> src?
 *
 * Two shapes are allowed and nothing else:
 *
 *   * a `data:` URL of the expected type — how a material looks when the portal
 *     is running standalone off the filesystem;
 *   * a same-origin `/api/library/preview/...` path — how it looks when the
 *     shared library is serving the bytes.
 *
 * The check is a whitelist rather than "not javascript:" because this value
 * ends up in an element that executes what it is pointed at. Anything else,
 * including an arbitrary http(s) URL, falls through to the placeholder.
 */
function isRenderablePreviewSource(source, dataPrefix) {
    const value = String(source || '');
    if (dataPrefix && value.startsWith(dataPrefix)) return true;
    return value.startsWith('/api/library/preview/');
}

function isRecentlyUpdated(material) {
    const uploaded = new Date(material.uploadedAt || material.lastModified || 0);
    if (Number.isNaN(uploaded.getTime())) return false;
    const ageMs = Date.now() - uploaded.getTime();
    return ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24 * 7;
}

function getHoverPreviewText(material) {
    const type = getDisplayType(material);
    if (type === 'Video') return 'Video preview available. Open to play without leaving the library.';
    if (type === 'PDF') return 'PDF preview available. Open to review before downloading.';
    if (type === 'Google Drive Link') return 'Cloud link. Opens inside the viewer — no new tab.';
    const source = String(getMaterialSource(material) || '').trim();
    if (material.previewType === 'text' && source) {
        return `${source.slice(0, 140)}${source.length > 140 ? '...' : ''}`;
    }
    return `${getMaterialCategory(material)} for ${material.subject || material.lesson || 'this folder'}.`;
}

/**
 * Is this value safe to put behind a link the student can follow?
 *
 * The scheme is the whole check, and it is the only one that belongs here:
 * `javascript:` and `data:` are what turn an `href` into script execution, and
 * both are refused. Anything left is an ordinary web address.
 *
 * WHY THIS IS NO LONGER A HOST ALLOWLIST
 * --------------------------------------
 * It used to accept only Drive, Docs and two spellings of youtube.com. Two
 * things were wrong with that:
 *
 *   * The upload form accepts *any* http(s) link and labels it "External link",
 *     so every non-Google link saved cleanly and then previewed as "Link
 *     preview not available". The material existed and could not be opened by
 *     anybody — which reads as a broken upload, not as a policy.
 *   * The list also missed `youtu.be` and `m.youtube.com` — the two forms a
 *     phone's share sheet and the YouTube app actually copy. The links most
 *     likely to be pasted from a phone were the ones most likely to be refused.
 *
 * Nothing is framed on the strength of this function. Embedding goes through
 * `getEmbeddableUrl`, which still recognises only Google and YouTube, and the
 * CSP's `frame-src` refuses everything else at the browser level regardless.
 * So an arbitrary URL here can become a link to follow, never an iframe.
 */
function getSafeExternalUrl(value) {
    try {
        const url = new URL(String(value || ''));
        return ['https:', 'http:'].includes(url.protocol) ? url.toString() : '';
    } catch (error) {
        return '';
    }
}

/**
 * Turn a shared link into one that renders *inside* the viewer.
 *
 * WHY THIS EXISTS
 * ---------------
 * A Drive or YouTube link used to be a placeholder with an "Open Material"
 * button, and the button was a new tab. On a laptop that is a mild annoyance.
 * On a phone it is the difference between reading the material and not: the tab
 * opens in the browser's own chrome or hands off to the YouTube/Drive app, the
 * student loses the folder they were standing in, and coming back means finding
 * the library again from the sign-in page.
 *
 * Both providers publish an embeddable form of the same URL. Rewriting to it
 * means the material appears in the pane the student is already looking at —
 * the same place a PDF or an uploaded video appears — and Back still closes the
 * viewer rather than leaving the site.
 *
 * @param {string} value a URL that has already passed getSafeExternalUrl
 * @returns {string} an embeddable URL, or '' when the link has no embed form
 */
function getEmbeddableUrl(value) {
    let url;

    try {
        url = new URL(String(value || ''));
    } catch (error) {
        return '';
    }

    const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
    const path = url.pathname;

    // --- YouTube -----------------------------------------------------------
    //
    // `youtube-nocookie.com` rather than `youtube.com`: it serves the same
    // player without writing tracking cookies for a student who only opened a
    // lecture. Everything else about the embed is identical.
    if (host === 'youtu.be') {
        const id = path.slice(1).split('/')[0];
        return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        // Already an embed — leave it alone.
        if (path.startsWith('/embed/')) return url.toString();

        const watchId = url.searchParams.get('v');
        if (watchId) {
            const list = url.searchParams.get('list');
            return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(watchId)}` +
                (list ? `?list=${encodeURIComponent(list)}` : '');
        }

        // Shorts and /live/ both carry the id as the last path segment.
        const shortsMatch = path.match(/^\/(shorts|live|v)\/([^/]+)/);
        if (shortsMatch) {
            return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(shortsMatch[2])}`;
        }

        const list = url.searchParams.get('list');
        if (list) {
            return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}`;
        }

        return '';
    }

    // --- Google Drive ------------------------------------------------------
    if (host === 'drive.google.com') {
        // https://drive.google.com/file/d/<id>/view?usp=sharing
        const fileMatch = path.match(/^\/file\/d\/([^/]+)/);
        if (fileMatch) {
            return `https://drive.google.com/file/d/${encodeURIComponent(fileMatch[1])}/preview`;
        }

        // The older share form, still what some Drive clients copy.
        const openId = url.searchParams.get('id');
        if (path === '/open' && openId) {
            return `https://drive.google.com/file/d/${encodeURIComponent(openId)}/preview`;
        }

        // A whole shared folder. Drive has a dedicated embed for these; without
        // it a folder link is the one Drive shape that cannot be framed.
        const folderMatch = path.match(/^\/drive\/(?:u\/\d+\/)?folders\/([^/]+)/);
        if (folderMatch) {
            return `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderMatch[1])}#grid`;
        }

        return '';
    }

    // --- Google Docs / Sheets / Slides -------------------------------------
    if (host === 'docs.google.com') {
        /*
         * A form is answered rather than read, so it takes its live view with
         * `embedded=true` instead of a preview.
         *
         * Matched before the general rule and with its own pattern on purpose:
         * a form's shared URL is `/forms/d/e/<id>/viewform`, where the segment
         * after `/d/` is the literal "e". The general `\/d\/([^/]+)` below would
         * capture that "e" as the id and build a URL pointing at nothing.
         */
        const formMatch = path.match(/^\/forms\/d\/e\/([^/]+)/);
        if (formMatch) {
            return `https://docs.google.com/forms/d/e/${encodeURIComponent(formMatch[1])}/viewform?embedded=true`;
        }

        // /document/d/<id>/edit -> /document/d/<id>/preview. The same swap works
        // for spreadsheets and presentations, and is what Docs' own "Publish to
        // the web" produces.
        const docMatch = path.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
        if (!docMatch) return '';

        return `https://docs.google.com/${docMatch[1]}/d/${encodeURIComponent(docMatch[2])}/preview`;
    }

    return '';
}

function isCurrentUserEditor() {
    return String(libraryCurrentUser.role || '').toUpperCase() === 'ADMIN';
}

function getTreeChildren(toggleBtn) {
    if (!toggleBtn) return null;
    const nextSibling = toggleBtn.nextElementSibling;
    if (nextSibling?.classList.contains('tree-children')) {
        return nextSibling;
    }
    return toggleBtn.parentElement?.querySelector(':scope > .tree-children') || null;
}

function toggleFolderTree(element, children) {
    if (!children) {
        children = getTreeChildren(element);
    }
    if (children && children.classList.contains('tree-children')) {
        const isHidden = children.classList.contains('hidden');
        children.classList.toggle('hidden', !isHidden); // Toggle based on current hidden state
        element.setAttribute('aria-expanded', String(isHidden));
        
        const icon = element.querySelector('.expand-icon');
        if (icon) {
            icon.textContent = isHidden ? 'expand_less' : 'expand_more';
        }
    }
}

function filterFolderTree(e) {
    const searchTerm = String(e.target.value || '').trim().toLowerCase();
    const treeNodes = document.querySelectorAll('.tree-node');
    
    treeNodes.forEach(node => {
        const folderText = Array.from(node.querySelectorAll('.folder-name'))
            .map(el => el.textContent.toLowerCase())
            .join(' ');
        const matches = !searchTerm || folderText.includes(searchTerm);
        node.style.display = matches ? 'block' : 'none';
        if (matches) {
            let parentFolder = node.parentElement?.closest('.tree-children')?.previousElementSibling?.closest('.tree-node');
            while (parentFolder) {
                parentFolder.style.display = 'block';
                parentFolder = parentFolder.parentElement?.closest('.tree-children')?.previousElementSibling?.closest('.tree-node');
            }
        }
    });

    if (searchTerm) {
        document.querySelectorAll('.tree-node').forEach(node => {
            if (node.style.display === 'none') return;
            let parent = node.parentElement?.closest('.tree-children');
            while (parent) {
                parent.classList.remove('hidden');
                const toggle = parent.previousElementSibling;
                if (toggle) toggle.setAttribute('aria-expanded', 'true');
                const icon = toggle?.querySelector('.expand-icon');
                if (icon) icon.textContent = 'expand_less';
                parent = parent.parentElement?.closest('.tree-children');
            }
        });
    }

    const folderCardGroups = document.querySelectorAll('.folder-card-group');
    folderCardGroups.forEach(group => {
        const hasVisibleNodes = Array.from(group.querySelectorAll('.tree-node')).some(node => node.style.display !== 'none');
        group.classList.toggle('hidden', !hasVisibleNodes);
    });
}

function selectFolder(folderId, element) {
    currentFolderId = folderId;
    window.currentFolderId = folderId;
    if (element) {
        revealFolderButton(element);
    }
    
    // Sync top bar filters
    const yearSelect = document.getElementById('library-filter-year');
    const subjectSelect = document.getElementById('library-filter-subject');
    const typeSelect = document.getElementById('library-filter-type');
    const lessonSelect = document.getElementById('library-filter-lesson');
    if (folderId === 'all') {
        if (yearSelect) yearSelect.value = '';
        if (subjectSelect) subjectSelect.value = '';
        if (typeSelect) typeSelect.value = '';
        if (lessonSelect) lessonSelect.value = '';
    } else {
        const parts = parseFolderParts(folderId);
        if (parts.yearShort && yearSelect) {
            yearSelect.value = parts.yearShort;
        } else if (yearSelect) {
            yearSelect.value = '';
        }
        populateSubjectFilter(); // Re-populate subjects based on selected year
        if (parts.subject && subjectSelect) {
            subjectSelect.value = parts.subject;
        } else if (subjectSelect) {
            subjectSelect.value = '';
        }
        populateLessonFilter(); // Re-populate lessons based on selected subject
        if (lessonSelect) {
            lessonSelect.value = parts.lesson || '';
        }
        if (parts.category && typeSelect) {
            typeSelect.value = MATERIAL_CATEGORIES_DISPLAY[parts.category] || parts.category;
        } else if (typeSelect) {
            typeSelect.value = '';
        }
    }
    populateLessonFilter(); // Always call to ensure lessons are updated
    populateTagFilter(); // Always call to ensure tags are updated
    
    // Update active state
    document.querySelectorAll('.tree-toggle, .tree-leaf').forEach(el => {
        el.classList.remove('active');
    });
    if (element) {
        element.classList.add('active');
    }

    // Update breadcrumb
    updateBreadcrumb(folderId);
    updateFolderContext(folderId);

    // Display materials for this folder
    displayMaterialCards(folderId);

    // Update Right Panel Suggestions
    displayRelatedMaterials(folderId);
    displayRelatedQA(folderId);
}

function updateBreadcrumb(folderId) {
    const breadcrumb = document.getElementById('library-breadcrumb');
    if (!breadcrumb) return;
    const parts = parseFolderParts(folderId);
    const labels = [parts.courseLabel, parts.year, parts.subject];
    if (parts.isProfessorLibrary) labels.push('Professor Folders');
    if (parts.professorName) labels.push(parts.professorName);
    labels.push(parts.category, parts.lesson);
    breadcrumb.textContent = labels.filter(Boolean).join(' > ') || 'All Materials';
}

function parseFolderParts(folderId) {
    if (!folderId || folderId === 'all') {
        return { course: '', courseLabel: 'All Materials', yearShort: '', year: '', subject: '', category: '', lesson: '', professorKey: '', professorName: '', isProfessorLibrary: false };
    }
    const parts = folderId.split('-');
    const course = parts[0] || '';
    const yearShort = parts[1] || '';
    const year = yearShort ? `${yearShort} Year` : '';
    const lessonMarkerIndex = parts.indexOf(LESSON_FOLDER_MARKER);
    const professorMarkerIndex = parts.indexOf(PROFESSOR_FOLDER_MARKER);
    const hasLesson = lessonMarkerIndex > -1;
    const hasProfessorLibrary = professorMarkerIndex > -1;
    const lastPart = parts.at(-1);
    const hasCategory = !hasLesson && !hasProfessorLibrary && MATERIAL_CATEGORIES.includes(lastPart);

    /*
     * A lesson folder now lives *inside* a category:
     *
     *   CE-1st-MAT 171-Reference Books-__lesson__-Lesson 3
     *
     * so the segment immediately before the marker may be a category. Without
     * this the category would be swallowed into the subject — the id above
     * would parse its subject as "MAT 171-Reference Books" and find nothing.
     *
     * The older shape with no category (CE-1st-MAT 171-__lesson__-Lesson 3)
     * still parses: there is simply no category segment to find.
     */
    const categoryBeforeLesson = hasLesson && lessonMarkerIndex > 2 &&
        MATERIAL_CATEGORIES.includes(parts[lessonMarkerIndex - 1])
            ? parts[lessonMarkerIndex - 1]
            : '';

    const subjectEnd = hasProfessorLibrary
        ? professorMarkerIndex
        : (hasLesson
            ? (categoryBeforeLesson ? lessonMarkerIndex - 1 : lessonMarkerIndex)
            : (hasCategory ? -1 : undefined));
    const subject = parts.length > 2 ? parts.slice(2, subjectEnd).join('-') : '';
    const professorCandidate = hasProfessorLibrary
        ? decodeFolderSegment(parts.slice(professorMarkerIndex + 1).join('-'))
        : '';
    const fullProfessorMatch = professorCandidate
        ? getProfessorLibrariesForSubject(course, year, subject).some(record =>
            normalizeIdentity(record.professorUsername || record.professorName) === normalizeIdentity(professorCandidate)
        )
        : false;
    const hasProfessorCategory = hasProfessorLibrary && !fullProfessorMatch && MATERIAL_CATEGORIES.includes(lastPart) && parts.length > professorMarkerIndex + 2;
    const category = categoryBeforeLesson || (hasCategory || hasProfessorCategory ? lastPart : '');
    const lesson = hasLesson ? parts.slice(lessonMarkerIndex + 1).join('-') : '';
    const professorKeyEnd = hasProfessorCategory ? -1 : undefined;
    const professorKey = hasProfessorLibrary ? decodeFolderSegment(parts.slice(professorMarkerIndex + 1, professorKeyEnd).join('-')) : '';
    const parsed = {
        course,
        courseLabel: course === 'CE' ? 'Civil Engineering' : (course === 'EE' ? 'Electrical Engineering' : course),
        yearShort,
        year,
        subject,
        category,
        lesson,
        professorKey,
        professorName: '',
        isProfessorLibrary: hasProfessorLibrary
    };
    parsed.professorName = getProfessorNameFromFolderParts(parsed);
    return parsed;
}

/**
 * Switch the library between its two layouts.
 *
 * BROWSE (folder = "all")
 *   Three columns: folder tree, material grid, and the suggestion rail
 *   (Related Materials, Quick Questions, Bookmarks). Library-wide counters
 *   across the top. This is the "what is in here" view.
 *
 * FOLDER (any other folder)
 *   The material grid takes the whole width beside the tree. The suggestion
 *   rail is gone, the library-wide counters are gone, and the Year and Subject
 *   dropdowns are gone — the folder already answers all three, and leaving
 *   them on screen while they cannot change anything is what made the page
 *   feel busy. What is left is the folder's own header and its files.
 *
 * The class goes on `.library-wrapper` rather than each element so the whole
 * switch is one line of state, and CSS decides what it means.
 */
function applyLibraryFolderView(folderId) {
    const wrapper = document.querySelector('#library-panel .library-wrapper');
    if (!wrapper) return;
    wrapper.classList.toggle('is-folder-view', Boolean(folderId) && folderId !== 'all');
}

function updateFolderContext(folderId) {
    const context = document.getElementById('library-folder-context');
    applyLibraryFolderView(folderId);
    if (!context) return;
    const parts = parseFolderParts(folderId);
    const files = getMaterialsByFolder(folderId);
    const canUpload = Boolean(libraryCurrentUser);
    const labels = [parts.courseLabel, parts.year, parts.subject];
    if (parts.isProfessorLibrary) labels.push('Professor Folders');
    if (parts.professorName) labels.push(parts.professorName);
    labels.push(parts.category, parts.lesson);
    const folderLabel = labels.join(' / ') || 'All Materials';

    /*
     * The header reads as a trail plus a name — "CE / 1st Year / MAT 171" over
     * "Reference Books" — instead of one long slash-separated string in bold.
     * At four or five levels deep that string wrapped to three lines and the
     * part that mattered, the folder you are actually in, was the hardest to
     * find in it.
     */
    const trail = labels.filter(Boolean);
    const folderName = trail.length ? trail[trail.length - 1] : 'All Materials';
    const parentTrail = trail.slice(0, -1).join(' / ');
    const isFocused = Boolean(folderId) && folderId !== 'all';
    const videos = files.filter(file => getDisplayType(file) === 'Video').length;
    const pdfs = files.filter(file => getDisplayType(file) === 'PDF').length;
    const updated = files.filter(isRecentlyUpdated).length;
    const bookmarked = getLibraryFolderBookmarks().includes(folderId || 'all');
    const uploadZone = '';
    const professorCount = parts.course && parts.subject
        ? getProfessorLibrariesForSubject(parts.course, parts.year, parts.subject).length
        : 0;
    const canCreateProfessorLibrary = isLibraryFacultyOrAdmin() && Boolean(parts.course) && Boolean(parts.subject);
    const professorButton = canCreateProfessorLibrary
        ? `<button type="button" class="setting-btn professor-library-btn" data-action="create-professor-library">Create Prof Folder</button>`
        : '';
    const professorMeta = parts.course && parts.subject
        ? ` | ${professorCount} prof folder${professorCount === 1 ? '' : 's'}`
        : '';

    context.innerHTML = `
        ${isFocused ? `
        <button type="button" class="folder-back-btn" data-action="library-back">
            <span class="material-icons" aria-hidden="true">arrow_back</span>
            All Materials
        </button>` : ''}
        <div class="folder-context-heading">
            <span class="folder-context-label">${escapeHtml(isFocused ? (parentTrail || 'Library') : 'Folder Focus')}</span>
            <strong title="${escapeHtml(folderLabel)}">${escapeHtml(folderName)}</strong>
        </div>
        <p>${files.length} material${files.length === 1 ? '' : 's'} | ${videos} video${videos === 1 ? '' : 's'} | ${pdfs} PDF${pdfs === 1 ? '' : 's'} | ${updated} new or updated${professorMeta}</p>
        <div class="folder-context-actions">
            ${professorButton}
            ${canUpload ? `<button type="button" class="setting-btn folder-upload-btn">Upload Material</button>` : ''}
            <button type="button" class="folder-bookmark-btn ${bookmarked ? 'active' : ''}" data-action="bookmark-folder" title="Bookmark folder">
                <span class="material-icons">${bookmarked ? 'bookmark' : 'bookmark_border'}</span>
            </button>
        </div>
        ${uploadZone}
    `;
}

function displayMaterialCards(folderId) {
    folderId = folderId || currentFolderId;
    
    let materials = getMaterialsByFolder(folderId);
    
    // Apply filters
    const typeFilter = document.getElementById('library-filter-type').value;
    const yearFilter = document.getElementById('library-filter-year').value;
    const subjectFilter = document.getElementById('library-filter-subject').value;
    const lessonFilter = document.getElementById('library-filter-lesson').value;
    const tagFilter = document.getElementById('library-filter-tag')?.value || '';
    const searchTerm = document.getElementById('library-search-enhanced').value.toLowerCase();
    const sortBy = document.getElementById('library-filter-sort').value;

    materials = materials.filter(m => {        
        const materialType = getDisplayType(m);
        const tags = normalizeTags(m.tags);
        const title = getMaterialTitle(m);
        const materialCategory = getMaterialCategory(m);
        const typeMatch = !typeFilter ||
            materialType === typeFilter || // Match by display type (e.g., 'PDF', 'Video')
            materialCategory === typeFilter ||
            MATERIAL_CATEGORIES_DISPLAY[materialCategory] === typeFilter || // Match by category display name
            (typeFilter === 'Handouts' && materialCategory === 'Handouts') ||
            (typeFilter === 'Reference Books' && materialCategory === 'Reference Books') ||
            (typeFilter === 'Google Drive Link' && materialType === 'Google Drive Link'); // Specific for GDrive
        const yearMatch = !yearFilter || String(m.year || getYearForSubject(m.subject, m.discipline)).startsWith(yearFilter);
        const subjectMatch = !subjectFilter || m.subject === subjectFilter;
        const lessonMatch = !lessonFilter || m.lesson === lessonFilter;
        const tagMatch = !tagFilter || tags.includes(tagFilter);

        const searchMatch = !searchTerm || 
            title.toLowerCase().includes(searchTerm) ||
            String(m.subject || '').toLowerCase().includes(searchTerm) ||
            String(m.professorName || '').toLowerCase().includes(searchTerm) ||
            String(m.professorUsername || '').toLowerCase().includes(searchTerm) ||
            String(m.materialCategory || '').toLowerCase().includes(searchTerm) ||
            String(m.version || '').toLowerCase().includes(searchTerm) ||
            tags.join(' ').toLowerCase().includes(searchTerm) ||
            (m.lesson && m.lesson.toLowerCase().includes(searchTerm));
        return typeMatch && yearMatch && subjectMatch && lessonMatch && tagMatch && searchMatch;
    });

    // Sort
    materials.sort((a, b) => {
        switch(sortBy) {
            case 'recent': return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
            case 'mostviewed': return (b.views || 0) - (a.views || 0);
            case 'name': return getMaterialTitle(a).localeCompare(getMaterialTitle(b));
            case 'oldest': return new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0);
            default: return 0;
        }
    });

    const container = document.getElementById('library-cards-container');
    if (!container) return;
    if (materials.length === 0) {
        container.classList.remove('list-view');
        container.innerHTML = '<p class="empty-library">No uploaded materials yet. New files will appear here after someone uploads them.</p>';
        updateLibraryStats([]);
        return;
    }

    if (currentLibraryView === 'list') {
        container.classList.add('list-view');
        container.innerHTML = `
            <div class="lib-explorer" role="table" aria-label="Materials in this folder">
                <!--
                    Three columns, and exactly three headers.

                    There used to be a separate Lesson column beside Name. Two
                    text columns side by side is what kept collapsing on top of
                    each other whenever a rule from the main stylesheet beat the
                    grid — the header read "NAMELESSON" in one place. The lesson
                    is now the row's own heading, so there is nothing to collide
                    with and one less column to lose.
                -->
                <div class="lib-explorer-head" role="row">
                    <span role="columnheader">Lesson &amp; topic</span>
                    <span role="columnheader" class="lib-col-size">Size</span>
                    <span role="columnheader">Modified</span>
                </div>
                <div class="lib-explorer-body">
                    ${materials.map(material => createMaterialRow(material)).join('')}
                </div>
            </div>
        `;
    } else {
        container.classList.remove('list-view'); // Remove class for grid view styling
        container.innerHTML = materials.map(material => createMaterialCard(material)).join('');
    }

    // Open on click, and on Enter/Space for the keyboard — a row carries
    // tabindex, so it has to answer the keyboard the way a button does.
    document.querySelectorAll('.material-card, .material-row, .lib-row').forEach(row => {
        row.addEventListener('click', function () {
            openMaterialDetail(this.dataset.materialId);
        });

        row.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            // Let a focused action button handle its own key press.
            if (event.target.closest('button')) return;
            event.preventDefault();
            openMaterialDetail(this.dataset.materialId);
        });
    });

    updateLibraryStats(materials);
}

// New function for creating material cards (grid view)
function getMaterialPathLabel(material) {
    return [material.discipline, material.year || getYearForSubject(material.subject, material.discipline), material.subject, material.professorName, material.lesson]
        .filter(Boolean)
        .join(' / ');
}

/**
 * Bytes as a file manager writes them: "2.4 MB", not "2458 KB".
 *
 * Returns an em dash rather than "0 B" for links, which have no size — a
 * column of zeroes reads as broken data.
 */
function formatMaterialSize(bytes) {
    const size = Number(bytes || 0);
    if (!size) return '—';

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, index);

    // Whole bytes and KB; one decimal from MB up, where it starts to matter.
    return (index < 2 ? Math.round(value) : value.toFixed(1)) + ' ' + units[index];
}

/**
 * Date the way a file list shows it: time for today, weekday for this week,
 * a plain date after that. Absolute rather than "3 days ago", because a file
 * list is scanned and compared, not read.
 */
function formatMaterialDate(isoString) {
    if (!isoString) return '—';

    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '—';

    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const days = Math.floor((now - date) / 86400000);
    if (days >= 0 && days < 7) {
        return date.toLocaleDateString([], { weekday: 'short' }) + ' ' +
            date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Which lesson this material belongs to.
 *
 * The whole point of the column: a student scanning a folder needs to know
 * which lesson a file is for before opening it. "General" is what the upload
 * form defaults to and means "not filed under a lesson", so it is shown as a
 * dash rather than as a lesson that does not exist.
 */
function getMaterialLessonLabel(material) {
    const lesson = String(material.lesson || '').trim();
    if (!lesson || lesson.toLowerCase() === 'general') return '—';
    return lesson;
}

/**
 * The name to show, which is not always the stored title.
 *
 * Uploads made from a folder were auto-titled from the folder itself —
 * "OE 025 - CHEMISTRY FOR ENGINEERS - Reference Books" — so a folder of ten
 * files showed ten identical names and a student could not tell them apart.
 * Where the title is only the folder read back, the original filename is used
 * instead, which is the one thing that actually differs between rows.
 */
function getMaterialDisplayName(material) {
    const title = String(getMaterialTitle(material) || '').trim();
    const original = String(material.originalName || '').trim();

    // What the folder auto-title would have produced for this material.
    const folderEcho = [material.subject, material.professorName, getMaterialCategory(material)]
        .filter(Boolean)
        .join(' - ')
        .toLowerCase();

    const isFolderEcho = title.toLowerCase() === folderEcho ||
        // Also catch the category on its own, e.g. a file simply called
        // "Reference Books".
        title.toLowerCase() === String(getMaterialCategory(material) || '').toLowerCase();

    if (isFolderEcho && original) return original;
    return title || original || 'Untitled';
}

/**
 * One row of the file-explorer list.
 *
 * Replaces the previous card, which stacked a chip, a type, a date, a title, a
 * description, a folder path, a tag row and eight buttons into one tile — so a
 * folder of ten files was a wall of boxes you had to read rather than a list
 * you could scan.
 *
 * The columns are the ones a file manager shows, in that order: name, type,
 * size, modified, owner. Actions stay out of the flow until the row is hovered
 * or focused, which is what keeps the line quiet.
 */
function createMaterialRow(material) {
    const isCompleted = isLibraryMaterialCompleted(material.id);
    const isBookmarked = isLibraryMaterialBookmarked(material.id);
    const materialType = getDisplayType(material);
    const materialCategory = getMaterialCategory(material);
    const title = getMaterialTitle(material);
    const toneClass = getMaterialToneClass(materialType, materialCategory);
    const uploader = material.uploadedBy || material.ownerUsername || 'Unknown';
    const canEditDelete = isCurrentUserEditor() ||
        String(material.ownerUsername || '').toLowerCase() === String(libraryCurrentUser.username || '').toLowerCase();

    const displayName = getMaterialDisplayName(material);
    const lessonLabel = getMaterialLessonLabel(material);
    const isRejected = String(material.status || '').toUpperCase() === 'REJECTED';

    /*
     * What the row is called.
     *
     * The lesson the uploader typed, whenever there is one. Every row in a
     * category folder used to read "Reference Books" — the folder's own name,
     * repeated back at a student who had just clicked into it, telling them
     * nothing about which lesson the file belonged to.
     *
     * The filename drops to the second line, where it still identifies the
     * file without being the thing a student has to read to navigate.
     */
    const original = String(material.originalName || '').trim();
    const hasLesson = lessonLabel !== '—';

    /*
     * A row must never be nameless.
     *
     * Records saved before the library moved to the server can reach here with
     * no lesson, no title and no original filename, and the row rendered as a
     * bare icon with nothing beside it — three blank lines that gave a student
     * no way to tell one file from another.
     */
    const heading = (hasLesson ? lessonLabel : '') ||
        displayName ||
        original ||
        String(material.name || '').trim() ||
        'Untitled file';

    /*
     * Second line: the topic, then the file.
     *
     * The lesson alone does not say which subject it belongs to, and "Lesson 1"
     * means different things under Chemistry and under Calculus. Both are
     * needed before deciding what to open.
     */
    const subjectLabel = String(material.subject || '').trim();
    const fileLine = original || displayName;

    const subtitleParts = [];
    if (subjectLabel) subtitleParts.push(subjectLabel);
    // Never repeat the heading underneath itself.
    if (fileLine && fileLine !== heading) subtitleParts.push(fileLine);

    const subtitle = subtitleParts.join(' · ') ||
        String(material.description || '').trim() ||
        uploader;

    /*
     * Review state.
     *
     * The list only ever holds approved material — the API filters everything
     * else out for non-moderators — so `Pending` is only reachable from the
     * moderator queue. Kept because that queue renders these same rows.
     */
    const isPending = String(material.status || '').toUpperCase() === 'PENDING';

    let stateBadge = '';
    if (isPending) {
        stateBadge = '<span class="lib-badge is-pending" title="Waiting for an admin to approve it">Pending</span>';
    } else if (isRecentlyUpdated(material)) {
        stateBadge = '<span class="lib-badge is-new">New</span>';
    }

    return `
        <div class="lib-row ${toneClass} ${isCompleted ? 'is-done' : ''} ${isPending ? 'is-pending-row' : ''} ${isRejected ? 'is-rejected-row' : ''}"
             role="row" tabindex="0" data-material-id="${material.id}"
             aria-label="${escapeHtml(title)}, ${escapeHtml(materialType)}${isPending ? ', waiting for approval, visible only to you' : ''}${isRejected ? ', not approved, visible only to you' : ''}">
            <span class="lib-cell lib-name" role="cell" title="${escapeHtml(heading)}">
                <span class="lib-icon material-icons" aria-hidden="true">${getMaterialTypeIcon(materialType)}</span>
                <span class="lib-name-text">
                    <span class="lib-title">${escapeHtml(heading)}${stateBadge}</span>
                    <span class="lib-path">${escapeHtml(subtitle)}${
                        isPending ? ' · only you can see this until an admin approves it'
                                  : (isRejected ? ' · not approved' : '')
                    }</span>
                </span>
            </span>
            <span class="lib-cell lib-col-size" role="cell">${escapeHtml(formatMaterialSize(material.size))}</span>
            <span class="lib-cell lib-modified" role="cell">${escapeHtml(formatMaterialDate(material.uploadedAt))}</span>
            <span class="lib-cell lib-col-actions" role="cell">
                <button type="button" class="lib-act" title="Open" aria-label="Open ${escapeHtml(title)}"
                        onclick="event.stopPropagation(); openMaterialDetail('${material.id}');">
                    <span class="material-icons">visibility</span>
                </button>
                <button type="button" class="lib-act" title="Comments" aria-label="Comments on ${escapeHtml(title)}"
                        onclick="event.stopPropagation(); openMaterialComments('${material.id}');">
                    <span class="material-icons">comment</span>
                </button>
                <button type="button" class="lib-act ${isBookmarked ? 'is-on' : ''}"
                        title="${isBookmarked ? 'Remove bookmark' : 'Bookmark'}"
                        aria-label="${isBookmarked ? 'Remove bookmark' : 'Bookmark'} ${escapeHtml(title)}"
                        onclick="event.stopPropagation(); toggleBookmarkFromCard('${material.id}');">
                    <span class="material-icons">${isBookmarked ? 'bookmark' : 'bookmark_border'}</span>
                </button>
                <button type="button" class="lib-act ${isCompleted ? 'is-on' : ''}"
                        title="${isCompleted ? 'Mark not done' : 'Mark done'}"
                        aria-label="${isCompleted ? 'Mark not done' : 'Mark done'}"
                        onclick="event.stopPropagation(); toggleCompleteFromCard('${material.id}');">
                    <span class="material-icons">${isCompleted ? 'check_circle' : 'check_circle_outline'}</span>
                </button>
                ${canEditDelete ? `
                    <button type="button" class="lib-act" title="Rename or edit" aria-label="Edit ${escapeHtml(title)}"
                            onclick="event.stopPropagation(); window.openEditFileModal('${material.id}');">
                        <span class="material-icons">edit</span>
                    </button>
                    <button type="button" class="lib-act is-danger" title="Delete" aria-label="Delete ${escapeHtml(title)}"
                            onclick="event.stopPropagation(); window.deleteUploadedFile('${material.id}');">
                        <span class="material-icons">delete_outline</span>
                    </button>
                ` : ''}
            </span>
        </div>
    `;
}

function getMaterialToneClass(materialType, materialCategory) {
    const normalized = `${materialType} ${materialCategory}`.toLowerCase();
    if (normalized.includes('video')) return 'file-tone-video';
    if (normalized.includes('reference')) return 'file-tone-reference';
    if (normalized.includes('handout') || normalized.includes('pdf')) return 'file-tone-pdf';
    if (normalized.includes('link') || normalized.includes('drive')) return 'file-tone-link';
    return 'file-tone-lesson';
}

function createMaterialCard(material) {
    const isCompleted = isLibraryMaterialCompleted(material.id);
    const isBookmarked = isLibraryMaterialBookmarked(material.id);
    const materialType = getDisplayType(material);
    const materialCategory = getMaterialCategory(material);
    const title = getMaterialTitle(material);
    const tags = normalizeTags(material.tags);
    const dateDisplay = material.uploadedAt ? formatShortDate(material.uploadedAt) : 'Recent';
    const uploader = material.uploadedBy || material.ownerUsername || 'Unknown';
    const canEditDelete = isCurrentUserEditor() ||
        String(material.ownerUsername || '').toLowerCase() === String(libraryCurrentUser.username || '').toLowerCase();
    const categoryLabel = MATERIAL_CATEGORIES_DISPLAY[materialCategory] || materialCategory;
    const previewText = material.description || getHoverPreviewText(material);
    const toneClass = getMaterialToneClass(materialType, materialCategory);
    const pathLabel = getMaterialPathLabel(material) || 'General Library';
    const newClass = isRecentlyUpdated(material) ? 'is-new' : '';
    const professorLabel = material.professorName ? `<span>${escapeHtml(material.professorName)}</span>` : '';

    return `
        <article class="material-card classroom-post-card ${toneClass} ${newClass} ${isCompleted ? 'completed' : ''}" data-material-id="${material.id}">
            <div class="post-file-icon" aria-hidden="true">
                <span class="material-icons">${getMaterialTypeIcon(materialType)}</span>
            </div>
            <div class="post-main">
                <div class="post-meta-line">
                    <span class="post-type-chip">${escapeHtml(categoryLabel)}</span>
                    <span>${escapeHtml(materialType)}</span>
                    <span>${escapeHtml(dateDisplay)}</span>
                    ${professorLabel}
                </div>
                <h3>${escapeHtml(title)}</h3>
                <p class="material-card-description">${escapeHtml(previewText)}</p>
                <div class="post-folder-path">
                    <span class="material-icons">folder_open</span>
                    <span>${escapeHtml(pathLabel)}</span>
                </div>
                <div class="material-hover-preview">
                    <strong>Preview</strong>
                    <span>${escapeHtml(getHoverPreviewText(material))}</span>
                </div>
                <div class="tag-row">
                    ${tags.slice(0, 3).map(tag => `<span class="tag-chip muted">${escapeHtml(tag)}</span>`).join('')}
                    ${isCompleted ? '<span class="tag-chip">Completed</span>' : ''}
                </div>
            </div>
            <div class="material-card-quick-actions">
                <button class="icon-action-btn" onclick="event.stopPropagation(); openMaterialDetail('${material.id}');" title="View" aria-label="View ${escapeHtml(title)}">
                    <span class="material-icons">visibility</span>
                </button>
                <button class="icon-action-btn" onclick="event.stopPropagation(); openMaterialComments('${material.id}');" title="Comment" aria-label="Comment on ${escapeHtml(title)}">
                    <span class="material-icons">comment</span>
                </button>
                <button class="icon-action-btn ${isBookmarked ? 'active' : ''}" onclick="event.stopPropagation(); toggleBookmarkFromCard('${material.id}');" title="${isBookmarked ? 'Remove bookmark' : 'Bookmark'}" aria-label="${isBookmarked ? 'Remove bookmark' : 'Bookmark'}">
                    <span class="material-icons">${isBookmarked ? 'bookmark' : 'bookmark_border'}</span>
                </button>
                <button class="icon-action-btn ${isCompleted ? 'active' : ''}" onclick="event.stopPropagation(); toggleCompleteFromCard('${material.id}');" title="${isCompleted ? 'Mark incomplete' : 'Mark complete'}" aria-label="${isCompleted ? 'Mark incomplete' : 'Mark complete'}">
                    <span class="material-icons">${isCompleted ? 'check_circle' : 'check_circle_outline'}</span>
                </button>
                ${canEditDelete ? `
                    <button class="icon-action-btn" onclick="event.stopPropagation(); window.openEditFileModal('${material.id}');" title="Edit" aria-label="Edit">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="icon-action-btn danger" onclick="event.stopPropagation(); window.deleteUploadedFile('${material.id}');" title="Delete" aria-label="Delete">
                        <span class="material-icons">delete</span>
                    </button>
                ` : ''}
                <span class="post-uploader">${escapeHtml(uploader)}</span>
            </div>
        </article>
    `;
}

/*
 * A second `createMaterialRow` used to sit here.
 *
 * Function declarations hoist, so this later copy silently won over the real
 * one — the list rendered the old three-column row no matter what the earlier
 * definition said. Removed rather than renamed: it was a duplicate of
 * `createClassroomMaterialRow` below, which is itself now unused by the list
 * view but kept because other call sites may still reach for it.
 */

function createClassroomMaterialRow(material) {
    const isCompleted = isLibraryMaterialCompleted(material.id);
    const isBookmarked = isLibraryMaterialBookmarked(material.id);
    const materialType = getDisplayType(material);
    const materialCategory = getMaterialCategory(material);
    const title = getMaterialTitle(material);
    const tags = normalizeTags(material.tags);
    const dateDisplay = material.uploadedAt ? formatShortDate(material.uploadedAt) : 'Recent';
    const categoryLabel = MATERIAL_CATEGORIES_DISPLAY[materialCategory] || materialCategory;
    const toneClass = getMaterialToneClass(materialType, materialCategory);
    const pathLabel = getMaterialPathLabel(material) || 'General Library';

    return `
        <div class="material-row classroom-post-row ${toneClass} ${isCompleted ? 'completed' : ''}" data-material-id="${material.id}">
            <div class="row-title">
                <span class="material-icon-row material-icons">${getMaterialTypeIcon(materialType)}</span>
                <div>
                    <strong>${escapeHtml(title)}</strong>
                    <p>${escapeHtml(pathLabel)}${tags.length ? ' | ' + escapeHtml(tags.slice(0, 3).join(', ')) : ''}</p>
                </div>
            </div>
            <span class="post-type-chip">${escapeHtml(categoryLabel)}</span>
            <span>${escapeHtml(material.lesson || 'General')}</span>
            <span>${escapeHtml(dateDisplay)}</span>
            <span class="row-actions">
                <button class="icon-action-btn" onclick="event.stopPropagation(); openMaterialDetail('${material.id}');" title="View" aria-label="View">
                    <span class="material-icons">visibility</span>
                </button>
                <button class="icon-action-btn" onclick="event.stopPropagation(); openMaterialComments('${material.id}');" title="Comment" aria-label="Comment">
                    <span class="material-icons">comment</span>
                </button>
                <button class="icon-action-btn ${isBookmarked ? 'active' : ''}" onclick="event.stopPropagation(); toggleBookmarkFromCard('${material.id}');" title="Bookmark" aria-label="Bookmark">
                    <span class="material-icons">${isBookmarked ? 'bookmark' : 'bookmark_border'}</span>
                </button>
            </span>
        </div>
    `;
}

function toggleBookmarkFromCard(id) {
    currentMaterial = { id };
    toggleBookmark();
    displayMaterialCards(currentFolderId);
}

function toggleCompleteFromCard(id) {
    currentMaterial = { id };
    toggleMaterialComplete();
    displayMaterialCards(currentFolderId);
}

function openMaterialComments(materialId) {
    openMaterialDetail(materialId);
    setTimeout(() => {
        const commentBox = document.getElementById('comment-text');
        if (commentBox) {
            commentBox.focus();
        }
    }, 120);
}

function displayRelatedMaterials(folderId) {
    const container = document.getElementById('related-materials');
    if (!container) return;

    if (!folderId || folderId === 'all') {
        container.innerHTML = '<p class="empty-state">Select a specific course or year to see suggestions</p>';
        return;
    }

    const parts = parseFolderParts(folderId);
    const course = parts.course;
    const allMaterials = getAllLibraryFiles();

    // Find materials in same course but different subject
    const related = allMaterials
        .filter(m => m.discipline === course && (!parts.subject || m.subject !== parts.subject))
        .slice(0, 3);

    if (related.length === 0) {
        container.innerHTML = '<p class="empty-state">No related materials yet</p>';
        return;
    }

    container.innerHTML = related.map(m => `
        <div class="related-item" onclick="openMaterialDetail('${m.id}')">
            <span class="material-icons">${getMaterialTypeIcon(m.type)}</span>
            <div class="related-info">
                <span class="related-title">${escapeHtml(m.title)}</span>
                <span class="related-meta">${m.type} • ${m.subject || m.lesson}</span>
            </div>
        </div>
    `).join('');
}

function displayRelatedQA(folderId) {
    const container = document.getElementById('related-qa');
    if (!container) return;

    if (!folderId || folderId === 'all') {
        container.innerHTML = '<p class="empty-state">No related questions yet</p>';
        return;
    }

    const questions = window.qaManager ? window.qaManager.getQuestions() : JSON.parse(localStorage.getItem('coeQAHubQuestions') || '[]');
    const subject = parseFolderParts(folderId).subject;

    const related = questions.filter(q => q.subject === subject).slice(0, 3);

    container.innerHTML = related.length ? related.map(q => `
        <div class="qa-quick-item" onclick="window.qaManager.openQuestionDetail('${q.id}')">
            <span class="material-icons">help_outline</span>
            <span class="qa-title">${escapeHtml(q.title)}</span>
        </div>
    `).join('') : '<p class="empty-state">No related questions found.</p>';
}

function getMaterialsByFolder(folderId) {
    const uploadedFiles = getAllLibraryFiles();
    
    if (!folderId || folderId === 'all') return uploadedFiles;

    const parts = parseFolderParts(folderId);
    const course = parts.course;
    const yearShort = parts.yearShort;
    const category = parts.category;
    const subject = parts.subject;
    const lesson = parts.lesson;
    const professorKey = parts.professorKey;

    return uploadedFiles.filter(f => {
        // Filter by course
        if (course && f.discipline !== course) return false;
        if (category && getMaterialCategory(f) !== category) return false;

        // Lesson. A material with no lesson set counts as "General", which is
        // what the "Unfiled" folder holds — otherwise an upload made without a
        // lesson would be in the category's count but reachable from none of
        // its lesson folders.
        if (lesson) {
            const materialLesson = String(f.lesson || '').trim() || 'General';
            if (materialLesson !== lesson) return false;
        }

        // If specific subject is selected
        if (subject && f.subject !== subject && f.topic !== subject) {
            return false;
        }

        if (professorKey) {
            const materialProfessorKey = normalizeIdentity(f.professorUsername || f.ownerUsername || f.professorName || f.uploadedBy);
            if (materialProfessorKey !== normalizeIdentity(professorKey)) return false;
        }

        // Year check.
        //
        // This previously read `return f.year === yearKey`, which hid a material
        // whenever its `year` field was blank or stored in a different format —
        // even if its course, subject and category had all just matched. Uploads
        // made outside a folder context leave `year` empty, so they were saved
        // correctly but were invisible in every folder.
        //
        // Now: only reject on a genuine mismatch. A material whose subject
        // already matched does not need a year, because the subject implies it.
        if (yearShort) {
            const expectedYear = `${yearShort} Year`;
            const fileYear = f.year || getYearForSubject(f.subject, f.discipline) || '';

            if (fileYear && fileYear !== expectedYear) return false;
            // No year at all: keep it only if the subject pinned it down.
            if (!fileYear && !subject) return false;
        }

        return true;
    });
}

function openMaterialDetail(materialId) {
    const uploadedFiles = getAllLibraryFiles();
    currentMaterial = uploadedFiles.find(f => f.id === materialId);

    if (!currentMaterial) return;
    logMaterialSecurityEvent('OPEN', currentMaterial, 'Opened protected material detail');
    const detailMaterialType = getDisplayType(currentMaterial);
    const detailMaterialCategory = getMaterialCategory(currentMaterial);

    // Increment views
    if (!currentMaterial.views) currentMaterial.views = 0;
    currentMaterial.views++;
    const files = JSON.parse(localStorage.getItem('coeLearningFiles') || '[]');
    const index = files.findIndex(f => f.id === materialId);
    if (index !== -1) {
        files[index].views = currentMaterial.views;
        saveLibraryFiles(files);
    }

    // Populate modal
    const icon = getMaterialTypeIcon(currentMaterial.type);
    document.getElementById('detail-material-icon').textContent = icon;

    /*
     * Title and subtitle.
     *
     * `getMaterialDisplayName` is used rather than the raw title because an
     * upload made from a folder is auto-titled after that folder — so the
     * heading read "OE 025 - CHEMISTRY FOR ENGINEERS - Reference Books" for
     * every file in it, which tells a student nothing about what they opened.
     *
     * The lesson leads the subtitle for the same reason it leads the list
     * column: it is what a student is looking for.
     */
    document.getElementById('detail-material-title').textContent =
        getMaterialDisplayName(currentMaterial);

    const lesson = getMaterialLessonLabel(currentMaterial);
    document.getElementById('detail-material-metadata').textContent = [
        lesson !== '—' ? lesson : null,
        currentMaterial.subject,
        MATERIAL_CATEGORIES_DISPLAY[detailMaterialCategory] || detailMaterialCategory,
        currentMaterial.professorName
    ].filter(Boolean).join('  ·  ');

    document.getElementById('detail-type').textContent = detailMaterialType;
    document.getElementById('detail-lesson').textContent = currentMaterial.lesson || 'Not specified';
    document.getElementById('detail-year').textContent = currentMaterial.year || getYearForSubject(currentMaterial.subject, currentMaterial.discipline) || 'Not specified';
    document.getElementById('detail-subject').textContent = currentMaterial.subject;
    document.getElementById('detail-version').textContent = currentMaterial.version || 'Original';
    document.getElementById('detail-tags').innerHTML = normalizeTags(currentMaterial.tags).map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('') || 'No tags';
    document.getElementById('detail-date').textContent = formatDate(currentMaterial.uploadedAt);
    document.getElementById('detail-uploader').textContent = currentMaterial.uploadedBy || 'Admin';
    document.getElementById('detail-views').textContent = currentMaterial.views;
    const canManageMaterial = isCurrentUserEditor() ||
        String(currentMaterial.ownerUsername || '').toLowerCase() === String(libraryCurrentUser.username || '').toLowerCase();
    document.getElementById('detail-access').textContent = canManageMaterial
        ? 'Editor / uploader access'
        : (currentMaterial.accessLevel || 'Shared with all users');

    // Preview
    const preview = document.getElementById('detail-preview');
    const previewSource = getMaterialSource(currentMaterial);
    // Any PDF already on screen belongs to the material being replaced.
    if (window.CoePdf) window.CoePdf.close();

    if (currentMaterial.previewType === 'image' && isSafeImageSource(previewSource)) {
        preview.innerHTML = `<img src="${escapeHtml(previewSource)}" alt="Material preview">`;
    } else if (currentMaterial.previewType === 'pdf' && isRenderablePreviewSource(previewSource, 'data:application/pdf')) {
        /*
         * Drawn page by page rather than framed.
         *
         * An <iframe> hands the file to the browser's own PDF plugin, which on
         * a phone means one page and no way to reach the second — iOS Safari
         * renders only the first, and Android Chrome usually offers a download
         * instead of rendering at all. CoePdf draws to a canvas and owns the
         * paging, so swipe and the Next button work the same everywhere.
         */
        if (window.CoePdf) {
            preview.innerHTML = '';
            window.CoePdf.open(preview, previewSource);
        } else {
            // The viewer script did not load. Better a framed PDF than none.
            preview.innerHTML = `<iframe src="${escapeHtml(previewSource)}" title="PDF preview"></iframe>`;
        }
    } else if (currentMaterial.previewType === 'video' && isRenderablePreviewSource(previewSource, 'data:video')) {
        preview.innerHTML = `<video controls src="${escapeHtml(previewSource)}"></video>`;
    } else if (currentMaterial.previewType === 'link' || detailMaterialType === 'Google Drive Link') {
        const safeUrl = getSafeExternalUrl(currentMaterial.externalUrl || currentMaterial.content);
        /*
         * Framed here rather than handed to a new tab.
         *
         * A new tab is the worst outcome on a phone: it leaves COE Studio, and
         * on Android it usually hands off to the YouTube or Drive app entirely,
         * so coming back means signing in again. Both providers publish an
         * embeddable form of the URL — see getEmbeddableUrl — and framing it
         * puts the lecture in the same pane a PDF appears in.
         *
         * `allowfullscreen` matters more than it looks: the frame is roughly
         * 44% of a phone screen, so watching anything at a readable size means
         * the player's own fullscreen button has to work.
         */
        const embedUrl = safeUrl ? getEmbeddableUrl(safeUrl) : '';

        if (embedUrl) {
            // A video wants 16:9; a document wants height. Framing both the same
            // way means either a letterboxed lecture or a Drive PDF read through
            // a slot — so the shape is chosen here and the stylesheet follows.
            const embedShape = /youtube(-nocookie)?\.com\/embed\//.test(embedUrl) ? 'is-video' : 'is-doc';

            preview.innerHTML =
                `<iframe class="preview-embed ${embedShape}" src="${escapeHtml(embedUrl)}" ` +
                `title="${escapeHtml(getMaterialDisplayName(currentMaterial))}" ` +
                `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" ` +
                `allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>` +
                // Kept as a way out, not as the way in. Some Drive files refuse
                // to be framed (owner-restricted sharing), and the frame then
                // shows the provider's own "cannot be displayed" page — this is
                // what a student uses when that happens.
                `<a class="preview-link preview-link-alt" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">` +
                `<span class="material-icons">open_in_new</span>Having trouble? Open it in a new tab</a>`;
        } else if (safeUrl) {
            preview.innerHTML =
                `<div class="preview-placeholder"><span class="material-icons">${icon}</span>` +
                `<p>This link has no in-app preview, so it opens in a new tab.</p>` +
                `<a class="preview-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">Open Material</a></div>`;
        } else {
            preview.innerHTML =
                `<div class="preview-placeholder"><span class="material-icons">${icon}</span>` +
                `<p>Link preview not available</p></div>`;
        }
    } else if (currentMaterial.previewType === 'text') {
        preview.innerHTML = `<pre class="file-preview-text">${escapeHtml(String(previewSource || 'No preview available'))}</pre>`;
    } else {
        preview.innerHTML = `<div class="preview-placeholder"><span class="material-icons">${icon}</span><p>File preview not available</p></div>`;
    }
    protectMaterialPreview(currentMaterial);

    const downloadBtn = document.getElementById('download-material-btn');
    if (downloadBtn) {
        // The label has to match what the button now does. A framed link is
        // viewed in place, so promising "open_in_new" would be a lie — and the
        // one thing this button must not do on a phone is look like it leaves.
        const linkIsFramed = (detailMaterialType === 'Google Drive Link' || currentMaterial.previewType === 'link') &&
            Boolean(getEmbeddableUrl(getSafeExternalUrl(currentMaterial.externalUrl || currentMaterial.content)));

        downloadBtn.innerHTML = detailMaterialType === 'Google Drive Link' && !linkIsFramed
            ? '<span class="material-icons">open_in_new</span>Access Link'
            : '<span class="material-icons">visibility</span>Access Module';
    }

    // Bookmark and complete buttons
    updateMaterialActionButtons();

    // Reset preview notes state
    const summaryContainer = document.getElementById('preview-notes-result');
    if (summaryContainer) summaryContainer.innerHTML = '';
    
    const notesBtn = document.querySelector('.notes-btn');
    if (notesBtn) {
        notesBtn.disabled = false;
        notesBtn.innerHTML = '<span class="material-icons">notes</span> Preview Notes';
        notesBtn.classList.remove('success');
        
        // Show preview notes only for videos and PDFs.
        const isSupported = detailMaterialType === 'Video' || detailMaterialType === 'PDF';
        notesBtn.style.display = isSupported ? 'flex' : 'none';
    }

    // Load comments
    displayMaterialComments(materialId);

    // --- Show it ---------------------------------------------------------
    //
    // `flex`, not `block`. The stylesheet centres this modal with
    // `align-items:center; justify-content:center`, and those do nothing on a
    // block container — which is why the viewer opened pinned to the top-left
    // corner instead of in the middle of the screen.
    const detailModal = document.getElementById('material-detail-modal');

    /*
     * Move the dialog to <body> before showing it.
     *
     * It is authored deep inside the library panel, and `position: fixed` only
     * means "relative to the viewport" while no ancestor is a containing
     * block. Any ancestor with a `transform`, `filter`, `backdrop-filter`,
     * `perspective`, `will-change` or `contain` silently changes that — the
     * dialog then anchors to that ancestor instead, so on a phone it opens
     * wherever the library happens to be scrolled to and you have to scroll
     * back up to find it. An ancestor with `overflow: hidden` can clip it, and
     * an ancestor stacking context can bury it behind the page.
     *
     * Rather than audit every rule that touches every wrapper — and re-audit
     * it each time one is added — the dialog is reparented to <body>, where
     * none of those can reach it. This is the portal pattern, and it is why
     * component libraries all do it.
     *
     * Moved once and left there: `appendChild` on an element already in place
     * would still detach and re-insert it, which restarts CSS transitions and
     * reloads any iframe inside.
     *
     * WHY A HOST ELEMENT AND NOT <body> DIRECTLY
     * ------------------------------------------
     * Moving it straight to <body> also moved it out of `.enhanced-library-section`,
     * and roughly a dozen rules in styles.css that dress this dialog are scoped
     * to that class — the white panel, the 940px width, the icon tile, the
     * two-column details grid, the buttons, and `.enhanced-library-section .modal
     * { z-index: 40000 }`. All of them stopped matching the moment the dialog
     * was reparented, so it opened unstyled AND fell back to a z-index below the
     * `z-index: 20000 !important` that styles.css forces onto `.main-content`,
     * `.library-wrapper`, `.folder-tree` and `.library-cards-container`. That is
     * why the viewer appeared behind the library instead of over it.
     *
     * The host is a child of <body> carrying that same class, so every scoped
     * rule keeps matching. It is `display: contents`, so it generates no box of
     * its own: it cannot be a containing block, cannot clip, and cannot open a
     * stacking context — the dialog still anchors to the viewport exactly as it
     * would as a direct child of <body>.
     */
    const modalHost = getModalHost();
    if (detailModal.parentElement !== modalHost) {
        modalHost.appendChild(detailModal);
    }

    detailModal.style.display = 'flex';
    detailModal.classList.add('is-open');

    lockBackgroundScroll();

    // Focus the dialog so Escape and Tab land inside it rather than on
    // whatever was focused in the list behind.
    const dialog = detailModal.querySelector('.material-detail-content');
    if (dialog) {
        dialog.setAttribute('tabindex', '-1');
        dialog.focus({ preventScroll: true });
        // Start at the top: a reopened modal keeps its old scroll position.
        dialog.scrollTop = 0;
    }
}

/**
 * The element the material viewer is moved into, created on first use.
 *
 * A direct child of <body>, so nothing in the page can be its containing block,
 * clip it, or bury it in a stacking context. It carries `enhanced-library-section`
 * only so the dialog's own stylesheet rules — which are all scoped to that class
 * — go on matching after the move, and `display: contents` so the host itself
 * lays out as if it were not there at all.
 */
function getModalHost() {
    let host = document.getElementById('coe-modal-host');
    if (host) return host;

    host = document.createElement('div');
    host.id = 'coe-modal-host';
    host.className = 'enhanced-library-section coe-modal-host';
    document.body.appendChild(host);
    return host;
}

/**
 * Freeze the page behind the viewer, and remember where it was.
 *
 * `overflow: hidden` on <body> alone does not hold on iOS Safari — the page
 * keeps rubber-banding behind the dialog, and on some versions the address bar
 * collapsing mid-gesture scrolls it for real. Pinning the body with
 * `position: fixed` at a negative offset is the technique that actually works
 * there; the offset is what stops the page jumping to the top the moment the
 * dialog opens.
 *
 * The class is kept as well, because other stylesheets hang rules off it.
 */
let savedScrollY = 0;

function lockBackgroundScroll() {
    if (document.body.classList.contains('coe-modal-open')) return;

    savedScrollY = window.scrollY || window.pageYOffset || 0;

    document.body.classList.add('coe-modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
}

function unlockBackgroundScroll() {
    if (!document.body.classList.contains('coe-modal-open')) return;

    document.body.classList.remove('coe-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';

    // Back to exactly where they were. Without this the library jumps to the
    // top every time a material is closed, which loses their place in a list
    // they may have scrolled a long way down.
    window.scrollTo(0, savedScrollY);
}

/**
 * Fullscreen the preview pane.
 *
 * The Fullscreen API is used rather than a CSS class, so a PDF or a video gets
 * the actual screen — a maximised div is still bounded by the browser chrome,
 * which is most of what a student loses on a laptop.
 *
 * Falls back to a CSS full-window mode where the API is unavailable or refused
 * (it requires a user gesture and Safari on iPhone has no element fullscreen).
 */
function toggleMaterialFullscreen() {
    const preview = document.getElementById('detail-preview');
    if (!preview) return;

    const doc = document;
    const isFull = doc.fullscreenElement || doc.webkitFullscreenElement;

    if (isFull) {
        (doc.exitFullscreen || doc.webkitExitFullscreen || function () {}).call(doc);
        preview.classList.remove('is-cssfull');
        return;
    }

    const request = preview.requestFullscreen || preview.webkitRequestFullscreen;

    if (!request) {
        preview.classList.toggle('is-cssfull');
        return;
    }

    Promise.resolve(request.call(preview)).catch(function () {
        // Refused — no gesture, or an iframe policy. Use the CSS fallback
        // rather than leaving the button doing nothing.
        preview.classList.add('is-cssfull');
    });
}

window.toggleMaterialFullscreen = toggleMaterialFullscreen;

/** Close the material viewer and release the page behind it. */
function closeMaterialDetail() {
    const modal = document.getElementById('material-detail-modal');
    if (!modal) return;

    modal.style.display = 'none';
    modal.classList.remove('is-open');

    // Releases the pin AND restores the scroll position it was holding. A bare
    // classList.remove() here would leave <body> position:fixed at a negative
    // top, which reads as the whole page having gone blank.
    unlockBackgroundScroll();

    // Tear down the PDF, or its worker and page buffers stay alive behind a
    // closed dialog and its keyboard handler keeps answering arrow keys.
    if (window.CoePdf) window.CoePdf.close();

    // Leave fullscreen with it, or the preview stays full-screen over a modal
    // that is no longer there.
    const preview = document.getElementById('detail-preview');
    if (preview) preview.classList.remove('is-cssfull');
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    }

    // Stop a playing video. Leaving it running behind a closed modal means
    // audio keeps playing with nothing on screen to pause it.
    modal.querySelectorAll('video, audio').forEach(media => {
        try { media.pause(); } catch (error) { /* already gone */ }
    });
}

window.closeMaterialDetail = closeMaterialDetail;

// New function for isSafeImageSource
/**
 * May this value be used as an `<img src>`?
 *
 * Three shapes are allowed, and the third was missing:
 *
 *   * `data:image/...;base64,...` — a file held in this browser;
 *   * an absolute http(s) URL — an external image;
 *   * `/api/library/preview/...` — **how the shared library serves the bytes**.
 *
 * Without that last one, every image uploaded to the server fell through to
 * "File preview not available", while PDFs and videos previewed correctly —
 * because their check (`isRenderablePreviewSource`) already accepted the path
 * and this one did not. The two had drifted apart.
 *
 * Adding it does not widen what is allowed in any meaningful sense: this
 * function already accepts any absolute https URL, and a same-origin path from
 * our own authenticated route is narrower than that.
 */
function isSafeImageSource(value) {
    const source = String(value || '');
    if (source.startsWith('/api/library/preview/')) return true;
    return /^(data:image\/[a-z0-9.+-]+;base64,|https?:\/\/)/i.test(source);
}

function updateMaterialActionButtons() {
    if (!currentMaterial) return;

    const bookmarkBtn = document.getElementById('bookmark-btn');
    const completeBtn = document.getElementById('mark-complete-btn');
    const isBookmarked = isLibraryMaterialBookmarked(currentMaterial.id);
    const isCompleted = isLibraryMaterialCompleted(currentMaterial.id);

    if (bookmarkBtn) {
        bookmarkBtn.classList.toggle('active', isBookmarked);
        bookmarkBtn.innerHTML = isBookmarked ? 
            '<span class="material-icons">bookmark</span>Bookmarked' : 
            '<span class="material-icons">bookmark_border</span>Bookmark';
    }

    if (completeBtn) {
        completeBtn.classList.toggle('active', isCompleted);
        completeBtn.innerHTML = isCompleted ? 
            '<span class="material-icons">check_circle</span>Completed' : 
            '<span class="material-icons">check_circle_outline</span>Mark Complete';
    }
}

function generatePreviewNotes() {
    const summaryContainer = document.getElementById('preview-notes-result');
    const btn = event.currentTarget;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons rotating">sync</span> Reading...';
    
    setTimeout(() => {
        summaryContainer.innerHTML = `
            <div class="preview-notes-box">
                <h5><span class="material-icons">notes</span> Preview Notes</h5>
                <p>This material covers <strong>${currentMaterial.subject || currentMaterial.lesson}</strong>. Review the main definitions, formulas, and sample applications before class discussion.</p>
            </div>
        `;
        btn.innerHTML = '<span class="material-icons">notes</span> Notes Ready';
        btn.classList.add('success');
    }, 1500);
}

function toggleBookmark() {
    if (!currentMaterial) return;

    const bookmarks = getLibraryBookmarks();
    const index = bookmarks.indexOf(currentMaterial.id);

    if (index > -1) {
        bookmarks.splice(index, 1);
    } else {
        bookmarks.push(currentMaterial.id);
    }

    localStorage.setItem(LOCAL_STORAGE_LIBRARY_BOOKMARKS, JSON.stringify(bookmarks));
    updateMaterialActionButtons();
    updateBookmarksList();
}

function toggleMaterialComplete() {
    if (!currentMaterial) return;

    const completed = getLibraryCompleted();
    const index = completed.indexOf(currentMaterial.id);

    if (index > -1) {
        completed.splice(index, 1);
    } else {
        completed.push(currentMaterial.id);
    }

    localStorage.setItem(LOCAL_STORAGE_LIBRARY_COMPLETED, JSON.stringify(completed));
    updateMaterialActionButtons();
    updateLibraryStats();
}

function displayMaterialComments(materialId) {
    const comments = getLibraryComments().filter(c => c.materialId === materialId);
    const commentsList = document.getElementById('comments-list');

    if (comments.length === 0) {
        commentsList.innerHTML = '<p class="empty-state">No comments yet. Be the first!</p>';
        return;
    }

    commentsList.innerHTML = comments.map(comment => `
        <div class="comment">
            <div class="comment-header">
                <strong class="commenter-name">${escapeHtml(comment.userName)}</strong>
                <span class="comment-date">${formatTimeAgo(comment.createdAt)}</span>
            </div>
            <p class="comment-text">${escapeHtml(comment.text)}</p>
        </div>
    `).join('');
}

function handleAddComment(e) {
    e.preventDefault();

    if (!currentMaterial) return;

    const commentText = document.getElementById('comment-text').value;

    if (!commentText.trim()) {
        alert('Please enter a comment');
        return;
    }

    const comment = {
        id: generateId('comment'),
        materialId: currentMaterial.id,
        userName: libraryCurrentUser.name || 'Anonymous',
        text: commentText,
        createdAt: new Date().toISOString()
    };

    const comments = getLibraryComments();
    comments.push(comment);
    localStorage.setItem(LOCAL_STORAGE_LIBRARY_COMMENTS, JSON.stringify(comments));

    document.getElementById('add-comment-form').reset();
    displayMaterialComments(currentMaterial.id);
}

function getLibraryBookmarks() {
    const stored = localStorage.getItem(LOCAL_STORAGE_LIBRARY_BOOKMARKS);
    return stored ? JSON.parse(stored) : [];
}

function getLibraryFolderBookmarks() {
    const stored = localStorage.getItem(LOCAL_STORAGE_LIBRARY_FOLDER_BOOKMARKS);
    return stored ? JSON.parse(stored) : [];
}

function toggleFolderBookmark(folderId) {
    const bookmarks = getLibraryFolderBookmarks();
    const index = bookmarks.indexOf(folderId);
    if (index > -1) {
        bookmarks.splice(index, 1);
    } else {
        bookmarks.push(folderId);
    }
    localStorage.setItem(LOCAL_STORAGE_LIBRARY_FOLDER_BOOKMARKS, JSON.stringify(bookmarks));
    updateFolderContext(folderId);
    updateBookmarksList();
}

function getLibraryComments() {
    const stored = localStorage.getItem(LOCAL_STORAGE_LIBRARY_COMMENTS);
    return stored ? JSON.parse(stored) : [];
}

function getLibraryCompleted() {
    const stored = localStorage.getItem(LOCAL_STORAGE_LIBRARY_COMPLETED);
    return stored ? JSON.parse(stored) : [];
}

function isLibraryMaterialBookmarked(materialId) {
    return getLibraryBookmarks().includes(materialId);
}

function isLibraryMaterialCompleted(materialId) {
    return getLibraryCompleted().includes(materialId);
}

function updateBookmarksList() {
    const bookmarks = getLibraryBookmarks();
    const folderBookmarks = getLibraryFolderBookmarks();
    const uploadedFiles = getAllLibraryFiles();
    const bookmarkedMaterials = uploadedFiles.filter(f => bookmarks.includes(f.id));

    const bookmarksList = document.getElementById('bookmarks-list');
    if (bookmarkedMaterials.length === 0 && folderBookmarks.length === 0) {
        bookmarksList.innerHTML = '<p class="empty-state">No bookmarks yet</p>';
        return;
    }

    const folderMarkup = folderBookmarks.map(folderId => {
        const parts = parseFolderParts(folderId);
        const labels = [parts.courseLabel, parts.year, parts.subject];
        if (parts.isProfessorLibrary) labels.push('Professor Folders');
        if (parts.professorName) labels.push(parts.professorName);
        labels.push(parts.category, parts.lesson);
        const title = labels.filter(Boolean).join(' / ') || 'All Materials';
        return `
            <div class="bookmark-item folder-bookmark-item" onclick="selectBookmarkedFolder('${escapeHtml(folderId)}')">
                <span class="material-icons">folder_special</span>
                <span class="bookmark-title">${escapeHtml(title)}</span>
            </div>
        `;
    }).join('');
    const materialMarkup = bookmarkedMaterials.map(material => `
        <div class="bookmark-item" onclick="openMaterialDetail('${material.id}')">
            <span class="material-icons">description</span>
            <span class="bookmark-title">${escapeHtml(getMaterialTitle(material))}</span>
        </div>
    `).join('');
    bookmarksList.innerHTML = folderMarkup + materialMarkup;
}

function selectBookmarkedFolder(folderId) {
    const button = Array.from(document.querySelectorAll('.tree-leaf, .tree-toggle')).find(node => node.dataset.folder === folderId);
    if (button) revealFolderButton(button);
    selectFolder(folderId, button || null);
}

function updateLibraryStats(scopeFiles = null) {
    const uploadedFiles = scopeFiles || getMaterialsByFolder(currentFolderId || 'all');
    const completed = getLibraryCompleted();

    const totalCount = document.getElementById('library-total-count');
    const videoCount = document.getElementById('library-video-count');
    const pdfCount = document.getElementById('library-pdf-count');
    const completedCount = document.getElementById('library-completed-count');
    const downloadCount = document.getElementById('library-download-count');

    if (totalCount) totalCount.textContent = uploadedFiles.length;
    if (videoCount) videoCount.textContent = uploadedFiles.filter(f => getDisplayType(f) === 'Video').length;
    if (pdfCount) pdfCount.textContent = uploadedFiles.filter(f => getDisplayType(f) === 'PDF').length;
    if (completedCount) completedCount.textContent = uploadedFiles.filter(file => completed.includes(file.id)).length;
    if (downloadCount) downloadCount.textContent = uploadedFiles.reduce((total, file) => total + Number(file.downloads || 0), 0);

    updateBookmarksList();
    updateLibraryDashboard();
}

function updateLibraryDashboard() {
    const uploadedFiles = getAllLibraryFiles();
    const totalEl = document.getElementById('library-dashboard-total');
    const pdfEl = document.getElementById('library-dashboard-pdf');
    const videoEl = document.getElementById('library-dashboard-video');
    const downloadEl = document.getElementById('library-dashboard-downloads');
    const thisWeekEl = document.getElementById('library-dashboard-this-week');
    const ceEl = document.getElementById('library-dashboard-ce');
    const eeEl = document.getElementById('library-dashboard-ee');
    const linkEl = document.getElementById('library-dashboard-link');
    const completedEl = document.getElementById('library-dashboard-completed');
    const recentList = document.getElementById('library-recent-list');

    const pdfCount = uploadedFiles.filter(file => getDisplayType(file) === 'PDF' || getMaterialCategory(file) === 'Handouts').length;
    const videoCount = uploadedFiles.filter(file => getDisplayType(file) === 'Video' || getMaterialCategory(file) === 'Video Lectures').length;
    const downloadCount = uploadedFiles.reduce((total, file) => total + Number(file.downloads || 0), 0);
    const thisWeekCount = uploadedFiles.filter(isRecentlyUpdated).length;
    const ceCount = uploadedFiles.filter(file => String(file.discipline || '').toUpperCase() === 'CE').length;
    const eeCount = uploadedFiles.filter(file => String(file.discipline || '').toUpperCase() === 'EE').length;
    const linkCount = uploadedFiles.filter(file => {
        const type = getDisplayType(file);
        return type === 'Google Drive Link' || type === 'Link' || Boolean(file.externalUrl || file.driveLink);
    }).length;
    const completed = getLibraryCompleted();
    const completedCount = uploadedFiles.filter(file => completed.includes(file.id)).length;

    if (totalEl) totalEl.textContent = uploadedFiles.length;
    if (pdfEl) pdfEl.textContent = pdfCount;
    if (videoEl) videoEl.textContent = videoCount;
    if (downloadEl) downloadEl.textContent = downloadCount;
    if (thisWeekEl) thisWeekEl.textContent = `${thisWeekCount} added this week`;
    if (ceEl) ceEl.textContent = ceCount;
    if (eeEl) eeEl.textContent = eeCount;
    if (linkEl) linkEl.textContent = linkCount;
    if (completedEl) completedEl.textContent = completedCount;

    if (!recentList) return;
    const recentFiles = uploadedFiles
        .slice()
        .sort((left, right) => new Date(right.uploadedAt || right.lastModified || 0) - new Date(left.uploadedAt || left.lastModified || 0))
        .slice(0, 4);

    if (!recentFiles.length) {
        recentList.innerHTML = '<p class="empty-library">No uploaded materials yet. Recent uploads will appear here.</p>';
        return;
    }

    recentList.innerHTML = recentFiles.map(file => `
        <button type="button" class="library-recent-item" data-recent-material-id="${escapeHtml(file.id)}">
            <span class="material-icons">${getMaterialTypeIcon(getDisplayType(file))}</span>
            <span>
                <strong>${escapeHtml(getMaterialTitle(file))}</strong>
                <small>${escapeHtml([file.discipline, file.year, file.subject || file.topic, getMaterialCategory(file)].filter(Boolean).join(' / '))}</small>
            </span>
            <em>${escapeHtml(formatShortDate(file.uploadedAt || file.lastModified))}</em>
        </button>
    `).join('');

    recentList.querySelectorAll('[data-recent-material-id]').forEach(button => {
        button.addEventListener('click', function () {
            openMaterialDetail(this.dataset.recentMaterialId);
        });
    });
}

function trackMaterialDownload(materialId) {
    if (!materialId) return;
    const files = getAllLibraryFiles();
    const index = files.findIndex(file => file.id === materialId);
    if (index === -1) return;
    files[index].downloads = Number(files[index].downloads || 0) + 1;
    saveLibraryFiles(files);
    if (currentMaterial && currentMaterial.id === materialId) {
        currentMaterial.downloads = files[index].downloads;
    }
    updateLibraryStats(getMaterialsByFolder(currentFolderId || 'all'));
    updateFolderContext(currentFolderId || 'all');
}

// Add window.openEditFileModal and window.deleteUploadedFile for quick actions
// These will call the original functions in scripts.js, which will be renamed.
window.openEditFileModal = function(materialId) {
    const uploadedFileIndex = getAllLibraryFiles().findIndex(f => f.id === materialId);
    if (uploadedFileIndex !== -1 && typeof window.openEditFileModalFromScripts === 'function') window.openEditFileModalFromScripts(uploadedFileIndex);
}
/**
 * Delete a material.
 *
 * This used to splice the record out of this browser's array and stop there.
 * The file was never removed from the server, so it reappeared on the next
 * sync and every other account went on seeing it the whole time — the button
 * looked like it worked and did nothing that mattered.
 *
 * The server decides who may: an administrator, or the account that uploaded
 * it. A 403 comes back otherwise and is shown rather than swallowed.
 *
 * The local path is kept for records that never reached the server — anything
 * uploaded before the library moved to it still lives only in this browser and
 * has no id the API would recognise.
 */
window.deleteUploadedFile = function (materialId) {
    const files = getAllLibraryFiles();
    const uploadedFileIndex = files.findIndex(f => f.id === materialId);
    const record = uploadedFileIndex === -1 ? null : files[uploadedFileIndex];

    const removeLocally = function () {
        if (uploadedFileIndex !== -1 && typeof window.deleteUploadedFileFromScripts === 'function') {
            window.deleteUploadedFileFromScripts(uploadedFileIndex);
        }
    };

    // `serverId` is set by toPortalRecord and only by it, so it is exactly the
    // test for "the API knows about this one".
    const isServerRecord = Boolean(record && record.serverId);

    if (!window.CoeLive || !window.CoeApi || !window.CoeApi.isServed() || !isServerRecord) {
        removeLocally();
        return;
    }

    if (!confirm('Delete this material for everyone?')) return;

    window.CoeLive.deleteMaterial(materialId)
        .then(function () {
            window.showLibraryToast?.('Deleted', 'Removed for everyone.', 'success');
            if (typeof closeMaterialDetail === 'function') closeMaterialDetail();
            if (typeof displayLibrary === 'function') displayLibrary();
        })
        .catch(function (error) {
            window.showLibraryToast?.(
                error && error.status === 403 ? 'Not allowed' : 'Could not delete',
                (error && error.message) || 'Try again.',
                'error'
            );
        });
};

function toggleLibraryView() {
    const container = document.getElementById('library-cards-container');
    const btn = document.getElementById('library-view-toggle');
    currentLibraryView = currentLibraryView === 'grid' ? 'list' : 'grid';
    container.classList.toggle('list-view', currentLibraryView === 'list');
    if (btn) {
        const icon = btn.querySelector('.material-icons');
        if (icon) {
            icon.textContent = currentLibraryView === 'list' ? 'view_module' : 'view_list';
        }
        btn.title = currentLibraryView === 'list' ? 'Switch to card view' : 'Switch to list view';
    }
    displayMaterialCards(currentFolderId);
}

function downloadMaterial(materialId) {
    const uploadedFiles = getAllLibraryFiles();
    const material = materialId ? uploadedFiles.find(f => f.id === materialId) : currentMaterial;

    if (!material) {
        alert('Material is not available.');
        return;
    }

    logMaterialSecurityEvent('DOWNLOAD_BLOCKED', material, 'Download blocked: view/access only policy');
    alert('Download is disabled. You can only open and access this module inside COE Studio.');
}

function accessMaterialOnly(materialId) {
    const uploadedFiles = getAllLibraryFiles();
    const material = materialId ? uploadedFiles.find(f => f.id === materialId) : currentMaterial;

    if (!material) {
        alert('Material is not available.');
        return;
    }

    const materialType = getDisplayType(material);
    if (materialType === 'Google Drive Link' || material.previewType === 'link') {
        const safeUrl = getSafeExternalUrl(material.externalUrl || material.content);
        if (!safeUrl) {
            alert('Link not available');
            return;
        }
        logMaterialSecurityEvent('OPEN_LINK', material, 'Accessed protected material link');
        if (material.id) { // Only track if material has an ID
            trackMaterialDownload(material.id);
        }

        /*
         * If the viewer is already showing it, take the student to it instead of
         * opening a second copy elsewhere.
         *
         * This button used to be an unconditional `window.open`. On a phone that
         * meant tapping "Access Link" left the site — even though the video was
         * already playing a few hundred pixels further down the same screen.
         * A new tab is now only for the links that genuinely have no embed.
         */
        if (getEmbeddableUrl(safeUrl)) {
            document.getElementById('detail-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        window.open(safeUrl, '_blank', 'noopener');
        return;
    }

    logMaterialSecurityEvent('ACCESS', material, 'Accessed protected module in preview');
    document.getElementById('detail-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getMaterialTypeIcon(type) {
    const icons = {
        'Video': 'video_library',
        'PDF': 'picture_as_pdf',
        'Image': 'image',
        'Document': 'article',
        'Link': 'link',
        'Google Drive Link': 'add_to_drive',
        'Reference Book': 'auto_stories',
        'Reviewer': 'fact_check',
        'Lesson': 'menu_book'
    };
    return icons[type] || 'description';
}

function escapeHtml(text) {
    text = String(text ?? '');
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString();
}

function formatTimeAgo(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export for external use
window.enhancedLibrary = {
    populateLibraryFolderTree, // Export this for initial setup
    updateBookmarksList,
    updateLibraryStats,
    displayMaterialCards,
    openMaterialDetail,
    populateYearFilter, // Export for initial population
    populateTypeFilter, // Export for initial population
    populateSubjectFilter,
    populateLessonFilter,
    populateTagFilter,
    updateLibraryDashboard,
    switchLibraryCourse,
    toggleLibraryView,
    createProfessorLibraryForFolder,
    getProfessorLibrariesForSubject
};

window.createProfessorLibraryForCurrentFolder = createProfessorLibraryForFolder;

// --- Upload helper fallback and upload-file name preview ---
document.addEventListener('DOMContentLoaded', function() {
    const uploadFileInput = document.getElementById('library-upload-file');
    if (uploadFileInput) {
        uploadFileInput.multiple = true;
        uploadFileInput.addEventListener('change', function () {
            const uploadFileName = document.getElementById('library-upload-file-name');
            if (!uploadFileName) return;
            if (!this.files || this.files.length === 0) {
                uploadFileName.textContent = 'No file selected';
                return;
            }
            const names = Array.from(this.files).map(f => f.name).join(', ');
            uploadFileName.textContent = names;
        });
    }
});

const openLibraryUploadModalFallback = function (folderId) {
    const uploadFileModal = document.getElementById('upload-file-modal');
    if (!uploadFileModal) {
        return;
    }
    uploadFileModal.style.display = 'block';
    const uploadFileForm = document.getElementById('upload-file-form');
    if (uploadFileForm) {
        uploadFileForm.removeAttribute('data-folder-index');
        uploadFileForm.setAttribute('data-folder-id', folderId);
    }
};

if (!window.openLibraryUploadModal) {
    window.openLibraryUploadModal = openLibraryUploadModalFallback;
}


/* =========================================================================
   TEST HELPERS — sample materials
   Lets you confirm the library renders, filters and counts uploads correctly
   without having to upload real files first.

   In the browser console (F12):
     seedLibraryTestMaterials()    add 4 sample materials
     clearLibraryTestMaterials()   remove only the samples
   ========================================================================= */

const LIBRARY_TEST_MARKER = '__coe_test_material__';

function seedLibraryTestMaterials() {
    const now = Date.now();
    const currentUser = (() => {
        try {
            return JSON.parse(localStorage.getItem('studentWorkplaceCurrentUser') || '{}') || {};
        } catch { return {}; }
    })();
    const uploader = currentUser.name || currentUser.username || 'COE Admin';
    const owner = currentUser.username || '@admin';

    // Fields mirror exactly what a real upload writes, so anything that works
    // for these will work for a genuine upload too.
    const base = (overrides) => ({
        id: `test-${now}-${Math.random().toString(16).slice(2, 8)}`,
        [LIBRARY_TEST_MARKER]: true,
        folderId: '',
        folderName: '',
        lesson: '',
        version: 'Original',
        comments: [],
        favorite: false,
        uploadedAt: new Date().toISOString(),
        lastModified: new Date().toLocaleString(),
        uploadedBy: uploader,
        ownerUsername: owner,
        professorName: uploader,
        professorUsername: owner,
        accessLevel: 'Shared with all users',
        downloads: 0,
        views: 0,
        previewType: 'text',
        content: 'This is a sample material created for testing. Replace it with a real upload.',
        ...overrides
    });

    const samples = [
        base({
            title: 'Engineering Mechanics — Chapter 5 Reviewer',
            name: 'BES058-Chapter5-Reviewer.pdf',
            originalName: 'BES058-Chapter5-Reviewer.pdf',
            description: 'Sample reviewer covering equilibrium of rigid bodies.',
            discipline: 'EE',
            year: '2nd Year',
            subject: 'BES 058 - ENGINEERING MECHANICS',
            materialCategory: 'Reference Books',
            type: 'PDF',
            fileType: 'application/pdf',
            size: 482000,
            previewType: 'pdf',
            tags: ['reviewer', 'equilibrium']
        }),
        base({
            title: 'Engineering Mechanics — Lecture Handout',
            name: 'BES058-Handout-Week3.pdf',
            originalName: 'BES058-Handout-Week3.pdf',
            description: 'Week 3 handout on force systems.',
            discipline: 'EE',
            year: '2nd Year',
            subject: 'BES 058 - ENGINEERING MECHANICS',
            materialCategory: 'Handouts',
            type: 'PDF',
            fileType: 'application/pdf',
            size: 265400,
            previewType: 'pdf',
            tags: ['handout', 'week3']
        }),
        base({
            title: 'Electrical Circuits 1 — Nodal Analysis Walkthrough',
            name: 'ELE001-Nodal-Analysis.mp4',
            originalName: 'ELE001-Nodal-Analysis.mp4',
            description: 'Sample video lecture on nodal analysis.',
            discipline: 'EE',
            year: '2nd Year',
            subject: 'ELE 001 - ELECTRICAL CIRCUITS 1',
            materialCategory: 'Video Lectures',
            type: 'Video',
            fileType: 'video/mp4',
            size: 18400000,
            previewType: 'video',
            tags: ['video', 'nodal']
        }),
        base({
            title: 'Calculus 1 — Limits Practice Set',
            name: 'MAT171-Limits-Practice.pdf',
            originalName: 'MAT171-Limits-Practice.pdf',
            description: 'Sample practice set on limits and continuity.',
            discipline: 'CE',
            year: '1st Year',
            subject: 'MAT 171 - CALCULUS 1',
            materialCategory: 'Handouts',
            type: 'PDF',
            fileType: 'application/pdf',
            size: 198700,
            previewType: 'pdf',
            tags: ['practice', 'limits']
        })
    ];

    let existing;
    try {
        existing = JSON.parse(localStorage.getItem('coeLearningFiles') || '[]');
        if (!Array.isArray(existing)) existing = [];
    } catch { existing = []; }

    const merged = [...existing, ...samples];

    try {
        localStorage.setItem('coeLearningFiles', JSON.stringify(merged));
    } catch (error) {
        // localStorage is capped around 5 MB and real uploads store the whole
        // file as base64, so this fills up fast. Worth saying plainly.
        console.error('Could not save samples — localStorage is full.', error);
        alert('Storage is full. Remove some uploaded files first.');
        return 0;
    }

    refreshLibraryAfterTestSeed();
    console.log(`Added ${samples.length} sample materials.`);
    return samples.length;
}

function clearLibraryTestMaterials() {
    let existing;
    try {
        existing = JSON.parse(localStorage.getItem('coeLearningFiles') || '[]');
        if (!Array.isArray(existing)) existing = [];
    } catch { existing = []; }

    const kept = existing.filter(file => !file || !file[LIBRARY_TEST_MARKER]);
    const removed = existing.length - kept.length;

    localStorage.setItem('coeLearningFiles', JSON.stringify(kept));
    refreshLibraryAfterTestSeed();
    console.log(`Removed ${removed} sample material(s).`);
    return removed;
}

/** Re-render whichever library views are currently mounted. */
function refreshLibraryAfterTestSeed() {
    try {
        if (typeof populateLibraryFolderTree === 'function') populateLibraryFolderTree();
        if (typeof populateSubjectFilter === 'function') populateSubjectFilter();
        if (typeof populateLessonFilter === 'function') populateLessonFilter();
        if (typeof populateTagFilter === 'function') populateTagFilter();
        if (typeof displayEnhancedLibrary === 'function') displayEnhancedLibrary();
        if (typeof window.displayLibrary === 'function') window.displayLibrary();
        if (typeof updateLibraryStats === 'function' && typeof getMaterialsByFolder === 'function') {
            updateLibraryStats(getMaterialsByFolder(typeof currentFolderId !== 'undefined' ? (currentFolderId || 'all') : 'all'));
        }
        if (typeof updateFolderContext === 'function') {
            updateFolderContext(typeof currentFolderId !== 'undefined' ? (currentFolderId || 'all') : 'all');
        }
    } catch (error) {
        console.warn('Seeded, but the view could not auto-refresh. Reload the page.', error);
    }
}

window.seedLibraryTestMaterials = seedLibraryTestMaterials;
window.clearLibraryTestMaterials = clearLibraryTestMaterials;


/* =========================================================================
   UPLOAD TOAST
   Top-centre notification shown when a material lands in a folder.
   Replaces the blocking alert() calls, which interrupted the flow and gave
   no indication of *which* folder received the file.
   ========================================================================= */

function ensureLibraryToastHost() {
    let host = document.getElementById('coe-toast-host');
    if (host) return host;

    host = document.createElement('div');
    host.id = 'coe-toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
    return host;
}

/**
 * @param {string} title   headline, e.g. '"Chapter 5.pdf" uploaded'
 * @param {string} detail  destination folder label
 * @param {string} tone    'success' | 'error' | 'info'
 */
function showLibraryToast(title, detail, tone) {
    const host = ensureLibraryToastHost();
    const toast = document.createElement('div');
    const icons = { success: 'cloud_done', error: 'error_outline', info: 'info' };

    toast.className = `coe-toast coe-toast-${tone || 'info'}`;
    toast.innerHTML = `
        <span class="material-icons coe-toast-icon">${icons[tone] || icons.info}</span>
        <div class="coe-toast-copy">
            <strong></strong>
            <small></small>
        </div>
        <button type="button" class="coe-toast-close" aria-label="Dismiss">
            <span class="material-icons">close</span>
        </button>
    `;
    // textContent, not innerHTML — a filename must never be able to inject markup.
    toast.querySelector('strong').textContent = title || 'Done';
    // Only the success path is a 'saved to <folder>' message; error and info
    // toasts pass a full sentence and must not be prefixed.
    toast.querySelector('small').textContent =
        detail ? (tone === 'success' ? `Saved to ${detail}` : detail) : '';

    const dismiss = () => {
        toast.classList.add('is-leaving');
        setTimeout(() => toast.remove(), 240);
    };

    toast.querySelector('.coe-toast-close').addEventListener('click', dismiss);
    host.appendChild(toast);

    setTimeout(dismiss, 4200);
    return toast;
}

window.showLibraryToast = showLibraryToast;
