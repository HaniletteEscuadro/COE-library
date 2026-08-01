document.addEventListener('DOMContentLoaded', function () {
    const subjectSelect = document.getElementById('subject-select');
    const lessonSelect = document.getElementById('lesson-select');
    const sharedBody = document.getElementById('shared-body');
    const libraryCount = document.getElementById('library-count');
    const LOCAL_STORAGE_TASKS = 'coeLearningTasks';
    const LOCAL_STORAGE_FILES = 'coeLearningFiles';

    function loadSavedData(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (error) {
            console.error('Failed to parse shared data:', error);
            return [];
        }
    }

    function normalizeText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function matchesTaskFilters(task, disciplineFilter, lessonFilter) {
        const matchesDiscipline = disciplineFilter === 'All' || task.discipline === disciplineFilter;
        const matchesLesson = lessonFilter === 'All' || task.lesson === lessonFilter;
        return matchesDiscipline && matchesLesson;
    }

    function matchesFileFilters(file, disciplineFilter) {
        return disciplineFilter === 'All' || file.discipline === disciplineFilter;
    }

    function renderTaskCard(task) {
        return `
            <article class="shared-card">
                <div class="shared-card-header">
                    <h3>${task.title || 'Untitled Problem'}</h3>
                    <span class="shared-badge">${task.discipline || 'N/A'}</span>
                </div>
                <p>${task.topic || 'No topic'} | ${task.lesson || 'No lesson'}</p>
                <p>${task.notes ? task.notes.substring(0, 140) + (task.notes.length > 140 ? '...' : '') : 'No notes available.'}</p>
                <p class="shared-meta">Answer: ${task.answer || 'N/A'} | File: ${task.fileName || 'None'}</p>
            </article>
        `;
    }

    function renderFileCard(file) {
        const sizeKb = typeof file.size === 'number' ? Math.max(1, Math.round(file.size / 1024)) : 0;
        const preview = normalizeText(file.content);
        return `
            <article class="shared-card">
                <div class="shared-card-header">
                    <h3>${file.name || 'Untitled File'}</h3>
                    <span class="shared-badge">${file.discipline || 'N/A'}</span>
                </div>
                <p>${file.type || 'Unknown type'}</p>
                <p>${preview ? preview.substring(0, 120) + (preview.length > 120 ? '...' : '') : 'No preview available.'}</p>
                <p class="shared-meta">Folder: ${file.folderName || 'Unknown'} | ${sizeKb} KB</p>
            </article>
        `;
    }

    function render() {
        if (!subjectSelect || !lessonSelect || !sharedBody) return;

        const disciplineFilter = subjectSelect.value;
        const lessonFilter = lessonSelect.value;
        const savedTasks = loadSavedData(LOCAL_STORAGE_TASKS);
        const savedFiles = loadSavedData(LOCAL_STORAGE_FILES);

        const filteredTasks = savedTasks.filter(task => matchesTaskFilters(task, disciplineFilter, lessonFilter));
        const filteredFiles = savedFiles.filter(file => matchesFileFilters(file, disciplineFilter));
        const totalItems = filteredTasks.length + filteredFiles.length;

        if (libraryCount) {
            libraryCount.textContent = String(totalItems);
        }

        sharedBody.innerHTML = `
            <section class="shared-section">
                <div class="shared-header">
                    <h2>Shared Problems</h2>
                    <p>${filteredTasks.length} item${filteredTasks.length === 1 ? '' : 's'}</p>
                </div>
                <div class="shared-list">
                    ${filteredTasks.length ? filteredTasks.map(renderTaskCard).join('') : '<p class="empty-library">No shared problems match the selected filters.</p>'}
                </div>
            </section>
            <section class="shared-section">
                <div class="shared-header">
                    <h2>Shared Materials</h2>
                    <p>${filteredFiles.length} item${filteredFiles.length === 1 ? '' : 's'}</p>
                </div>
                <div class="shared-list">
                    ${filteredFiles.length ? filteredFiles.map(renderFileCard).join('') : '<p class="empty-library">No shared materials match the selected filters.</p>'}
                </div>
            </section>
        `;
    }

    subjectSelect?.addEventListener('change', render);
    lessonSelect?.addEventListener('change', render);
    render();
});
