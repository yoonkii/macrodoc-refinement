// ---------------------------------------------------------------------------
// Content script — injects the floating "Refine" widget on text selection
// and handles message-based communication with the background service worker.
// ---------------------------------------------------------------------------

const WIDGET_ID = 'mdr-refine-widget';
const MIN_SELECTION_LENGTH = 4;
const WIDGET_OFFSET_Y = 40;

let widgetHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let widgetButton: HTMLButtonElement | null = null;
let currentSelectedText = '';
let isRefining = false;
let inlineWidgetEnabled = true;

// Load the inline widget setting from storage on init
chrome.storage.local.get('extensionSettings').then((data) => {
  const settings = data['extensionSettings'] as { inlineWidgetEnabled?: boolean } | undefined;
  if (settings && typeof settings.inlineWidgetEnabled === 'boolean') {
    inlineWidgetEnabled = settings.inlineWidgetEnabled;
  }
});

// Listen for setting changes in real time
chrome.storage.onChanged.addListener((changes) => {
  if (changes['extensionSettings']?.newValue) {
    const newSettings = changes['extensionSettings'].newValue as { inlineWidgetEnabled?: boolean };
    if (typeof newSettings.inlineWidgetEnabled === 'boolean') {
      inlineWidgetEnabled = newSettings.inlineWidgetEnabled;
      if (!inlineWidgetEnabled) {
        hideWidget();
      }
    }
  }
});

// ── Widget creation (Shadow DOM for style isolation) ───────────────────────

function ensureWidget(): { host: HTMLElement; button: HTMLButtonElement } {
  if (widgetHost && shadowRoot && widgetButton && document.body.contains(widgetHost)) {
    return { host: widgetHost, button: widgetButton };
  }

  // Clean up stale references if the host was detached from the DOM
  if (widgetHost && !document.body.contains(widgetHost)) {
    widgetHost = null;
    shadowRoot = null;
    widgetButton = null;
  }

  widgetHost = document.createElement('div');
  widgetHost.id = WIDGET_ID;
  widgetHost.style.cssText = 'position:fixed;z-index:2147483647;display:none;';

  shadowRoot = widgetHost.attachShadow({ mode: 'closed' });
  shadowRoot.innerHTML = `
    <style>
      :host { all: initial; }
      .mdr-btn {
        padding: 6px 14px;
        border-radius: 999px;
        background: #E8A838;
        color: #1A1816;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.15s ease;
        white-space: nowrap;
        line-height: 1;
      }
      .mdr-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      .mdr-btn.loading {
        opacity: 0.7;
        pointer-events: none;
      }
      .mdr-spinner {
        display: none;
        width: 12px;
        height: 12px;
        border: 2px solid #1A1816;
        border-top-color: transparent;
        border-radius: 50%;
        animation: mdr-spin 0.6s linear infinite;
      }
      .mdr-btn.loading .mdr-spinner { display: inline-block; }
      .mdr-btn.loading .mdr-icon { display: none; }
      @keyframes mdr-spin {
        to { transform: rotate(360deg); }
      }
    </style>
    <button class="mdr-btn">
      <span class="mdr-icon">&#10024;</span>
      <span class="mdr-spinner"></span>
      Refine
    </button>
  `;

  widgetButton = shadowRoot.querySelector('.mdr-btn') as HTMLButtonElement;
  widgetButton.addEventListener('click', handleRefineClick);

  document.body.appendChild(widgetHost);
  return { host: widgetHost, button: widgetButton };
}

// ── Show / hide widget ────────────────────────────────────────────────────

function showWidget(x: number, y: number, text: string): void {
  if (isRefining || !inlineWidgetEnabled) return;

  const { host } = ensureWidget();
  currentSelectedText = text;

  // Clamp position to viewport
  const viewportWidth = window.innerWidth;
  const clampedX = Math.min(x, viewportWidth - 120);
  const clampedY = Math.max(y - WIDGET_OFFSET_Y, 8);

  host.style.left = `${clampedX}px`;
  host.style.top = `${clampedY}px`;
  host.style.display = 'block';
}

