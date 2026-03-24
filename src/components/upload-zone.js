/**
 * ChitraVithika — <upload-zone> Web Component
 *
 * Stage-only mode: files are selected and previewed but NOT auto-uploaded.
 * The parent form controls when submission happens.
 *
 * Events:
 *   upload-zone:file-selected — fired when user selects/drops valid files
 *   upload-zone:file-removed  — fired when user removes a staged file
 *
 * Public API:
 *   .getFiles()    — returns array of staged File objects
 *   .hasFiles()    — returns boolean
 *   .clearFiles()  — clears all staged files
 *   .showSuccess() — shows success state
 *   .showError(msg) — shows error state
 *
 * Attributes:
 *   accept        — accepted file types (default: .jpg,.jpeg,.png,.webp)
 *   max-size-mb   — max file size in MB (default: 50)
 */

class UploadZone extends HTMLElement {
  static get observedAttributes() {
    return ['accept', 'max-size-mb'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._dragDepth = 0;
    this._stagedFiles = [];
    this._previewUrls = [];
  }

  connectedCallback() {
    this._render();
    this._attachEvents();
  }

  disconnectedCallback() {
    // Revoke any preview URLs
    this._previewUrls.forEach(u => URL.revokeObjectURL(u));
  }

  get accept() { return this.getAttribute('accept') || '.jpg,.jpeg,.png,.webp'; }
  get maxSizeMb() { return parseInt(this.getAttribute('max-size-mb') || '50', 10); }

  // ─── Public API ───────────────────────────────────────
  getFiles() { return [...this._stagedFiles]; }
  hasFiles() { return this._stagedFiles.length > 0; }

  clearFiles() {
    this._stagedFiles = [];
    this._previewUrls.forEach(u => URL.revokeObjectURL(u));
    this._previewUrls = [];
    this._updatePreview();
    this._resetZone();
  }

  showSuccess() {
    const zone = this.shadowRoot.getElementById('uz-zone');
    zone?.classList.remove('error', 'has-files');
    zone?.classList.add('success');
    this._setFeedback('✓ Listed successfully!');
    setTimeout(() => this.clearFiles(), 3000);
  }

  showError(msg) {
    const zone = this.shadowRoot.getElementById('uz-zone');
    zone?.classList.remove('success');
    zone?.classList.add('error');
    this._setFeedback(`✗ ${msg}`);
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        .uz-zone {
          border: 2px dashed rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 48px 32px;
          text-align: center;
          position: relative;
          transition: border-color 0.3s ease, background 0.3s ease;
          cursor: pointer;
          background: rgba(255,255,255,0.02);
        }

        .uz-zone.dragging {
          border-color: rgba(200,169,110,0.6);
          background: rgba(200,169,110,0.05);
        }

        .uz-zone.has-files { border-color: rgba(200,169,110,0.3); cursor: default; }
        .uz-zone.success   { border-color: rgba(76,175,129,0.5); background: rgba(76,175,129,0.03); }
        .uz-zone.error     { border-color: rgba(224,82,82,0.5);  background: rgba(224,82,82,0.03); }

        .uz-icon {
          width: 48px; height: 48px;
          margin: 0 auto 16px;
          color: rgba(200,169,110,0.4);
          transition: transform 0.2s ease, color 0.2s ease;
        }

        .uz-zone.dragging .uz-icon { color: rgba(200,169,110,0.9); transform: scale(1.15); }

        .uz-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.15rem;
          font-weight: 600;
          color: #f0ede8;
          margin-bottom: 6px;
        }

        .uz-subtitle {
          font-size: 0.78rem;
          color: #6a6560;
          margin-bottom: 20px;
          line-height: 1.6;
        }

        .uz-browse-btn {
          display: inline-block;
          padding: 8px 20px;
          border-radius: 6px;
          border: 1px solid rgba(200,169,110,0.35);
          background: rgba(200,169,110,0.08);
          color: #c8a96e;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s ease;
          outline: none;
        }

        .uz-browse-btn:hover  { background: rgba(200,169,110,0.18); }
        .uz-browse-btn:focus-visible { outline: 2px solid #c8a96e; outline-offset: 2px; }

        /* File input — visually hidden */
        #uz-file-input {
          position: absolute; inset: 0;
          opacity: 0; cursor: pointer;
          width: 100%; height: 100%;
        }

        .uz-zone.has-files #uz-file-input { display: none; }
        .uz-zone.has-files .uz-upload-prompt { display: none; }
        .uz-zone.has-files .uz-preview { display: flex; }

        /* ─── Preview ─── */
        .uz-preview {
          display: none;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .uz-preview-image {
          max-width: 100%;
          max-height: 280px;
          border-radius: 10px;
          object-fit: contain;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }

        .uz-preview-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.78rem;
          color: #8a8580;
        }

        .uz-preview-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          color: #c8a96e;
          max-width: 28ch;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .uz-preview-size {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.68rem;
          color: #6a6560;
        }

        .uz-remove-btn {
          padding: 4px 14px;
          border-radius: 999px;
          border: 1px solid rgba(224,82,82,0.3);
          background: rgba(224,82,82,0.06);
          color: #e05252;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s ease;
          outline: none;
        }

        .uz-remove-btn:hover { background: rgba(224,82,82,0.15); }

        /* ─── Feedback ─── */
        .uz-feedback {
          margin-top: 12px;
          font-size: 0.82rem;
          min-height: 1.4em;
          transition: color 0.3s ease;
        }

        .uz-zone.success .uz-feedback { color: #4caf81; }
        .uz-zone.error   .uz-feedback { color: #e05252; }
        .uz-feedback:empty            { display: none; }
      </style>

      <div class="uz-zone" id="uz-zone" role="region"
           aria-label="Upload your photograph. Drag and drop or click to browse."
           tabindex="0">

        <input type="file" id="uz-file-input"
               accept="${this.accept}"
               aria-label="Select a photograph to upload" />

        <div class="uz-upload-prompt">
          <svg class="uz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>

          <div class="uz-title" id="uz-title">Drop Your Photograph Here</div>
          <div class="uz-subtitle">
            JPEG · PNG · WebP &nbsp;·&nbsp; Max ${this.maxSizeMb}MB
          </div>
          <button class="uz-browse-btn" type="button" id="uz-browse-btn">
            Browse Files
          </button>
        </div>

        <div class="uz-preview" id="uz-preview">
          <img class="uz-preview-image" id="uz-preview-img" alt="Preview" />
          <div class="uz-preview-meta">
            <span class="uz-preview-name" id="uz-preview-name"></span>
            <span class="uz-preview-size" id="uz-preview-size"></span>
            <button class="uz-remove-btn" id="uz-remove-btn" type="button">Remove</button>
          </div>
        </div>

        <div id="uz-feedback" class="uz-feedback" aria-live="polite" aria-atomic="true"></div>
      </div>
    `;
  }

  _attachEvents() {
    const zone = this.shadowRoot.getElementById('uz-zone');
    const fileInput = this.shadowRoot.getElementById('uz-file-input');
    const browseBtn = this.shadowRoot.getElementById('uz-browse-btn');
    const removeBtn = this.shadowRoot.getElementById('uz-remove-btn');

    // Browse button triggers the hidden file input
    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    // File input change — stage file, don't upload
    fileInput?.addEventListener('change', () => {
      if (fileInput.files?.length) this._stageFile(fileInput.files[0]);
    });

    // Remove button
    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearFiles();
      this.dispatchEvent(new CustomEvent('upload-zone:file-removed', {
        bubbles: true, composed: true,
      }));
    });

    // Drag events
    zone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      this._dragDepth++;
      zone.classList.add('dragging');
    });

    zone.addEventListener('dragleave', () => {
      this._dragDepth--;
      if (this._dragDepth === 0) zone.classList.remove('dragging');
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dragDepth = 0;
      zone.classList.remove('dragging');
      const files = [...(e.dataTransfer.files || [])];
      if (files.length) this._stageFile(files[0]);
    });

    // Keyboard
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!this.hasFiles()) fileInput.click();
      }
    });
  }

  _stageFile(file) {
    const maxBytes = this.maxSizeMb * 1024 * 1024;
    const validExts = this.accept.split(',').map(e => e.trim().toLowerCase());
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExts.includes(ext)) {
      this._setFeedback(`Unsupported format: ${ext}. Use ${validExts.join(', ')}`, 'error');
      return;
    }
    if (file.size > maxBytes) {
      this._setFeedback(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB — max ${this.maxSizeMb}MB`, 'error');
      return;
    }

    // Release old preview
    this._previewUrls.forEach(u => URL.revokeObjectURL(u));
    this._previewUrls = [];
    this._stagedFiles = [file];

    // Create preview
    const url = URL.createObjectURL(file);
    this._previewUrls.push(url);
    this._updatePreview(url, file);

    this._setFeedback('');

    this.dispatchEvent(new CustomEvent('upload-zone:file-selected', {
      bubbles: true, composed: true,
      detail: { file },
    }));
  }

