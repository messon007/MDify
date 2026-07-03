const appVersion = '1.3.6';
document.getElementById('version').textContent = appVersion;
document.getElementById('dialog-version').textContent = appVersion;

let currentFileHandle = null;
let skipAutosaveLoad = false;
let currentDraftId = null;
let autosaveStorageWarningShown = false;
let lastSavedContent = '';

const MAX_LOCAL_STORAGE_DRAFT_KB = 4000;
const LARGE_DOCUMENT_CHAR_LIMIT = 300000;
const LARGE_DOCUMENT_LINE_LIMIT = 10000;
const LARGE_DOCUMENT_PREVIEW_CONTEXT_LINES = 220;

function estimateLocalStorageSizeWith(key, value) {
  const snapshot = {};
  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    snapshot[storageKey] = localStorage.getItem(storageKey);
  }
  snapshot[key] = value;
  return Math.round((JSON.stringify(snapshot).length / 1024) * 100) / 100;
}

function isQuotaExceededError(err) {
  return err && (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

// Autosave Collection Functions
function loadAutosaveCollection() {
  const collectionJSON = localStorage.getItem('autosaveCollection');
  return collectionJSON ? JSON.parse(collectionJSON) : [];
}

function saveAutosaveCollection(collection) {
  const collectionJSON = JSON.stringify(collection);
  const estimatedSize = estimateLocalStorageSizeWith('autosaveCollection', collectionJSON);
  if (estimatedSize > MAX_LOCAL_STORAGE_DRAFT_KB) {
    throw new Error(`Document is too large for browser autosave (${estimatedSize} KB). Please save it as a file instead.`);
  }
  localStorage.setItem('autosaveCollection', collectionJSON);
}

function addOrUpdateDraft(id, name, content) {
  const collection = loadAutosaveCollection();
  const timestamp = Date.now();
  const size = content.length;
  const preview = content
    .replace(/[#*_>`~]/g, '') // Strip markdown symbols
    .replace(/<\/?("[^"]*"|'[^']*'|[^>])*(>|$)/g, "")
    .replace(/\n/g, '')
    .substring(0, 50)
    .trim() + (content.length > 50 ? '...' : '');

  const draftIndex = collection.findIndex(draft => draft.id === id);
  
  if (draftIndex !== -1) {
    // Update existing draft
    collection[draftIndex] = {
      ...collection[draftIndex],
      name,
      preview,
      content,
      timestamp,
      size
    };
  } else {
    // Create new draft
    collection.push({
      id,
      name: name || `Untitled Document-${timestamp}`,
      preview,
      content,
      timestamp,
      size
    });
  }
  
  saveAutosaveCollection(collection);
  return id;
}

function deleteDraft(id) {
  const collection = loadAutosaveCollection();
  const newCollection = collection.filter(draft => draft.id !== id);
  saveAutosaveCollection(newCollection);
  
  if (currentDraftId === id) {
    currentDraftId = null;
  }
}

function clearAllDrafts() {
  localStorage.removeItem('autosaveCollection');
  currentDraftId = null;
}

function getLocalStorageSize() {
  const total = 5120; // 5MB in KB
  const used = Math.round((JSON.stringify(localStorage).length / 1024) * 100) / 100;
  return { used, total };
}

const isMobile = window.matchMedia('(max-width: 768px)').matches;

const SaveIconBtn = document.querySelector('#autoSaveIconBtn');
const SaveIconBtnIcon = document.querySelector('#autoSaveIconBtn .status');
const directionIconBtn = document.getElementById('directionBtn');

const rtlIcon = `
<svg fill="currentColor" width="16" height="16" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg">
    <path d="M822.456 787.786h33.337v447.22h168.8V168.89h196.652v1066.115h168.8V168.89h171.331V0h-738.92C605.379 0 428.73 176.659 428.73 393.85c0 217.277 176.65 393.936 393.726 393.936m949.528 650.39H523.268l193.65-193.592-119.416-119.38-397.518 397.398L597.502 1920l119.416-119.38-193.65-193.59h1248.716v-168.855Z" fill-rule="evenodd" />
</svg>
`;

const ltrIcon = `
<svg fill="currentColor" width="16" height="16" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg">
    <path d="M306.205 1607.01h1290.597l-193.598 193.603L1522.588 1920 1920 1522.577l-397.412-397.423-119.384 119.387 193.598 193.604H306.205v168.864Zm389.661-819.34h33.35v447.153h168.86V168.865h196.722v1065.958h168.86V168.865h171.393V0H695.866C478.712 0 302 176.632 302 393.792c0 217.245 176.712 393.877 393.866 393.877" fill-rule="evenodd"/>
</svg>
`;

const checkIcon = `
<svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 6L9 17L4 12" stroke="var(--bg-color)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M20 6L9 17L4 12" stroke="#00b700" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const closeIcon = `
<svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="disabled-icon">
<path d="M18 6L6 18M6 6L18 18" stroke="var(--bg-color)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M18 6L6 18M6 6L18 18" stroke="#ff175e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const loadingIcon = `
<svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="loading-icon">
<path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.0784 19.0784L16.25 16.25M19.0784 4.99994L16.25 7.82837M4.92157 19.0784L7.75 16.25M4.92157 4.99994L7.75 7.82837" stroke="var(--bg-color)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.0784 19.0784L16.25 16.25M19.0784 4.99994L16.25 7.82837M4.92157 19.0784L7.75 16.25M4.92157 4.99994L7.75 7.82837" stroke="#00b2ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

function changeSaveIconBtnIcon(status = "loading") {
  if (status == 'loading') {
    SaveIconBtnIcon.innerHTML = loadingIcon;
    SaveIconBtn.setAttribute('data-tooltip', 'Auto Save is Enable');
  } else if (status == 'saved') {
    SaveIconBtnIcon.innerHTML = checkIcon;
    SaveIconBtn.setAttribute('data-tooltip', 'Auto Save is Enable');
  } else {
    SaveIconBtnIcon.innerHTML = closeIcon;
    SaveIconBtn.setAttribute('data-tooltip', 'Auto Save is Disable');
  }
}

let languageDetectionString = "";
function detectLanguageByScript(text) {
  // Map of language codes to their Unicode script regex
  const languageScripts = {
    // --- Unique & Highly Distinct Scripts ---

    // CJK (Chinese, Japanese, Korean)
    // Note: These scripts overlap. Detection is a best guess.
    'ja': /[\u3040-\u309F\u30A0-\u30FF]/, // Japanese (Hiragana, Katakana) - Most specific
    'ko': /[\uAC00-\uD7AF]/, // Korean (Hangul Syllables) - Very specific
    'zh': /[\u4E00-\u9FFF]/, // Chinese (Hanzi) - Also covers Japanese Kanji, so less specific on its own

    // Middle Eastern Scripts
    'fa': /[\u0600-\u06FF]/, // Persian (uses Arabic script)
    'ar': /[\u0600-\u06FF]/, // Arabic (shares script with Persian) - a good starting point
    'he': /[\u0590-\u05FF]/, // Hebrew

    // South & Southeast Asian Scripts
    'hi': /[\u0900-\u097F]/, // Hindi (Devanagari)
    'bn': /[\u0980-\u09FF]/, // Bengali
    'ta': /[\u0B80-\u0BFF]/, // Tamil
    'te': /[\u0C00-\u0C7F]/, // Telugu
    'th': /[\u0E00-\u0E7F]/, // Thai
    'lo': /[\u0E80-\u0EFF]/, // Lao
    'my': /[\u1000-\u109F]/, // Burmese (Myanmar)

    // European Scripts (Non-Latin)
    'ru': /[\u0400-\u04FF]/, // Russian (Cyrillic)
    'el': /[\u0370-\u03FF]/, // Greek

    // Other Distinct Scripts
    'ka': /[\u10A0-\u10FF]/, // Georgian
    'am': /[\u1200-\u137F]/, // Amharic (Ethiopic)
    'hy': /[\u0530-\u058F]/, // Armenian
  };

  for (const langCode in languageScripts) {
    if (languageScripts[langCode].test(text)) {
      return langCode;
    }
  }

  // If no specific script is found, it's likely Latin-based or unknown
  return null;
}

// A simple debounce function to avoid running on every single keystroke
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

function testLog(log) {
  const isEnable = false;
  if (isEnable) {
    document.getElementById('testLog').textContent = log.trim();
  }
}

const detectAndSetLanguage = debounce(() => {
  const editorContentElem = document.querySelector('.toastui-editor [contenteditable="true"]');
  // Get the first 50 characters to make detection fast
  const sampleText = getDocumentMarkdown().substring(0, 50);
  if (!sampleText) return;
  if(sampleText.trim() != languageDetectionString.trim()) {
    // console.log("---------> Checking Language...");
    languageDetectionString = sampleText.trim();
    const detectedLang = detectLanguageByScript(sampleText);

    if (detectedLang) {
      console.log(`Detected language: ${detectedLang}`);
      testLog(`Detected language: ${detectedLang}`)
      // editor.lang = detectedLang;
      editorContentElem.lang = detectedLang;
    } else {
      // If no unique script is detected, you might fall back to English or remove the lang attribute
      editorContentElem.lang = 'en';
      console.log('No unique script detected, defaulting to English.');
      testLog('No unique script detected, defaulting to English.');
    }
  }
}, 3000); // Wait 3 second after user stops typing

const autoSaveOnChangeFunc = debounce(() => {
  autoSaveFunc();
}, 2000); // Wait 3 second after user stops typing

const updateOutlineOnChange = debounce(() => {
  const sidebar = document.getElementById('outlineSidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    renderOutlineSidebar();
  }
}, 500);


// Alert timeout
let alertTimeout;
let popupTimeout;

const toggleDisableSpellCheck = document.getElementById('disableSpellCheck');

const { Editor } = toastui;
const { chart, codeSyntaxHighlight, colorSyntax, tableMergedCell, uml } = Editor.plugin;

const chartOptions = {
  minWidth: 100,
  maxWidth: 600,
  minHeight: 100,
  maxHeight: 300
};

// Initialize Toast UI Editor with RTL support and custom commands
const editor = new Editor({
    el: document.querySelector('#editor'),
    initialEditType: localStorage.getItem('WYSIWYGMode') === 'true' ? 'wysiwyg' : 'markdown',
    previewStyle: localStorage.getItem('editorTabMode') === 'true' || isMobile ? 'tab' : 'vertical',
    autofocus: false, // Set this to false to disable auto-focus
    height: '100%',
    usageStatistics: false,
    theme: localStorage.getItem('selectedTheme') === 'dark' ? 'dark' : 'light',
    plugins: [
      [chart, chartOptions],
      [codeSyntaxHighlight, { highlighter: Prism}],
      colorSyntax,
      tableMergedCell,
      uml
    ],
    // hooks: {
    //     async 'addImageBlobHook'(blob, callback) {
    //         // Handle image uploads
    //         callback('https://via.placeholder.com/150');
    //     }
    // },
    events: {
      // load: () => {
      //   console.log('Editor loaded');
      // },
      change: () => {
        // console.log('Editor changed');
        if(!toggleDisableSpellCheck.checked) {
          detectAndSetLanguage();
        }

        autoSaveOnChangeFunc();
        updateOutlineOnChange();
      },
    //   focus: () => {
    //     document.body.classList.add('editor-focused');
    //     console.log('Editor focused');
    //   },
    //   blur: () => {
    //     document.body.classList.remove('editor-focused');
    //     console.log('Editor blurred');
    //   }
    },
    // customHTMLRenderer: {
    //   htmlBlock: {
    //     pagebreak(node) {
    //       return [
    //         { type: 'openTag', tagName: 'span', outerNewLine: true, attributes: {'data-test': 'data-page-break'} },
    //         { type: 'html', content: "===" },
    //         { type: 'closeTag', tagName: 'span', outerNewLine: true },
    //       ];
    //     },
    //   }
    // },
});

let largeDocumentMode = false;
let compareMode = false;
const largeDocumentTextarea = document.createElement('textarea');
const largeDocumentPreview = document.getElementById('preview');
const editorContainer = document.querySelector('.editor-container');
largeDocumentTextarea.id = 'largeDocumentEditor';
largeDocumentTextarea.setAttribute('aria-label', 'Large markdown editor');
largeDocumentTextarea.spellcheck = false;
largeDocumentTextarea.style.cssText = 'display:none;width:50%;height:100%;box-sizing:border-box;border:0;border-right:1px solid var(--border-color);resize:none;padding:16px;font:14px/1.6 monospace;background:var(--bg-color);color:var(--text-color);outline:none;order:1;';
largeDocumentPreview.style.cssText = 'display:none;width:50%;height:100%;box-sizing:border-box;overflow:auto;padding:16px;background:var(--bg-color);color:var(--text-color);font-family:var(--font-body);line-height:1.6;';
largeDocumentPreview.style.order = '2';
editorContainer.insertBefore(largeDocumentTextarea, largeDocumentPreview);

const compareContainer = document.createElement('div');
compareContainer.id = 'compareContainer';
compareContainer.className = 'compare-container';
compareContainer.innerHTML = `
  <section class="compare-pane" data-side="source">
    <div class="compare-pane-header">
      <div class="compare-pane-title" id="compareSourceTitle">Source</div>
      <div class="compare-pane-actions">
        <button type="button" data-open-side="source">Open</button>
        <button type="button" data-render-toggle="source">Render</button>
      </div>
    </div>
    <textarea id="compareSourceText" class="compare-source" readonly></textarea>
    <div id="compareSourceRender" class="compare-render"></div>
  </section>
  <section class="compare-pane" data-side="target">
    <div class="compare-pane-header">
      <div class="compare-pane-title" id="compareTargetTitle">Target</div>
      <div class="compare-pane-actions">
        <button type="button" data-open-side="target">Open</button>
        <button type="button" data-render-toggle="target">Render</button>
      </div>
    </div>
    <textarea id="compareTargetText" class="compare-source" readonly></textarea>
    <div id="compareTargetRender" class="compare-render"></div>
  </section>
  <input type="file" id="compareFileInput" accept=".md,.txt" hidden>
`;
editorContainer.appendChild(compareContainer);

const compareModeBtn = document.getElementById('compareModeBtn');
const compareSourceTitle = document.getElementById('compareSourceTitle');
const compareTargetTitle = document.getElementById('compareTargetTitle');
const compareSourceText = document.getElementById('compareSourceText');
const compareTargetText = document.getElementById('compareTargetText');
const compareSourceRender = document.getElementById('compareSourceRender');
const compareTargetRender = document.getElementById('compareTargetRender');
const compareFileInput = document.getElementById('compareFileInput');
let compareTargetName = 'Target';
let compareFileInputSide = 'target';
const markdownViewers = {
  large: null,
  source: null,
  target: null
};

const updateLargeDocumentPreview = debounce(() => {
  if (!largeDocumentMode) return;
  const content = getLargeDocumentPreviewSlice();
  renderMarkdownWithToastViewer('large', content, largeDocumentPreview);
}, 250);

largeDocumentTextarea.addEventListener('input', () => {
  autoSaveOnChangeFunc();
  updateOutlineOnChange();
  updateLargeDocumentPreview();
});
largeDocumentTextarea.addEventListener('keyup', updateLargeDocumentPreview);
largeDocumentTextarea.addEventListener('click', updateLargeDocumentPreview);
largeDocumentTextarea.addEventListener('scroll', updateLargeDocumentPreview);

function shouldUseLargeDocumentMode(content) {
  return content.length > LARGE_DOCUMENT_CHAR_LIMIT ||
    (content.match(/\n/g) || []).length > LARGE_DOCUMENT_LINE_LIMIT;
}

function setLargeDocumentMode(enabled) {
  largeDocumentMode = enabled;
  if (!compareMode) {
    document.getElementById('editor').style.display = enabled ? 'none' : '';
    largeDocumentTextarea.style.display = enabled ? 'block' : 'none';
    largeDocumentPreview.style.display = enabled ? 'block' : 'none';
    document.getElementById('footerButtons').style.display = enabled ? 'none' : '';
  }
}

function getDocumentMarkdown() {
  if (compareMode) {
    return compareSourceText.value;
  }
  return largeDocumentMode ? largeDocumentTextarea.value : editor.getMarkdown();
}

function setDocumentMarkdown(content, options = {}) {
  if (compareMode) {
    setCompareMode(false);
  }
  if (options.forceLarge || shouldUseLargeDocumentMode(content)) {
    setLargeDocumentMode(true);
    largeDocumentTextarea.value = content;
    updateLargeDocumentPreview();
    return true;
  } else {
    setLargeDocumentMode(false);
    editor.setMarkdown(content);
    return false;
  }
}

function getDocumentHTML() {
  return largeDocumentMode ? lightweightMarkdownToHtml(getDocumentMarkdown()) : editor.getHTML();
}

function setCompareMode(enabled) {
  const sourceMarkdown = enabled ? getDocumentMarkdown() : '';
  compareMode = enabled;
  compareContainer.classList.toggle('active', enabled);
  compareModeBtn.classList.toggle('active', enabled);
  compareModeBtn.querySelector('span').textContent = 'Compare';

  if (enabled) {
    compareSourceText.value = sourceMarkdown;
    compareSourceTitle.textContent = fileNameInput.value || 'Source';
    renderComparePane('source');

    document.getElementById('editor').style.display = 'none';
    largeDocumentTextarea.style.display = 'none';
    largeDocumentPreview.style.display = 'none';
    document.getElementById('footerButtons').style.display = 'none';
  } else {
    destroyMarkdownViewer('source');
    destroyMarkdownViewer('target');
    compareContainer.classList.remove('active');
    document.getElementById('editor').style.display = largeDocumentMode ? 'none' : '';
    largeDocumentTextarea.style.display = largeDocumentMode ? 'block' : 'none';
    largeDocumentPreview.style.display = largeDocumentMode ? 'block' : 'none';
    document.getElementById('footerButtons').style.display = largeDocumentMode ? 'none' : '';
  }
}

function renderComparePane(side) {
  const textElement = side === 'source' ? compareSourceText : compareTargetText;
  const renderElement = side === 'source' ? compareSourceRender : compareTargetRender;
  if (!textElement.value.trim() && side === 'target') {
    destroyMarkdownViewer(side);
    renderElement.innerHTML = '<div class="compare-target-empty">Open a target Markdown file to compare.</div>';
  } else {
    renderCompareMarkdown(side, textElement.value, renderElement);
  }
}

function destroyMarkdownViewer(key) {
  if (markdownViewers[key]) {
    markdownViewers[key].destroy();
    markdownViewers[key] = null;
  }
}

function renderCompareMarkdown(side, markdown, renderElement) {
  const textElement = side === 'source' ? compareSourceText : compareTargetText;
  const isLarge = shouldUseLargeDocumentMode(markdown);
  const content = isLarge
    ? getMarkdownSlice(markdown, textElement.selectionStart || 0)
    : markdown;
  renderMarkdownWithToastViewer(side, content, renderElement);
  if (isLarge) {
    const note = document.createElement('div');
    note.className = 'compare-target-empty';
    note.textContent = 'Large file: rendered section preview';
    renderElement.prepend(note);
  }
}

function renderMarkdownWithToastViewer(key, markdown, renderElement) {
  destroyMarkdownViewer(key);
  renderElement.innerHTML = '';

  try {
    const viewerOptions = {
      el: renderElement,
      viewer: true,
      initialValue: markdown,
      usageStatistics: false,
      theme: localStorage.getItem('selectedTheme') === 'dark' ? 'dark' : 'light',
      plugins: [
        [chart, chartOptions],
        [codeSyntaxHighlight, { highlighter: Prism}],
        colorSyntax,
        tableMergedCell,
        uml
      ]
    };

    markdownViewers[key] = Editor.factory
      ? Editor.factory(viewerOptions)
      : new Editor(viewerOptions);
  } catch (err) {
    console.error(err);
    renderElement.innerHTML = lightweightMarkdownToHtml(markdown);
  }
}

function setComparePaneMode(side, mode) {
  const pane = compareContainer.querySelector(`.compare-pane[data-side="${side}"]`);
  pane.classList.toggle('render-mode', mode === 'render');
  const renderButton = pane.querySelector('[data-render-toggle]');
  renderButton.classList.toggle('active', mode === 'render');
  if (mode === 'render') {
    renderComparePane(side);
  }
}

function toggleComparePaneRender(side) {
  const pane = compareContainer.querySelector(`.compare-pane[data-side="${side}"]`);
  setComparePaneMode(side, pane.classList.contains('render-mode') ? 'source' : 'render');
}

compareModeBtn.addEventListener('click', () => {
  setCompareMode(!compareMode);
});

compareContainer.querySelectorAll('[data-render-toggle]').forEach(button => {
  button.addEventListener('click', () => {
    toggleComparePaneRender(button.dataset.renderToggle);
  });
});

compareContainer.querySelectorAll('[data-open-side]').forEach(button => {
  button.addEventListener('click', () => {
    compareFileInputSide = button.dataset.openSide;
    compareFileInput.click();
  });
});

compareFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const content = await file.text();
    if (compareFileInputSide === 'source') {
      compareSourceText.value = content;
      compareSourceTitle.textContent = file.name;
      renderComparePane('source');
    } else {
      compareTargetText.value = content;
      compareTargetName = file.name;
      compareTargetTitle.textContent = compareTargetName;
      renderComparePane('target');
    }
    event.target.value = '';
  } catch (err) {
    showAlert(`Failed to open compare file: ${err.message}`);
  }
});

function getLargeDocumentPreviewSlice() {
  const content = largeDocumentTextarea.value;
  const cursor = largeDocumentTextarea.selectionStart || 0;
  return getMarkdownSlice(content, cursor);
}

function getMarkdownSlice(content, cursor = 0) {
  const beforeCursor = content.slice(0, cursor);
  const cursorLine = beforeCursor.split('\n').length - 1;
  const lines = content.split('\n');
  const halfWindow = Math.floor(LARGE_DOCUMENT_PREVIEW_CONTEXT_LINES / 2);
  let start = Math.max(0, cursorLine - halfWindow);
  let end = Math.min(lines.length, start + LARGE_DOCUMENT_PREVIEW_CONTEXT_LINES);
  start = Math.max(0, end - LARGE_DOCUMENT_PREVIEW_CONTEXT_LINES);

  for (let i = cursorLine; i >= start; i--) {
    if (/^#{1,6}\s+/.test(lines[i])) {
      start = i;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

function escapeHTML(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderInlineMarkdown(value) {
  return escapeHTML(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function lightweightMarkdownToHtml(markdown) {
  const lines = markdown.split('\n');
  const html = [];
  let inCodeBlock = false;
  let codeLines = [];
  let inList = false;
  let inTable = false;

  function closeList() {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  }

  function closeTable() {
    if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
    }
  }

  function renderTableRow(line, tag) {
    const cells = line.trim().replace(/^\||\|$/g, '').split('|');
    return '<tr>' + cells.map(cell => `<${tag}>${renderInlineMarkdown(cell.trim())}</${tag}>`).join('') + '</tr>';
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeList();
        closeTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      closeTable();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      closeTable();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      closeTable();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
      continue;
    }

    if (/^\s*\|.+\|\s*$/.test(line)) {
      closeList();
      if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) {
        continue;
      }
      if (!inTable) {
        html.push('<table><tbody>');
        inTable = true;
        html.push(renderTableRow(line, 'th'));
      } else {
        html.push(renderTableRow(line, 'td'));
      }
      continue;
    }

    closeList();
    closeTable();

    if (/^---+$/.test(line.trim())) {
      html.push('<hr>');
    } else if (/^\s*>/.test(line)) {
      html.push(`<blockquote>${renderInlineMarkdown(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
    } else {
      html.push(`<p>${renderInlineMarkdown(line)}</p>`);
    }
  }

  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`);
  }
  closeList();
  closeTable();
  return html.join('\n');
}

editor.addCommand("markdown", "pageBreak", function additem() {
  // editor.replaceSelection("\n\n~~-~~ ~~-~~ ~~-~~\n\n");
  // editor.insertText("\n~~-~~ ~~-~~ ~~-~~\n");
  editor.insertText(" \n \n <span data-page-break='break'>=======================</span> \n \n ");
});

editor.insertToolbarItem({ groupIndex: 5, itemIndex: 0 }, {
  name: 'myItem',
  tooltip: 'Page Break',
  command: 'pageBreak',
  text: '',
  className: 'toastui-editor-toolbar-icons page-break-command',
  // style: { backgroundImage: 'none' }
});

function disableSpellCheck() {
  const editorContentElem = document.querySelector('.toastui-editor [contenteditable="true"]');
  if(toggleDisableSpellCheck.checked) {
    console.log("spellcheck disabled!");
    editorContentElem.spellcheck = false;
  } else {
    editorContentElem.spellcheck = true;
  }

}

toggleDisableSpellCheck.addEventListener('change', (e) => {
  disableSpellCheck();
  localStorage.setItem('disableSpellCheck', e.target.checked);
});

const savedDisableSpellCheck = localStorage.getItem('disableSpellCheck') === 'true';
toggleDisableSpellCheck.checked = savedDisableSpellCheck;

// Direction handling
let isRTL = false;
const toggleDirectionBtn = document.getElementById('toggleDirection');
const editorTabModeBtn = document.getElementById('editorTabMode');
const WYSIWYGModeBtn = document.getElementById('WYSIWYGMode');
const toggleAutosave = document.getElementById('autosave-setting');

// File Name
const fileNameInput = document.getElementById('fileName');
let openedFileName = '';

toggleAutosave.addEventListener('change', (e) => {
  if (e.target.checked) {
    showAlert('Autosave enabled.');
    autoSaveFunc();
  } else {
    if(confirm("Are you sure you want to disable autosave? We recommend keeping it enabled so that your work stays safe by saving regularly.")){
      showAlert('Autosave disabled. We recommend to keep autosave enable.');
      changeSaveIconBtnIcon('disable');
    } else {
      e.target.checked = true;
    }
  }
});

fileNameInput.addEventListener('change', (e) => {
  autoSaveOnChangeFunc();
});

// SaveIconBtn.addEventListener('click', (e) => {
//   toggleAutosave.click();
// });

function updateDirection() {
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  // editor.setOptions({ rtl: isRTL });
  editor.setHeight('100%'); // Force refresh layout
  localStorage.setItem('editorDirection', isRTL ? 'rtl' : 'ltr');
}

toggleDirectionBtn.addEventListener('change', () => {
  isRTL = !isRTL;
  updateDirection();
});

directionIconBtn.addEventListener('click', () => {
  toggleDirectionBtn.click();
  console.log(isRTL);
  if (isRTL) {
    directionIconBtn.innerHTML = ltrIcon;
  } else {
    directionIconBtn.innerHTML = rtlIcon;
  }
  
});

if (isRTL) {
  directionIconBtn.innerHTML = ltrIcon;
} else {
  directionIconBtn.innerHTML = rtlIcon;
}

// Initialize Direction from localStorage
const savedDirection = localStorage.getItem('editorDirection');
if (savedDirection) {
  isRTL = savedDirection === 'rtl';
  updateDirection();
  toggleDirectionBtn.checked = isRTL;
}

editorTabModeBtn.addEventListener('change', (e) => {
  // console.log(e.target.checked);
  localStorage.setItem('editorTabMode', e.target.checked);
  editor.changePreviewStyle(e.target.checked ? 'tab' : 'vertical');
});

WYSIWYGModeBtn.addEventListener('change', (e) => {
  // console.log(e.target.checked);
  localStorage.setItem('WYSIWYGMode', e.target.checked);
  editor.changeMode(e.target.checked ? 'wysiwyg' : 'markdown');
});

const savedEditorMode = localStorage.getItem('editorTabMode') === 'true' || isMobile;
editorTabModeBtn.checked = savedEditorMode;

const savedWYSIWYGModeAsDefault = localStorage.getItem('WYSIWYGMode') === 'true';
WYSIWYGModeBtn.checked = savedWYSIWYGModeAsDefault;

// Theme management
const themeToggle = document.getElementById('themeToggle');

function applyTheme(isDark) {
  const theme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('selectedTheme', theme);
  let el = document.getElementsByClassName("toastui-editor-defaultUI")[0];

  if (isDark) {
    el.classList.add("toastui-editor-dark");
  } else {
    el.classList.remove("toastui-editor-dark");
  }
}

themeToggle.addEventListener('change', (e) => {
  applyTheme(e.target.checked);
});

// Initialize from localStorage
const savedTheme = localStorage.getItem('selectedTheme') === 'dark';
themeToggle.checked = savedTheme;
applyTheme(savedTheme);

function saveAs(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

if ('launchQueue' in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;

    const fileHandle = launchParams.files[0];
    const file = await fileHandle.getFile();
    const contents = await file.text();    

    setDocumentMarkdown(contents); // or your editor loading method
    currentFileHandle = fileHandle; // 🔹 Save the handle so you can save it later
    
    localStorage.removeItem('autosave');
    setFileNameValue(file.name);
    lastSavedContent = contents;
  });
}

async function saveFile() {
  try {
    if (!currentFileHandle) {
      await saveAsNewFile();
      return;
    }

    const nameChanged = openedFileName !== fileNameInput.value;

    if (nameChanged) {
      // console.log("File name has changed:", openedFileName, "->", fileNameInput.value);
      const confirmSaveAs = confirm(
        "File name has changed. Do you want to save it as a new file?\n\n" +
        "⚠️ Note: File renaming is not supported directly in the browser. If you want to change the file name, please save it as a new file with your desired name, or rename it manually in your system after saving."
      );
      if (confirmSaveAs) {
        await saveAsNewFile();
        return;
      }
      // Revert filename input to original
      fileNameInput.value = openedFileName;
    }

    const writable = await currentFileHandle.createWritable();
    await writable.write(getDocumentMarkdown());
    await writable.close();
    showAlert('File saved successfully');
    lastSavedContent = getDocumentMarkdown();
    localStorage.removeItem('autosave');
  } catch (err) {
    showAlert(`Save failed: ${err.message}`);
  }
}

async function saveAsNewFile() {
  try {
    const suggestedName = extractSafeFilenameFromContent();
    const handle = await window.showSaveFilePicker({
      types: [{
        description: 'Markdown Files',
        accept: {
          'text/markdown': ['.md'],
          'text/plain': ['.txt'],
        },
      }],
      excludeAcceptAllOption: true,
      suggestedName: suggestedName
    });

    const writable = await handle.createWritable();
    await writable.write(getDocumentMarkdown());
    await writable.close();
    currentFileHandle = handle;


    // Patch: Check if the file name has the proper extension
    const fileName = handle.name || '';
    // console.log(fileName);
    // document.title = "MDify | " + fileName.toUpperCase();
    
    setFileNameValue(fileName);

    if (!fileName.toLowerCase().endsWith('.md') && !fileName.toLowerCase().endsWith('.txt') && !fileName.toLowerCase().endsWith('.text')) {
      showAlert('File saved successfully \nWarning: File extension is missing. The file may not be recognized as Markdown.');
    }
    else {
      showAlert('File saved successfully');
    }
    
    lastSavedContent = getDocumentMarkdown();
    localStorage.removeItem('autosave');
  } catch (err) {
    if (err.name !== 'AbortError') {
      showAlert(`Save failed: ${err.message}`);
    }
  }
}

document.getElementById('openMd').addEventListener('click', async () => {
  if (getDocumentMarkdown().trim() && !confirm('Unsaved changes will be lost. Continue?')) return;

  try {
    // Check if File System Access API is supported
    if (window.showOpenFilePicker) {
      // Show native file picker
      skipAutosaveLoad = true; // prevent replacing with autosave
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Markdown Files',
          accept: {
            'text/markdown': ['.md'],
            'text/plain': ['.txt'],
          }
        }],
        excludeAcceptAllOption: true,
        multiple: false
      });

      const file = await handle.getFile();
      const content = await file.text();
      const loadedInLargeMode = setDocumentMarkdown(content);
      currentFileHandle = handle;
      showAlert(loadedInLargeMode
        ? `Opened: ${file.name} in Large Document Mode`
        : `Opened: ${file.name}`);
      localStorage.removeItem('autosave');
      unselectDraftItem();
      // document.title = "MDify | " + file.name.toUpperCase();

      setFileNameValue(file.name);
      lastSavedContent = content;
    } else {
      // Fallback: Use traditional file input for browsers without File System Access API
      skipAutosaveLoad = true;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.txt';

      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const content = await file.text();
          const loadedInLargeMode = setDocumentMarkdown(content);
          currentFileHandle = null; // Can't save directly to file with traditional input
          showAlert(loadedInLargeMode
            ? `Opened: ${file.name} in Large Document Mode (Use "Save As" to save changes)`
            : `Opened: ${file.name} (Note: Use "Save As" to save changes)`);
          localStorage.removeItem('autosave');
          unselectDraftItem();
          setFileNameValue(file.name);
          lastSavedContent = content;
        } catch (err) {
          showAlert(`Failed to read file: ${err.message}`);
        }
      });

      input.click();
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      showAlert(`Failed to open file: ${err.message}`);
    }
  }
});