function hideWidget(): void {
  if (isRefining) return;
  if (widgetHost) {
    widgetHost.style.display = 'none';
  }
  currentSelectedText = '';
}

// ── Refine click handler ──────────────────────────────────────────────────

function handleRefineClick(): void {
  if (!currentSelectedText || isRefining) return;

  isRefining = true;
  widgetButton?.classList.add('loading');

  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: 'refine-stream' });
  } catch {
    // Extension context invalidated (e.g., extension reloaded)
    finishRefining();
    return;
  }

  let refinedText = '';

  port.onDisconnect.addListener(() => {
    // Service worker disconnected unexpectedly (e.g., worker restarted)
    if (isRefining) {
      if (refinedText) {
        replaceSelectedText(refinedText);
      }
      finishRefining();
    }
  });

  port.onMessage.addListener((msg: { type: string; text?: string; error?: string }) => {
    if (msg.type === 'CHUNK' && msg.text) {
      refinedText += msg.text;
    } else if (msg.type === 'DONE') {
      replaceSelectedText(refinedText);
      finishRefining();
      port.disconnect();
    } else if (msg.type === 'ERROR') {
      finishRefining();
      port.disconnect();
    }
  });

  port.postMessage({ text: currentSelectedText });
}

function finishRefining(): void {
  isRefining = false;
  widgetButton?.classList.remove('loading');
  hideWidget();
}

// ── Replace selected text in the active element ───────────────────────────

function replaceSelectedText(newText: string): void {
  const activeElement = document.activeElement;

  // Handle textarea / input elements
  if (
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLInputElement
  ) {
    const start = activeElement.selectionStart ?? 0;
    const end = activeElement.selectionEnd ?? 0;
    const currentValue = activeElement.value;

    activeElement.value =
      currentValue.slice(0, start) + newText + currentValue.slice(end);

    // Restore cursor position after replacement
    const newCursorPos = start + newText.length;
    activeElement.setSelectionRange(newCursorPos, newCursorPos);

    // Dispatch input event so frameworks detect the change
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  // Handle contentEditable elements
  if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));

    // Collapse cursor to end of inserted text
    selection.collapseToEnd();

    // Dispatch input event
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  // Fallback: copy refined text to clipboard
  navigator.clipboard.writeText(newText).catch(() => {
    // Silent fallback — clipboard write may be blocked
  });
}

// ── Selection listener ────────────────────────────────────────────────────

document.addEventListener('mouseup', (event: MouseEvent) => {
  // Small delay to let the selection finalize
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length >= MIN_SELECTION_LENGTH) {
      showWidget(event.clientX, event.clientY, text);
    } else {
      hideWidget();
    }
  }, 10);
});

// Hide widget when clicking elsewhere
document.addEventListener('mousedown', (event: MouseEvent) => {
  if (widgetHost && !widgetHost.contains(event.target as Node)) {
    hideWidget();
  }
});

// ── MDR website profile sync ─────────────────────────────────────────────
// When running on the MDR website, sync style profiles between localStorage
// (web app / Zustand persist) and chrome.storage.local (extension).

const MDR_LOCALHOST_PORT = '3000';
const ZUSTAND_PERSIST_KEY = 'mdr-style-profiles';

function isMdrDomain(): boolean {
  const { hostname, port } = window.location;
  if (hostname === 'macrodocrefinement.com' || hostname.endsWith('.macrodocrefinement.com')) {
    return true;
  }
  if (hostname === 'localhost' && port === MDR_LOCALHOST_PORT) {
    return true;
  }
  return false;
}

/**
 * Read style profiles from the web app's Zustand persist localStorage.
 * Zustand persist format: { state: { profiles: StyleProfile[] }, version: number }
 */