  _updatePreview(url, file) {
    const zone = this.shadowRoot.getElementById('uz-zone');
    const img = this.shadowRoot.getElementById('uz-preview-img');
    const name = this.shadowRoot.getElementById('uz-preview-name');
    const size = this.shadowRoot.getElementById('uz-preview-size');

    if (url && file) {
      zone?.classList.add('has-files');
      zone?.classList.remove('error', 'success');
      if (img) img.src = url;
      if (name) name.textContent = file.name;
      if (size) size.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    } else {
      zone?.classList.remove('has-files');
      if (img) img.src = '';
      if (name) name.textContent = '';
      if (size) size.textContent = '';
    }
  }

  _resetZone() {
    const zone = this.shadowRoot.getElementById('uz-zone');
    zone?.classList.remove('has-files', 'success', 'error');
    this._setFeedback('');
    const fileInput = this.shadowRoot.getElementById('uz-file-input');
    if (fileInput) fileInput.value = '';
  }

  _setFeedback(msg, state = '') {
    const zone = this.shadowRoot.getElementById('uz-zone');
    const feedback = this.shadowRoot.getElementById('uz-feedback');
    if (feedback) feedback.textContent = msg;
    if (state && zone) {
      zone.classList.remove('success', 'error');
      zone.classList.add(state);
    }
  }
}

customElements.define('upload-zone', UploadZone);