let importAndAppend = false;
// Handle file imports
document.getElementById('importMd').addEventListener('click', () => {
  if (getDocumentMarkdown().trim() && !confirm('Unsaved changes will be lost. Continue?')) return;
  importAndAppend = false;
  document.getElementById('fileInput').click();
});

document.getElementById('importAppendMd').addEventListener('click', () => {
  importAndAppend = true;
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const content = await file.text();
    if (importAndAppend) {
      const loadedInLargeMode = setDocumentMarkdown(getDocumentMarkdown() + '\n' + content);
      if (loadedInLargeMode) {
        showAlert(`Imported: ${file.name} in Large Document Mode`);
      }
    } else {
      const loadedInLargeMode = setDocumentMarkdown(content);
      lastSavedContent = content;
      if (loadedInLargeMode) {
        showAlert(`Imported: ${file.name} in Large Document Mode`);
      }
    }

    if (!largeDocumentMode) {
      showAlert(`Imported: ${file.name}`);
    }
    document.getElementById('fileInput').value = '';
  } catch (err) {
    showAlert(`Import failed: ${err.message}`);
  }
});

// New file confirmation
document.getElementById('newMd').addEventListener('click', () => {
  if (getDocumentMarkdown().trim() && !confirm('Unsaved changes will be lost. Continue?')) return;
  document.getElementById('fileInput').value = '';
  currentFileHandle = null;
  setDocumentMarkdown('');
  fileNameInput.value = "Untitled Document " + Date.now();
  localStorage.removeItem('autosave');
  sessionStorage.clear();
  unselectDraftItem();
  // document.title = "MDify | New Document";
  // sessionStorage.setItem('newFile', '1');
  // location.href = location.href;
  // location.reload(); // Force full reset
});