function readWebProfiles(): unknown[] | null {
  try {
    const raw = localStorage.getItem(ZUSTAND_PERSIST_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    // Zustand persist envelope: { state: { profiles: [...] }, version: N }
    const profiles = parsed?.state?.profiles;
    if (Array.isArray(profiles)) {
      return profiles;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write extension profiles into the web app's Zustand persist localStorage.
 * Preserves existing profiles and merges in new ones from the extension.
 */
function writeWebProfiles(extensionProfiles: unknown[]): void {
  try {
    const raw = localStorage.getItem(ZUSTAND_PERSIST_KEY);
    let existing: { state: { profiles: unknown[] }; version: number } = {
      state: { profiles: [] },
      version: 0,
    };

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.profiles && Array.isArray(parsed.state.profiles)) {
        existing = parsed;
      }
    }

    // Merge: add extension profiles not already present (by ID)
    const existingIds = new Set(
      existing.state.profiles
        .filter((p): p is { id: string } => typeof (p as { id?: unknown })?.id === 'string')
        .map((p) => p.id),
    );

    let addedCount = 0;
    for (const profile of extensionProfiles) {
      const profileObj = profile as { id?: string };
      if (profileObj.id && !existingIds.has(profileObj.id)) {
        existing.state.profiles.push(profile);
        existingIds.add(profileObj.id);
        addedCount += 1;
      }
    }

    if (addedCount > 0) {
      localStorage.setItem(ZUSTAND_PERSIST_KEY, JSON.stringify(existing));
    }
  } catch {
    // localStorage may be unavailable or quota exceeded
  }
}

function runMdrSync(): void {
  if (!isMdrDomain()) return;

  // Phase 1: Read web profiles and send to extension background
  const webProfiles = readWebProfiles();
  if (webProfiles && webProfiles.length > 0) {
    chrome.runtime.sendMessage(
      { type: 'SYNC_PROFILES_FROM_WEB', profiles: webProfiles },
      (response) => {
        if (chrome.runtime.lastError) return;
        // Phase 2: Write extension-only profiles back to web localStorage
        if (response?.extensionProfiles && Array.isArray(response.extensionProfiles)) {
          writeWebProfiles(response.extensionProfiles);
        }
      },
    );
  } else {
    // No web profiles yet — still send a request so extension profiles
    // can be written to the web app
    chrome.runtime.sendMessage(
      { type: 'SYNC_PROFILES_FROM_WEB', profiles: [] },
      (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.extensionProfiles && Array.isArray(response.extensionProfiles)) {
          writeWebProfiles(response.extensionProfiles);
        }
      },
    );
  }
}

// Run sync on page load for MDR domains
runMdrSync();

// Listen for reverse sync requests (extension pushing profiles to web)
chrome.runtime.onMessage.addListener(
  (message: { type: string; profiles?: unknown[] }, _sender, sendResponse) => {
    if (message.type === 'SYNC_PROFILES_TO_WEB' && isMdrDomain()) {
      if (message.profiles && Array.isArray(message.profiles)) {
        writeWebProfiles(message.profiles);
      }
      sendResponse({ ok: true });
    }
    return false;
  },
);

// ── Cleanup on page unload ───────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  if (widgetHost && document.body.contains(widgetHost)) {
    widgetHost.remove();
  }
  widgetHost = null;
  shadowRoot = null;
  widgetButton = null;
  currentSelectedText = '';
  isRefining = false;
});

// ── Message listener (from background / popup) ────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: { type: string; text?: string; menuId?: string }, _sender, sendResponse) => {
    if (message.type === 'REFINE_SELECTION' && message.text) {
      currentSelectedText = message.text;
      handleRefineClick();
      sendResponse({ ok: true });
    } else if (message.type === 'GET_ACTIVE_TEXT') {
      const activeEl = document.activeElement;
      let text = '';
      if (
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLInputElement
      ) {
        text = activeEl.value;
      } else if (activeEl instanceof HTMLElement && activeEl.isContentEditable) {
        text = activeEl.innerText;
      }
      sendResponse({ text });
    } else if (message.type === 'INSERT_TEXT' && message.text) {
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLInputElement
      ) {
        activeEl.value = message.text;
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (activeEl instanceof HTMLElement && activeEl.isContentEditable) {
        activeEl.innerText = message.text;
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      sendResponse({ ok: true });
    }

    return false;
  },
);
