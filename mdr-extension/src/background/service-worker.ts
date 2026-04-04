// ---------------------------------------------------------------------------
// Background service worker — handles context menus, message routing,
// streaming refinement coordination via chrome.runtime ports.
// ---------------------------------------------------------------------------

import { streamRefine } from '../shared/api';
import { streamWithProvider } from '../shared/byom-api';
import { buildRefinementPrompt } from '../shared/prompt-builder';
import { getModelConfig } from '../storage/model-config';
import { getSettings } from '../storage/settings';
import { getStyleProfiles, mergeProfiles } from '../storage/style-profiles';

// ── Context menu creation ──────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'refine-selection',
    title: 'Refine with MDR',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'refine-professional',
    title: 'Refine — Professional',
    contexts: ['selection'],
    parentId: 'refine-selection',
  });

  chrome.contextMenus.create({
    id: 'refine-casual',
    title: 'Refine — Casual',
    contexts: ['selection'],
    parentId: 'refine-selection',
  });

  chrome.contextMenus.create({
    id: 'refine-linkedin',
    title: 'Refine for LinkedIn',
    contexts: ['selection'],
    parentId: 'refine-selection',
  });

  chrome.contextMenus.create({
    id: 'refine-x',
    title: 'Refine for X (Twitter)',
    contexts: ['selection'],
    parentId: 'refine-selection',
  });
});

// ── Context menu click handler ─────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !info.selectionText) return;

  const menuId = info.menuItemId as string;
  if (!menuId.startsWith('refine')) return;

  chrome.tabs.sendMessage(
    tab.id,
    {
      type: 'REFINE_SELECTION',
      text: info.selectionText,
      menuId,
    },
    () => {
      // Check lastError to suppress "Receiving end does not exist" console errors
      // when content script is not loaded (e.g., chrome:// pages)
      if (chrome.runtime.lastError) {
        // Content script not available on this page
      }
    },
  );
});

// ── Message handler (for simple request/response) ──────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_MODEL_CONFIG') {
    getModelConfig()
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }

  if (message.type === 'GET_STYLE_PROFILES') {
    getStyleProfiles()
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings()
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    if (message.tabId) {
      chrome.sidePanel.open({ tabId: message.tabId }).catch(() => {
        // Side panel may not be available in all contexts
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  // ── Profile sync from MDR website ───────────────────────────────────────
  if (message.type === 'SYNC_PROFILES_FROM_WEB') {
    const incoming = message.profiles;
    if (!Array.isArray(incoming)) {
      sendResponse({ ok: false, error: 'Invalid profiles data' });
      return false;
    }

    (async () => {
      try {
        const { merged, addedCount, updatedCount } = await mergeProfiles(incoming);

        // Notify any open side panels about the sync result
        chrome.runtime.sendMessage({
          type: 'SYNC_COMPLETE',
          addedCount,
          updatedCount,
          totalCount: merged.length,
        }).catch(() => {
          // No listeners — side panel may not be open
        });

        // Return all extension profiles so the content script can
        // write extension-only profiles back to the web app's localStorage
        sendResponse({
          ok: true,
          addedCount,
          updatedCount,
          extensionProfiles: merged,
        });
      } catch {
        sendResponse({ ok: false, error: 'Merge failed' });
      }
    })();

    // Return true to indicate async sendResponse
    return true;
  }

  return false;
});

// ── Port-based streaming for refinement ────────────────────────────────────
// Content script / side panel connects via chrome.runtime.connect with
// port name "refine-stream". Messages on the port trigger streaming.

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'refine-stream') return;

  let abortController: AbortController | null = null;
  let portDisconnected = false;

  /** Safely send a message over the port, ignoring errors if already disconnected. */
  function safeSend(msg: Record<string, unknown>): void {
    if (portDisconnected) return;
    try {
      port.postMessage(msg);
    } catch {
      // Port was disconnected between our check and the send
      portDisconnected = true;
    }
  }

  port.onDisconnect.addListener(() => {
    portDisconnected = true;
    abortController?.abort();
    abortController = null;
  });

  port.onMessage.addListener(async (msg: {
    text: string;
    toneValue?: number;
    platformPresetName?: string;
    personalityModeName?: string;
  }) => {
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    try {
      const config = await getModelConfig();
      const profiles = await getStyleProfiles();
      const settings = await getSettings();

      const activeProfiles = profiles.filter((p) => p.isActive);
      const toneValue = msg.toneValue ?? settings.toneValue;

      // Resolve optional named presets
      const platformPreset = msg.platformPresetName
        ? profiles.find((p) => p.name === msg.platformPresetName && p.type === 'platform') ?? null
        : null;
      const personalityMode = msg.personalityModeName
        ? profiles.find((p) => p.name === msg.personalityModeName && p.type === 'personality') ?? null
        : null;

      const prompt = buildRefinementPrompt({
        inputText: msg.text,
        activeProfiles,
        toneValue,
        platformPreset,
        personalityMode,
      });

      const useDefault = config.provider === 'default' || !config.apiKey.trim();

      if (useDefault) {
        for await (const chunk of streamRefine(prompt, signal)) {
          if (portDisconnected) return;
          safeSend({ type: 'CHUNK', text: chunk });
        }
      } else {
        for await (const chunk of streamWithProvider(prompt, config, signal)) {
          if (portDisconnected) return;
          safeSend({ type: 'CHUNK', text: chunk });
        }
      }

      safeSend({ type: 'DONE' });
    } catch (err: unknown) {
      if (signal.aborted || portDisconnected) return;
      const errorMessage = err instanceof Error ? err.message : String(err);
      safeSend({ type: 'ERROR', error: errorMessage });
    }
  });
});

// Note: chrome.action.onClicked does NOT fire when default_popup is set.
// Side panel opening is handled via OPEN_SIDE_PANEL message from the popup.