document.getElementById('saveBtn').addEventListener('click', saveFile);
document.getElementById('saveAsBtn').addEventListener('click', saveAsNewFile);

// Export handlers
document.getElementById('exportMd').addEventListener('click', () => {
  const content = getDocumentMarkdown();
  const blob = new Blob([content], {
    type: 'text/markdown'
  });
  saveAs(blob, `document-${Date.now()}.md`);
});

document.getElementById('exportHtml').addEventListener('click', async () => {
  try {
    const content = getDocumentHTML();
    const suggestedName = extractSafeFilenameFromContent('html');

    const html = `
<!DOCTYPE html>
<html lang="en" ${isRTL ? 'dir="rtl"' : ''}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${suggestedName}</title>
    <style>
    @import url("https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@latest/dist/font-face.css");
    body {
        font-family: "Vazirmatn", Tahoma, Open Sans, Helvetica Neue, Helvetica, Arial, sans-serif;
        ${isRTL ? 'direction: rtl;' : ''}
    }
    pre{direction: ltr;}
    /* 
      Rule for the FIRST <del> in a sequence of three.
      This is the one we will apply the special styles to.
    */
    del:has(+ del + del),
    span[data-page-break] {
      /* This makes the element a block, which is required for page-break-after to work reliably. */
      display: block;
      /* The important rule for printing */
      page-break-after: always;
      /* These rules hide it visually without removing it from the layout, so the page break still works. */
      height: 0;
      visibility: hidden;
      margin: 0;
      padding: 0;
      border: none;
    }
    del:has(+ del + del) + del,
    del:has(+ del + del) + del + del {
      display: none;
    }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;

    const handle = await window.showSaveFilePicker({
      types: [{
        description: 'HTML Files',
        accept: {'text/html': ['.html']},
      }],
      excludeAcceptAllOption: true,
      suggestedName: suggestedName
    });

    const writable = await handle.createWritable();
    await writable.write(html);
    await writable.close();
    showAlert('HTML exported successfully');
  } catch (err) {
    if (err.name !== 'AbortError') {
      showAlert(`HTML export failed: ${err.message}`);
    }
  }
});

document.getElementById('exportStyledHtml').addEventListener('click', async () => {
  try {
    const content = getDocumentHTML();
    const suggestedName = extractSafeFilenameFromContent('html');
    const prismCSS = await loadFile("./libs/prism.min.css");
    const tuiEditorViewer = await loadFile("./libs/toastui-editor-viewer-export.min.css");

    const rtlStyles = 
    `
.task-list-item {
    margin-right: 0;
    padding-right: 0;
    margin-right: -24px;
    padding-right: 24px;
}
.task-list-item:before {
left: auto;
right: 0;
}
[dir="rtl"] blockquote {
    border-left: 0;
    border-right: 4px solid #e5e5e5;
}
[dir="rtl"] dir,
[dir="rtl"] menu,
[dir="rtl"] ol,
[dir="rtl"] ul {
    padding-left: 0;
    padding-right: 24px;
}

[dir="rtl"] ul>li:before,
[dir="rtl"] ol>li:before {
    direction: ltr;
    margin-right: -17px;
}
    `;
    
    const html = `
<!DOCTYPE html>
<html lang="en" ${isRTL ? 'dir="rtl"' : ''}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${suggestedName}</title>
    <style>
    @import url("https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@latest/dist/font-face.css");
    body {
        font-family: "Vazirmatn", Tahoma, Open Sans, Helvetica Neue, Helvetica, Arial, sans-serif;
        ${isRTL ? 'direction: rtl;' : ''}
    }
    /* 
      Rule for the FIRST <del> in a sequence of three.
      This is the one we will apply the special styles to.
    */
    del:has(+ del + del),
    span[data-page-break] {
      /* This makes the element a block, which is required for page-break-after to work reliably. */
      display: block;
      /* The important rule for printing */
      page-break-after: always;
      /* These rules hide it visually without removing it from the layout, so the page break still works. */
      height: 0;
      visibility: hidden;
      margin: 0;
      padding: 0;
      border: none;
    }
    /* 
      Rule for the SECOND and THIRD <del> tags in the sequence.
      We simply hide them completely.
    */
    del:has(+ del + del) + del,
    del:has(+ del + del) + del + del {
      display: none;
    }

    ${prismCSS}

    ${tuiEditorViewer}

    ${isRTL ? rtlStyles : ''}
    pre{direction: ltr;}
    </style>
</head>
<body>
    ${content}
</body>
</html>`;

    const handle = await window.showSaveFilePicker({
      types: [{
        description: 'HTML Files',
        accept: {'text/html': ['.html']},
      }],
      excludeAcceptAllOption: true,
      suggestedName: suggestedName
    });

    const writable = await handle.createWritable();
    await writable.write(html);
    await writable.close();
    showAlert('HTML exported successfully');
  } catch (err) {
    if (err.name !== 'AbortError') {
      showAlert(`HTML export failed: ${err.message}`);
    }
  }
});

async function autoSaveFunc() {
  if (!toggleAutosave.checked) {
    changeSaveIconBtnIcon('disable');
    return;
  }
  try {
    changeSaveIconBtnIcon('loading');
    const content = getDocumentMarkdown();
    if (content === lastSavedContent) {
      changeSaveIconBtnIcon('saved');
      return;
    }
    
    // If we have a file handle, save to file
    if (currentFileHandle) {
      const writable = await currentFileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } else {
      if (content.trim() != "") {
        // Always update the draft collection
        const name = fileNameInput.value || "Untitled Document" + Date.now();
        if (!currentDraftId) {
          // Create new draft if none exists
          currentDraftId = `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        addOrUpdateDraft(currentDraftId, name, content);
        autosaveStorageWarningShown = false;
      }
    }
    
    lastSavedContent = getDocumentMarkdown();
    setTimeout(() => {
      changeSaveIconBtnIcon('saved');
    }, 1000);
  } catch (err) {
    const errorMessage = err && err.message ? err.message : '';
    if (isQuotaExceededError(err) || errorMessage.includes('too large for browser autosave')) {
      if (!autosaveStorageWarningShown) {
        showAlert(errorMessage.includes('too large for browser autosave')
          ? errorMessage
          : 'Document is too large for browser autosave. Please save it as a file instead.');
        autosaveStorageWarningShown = true;
      }
    } else {
      showAlert(`Autosave failed: ${errorMessage || 'Unknown error'}`);
    }
    changeSaveIconBtnIcon('disable');
  }
}

