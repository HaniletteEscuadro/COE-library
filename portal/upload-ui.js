/**
 * Upload modal behaviour: drag-and-drop, file preview, progress.
 *
 * Purely additive. It never submits the form or writes to storage — the
 * existing handler in scripts.js still does all of that. This only reflects
 * the chosen file back to the user, which the old modal did not do beyond a
 * bare filename.
 */
(function () {
  'use strict';

  var fileInput, cameraInput, drop, box, nameEl, metaEl, clearBtn, legacyName;

  function bytes(size) {
    if (!size) return '';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    var value = size / Math.pow(1024, i);
    return (i === 0 ? value : value.toFixed(1)) + ' ' + units[i];
  }

  /** Rough icon by extension, so the card is not always a blank page. */
  function iconFor(name) {
    var ext = String(name || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].indexOf(ext) > -1) return 'image';
    if (['mp4', 'mov', 'webm'].indexOf(ext) > -1) return 'movie';
    if (['doc', 'docx'].indexOf(ext) > -1) return 'article';
    if (['ppt', 'pptx'].indexOf(ext) > -1) return 'slideshow';
    if (['xls', 'xlsx', 'csv'].indexOf(ext) > -1) return 'table_chart';
    if (ext === 'zip') return 'folder_zip';
    return 'description';
  }

  function show(file) {
    if (!box) return;

    if (!file) {
      box.hidden = true;
      if (drop) drop.hidden = false;
      if (legacyName) legacyName.textContent = 'No file selected';
      return;
    }

    box.hidden = false;
    if (drop) drop.hidden = true;

    if (nameEl) nameEl.textContent = file.name;
    if (metaEl) metaEl.textContent = bytes(file.size) + (file.type ? ' · ' + file.type : '');

    var icon = box.querySelector('.gd-file-icon');
    if (icon) icon.textContent = iconFor(file.name);

    // scripts.js still reads this element, so keep it in step.
    if (legacyName) legacyName.textContent = file.name;
  }

  function currentFile() {
    if (fileInput && fileInput.files && fileInput.files[0]) return fileInput.files[0];
    if (cameraInput && cameraInput.files && cameraInput.files[0]) return cameraInput.files[0];
    return null;
  }

  function init() {
    var modal = document.getElementById('upload-file-modal');
    if (!modal) return;

    fileInput = document.getElementById('file-upload');
    cameraInput = document.getElementById('camera-upload');
    drop = document.getElementById('gd-drop');
    box = document.getElementById('gd-file');
    nameEl = document.getElementById('gd-file-name');
    metaEl = document.getElementById('gd-file-meta');
    clearBtn = document.getElementById('gd-file-clear');
    legacyName = document.getElementById('upload-file-name');

    if (fileInput) fileInput.addEventListener('change', function () { show(currentFile()); });
    if (cameraInput) cameraInput.addEventListener('change', function () { show(currentFile()); });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (fileInput) fileInput.value = '';
        if (cameraInput) cameraInput.value = '';
        show(null);
      });
    }

    // --- Drag and drop ---------------------------------------------------
    if (drop && fileInput) {
      ['dragenter', 'dragover'].forEach(function (event) {
        drop.addEventListener(event, function (e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.add('is-over');
        });
      });

      ['dragleave', 'drop'].forEach(function (event) {
        drop.addEventListener(event, function (e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.remove('is-over');
        });
      });

      drop.addEventListener('drop', function (e) {
        var dropped = e.dataTransfer && e.dataTransfer.files;
        if (!dropped || !dropped.length) return;

        // DataTransfer is the only way to put a dropped file into an <input>,
        // which is what the existing submit handler reads from.
        try {
          var transfer = new DataTransfer();
          transfer.items.add(dropped[0]);
          fileInput.files = transfer.files;
          show(dropped[0]);
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (error) {
          console.warn('[upload] could not attach the dropped file', error);
        }
      });
    }

    // The whole page should not navigate if a file misses the zone.
    ['dragover', 'drop'].forEach(function (event) {
      window.addEventListener(event, function (e) {
        if (modal.style.display === 'none' || !modal.style.display) return;
        e.preventDefault();
      });
    });

    // --- Closing -----------------------------------------------------------
    //
    // One closer used by every route out of the modal. The legacy close button
    // is rebound here too: the modal markup was replaced, so whatever listener
    // scripts.js attached at load time is bound to an element that no longer
    // exists in the tree.
    function closeModal() {
      // setProperty with 'important' beats the stylesheet, which forces
      // display:flex whenever the inline style contains "block" or "flex".
      modal.style.setProperty('display', 'none', 'important');
      modal.removeAttribute('data-open');

      if (fileInput) fileInput.value = '';
      if (cameraInput) cameraInput.value = '';

      var link = document.getElementById('gd-link-url');
      if (link) link.value = '';

      var preview = document.getElementById('gd-link-preview');
      if (preview) preview.hidden = true;

      var progress = document.getElementById('gd-progress');
      if (progress) progress.hidden = true;

      show(null);
    }

    window.closeUploadModal = closeModal;

    var cancel = document.getElementById('gd-cancel');
    if (cancel) cancel.addEventListener('click', closeModal);

    // The X in the corner. Rebound for the reason above.
    var closeX = document.getElementById('close-upload-modal-btn');
    if (closeX) closeX.addEventListener('click', closeModal);

    // Backdrop click, but not a click inside the card.
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    // Escape, whatever the modal was opened with.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = window.getComputedStyle(modal).display !== 'none';
      if (open) closeModal();
    });

    // Opening must clear an inline "none !important" left by a previous close,
    // otherwise the modal can never be shown again.
    var observer = new MutationObserver(function () {
      var inline = modal.getAttribute('style') || '';
      if (/display:\s*(block|flex)/i.test(inline)) {
        modal.style.setProperty('display', 'flex', 'important');
        modal.setAttribute('data-open', 'true');
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });

    initLinkMode();

    // Reset the preview whenever the form is submitted or reset.
    var form = document.getElementById('upload-file-form');
    if (form) {
      form.addEventListener('reset', function () { setTimeout(function () { show(null); }, 0); });
      form.addEventListener('submit', function () { setTimeout(function () { show(currentFile()); }, 0); });
    }
  }

  // -------------------------------------------------------------------------
  // Link mode
  //
  // The existing submit handler only knows how to read a File. Rather than
  // touch it, link submissions are handled here in full and the native submit
  // is cancelled -- so a link never reaches a code path that expects bytes.
  // -------------------------------------------------------------------------

  /** Recognise the provider so the preview can say what it is. */
  function describeLink(value) {
    var url;
    try {
      url = new URL(String(value || '').trim());
    } catch (error) {
      return null;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    var host = url.hostname.replace(/^www\./, '');

    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) {
      return { kind: 'YouTube video', icon: 'smart_display', tone: 'is-youtube', host: host, url: url.href, type: 'Video' };
    }
    if (/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/.test(host)) {
      return { kind: 'Google Drive', icon: 'add_to_drive', tone: 'is-drive', host: host, url: url.href, type: 'GDrive Links' };
    }
    return { kind: 'External link', icon: 'link', tone: 'is-other', host: host, url: url.href, type: 'GDrive Links' };
  }

  function initLinkMode() {
    var tabFile = document.getElementById('gd-tab-file');
    var tabLink = document.getElementById('gd-tab-link');
    var pane = document.getElementById('gd-link-pane');
    var input = document.getElementById('gd-link-url');
    var preview = document.getElementById('gd-link-preview');
    var alt = document.getElementById('gd-alt');
    var form = document.getElementById('upload-file-form');
    var modal = document.getElementById('upload-file-modal');

    if (!tabFile || !tabLink || !pane || !input) return;

    var mode = 'file';

    function setMode(next) {
      mode = next;
      var isLink = next === 'link';

      pane.hidden = !isLink;
      if (drop) drop.hidden = isLink || (box && !box.hidden);
      if (box && !box.hidden) box.hidden = isLink ? true : box.hidden;
      if (alt) alt.hidden = isLink;

      tabFile.classList.toggle('is-on', !isLink);
      tabLink.classList.toggle('is-on', isLink);
      tabFile.setAttribute('aria-selected', String(!isLink));
      tabLink.setAttribute('aria-selected', String(isLink));
    }

    tabFile.addEventListener('click', function () { setMode('file'); });
    tabLink.addEventListener('click', function () { setMode('link'); });

    input.addEventListener('input', function () {
      var value = input.value.trim();

      if (!value) {
        preview.hidden = true;
        return;
      }

      var info = describeLink(value);
      preview.hidden = false;
      preview.className = 'gd-link-preview ' + (info ? info.tone : 'is-bad');
      document.getElementById('gd-link-icon').textContent = info ? info.icon : 'error_outline';
      document.getElementById('gd-link-kind').textContent = info ? info.kind : 'That does not look like a valid link';
      document.getElementById('gd-link-host').textContent = info ? info.host : 'Use a full http or https address.';
    });

    if (!form) return;

    // Capture phase, so this runs before the legacy submit listener.
    form.addEventListener('submit', function (event) {
      if (mode !== 'link') return;

      event.preventDefault();
      event.stopImmediatePropagation();

      var info = describeLink(input.value);

      if (!info) {
        window.showLibraryToast
          ? window.showLibraryToast('Invalid link', 'Enter a full http or https address.', 'error')
          : alert('Enter a full http or https address.');
        return;
      }

      var lesson = (document.getElementById('upload-lesson') || {}).value || 'General';
      var course = (document.getElementById('upload-discipline') || {}).value || 'CE';
      // Where the button sits during the round trip. A link POST is fast but not
      // instant, and a form that looks idle invites a second submit.
      var submitBtn = form.querySelector('button[type="submit"], .gd-submit');
      var submitLabel = submitBtn ? submitBtn.innerHTML : '';

      var user = {};
      try { user = JSON.parse(localStorage.getItem('studentWorkplaceCurrentUser') || '{}') || {}; } catch (e) { user = {}; }

      // Whichever folder the tree has open. Without this the link was filed
      // under the modal's own two fields only, so a YouTube lecture pasted
      // while standing inside a subject folder never appeared in it.
      var openFolderId = form.getAttribute('data-folder-id') ||
        (window.currentFolderId && window.currentFolderId !== 'all' ? window.currentFolderId : '');
      var folder = (window.getLibraryFolderContext && openFolderId)
        ? window.getLibraryFolderContext(openFolderId)
        : {};

      var destination = folder.folderName || lesson;
      // The folder decides the shelf. Only fall back to the link's own kind
      // when the upload is not aimed at a category folder.
      var category = folder.category || (info.type === 'Video' ? 'Video Lectures' : 'GDrive Links');
      var title = folder.subject ? folder.subject + ' - ' + info.kind : lesson;

      /** Clear the composer and refresh whichever library views are mounted. */
      function finish(headline, detail, tone) {
        input.value = '';
        preview.hidden = true;
        setMode('file');
        if (window.closeUploadModal) window.closeUploadModal();
        form.reset();

        if (window.showLibraryToast) {
          window.showLibraryToast(headline, detail, tone || 'success');
        }

        try {
          if (window.enhancedLibrary && window.enhancedLibrary.populateLibraryFolderTree) {
            window.enhancedLibrary.populateLibraryFolderTree();
          }
          if (typeof window.displayLibrary === 'function') window.displayLibrary();
        } catch (error) {
          console.warn('[upload] link saved, but the view did not refresh', error);
        }
      }

      // --- Shared library ---------------------------------------------------
      //
      // A pasted link used to be written straight into this browser's own copy
      // of the library and nowhere else. It looked like it worked -- the card
      // appeared, the toast said "added" -- but the server never heard about
      // it, so nobody else could see it and it was gone the moment the cache
      // was rebuilt from the database. Files already took this path; links did
      // not, which is the whole of the bug.
      //
      // The local branch below is kept only for opening index.html straight off
      // the filesystem, where there is no server to talk to.
      if (window.CoeLive && window.CoeLive.ready) {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Adding link...';
        }

        window.CoeLive.uploadMaterial({
          folder: {
            course: folder.course || course,
            year: folder.year || '',
            subject: folder.subject || '',
            category: category
          },
          title: title,
          description: '',
          tags: [],
          lesson: folder.lesson || lesson,
          professorName: folder.professorName || '',
          externalUrl: info.url
        }).then(function (result) {
          finish(
            result.status === 'pending' ? 'Sent for approval' : info.kind + ' added',
            result.status === 'pending' ? result.message : destination,
            result.status === 'pending' ? 'info' : 'success'
          );
        }).catch(function (error) {
          // Nothing is cleared on failure: the address stays in the box so it
          // can be retried without being pasted again.
          if (window.showLibraryToast) {
            window.showLibraryToast('Could not add link', (error && error.message) || 'Try again.', 'error');
          }
        }).then(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = submitLabel;
          }
        });

        return;
      }

      // Served by the app server, but the live layer never came up. The local
      // branch below writes into the render cache, which coe-live.js replaces
      // from the database on the next boot -- so the link would look added and
      // be gone after a refresh. Say so rather than losing it quietly. See the
      // matching guard in scripts.js uploadMaterialToLibrary().
      if (window.CoeApi && window.CoeApi.isServed && window.CoeApi.isServed()) {
        if (window.showLibraryToast) {
          window.showLibraryToast(
            'Link not saved',
            'Not signed in to the library server. Reload the page and sign in, then try again.',
            'error'
          );
        }
        return;
      }

      var record = {
        id: 'link-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8),
        folderId: folder.folderId || '',
        folderName: folder.folderName || '',
        title: title,
        name: info.kind,
        originalName: info.kind,
        description: '',
        discipline: folder.course || course,
        year: folder.year || '',
        subject: folder.subject || lesson,
        lesson: folder.lesson || lesson,
        materialCategory: category,
        professorName: folder.professorName || '',
        professorUsername: folder.professorUsername || '',
        type: info.type,
        fileType: 'link',
        size: 0,
        tags: [],
        comments: [],
        favorite: false,
        uploadedAt: new Date().toISOString(),
        lastModified: new Date().toLocaleString(),
        uploadedBy: user.name || user.username || 'COE user',
        ownerUsername: user.username || '',
        content: info.url,
        externalUrl: info.url,
        previewType: 'link',
        accessLevel: 'Shared with all users',
        downloads: 0,
        views: 0
      };

      // scripts.js owns the in-memory list. Writing to localStorage behind its
      // back meant the next upload from anywhere else overwrote this record.
      if (typeof window.addLibraryRecord === 'function') {
        if (!window.addLibraryRecord(record, { destinationLabel: destination })) return;
      } else {
        var files = [];
        try { files = JSON.parse(localStorage.getItem('coeLearningFiles') || '[]'); } catch (e) { files = []; }
        if (!Array.isArray(files)) files = [];
        files.push(record);

        try {
          localStorage.setItem('coeLearningFiles', JSON.stringify(files));
        } catch (error) {
          window.showLibraryToast
            ? window.showLibraryToast('Could not save', 'Browser storage is full.', 'error')
            : alert('Browser storage is full.');
          return;
        }
      }

      finish(info.kind + ' added', destination, 'success');
    }, true);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
