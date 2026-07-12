// ---------------------------------------------------------------------------
// Background service worker — handles context menus, message routing,
// streaming refinement coordination via chrome.runtime ports.
// ---------------------------------------------------------------------------

import { streamRefine } from '../shared/api';
import { streamWithProvider } from '../shared/byom-api';
import { DEFAULT_PROFILES } from '../shared/constants';
import { buildRefinementPrompt } from '../shared/prompt-builder';
import type { StyleProfile } from '../shared/types';
import { getModelConfig } from '../storage/model-config';
import { getSettings } from '../storage/settings';
import { getStyleProfiles, mergeProfiles } from '../storage/style-profiles';

// ── MDR web origin allowlist (defense-in-depth for profile sync) ────────────
// A page's content script can post SYNC_PROFILES_FROM_WEB, so verify the
// sender is the real MDR web app before trusting its profile payload. The
// localhost origin is only honoured in dev builds — import.meta.env.DEV is
// statically false in the production bundle Vite emits for the Web Store.
function isAllowedMdrSender(sender: chrome.runtime.MessageSender): boolean {
  const rawUrl = sender.url ?? sender.origin ?? '';
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  const { origin, hostname, protocol } = parsed;
  if (protocol === 'https:') {
    if (hostname === 'macrodocrefinement.com' || hostname.endsWith('.macrodocrefinement.com')) {
      return true;
    }
  }
  if (import.meta.env.DEV && origin === 'http://localhost:3000') {
    return true;
  }
  return false;
}

// ── Context-menu preset mapping ─────────────────────────────────────────────
// Each variant menu item applies a fixed preset. Resolved against the canonical
// DEFAULT_PROFILES (not the user's stored profiles) so the preset is applied
// deterministically even if the user renamed or deleted the seeded profile.
const CONTEXT_MENU_PRESETS: Record<
  string,
  { toneValue?: number; personalityName?: string; platformName?: string }
> = {
  'refine-professional': { toneValue: -0.3, personalityName: 'Professional' },
  'refine-casual': { toneValue: 0.5, personalityName: 'Casual & Friendly' },
  'refine-linkedin': { platformName: 'LinkedIn Professional' },
  'refine-x': { platformName: 'X (Twitter) Style' },
};

interface ResolvedMenuPreset {
  toneValue?: number;
  personalityMode: StyleProfile | null;
  platformPreset: StyleProfile | null;
}

function resolveMenuPreset(menuId: string | undefined): ResolvedMenuPreset | null {
  if (!menuId) return null;
  const preset = CONTEXT_MENU_PRESETS[menuId];
  if (!preset) return null;

  const personalityMode = preset.personalityName
    ? DEFAULT_PROFILES.find((p) => p.name === preset.personalityName) ?? null
    : null;
  const platformPreset = preset.platformName
    ? DEFAULT_PROFILES.find((p) => p.name === preset.platformName) ?? null
    : null;

  return { toneValue: preset.toneValue, personalityMode, platformPreset };
}

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    // Defense-in-depth: only accept syncs from the real MDR web app. The
    // content script already gates this by hostname, but the sender may be any
    // frame on any page, so re-verify the origin here at the trust boundary.
    if (!isAllowedMdrSender(sender)) {
      sendResponse({ ok: false, error: 'Untrusted sender' });
      return false;
    }

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
    menuId?: string;
  }) => {
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    try {
      const config = await getModelConfig();
      const profiles = await getStyleProfiles();
      const settings = await getSettings();

      const activeProfiles = profiles.filter((p) => p.isActive);

      // Context-menu variants map to a fixed preset (tone + platform/personality
      // instruction block). Explicit port params still win over the menu preset,
      // which in turn wins over the stored default tone.
      const menuPreset = resolveMenuPreset(msg.menuId);
      const toneValue = msg.toneValue ?? menuPreset?.toneValue ?? settings.toneValue;

      // Resolve optional named presets, falling back to the menu preset.
      const platformPreset = msg.platformPresetName
        ? profiles.find((p) => p.name === msg.platformPresetName && p.type === 'platform') ?? null
        : menuPreset?.platformPreset ?? null;
      const personalityMode = msg.personalityModeName
        ? profiles.find((p) => p.name === msg.personalityModeName && p.type === 'personality') ?? null
        : menuPreset?.personalityMode ?? null;

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