// Autosave functionality
setInterval(async () => {
  autoSaveFunc();
}, 10000);


// Handle PWA file launches
window.addEventListener('DOMContentLoaded', () => {
  if ('launchQueue' in window) {
    launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams.files.length) return;

      try {
        skipAutosaveLoad = true; // prevent replacing with autosave
        const fileHandle = launchParams.files[0];
        const file = await fileHandle.getFile();
        const content = await file.text();
        const loadedInLargeMode = setDocumentMarkdown(content);
        currentFileHandle = fileHandle;
        setFileNameValue(file.name);
        lastSavedContent = content;
        showAlert(loadedInLargeMode
          ? `Opened file: ${file.name} in Large Document Mode`
          : `Opened file: ${file.name}`);
      } catch (error) {
        showAlert(`Error opening file: ${error.message}`);
      }
    });
  }
});

// Load autosaved content
const autosave = localStorage.getItem('autosave');
// console.log(autosave);

// On Page Load
// 1. On Load: Check for emergency recovery data
window.addEventListener('DOMContentLoaded', () => {
  const emergencySave = localStorage.getItem('emergency_save');
  if (emergencySave) {
    if (confirm("We found unsaved work from your last session. Restore it?")) {
      setDocumentMarkdown(emergencySave);
      // lastSavedContent = emergencySave; // Or prompt them to save it manually
    }
    localStorage.removeItem('emergency_save');
  } else {
    if (!skipAutosaveLoad) {
      // if (!toggleAutosave.checked) {
      //   // toggleAutosave.checked = false;
      //   editor.setMarkdown('');
      //   changeSaveIconBtnIcon('disable');
      // }
      fileNameInput.value = "Untitled Document " + Date.now();
    }
  }
});

