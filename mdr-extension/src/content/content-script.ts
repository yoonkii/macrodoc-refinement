// ---------------------------------------------------------------------------
// Content script — injects the floating "Refine" widget on text selection
// and handles message-based communication with the background service worker.
// ---------------------------------------------------------------------------

const WIDGET_ID = 'mdr-refine-widget';
const MIN_SELECTION_LENGTH = 4;
const WIDGET_OFFSET_Y = 40;
// Max time to wait between stream events before treating the refinement as
// failed. Guards against a killed MV3 service worker leaving the widget stuck.
const STREAM_INACTIVITY_MS = 30000;
// How long the inline error state stays visible before the widget hides itself.
const ERROR_DISPLAY_MS = 3000;

/**
 * Snapshot of the element (and its selection) that was focused when the widget
 * was shown. Captured up-front because streaming takes seconds, during which
 * `document.activeElement` and the live selection may change (the user may
 * click elsewhere), which would otherwise send the refined text nowhere.
 */
interface CapturedTarget {
  element: HTMLElement;
  // Populated for <input> / <textarea> targets.
  selectionStart: number | null;
  selectionEnd: number | null;
  // Populated for contenteditable targets (cloned so later DOM edits don't mutate it).
  range: Range | null;
}

let widgetHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let widgetButton: HTMLButtonElement | null = null;
let widgetLabel: HTMLElement | null = null;
let currentSelectedText = '';
let capturedTarget: CapturedTarget | null = null;
let isRefining = false;
let inlineWidgetEnabled = true;
let inactivityTimerId: number | null = null;
let errorTimerId: number | null = null;

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
    widgetLabel = null;
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
      .mdr-btn.error {
        background: #E85A5A;
        color: #1A1816;
        pointer-events: none;
      }
      .mdr-btn.error:hover {
        transform: none;
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
      <span class="mdr-label">Refine</span>
    </button>
  `;

  widgetButton = shadowRoot.querySelector('.mdr-btn') as HTMLButtonElement;
  widgetLabel = shadowRoot.querySelector('.mdr-label') as HTMLElement;
  // Suppress focus theft: a plain click on the button would move focus off the
  // target field, collapsing its selection and breaking the replacement path.
  // Handling mousedown with preventDefault keeps the target focused/selected.
  widgetButton.addEventListener('mousedown', (event: MouseEvent) => {
    event.preventDefault();
  });
  widgetButton.addEventListener('click', handleRefineClick);

  document.body.appendChild(widgetHost);
  return { host: widgetHost, button: widgetButton };
}

// ── Show / hide widget ────────────────────────────────────────────────────

/**
 * Snapshot the currently focused editable element and its selection. Called the
 * moment the widget is shown so the replacement path can target the original
 * field even after the stream completes seconds later.
 */
function captureTarget(): void {
  const el = document.activeElement;

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    capturedTarget = {
      element: el,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      range: null,
    };
    return;
  }

  if (el instanceof HTMLElement && el.isContentEditable) {
    const selection = window.getSelection();
    capturedTarget = {
      element: el,
      selectionStart: null,
      selectionEnd: null,
      range: selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null,
    };
    return;
  }

  capturedTarget = null;
}

function showWidget(x: number, y: number, text: string): void {
  if (isRefining || !inlineWidgetEnabled) return;

  const { host } = ensureWidget();
  currentSelectedText = text;
  captureTarget();

  // Reset any lingering error state from a previous failed refinement so a
  // fresh selection shows the normal button, not the red error label.
  clearErrorTimer();
  widgetButton?.classList.remove('error');
  if (widgetLabel) widgetLabel.textContent = 'Refine';

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
  capturedTarget = null;
}

// ── Refine click handler ──────────────────────────────────────────────────

function handleRefineClick(): void {
  if (!currentSelectedText || isRefining) return;

  // Snapshot the target now; the module-level ref may be cleared before the
  // async stream completes.
  const target = capturedTarget;

  isRefining = true;
  clearErrorTimer();
  widgetButton?.classList.remove('error');
  widgetButton?.classList.add('loading');

  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: 'refine-stream' });
  } catch {
    // Extension context invalidated (e.g., extension reloaded) — leave the
    // user's original text untouched and surface the failure.
    failRefining();
    return;
  }

  let refinedText = '';
  // Only true once the explicit DONE message arrives. Until then any
  // disconnect / timeout must be treated as a failure so we never replace the
  // user's text with a partial (truncated) stream.
  let completed = false;

  const disconnectPort = (): void => {
    try {
      port.disconnect();
    } catch {
      // Port already gone — nothing to do.
    }
  };

  const startInactivityTimer = (): void => {
    clearInactivityTimer();
    inactivityTimerId = window.setTimeout(() => {
      // No chunk or completion within the window — assume the service worker
      // died. Keep the original text and show the inline error state.
      disconnectPort();
      if (isRefining && !completed) {
        failRefining();
      }
    }, STREAM_INACTIVITY_MS);
  };

  port.onDisconnect.addListener(() => {
    // Service worker disconnected unexpectedly (e.g., worker killed mid-stream).
    // Never replace on an incomplete stream — the partial text would truncate
    // the user's content.
    if (isRefining && !completed) {
      failRefining();
    }
  });

  port.onMessage.addListener((msg: { type: string; text?: string; error?: string }) => {
    if (msg.type === 'CHUNK' && msg.text) {
      refinedText += msg.text;
      startInactivityTimer();
    } else if (msg.type === 'DONE') {
      completed = true;
      clearInactivityTimer();
      const replaced = refinedText.length > 0 && replaceTargetText(target, refinedText);
      if (replaced) {
        finishRefining();
      } else {
        failRefining();
      }
      disconnectPort();
    } else if (msg.type === 'ERROR') {
      clearInactivityTimer();
      failRefining();
      disconnectPort();
    }
  });

  startInactivityTimer();
  port.postMessage({ text: currentSelectedText });
}

function clearInactivityTimer(): void {
  if (inactivityTimerId !== null) {
    window.clearTimeout(inactivityTimerId);
    inactivityTimerId = null;
  }
}

function clearErrorTimer(): void {
  if (errorTimerId !== null) {
    window.clearTimeout(errorTimerId);
    errorTimerId = null;
  }
}

/** Successful completion: clear loading state and hide the widget. */
function finishRefining(): void {
  isRefining = false;
  clearInactivityTimer();
  widgetButton?.classList.remove('loading');
  hideWidget();
}

/**
 * Failure path: the user's original text is left untouched. Surface a brief
 * inline error state (reusing the widget button) instead of silently vanishing.
 */
function failRefining(): void {
  isRefining = false;
  clearInactivityTimer();
  widgetButton?.classList.remove('loading');

  if (widgetButton && widgetLabel) {
    widgetButton.classList.add('error');
    widgetLabel.textContent = 'Text unchanged — try again';
    clearErrorTimer();
    errorTimerId = window.setTimeout(() => {
      errorTimerId = null;
      if (widgetButton && widgetLabel) {
        widgetButton.classList.remove('error');
        widgetLabel.textContent = 'Refine';
      }
      hideWidget();
    }, ERROR_DISPLAY_MS);
  } else {
    hideWidget();
  }
}

// ── Replace selected text in the captured target ──────────────────────────

/**
 * Set an <input>/<textarea> value through the native prototype setter so
 * React's value tracker is bypassed and a dispatched 'input' event updates
 * controlled component state. Assigning `.value` directly is swallowed by
 * React on its actual target sites (LinkedIn, X, Slack).
 */
function setNativeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
}

/**
 * Replace the captured selection with `newText`. Uses the target snapshot taken
 * when the widget was shown rather than re-reading the live DOM, since the
 * stream may have finished seconds later. Returns true when the text was placed
 * (into the field, or the clipboard as a last resort); false only when nothing
 * could be done — in which case the caller keeps the original text and errors.
 */
function replaceTargetText(target: CapturedTarget | null, newText: string): boolean {
  // Prefer the captured element; fall back to the live active element.
  const element = target?.element ?? document.activeElement;

  // Handle textarea / input elements
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = target?.selectionStart ?? element.selectionStart ?? 0;
    const end = target?.selectionEnd ?? element.selectionEnd ?? 0;
    const currentValue = element.value;

    setNativeInputValue(
      element,
      currentValue.slice(0, start) + newText + currentValue.slice(end),
    );

    // Restore cursor position after replacement (some input types reject this).
    const newCursorPos = start + newText.length;
    try {
      element.setSelectionRange(newCursorPos, newCursorPos);
    } catch {
      // e.g. <input type="number"> disallows setSelectionRange — ignore.
    }

    // Dispatch input event so frameworks (React) detect the change.
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // Handle contentEditable elements
  if (element instanceof HTMLElement && element.isContentEditable) {
    element.focus();
    const selection = window.getSelection();
    if (!selection) return false;

    // Restore the captured selection so execCommand replaces the right range.
    if (target?.range) {
      selection.removeAllRanges();
      selection.addRange(target.range);
    }
    if (selection.rangeCount === 0) return false;

    // Prefer execCommand('insertText'): it plays well with rich-text editors
    // (Slack, X) by emitting the beforeinput/input events they listen for.
    if (document.execCommand('insertText', false, newText)) {
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    // Fallback: manual Range manipulation when execCommand is unsupported.
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
    selection.collapseToEnd();
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // Last resort: copy refined text to the clipboard so it isn't lost.
  navigator.clipboard.writeText(newText).catch(() => {
    // Silent fallback — clipboard write may be blocked.
  });
  return true;
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
  clearInactivityTimer();
  clearErrorTimer();
  if (widgetHost && document.body.contains(widgetHost)) {
    widgetHost.remove();
  }
  widgetHost = null;
  shadowRoot = null;
  widgetButton = null;
  widgetLabel = null;
  currentSelectedText = '';
  capturedTarget = null;
  isRefining = false;
});

// ── Message listener (from background / popup) ────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: { type: string; text?: string; menuId?: string }, _sender, sendResponse) => {
    if (message.type === 'REFINE_SELECTION' && message.text) {
      currentSelectedText = message.text;
      // Capture the target now (right-click keeps focus on the field) so the
      // replacement path has a reference even without the floating widget.
      captureTarget();
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
        setNativeInputValue(activeEl, message.text);
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