// Undo button action
document.getElementById('editor-undo').addEventListener('click', () => {
  editor.exec('undo');
});

// Redo button action
document.getElementById('editor-redo').addEventListener('click', () => {
  editor.exec('redo');
});

async function loadFile(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return await response.text();
}

function showAlert(text) {
  clearTimeout(popupTimeout);
  clearTimeout(alertTimeout);

  popupAlert(text);
  textAlert(text);
}

function textAlert(text) {
  const alert = document.getElementById("alert");

  alert.innerText = text;
  alert.style.opacity = "1";

  // Hide slowly after 3 seconds
  alertTimeout = setTimeout(() => {
    alert.style.opacity = "0";
    // Clear text after fade-out completes (500ms)
    setTimeout(() => {
      alert.innerText = "";
    }, 500);
  }, 3000);
}

function popupAlert(message) {
  const popup = document.getElementById('aiStatus');

  popup.innerText = message;

  // popup.style = "visibility: visible;opacity: 1";
  popup.style.visibility = "visible";
  popup.style.opacity = "1";
  popupTimeout = setTimeout(function () {
    // popup.style = "visibility: hidden;opacity: 0";
    popup.style.visibility = "hidden";
    popup.style.opacity = "0";
    // Clear text after fade-out completes (500ms)
    setTimeout(() => {
      popup.innerText = "";
    }, 500);
  }, 4000);
}

function extractSafeFilenameFromContent(type = 'md') {
  const maxBytes = 80; // limit for UTF-8 bytes (safe on Android FS)
  const maxWords = 12;
  const now = Date.now();
  let clean;
  let fileNameInputValue = fileNameInput.value.trim();

  // Remove Markdown and filesystem-unsafe characters
  const sanitize = str => {
    return str
      .replace(/^[-*+]\s+/, '')          // Remove list markers
      .replace(/^#+\s*/, '')             // Remove Markdown headers
      .replace(/[*_`>#]+/g, '')           // Remove Markdown symbols
      .replace(/[<>:"/\\|?*]+/g, '-')     // Replace illegal filename chars
      .replace(/[\u200B-\u200F\u202A-\u202E]/g, '') // Remove ZWSP & directional marks
      .replace(/\s+/g, ' ')               // Normalize spaces
      .trim();
  };

  // Pick source text: filename input or first line of content
  if (fileNameInputValue && fileNameInputValue !== "Untitled Document") {
    clean = sanitize(fileNameInputValue);
  } else {
    const content = getDocumentMarkdown().trim();
    const firstLine = content.split('\n').find(line => line.trim().length > 0) || 'Untitled Document';
    clean = sanitize(firstLine);
  }

  // Normalize Unicode (avoids weird multi-byte combining sequences)
  clean = clean.normalize('NFC');

  // Limit words
  const words = clean.split(/\s+/).slice(0, maxWords);
  clean = words.join(' ');

  // Limit byte length (UTF-8)
  while (new TextEncoder().encode(clean).length > maxBytes) {
    clean = clean.slice(0, -1).trim();
  }

  if (!clean || clean == 'Untitled-Document' || clean == 'Untitled Document') clean = 'Untitled Document-' + now;

  return `${clean}.${type}`;
}


function setFileNameValue(fileName) {
  function cleanFileName(name) {
    return name.replace('--', '-').replace(/([\d\w\D\W])-([\d\w\D\W])/g, '$1 $2').replace(".md", "").replace(".txt", "").replace(".text", "").trim();
  }
  // console.log("---> " + fileName);
  
  fileName = cleanFileName(fileName);
  openedFileName = fileName;
  fileNameInput.value = fileName.trim();
}

if (isMobile) {
  // const footerButtons = document.getElementById('footerButtons');
  // function updateToolbarPosition() {
  //   if (window.visualViewport) {
  //     // The distance from the bottom of the layout viewport to the bottom of the visual viewport
  //     const bottomOffset = window.innerHeight - (window.visualViewport.height + window.visualViewport.offsetTop);

  //     footerButtons.style.bottom = `${bottomOffset}px`;
  //   } else {
  //     footerButtons.style.bottom = '0px';
  //   }
  // }

  // // Listen for changes in the visual viewport
  // if (window.visualViewport) {
  //   window.visualViewport.addEventListener('resize', updateToolbarPosition);
  //   window.visualViewport.addEventListener('scroll', updateToolbarPosition);
  // }

  // window.addEventListener('resize', updateToolbarPosition);

  // updateToolbarPosition();

  function resizeToFit() {
    if (window.visualViewport) {
      const vh = window.visualViewport.height + 'px';
      document.body.style.height = vh;
      document.documentElement.style.height = vh;
      window.scrollTo(0, 0);
    }
  }

  // Check if the visualViewport API is supported
  if (window.visualViewport) {
    resizeToFit();
    window.visualViewport.addEventListener('resize', resizeToFit);
  }

}

document.addEventListener('DOMContentLoaded', function () {
  setTimeout(() => {
    disableSpellCheck();
  }, 2000);

  if (isMobile) {
    const dropdownContainer = document.querySelector('.dropdown');
    const toggleMenuButton = document.querySelector('.dropbtn');
    const contentToToggle = document.querySelector('.dropdown-content');

    toggleMenuButton.addEventListener('click', function () {
      if (contentToToggle.style.display === 'none' || contentToToggle.style.display === '') {
        contentToToggle.style.display = 'block'; // Or 'flex', 'grid', etc.
        dropdownContainer.classList.add("open");
      } else {
        contentToToggle.style.display = 'none';
        dropdownContainer.classList.remove("open");
      }
    });

    window.addEventListener('click', (e) => {
      // console.log(e.target);
      
      if (e.target === dropdownContainer) {
        contentToToggle.style.display = 'none';
        dropdownContainer.classList.remove("open");
      }
    });
  }
});

const aboutMDifyDialog = document.getElementById('aboutDialog');
const closeAboutDialog = document.getElementById('closeAboutDialog');
const aboutMDifyDialogOverlay = document.querySelector('.dialog-overlay');

document.getElementById('aboutMDify').addEventListener('click', () => {
  aboutMDifyDialog.style.display = 'block';
});

closeAboutDialog.addEventListener('click', () => {
  aboutMDifyDialog.style.display = 'none';
});

aboutMDifyDialogOverlay.addEventListener('click', () => {
  aboutMDifyDialog.style.display = 'none';
});


///////////////////////////////////////////////////////
/////////////////////////////////////////////////////// Start of AI Codes
///////////////////////////////////////////////////////

// AI Assistant Modal
const aiModal = document.getElementById('aiAssistantModal');
const aiBtn = document.getElementById('aiAssistantBtn');
const closeModal = document.querySelector('.close');
const aiStatus = document.getElementById('aiStatus');
const aiError = document.getElementById('aiError');
const spinner = document.querySelector('.spinner');

// Show/hide modal
aiBtn.addEventListener('click', () => {
  aiModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => {
  aiModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === aiModal) {
    aiModal.style.display = 'none';
  }
});

// Role selection and custom instructions
const customInstructionsToggle = document.getElementById('customInstructionsToggle');
const customInstructionsSection = document.getElementById('customInstructionsSection');
const aiRole = document.getElementById('aiRole');
const customRole = document.getElementById('customRole');
const customPrompt = document.getElementById('customPrompt');
const customTemp = document.getElementById('customTemp');
const customTopP = document.getElementById('customTopP');

customInstructionsToggle.addEventListener('change', () => {
  customInstructionsSection.style.display = customInstructionsToggle.checked ? 'block' : 'none';
});

// Load saved roles
// Predefined roles for first-time users
const preDefinedRoles = [
  {
    id: 1,
    role: "DocWriter",
    prompt:
`You are an expert technical documentation writer with extensive experience in creating clear, comprehensive, and user-friendly documentation.
**Core Philosophy:** Your primary goal is to make complex information accessible and understandable. You value clarity, accuracy, and proper structure in all documentation.
**Capabilities:** You can write technical documentation, API references, user guides, tutorials, README files, and other technical content. You excel at organizing information logically and using appropriate formatting.
**Interaction Style:** Clear, professional, and detail-oriented. You focus on accuracy and readability.
`,
    temperature: 0.3,
    top_p: 0.7
  },
];

// Load user roles from localStorage
let userRoles = [];
const savedUserRoles = localStorage.getItem('aiRoles');
if (savedUserRoles) {
  userRoles = JSON.parse(savedUserRoles);
}

// Merge predefined roles and user roles (predefined come first)
let roles = [...preDefinedRoles, ...userRoles];

// Ensure user roles have IDs starting from 100
let maxUserId = 99;
userRoles.forEach(role => {
  if (role.id > maxUserId) maxUserId = role.id;
});

// Initialize role dropdown
aiRole.innerHTML = '';
roles.forEach(role => {
  const option = document.createElement('option');
  option.value = role.id;
  option.textContent = role.role;
  aiRole.appendChild(option);
});

// aiRole.innerHTML = '';
// roles.forEach(role => {
//   const option = document.createElement('option');
//   option.value = role.id;
//   option.textContent = role.role;
//   aiRole.appendChild(option);
// });

// Save custom role
document.getElementById('saveCustomRole').addEventListener('click', () => {
  // Create new role with ID starting from 100
  maxUserId++;
  const newRole = {
    id: maxUserId,
    role: customRole.value,
    prompt: customPrompt.value,
    temperature: parseFloat(customTemp.value),
    top_p: parseFloat(customTopP.value)
  };
  
  // Add to user roles and save to localStorage
  userRoles.push(newRole);
  localStorage.setItem('aiRoles', JSON.stringify(userRoles));
  
  // Update merged roles and rebuild dropdown
  roles = [...preDefinedRoles, ...userRoles];

  const option = document.createElement('option');
  option.value = newRole.id;
  option.textContent = newRole.role;
  aiRole.appendChild(option);
  
  aiRole.value = newRole.id;
  customInstructionsToggle.checked = false;
  customInstructionsSection.style.display = 'none';
});

// Settings panel
const apiEndpoint = document.getElementById('apiEndpoint');
const apiKey = document.getElementById('apiKey');
const aiModel = document.getElementById('aiModel');

// Load settings from localStorage
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('aiSettings') || '{}');
  if (settings.endpoint) apiEndpoint.value = settings.endpoint;
  if (settings.model) aiModel.value = settings.model;
  if (settings.key) apiKey.value = atob(settings.key); // Decode from base64
}

// Save settings to localStorage
function saveSettings() {
  const settings = {
    endpoint: apiEndpoint.value,
    model: aiModel.value,
    key: btoa(apiKey.value) // Encode to base64
  };
  localStorage.setItem('aiSettings', JSON.stringify(settings));
}

// Load models from API
async function loadModels() {
  if (!apiKey.value) {
    aiError.textContent = 'API key required';
    return;
  }

  if (!apiEndpoint.value) {
    aiError.textContent = 'API endpoint required';
    return;
  }

  try {
    spinner.style.display = 'block';
    aiError.textContent = '';

    const response = await fetch(apiEndpoint.value + '/models', {
      headers: {
        'Authorization': `Bearer ${apiKey.value}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;

      try {
        const data = await response.json(); // try to parse error body
        if (data.error) {
          errorMessage += ` - ${data.error.message || data.error}`;
        }
      } catch (e) {
        // if response is not JSON or parsing failed
        errorMessage += " - Unknown error";
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const currentValue = aiModel.value;
    aiModel.innerHTML = '';

    // Add default model first
    const defaultOption = document.createElement('option');
    defaultOption.value = 'kivy-glm-4_7';
    defaultOption.textContent = 'kivy-glm-4_7';
    aiModel.appendChild(defaultOption);

    // Add models from API
    data.data.forEach(model => {
      // Skip if it's the same as default model
      if (model.id === 'kivy-glm-4_7') return;

      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.id;
      aiModel.appendChild(option);
    });

    // Restore previous selection if it exists
    if (currentValue && Array.from(aiModel.options).some(opt => opt.value === currentValue)) {
      aiModel.value = currentValue;
    }
  } catch (err) {
    aiError.textContent = err.message;
  } finally {
    spinner.style.display = 'none';
  }
}

// Event listeners for settings
apiEndpoint.addEventListener('change', saveSettings);
apiKey.addEventListener('change', saveSettings);
aiModel.addEventListener('change', saveSettings);
document.getElementById('loadModelsBtn').addEventListener('click', loadModels);

// Initialize settings
loadSettings();

// Write with AI panel
const writePrompt = document.getElementById('writePrompt');
const generateOutlineBtn = document.getElementById('generateOutlineBtn');
const outlinePreview = document.getElementById('outlinePreview');
const outlineActions = document.getElementById('outlineActions');
const confirmOutlineBtn = document.getElementById('confirmOutlineBtn');
const regenerateOutlineBtn = document.getElementById('regenerateOutlineBtn');
const cancelOutlineBtn = document.getElementById('cancelOutlineBtn');

let currentOutline = '';

generateOutlineBtn.addEventListener('click', async () => {
  if (!writePrompt.value) {
    aiError.textContent = 'Please enter a prompt!';
    return;
  }
  
  try {
    spinner.style.display = 'block';
    aiError.textContent = '';
    
    const [outline, usage] = await generateContent(
      `Based on the following user request, generate a brief summary and a list of headlines or table of contents. Don't write the full article yet.\n\nRequest: ${writePrompt.value}`
    );
    
    outlinePreview.innerHTML = outline.replace(/\n/g, '<br>');
    outlineActions.style.display = 'block';
    currentOutline = outline;
    popupAlert(`Outline generated successfully! Total Token Usage: ${usage}`);
  } catch (err) {
    aiError.textContent = err.message;
  } finally {
    spinner.style.display = 'none';
  }
});

confirmOutlineBtn.addEventListener('click', async () => {
  try {
    const writeMode = document.querySelector('input[name="writeMode"]:checked').value;
    if (!confirm('You are about to replace the current document. Do you want to continue?')) {
      return;
    }
    spinner.style.display = 'block';
    aiError.textContent = '';
    aiStatus.textContent = '';
    
    const additionalNotes = document.getElementById('additionalNotes').value;
    const prompt = additionalNotes ?
        `Please write the full content based on the following structure and topic, and consider these additional notes:\n\nTopic: ${writePrompt.value}\nOutline: ${currentOutline}\nAdditional Notes: ${additionalNotes}` :
        `Please write the full content based on the following structure and topic:\n\nTopic: ${writePrompt.value}\nOutline: ${currentOutline}`;
    
    const [fullContent, usage] = await generateContent(prompt);
    
    if (writeMode === 'replace') {
      // if (confirm('Replace current document?')) {}
      setDocumentMarkdown(fullContent);
    } else {
      const currentContent = getDocumentMarkdown();
      setDocumentMarkdown(currentContent + '\n\n' + fullContent);
    }

    popupAlert(`Full content generated successfully! Total Token Usage: ${usage}`);
    aiModal.style.display = 'none';
  } catch (err) {
    aiError.textContent = err.message;
  } finally {
    spinner.style.display = 'none';
  }
});

regenerateOutlineBtn.addEventListener('click', () => {
  generateOutlineBtn.click();
});

cancelOutlineBtn.addEventListener('click', () => {
  outlinePreview.innerHTML = '';
  outlineActions.style.display = 'none';
});

// Modify/Extend panel
const modifyPrompt = document.getElementById('modifyPrompt');
const modifyBtn = document.getElementById('modifyBtn');

modifyBtn.addEventListener('click', async () => {
  const selectedText = editor.getSelectedText();
  if (!selectedText) {
    aiError.textContent = 'Please select some text!';
    return;
  }
  
  if (!modifyPrompt.value) {
    aiError.textContent = 'Please enter instructions';
    return;
  }
  
  try {
    spinner.style.display = 'block';
    aiError.textContent = '';
    
    const mode = document.querySelector('input[name="modifyMode"]:checked').value;
    const instruction = mode === 'modify' ?
      `Modify the following text: ${selectedText}\n\nInstructions: ${modifyPrompt.value}` :
      `Write new content based on: ${selectedText}\n\nInstructions: ${modifyPrompt.value}`;
    
    const [result, usage] = await generateContent(instruction);
    
    if (mode === 'modify') {
      editor.replaceSelection(result);
    } else {
      const currentContent = getDocumentMarkdown();
      setDocumentMarkdown(currentContent + '\n\n' + result);
    }

    popupAlert(`Content modified successfully! Total Token Usage: ${usage}`);
  } catch (err) {
    aiError.textContent = err.message;
  } finally {
    spinner.style.display = 'none';
  }
});

// Generate content with AI
async function generateContent(prompt) {
  const settings = JSON.parse(localStorage.getItem('aiSettings') || '{}');
  const selectedRole = roles.find(r => r.id == aiRole.value);

  if (!settings.endpoint) {
    throw new Error('Please configure API endpoint in AI Settings');
  }

  if (!settings.key) {
    throw new Error('Please configure API key in AI Settings');
  }

  if (!aiModel.value) {
    throw new Error('Please select a model in AI Settings');
  }

  const requestBody = {
    model: aiModel.value,
    messages: [
      {role: 'system', content: selectedRole?.prompt || 'You are a helpful assistant'},
      {role: 'user', content: prompt}
    ],
    temperature: selectedRole?.temperature || 0.7,
    top_p: selectedRole?.top_p || 0.8
  };

  const response = await fetch(settings.endpoint + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${atob(settings.key)}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;

    try {
      const data = await response.json(); // try to parse error body
      if (data.error) {
        errorMessage += ` - ${data.error.message || data.error}`;
      }
    } catch (e) {
      // if response is not JSON or parsing failed
      errorMessage += " - Unknown error";
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return [data.choices[0].message.content, data.usage?.total_tokens || 0];
}

///////////////////////////////////////////////////////
/////////////////////////////////////////////////////// End of AI Codes
///////////////////////////////////////////////////////

// Document Outline Sidebar
const outlineSidebar = document.getElementById('outlineSidebar');
const outlineSidebarOverlay = document.getElementById('outlineSidebarOverlay');
const openOutlineSidebarBtn = document.getElementById('openOutlineSidebarBtn');
const closeOutlineSidebar = document.getElementById('closeOutlineSidebar');
const outlineList = document.getElementById('outlineList');

function extractMarkdownHeadings(markdown) {
  const headings = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;

  lines.forEach((line, index) => {
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;

    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (!match) return;

    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      line: index
    });
  });

  return headings;
}

function renderOutlineSidebar() {
  const headings = extractMarkdownHeadings(getDocumentMarkdown());
  outlineList.innerHTML = '';

  if (!headings.length) {
    outlineList.innerHTML = '<div class="outline-empty">No headings found.</div>';
    return;
  }

  headings.forEach((heading, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'outline-item';
    item.style.paddingLeft = `${10 + (heading.level - 1) * 14}px`;
    item.textContent = heading.text;
    item.title = heading.text;
    item.addEventListener('click', () => {
      jumpToHeading(heading, index);
      closeOutline();
    });
    outlineList.appendChild(item);
  });
}

function closeOutline() {
  outlineSidebar.classList.remove('open');
  outlineSidebarOverlay.style.display = 'none';
}

function jumpToHeading(heading, index) {
  if (largeDocumentMode) {
    jumpLargeDocumentTextareaToLine(heading.line);
  } else {
    jumpToastEditorToHeading(heading, index);
  }
}

function jumpLargeDocumentTextareaToLine(lineNumber) {
  const lines = largeDocumentTextarea.value.split('\n');
  let offset = 0;
  for (let i = 0; i < lineNumber; i++) {
    offset += lines[i].length + 1;
  }

  largeDocumentTextarea.focus();
  largeDocumentTextarea.setSelectionRange(offset, offset);

  const lineHeight = parseFloat(getComputedStyle(largeDocumentTextarea).lineHeight) || 22;
  largeDocumentTextarea.scrollTop = Math.max(0, lineNumber * lineHeight - largeDocumentTextarea.clientHeight * 0.2);
  updateLargeDocumentPreview();
}

function jumpToastEditorToHeading(heading, index) {
  const markdown = getDocumentMarkdown();
  const headings = extractMarkdownHeadings(markdown);
  const target = headings[index];
  if (!target) return;

  editor.focus();
  editor.setSelection([target.line + 1, 1], [target.line + 1, 1]);

  const editorScroll = document.querySelector('.toastui-editor-md-container .toastui-editor-md-editor, .toastui-editor-md-container .toastui-editor-md-preview, .toastui-editor-contents');
  if (editorScroll && 'scrollTop' in editorScroll) {
    const lineHeight = 22;
    editorScroll.scrollTop = Math.max(0, target.line * lineHeight - editorScroll.clientHeight * 0.2);
  }
}

openOutlineSidebarBtn.addEventListener('click', () => {
  renderOutlineSidebar();
  document.getElementById('autosaveSidebar').classList.remove('open');
  document.getElementById('autosaveSidebarOverlay').style.display = 'none';
  outlineSidebar.classList.add('open');
  outlineSidebarOverlay.style.display = 'block';
});

closeOutlineSidebar.addEventListener('click', closeOutline);
outlineSidebarOverlay.addEventListener('click', closeOutline);

// Autosave Sidebar
const autosaveSidebar = document.getElementById('autosaveSidebar');
const autosaveSidebarOverlay = document.getElementById('autosaveSidebarOverlay');
const openAutosaveSidebarBtn = document.getElementById('openAutosaveSidebarBtn');
const closeAutosaveSidebar = document.getElementById('closeAutosaveSidebar');
const draftsList = document.getElementById('draftsList');
const storageUsage = document.getElementById('storageUsage');
const clearAllDraftsBtn = document.getElementById('clearAllDrafts');
const exportJsonBtn = document.getElementById('exportJson');
const exportZipBtn = document.getElementById('exportZip');

// Toggle sidebar
openAutosaveSidebarBtn.addEventListener('click', () => {
  renderAutosaveSidebar();
  closeOutline();
  autosaveSidebar.classList.add('open');
  autosaveSidebarOverlay.style.display = 'block';
});

closeAutosaveSidebar.addEventListener('click', () => {
  autosaveSidebar.classList.remove('open');
  autosaveSidebarOverlay.style.display = 'none';
});

autosaveSidebarOverlay.addEventListener('click', () => {
  autosaveSidebar.classList.remove('open');
  autosaveSidebarOverlay.style.display = 'none';
});

// Render sidebar content
function renderAutosaveSidebar() {  
  const collection = loadAutosaveCollection();
  draftsList.innerHTML = '';
  
  // Sort by timestamp descending (most recent first)
  collection.sort((a, b) => b.timestamp - a.timestamp);
  
  collection.forEach(draft => {
    const draftItem = document.createElement('div');
    draftItem.className = 'draft-item';
    if (draft.id === currentDraftId) {
      draftItem.classList.add('selected');
    }
    
    const date = new Date(draft.timestamp);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString();
    
    draftItem.innerHTML = `
      <h4>${draft.name}</h4>
      <div class="draft-preview">${draft.preview}</div>
      <div class="draft-meta">
        <span>${(draft.size / 1024).toFixed(2)} KB</span>
        <span>${formattedDate} ${formattedTime}</span>
      </div>
      <div class="draft-actions">
        <button class="delete-draft" data-id="${draft.id}">Delete</button>
      </div>
    `;
    
    draftItem.addEventListener('click', (e) => {
      if (!e.target.classList.contains('delete-draft')) {
        // Load draft into editor
        if (hasUnsavedChanges() && !confirm('Unsaved changes will be lost. Continue?')) return;
        
        currentFileHandle = null;
        setDocumentMarkdown(draft.content);
        // fileNameInput.value = draft.name;
        setFileNameValue(draft.name);
        currentDraftId = draft.id;
        autosaveSidebar.classList.remove('open');
        autosaveSidebarOverlay.style.display = 'none';
      }
    });
    
    draftsList.appendChild(draftItem);
  });
  
  // Add delete event listeners
  document.querySelectorAll('.delete-draft').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this draft?')) {
        deleteDraft(btn.dataset.id);
        renderAutosaveSidebar();
        updateStorageUsage();
      }
    });
  });
  
  updateStorageUsage();
}

function updateStorageUsage() {
  const { used, total } = getLocalStorageSize();
  storageUsage.textContent = `Used: ${used} KB / ${total} KB`;
  
  if ( used >= 4700 ) {
    alert("Caution: Your localStorage is nearly maxed out—try moving your content into files and clearing out drafts to ensure you have enough space.")
  }
}

// Clear all drafts
clearAllDraftsBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all drafts?')) {
    clearAllDrafts();
    renderAutosaveSidebar();
  }
});

// Export as JSON
exportJsonBtn.addEventListener('click', () => {
  const collection = loadAutosaveCollection();
  const blob = new Blob([JSON.stringify(collection)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `autosaveCollection-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Import from JSON
const importJsonBtn = document.getElementById('importJson');
importJsonBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
      input.remove(); // clean up if no file selected
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedCollection = JSON.parse(event.target.result);
          if (!Array.isArray(importedCollection)) {
            throw new Error('Invalid JSON format: expected an array of drafts');
          }

          const existingCollection = loadAutosaveCollection();
          const mergedCollection = [...existingCollection];

          importedCollection.forEach(importedDraft => {
            // Check if draft with same ID already exists
            const existingIndex = mergedCollection.findIndex(d => d.id === importedDraft.id);

            if (existingIndex !== -1) {
              // Regenerate ID to avoid collision
              importedDraft.id = `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            }
            mergedCollection.push(importedDraft);
          });

          saveAutosaveCollection(mergedCollection);
          renderAutosaveSidebar();
          showAlert(`Imported ${importedCollection.length} draft(s) successfully`);
        } catch (err) {
          showAlert(`Error parsing JSON: ${err.message}`);
        } finally {
          input.remove(); // clean up after reading
        }
      };
      reader.readAsText(file);
    } catch (err) {
      showAlert(`Import failed: ${err.message}`);
      input.remove(); // also clean up if file read fails
    }
  });

  input.click();
});

// Export as ZIP (using JSZip)
exportZipBtn.addEventListener('click', async () => {
  try {
    const JSZip = window.JSZip;
    if (!JSZip) {
      throw new Error('JSZip library not loaded');
    }

    // Remove Markdown and filesystem-unsafe characters
    const sanitize = str => {
      return str
        .replace(/^[-*+]\s+/, '')          // Remove list markers
        .replace(/^#+\s*/, '')             // Remove Markdown headers
        .replace(/[*_`>#]+/g, '')           // Remove Markdown symbols
        .replace(/[<>:"/\\|?*]+/g, '-')     // Replace illegal filename chars
        .replace(/[\u200B-\u200F\u202A-\u202E]/g, '') // Remove ZWSP & directional marks
        .replace(/\s+/g, ' ')               // Normalize spaces
        .trim();
    };
    
    const collection = loadAutosaveCollection();
    const zip = new JSZip();
    
    collection.forEach(draft => {
      zip.file(`${sanitize(draft.name)}.md`, draft.content);
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `autosaveCollection-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showAlert(`Export failed: ${err.message}`);
  }
});

// Initialize sidebar
document.addEventListener('DOMContentLoaded', () => {
  renderAutosaveSidebar();
});

function unselectDraftItem() {
  currentDraftId = null;
}

function hasUnsavedChanges() {
  return getDocumentMarkdown().trim() !== lastSavedContent.trim();
}

const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
let confirmationActive = false;

if (isMobile) {
  if (isStandalone) {
    // 5. For PWAs and Mobile: The "Last Gasp" Silent Save
    function finalSaveAttempt() {
      if (toggleAutosave.checked == false && hasUnsavedChanges()) {
        localStorage.setItem("emergency_save", getDocumentMarkdown());
      }
    }
    window.addEventListener("pagehide", finalSaveAttempt);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        finalSaveAttempt();
      }
    });
  } else {
    // Mobile browser: rely on beforeunload native confirmation (no history trick)
    window.addEventListener("beforeunload", (event) => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = ""; // triggers native confirm
    });
  }
} else {
  // Desktop: standard beforeunload confirmation
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

// Attaches the keyboard shortcut listener for saving (Ctrl+S or Cmd+S).
function setupSaveShortcut() {
  function handleSaveShortcut(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      // Prevent the default browser "Save As..." dialog.
      e.preventDefault();
      e.stopImmediatePropagation();
      // e.stopPropagation();
      console.log("Save shortcut triggered. Calling saveFile().");
      saveFile(); // Assuming saveFile() is defined elsewhere
      return false;
    }
  }

  // Add the listener to the document.
  document.addEventListener('keydown', handleSaveShortcut, { capture: true });
  console.log("Save shortcut listener is now active.");
}

// This is the key part to prevent the race condition.
// It checks if the DOM is already loaded. If so, it runs the setup immediately.
// If not, it waits for the DOMContentLoaded event.
if (document.readyState === 'loading') {
  // The document is still loading, so we wait for the event.
  document.addEventListener('DOMContentLoaded', setupSaveShortcut);
} else {
  // The 'DOMContentLoaded' event has already fired.
  // We can directly call the setup function.
  setupSaveShortcut();
}
