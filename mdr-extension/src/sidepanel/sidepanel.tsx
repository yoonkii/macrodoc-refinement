import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlatformKey, StyleProfile } from '../shared/types';
import { PLATFORM_META } from '../shared/constants';
import { getStyleProfiles, toggleProfile } from '../storage/style-profiles';
import { getModelConfig } from '../storage/model-config';

// ── Types ──────────────────────────────────────────────────────────────────

type TabKey = 'refined' | PlatformKey;

interface StreamMessage {
  type: 'CHUNK' | 'DONE' | 'ERROR';
  text?: string;
  error?: string;
}

// ── Style chip ordering by formality ───────────────────────────────────────

const STYLE_ORDER: string[] = [
  'MDR Style',
  'Academic',
  'Professional',
  'Warner',
  'Casual & Friendly',
  'Gen Z Style',
  'Proofread Only',
];

// ── Platform tabs with char limits ─────────────────────────────────────────

const TABS: Array<{ key: TabKey; label: string; charLimit?: number }> = [
  { key: 'refined', label: 'Refined' },
  { key: 'linkedin', label: 'LinkedIn', charLimit: 1300 },
  { key: 'x', label: 'X', charLimit: 280 },
  { key: 'instagram', label: 'Instagram', charLimit: 2200 },
];

// ── CSS helper: all colors via CSS variables ───────────────────────────────

function cssVar(name: string): string {
  return `var(--mdr-${name})`;
}

// ── Inline styles using CSS variables ──────────────────────────────────────

const S = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
    background: cssVar('bg'),
    color: cssVar('text'),
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    padding: '14px 16px 13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    position: 'relative' as const,
  },
  headerGradientBorder: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '1px',
    background: `linear-gradient(90deg, ${cssVar('amber')} 0%, ${cssVar('border')} 50%, transparent 100%)`,
    opacity: 0.7,
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: cssVar('text'),
    letterSpacing: '-0.01em',
  },
  modelBadge: {
    fontSize: '9px',
    fontWeight: 500,
    color: cssVar('muted'),
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    background: cssVar('surface'),
    padding: '3px 7px',
    borderRadius: '4px',
    border: `1px solid ${cssVar('border-subtle')}`,
  },

  // ── Section divider labels ──────────────────────────────────────────────
  sectionDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '4px 0 8px',
  },
  sectionDividerLine: {
    flex: 1,
    height: '1px',
    background: cssVar('border'),
  },
  sectionDividerLabel: {
    fontSize: '9px',
    fontWeight: 600,
    color: cssVar('dim'),
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    flexShrink: 0,
  },

  // ── Body scroll area ──────────────────────────────────────────────────
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },

  // ── Input section ───────────────────────────────────────────────────────
  inputSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0px',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    background: cssVar('surface'),
    border: `1px solid ${cssVar('border')}`,
    borderRadius: '8px',
    color: cssVar('text'),
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: '1.55',
    padding: '10px 12px',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  inputActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '8px',
  },
  refineButton: {
    flex: 1,
    padding: '9px 16px',
    borderRadius: '8px',
    background: cssVar('amber'),
    color: cssVar('amber-text'),
    fontWeight: 600,
    fontSize: '12px',
    letterSpacing: '0.01em',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease-out',
    boxShadow: `0 1px 2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.15)`,
  },
  grabButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: `1px solid ${cssVar('border')}`,
    borderRadius: '8px',
    color: cssVar('muted'),
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    padding: '8px 10px',
    transition: 'all 0.15s ease-out',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },

  // ── Style chips ─────────────────────────────────────────────────────────
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },

  // ── Output section ──────────────────────────────────────────────────────
  outputSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0,
  },

  // Segmented tab control
  tabBar: {
    display: 'flex',
    background: cssVar('surface'),
    borderRadius: '8px',
    padding: '3px',
    gap: '2px',
    flexShrink: 0,
    border: `1px solid ${cssVar('border')}`,
  },

  outputArea: {
    flex: 1,
    padding: '12px',
    background: cssVar('surface'),
    borderRadius: '8px',
    border: `1px solid ${cssVar('border')}`,
    fontSize: '13px',
    lineHeight: '1.65',
    color: cssVar('text'),
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    overflowY: 'auto' as const,
    marginTop: '8px',
    minHeight: '140px',
  },

  // Blinking cursor for streaming
  cursor: {
    display: 'inline-block',
    width: '2px',
    height: '14px',
    background: cssVar('amber'),
    marginLeft: '1px',
    animation: 'mdr-blink 0.8s step-end infinite',
    verticalAlign: 'text-bottom',
    borderRadius: '1px',
  },

  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    padding: '12px 16px',
    borderTop: `1px solid ${cssVar('border')}`,
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
    background: cssVar('bg'),
  },
  footerSecondary: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '9px 12px',
    borderRadius: '8px',
    background: 'transparent',
    color: cssVar('text-secondary'),
    fontWeight: 500,
    fontSize: '12px',
    border: `1px solid ${cssVar('border')}`,
    cursor: 'pointer',
    transition: 'all 0.15s ease-out',
  },
  footerPrimary: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '9px 12px',
    borderRadius: '8px',
    background: cssVar('amber'),
    color: cssVar('amber-text'),
    fontWeight: 600,
    fontSize: '12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease-out',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.12)',
  },
} as const;

// Dynamic style helpers (depend on state)
function chipStyle(isActive: boolean, isProofread: boolean = false): React.CSSProperties {
  if (isActive) {
    return {
      padding: '3px 10px',
      borderRadius: '999px',
      background: cssVar('amber'),
      color: cssVar('amber-text'),
      fontSize: '11px',
      fontWeight: 600,
      border: `1px solid ${cssVar('amber')}`,
      cursor: 'pointer',
      transition: 'all 0.15s ease-out',
      whiteSpace: 'nowrap' as const,
    };
  }

  // Proofread Only: visually distinct when inactive
  if (isProofread) {
    return {
      padding: '3px 10px',
      borderRadius: '999px',
      background: cssVar('amber-subtle'),
      color: cssVar('muted'),
      fontSize: '11px',
      fontWeight: 500,
      border: `1px dashed ${cssVar('border')}`,
      cursor: 'pointer',
      transition: 'all 0.15s ease-out',
      whiteSpace: 'nowrap' as const,
    };
  }

  return {
    padding: '3px 10px',
    borderRadius: '999px',
    background: 'transparent',
    color: cssVar('muted'),
    fontSize: '11px',
    fontWeight: 400,
    border: `1px solid ${cssVar('border')}`,
    cursor: 'pointer',
    transition: 'all 0.15s ease-out',
    whiteSpace: 'nowrap' as const,
  };
}

function tabStyle(isActive: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '5px 6px',
    background: isActive ? cssVar('surface-alt') : 'transparent',
    color: isActive ? cssVar('text') : cssVar('muted'),
    fontWeight: isActive ? 600 : 400,
    fontSize: '11px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s ease-out',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
  };
}

// ── SVG Icons (inline, tiny) ──────────────────────────────────────────────

function GrabIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M3 4h10M3 8h10M3 12h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 11V3h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsertIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

const MDR_WEBSITE_URL = 'https://macrodocrefinement.com';

export function SidePanel() {
  const [inputText, setInputText] = useState('');
  const [outputs, setOutputs] = useState<Record<TabKey, string>>({
    refined: '',
    linkedin: '',
    x: '',
    instagram: '',
    substack: '',
  });
  const [activeTab, setActiveTab] = useState<TabKey>('refined');
  const [isStreaming, setIsStreaming] = useState(false);
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [modelLabel, setModelLabel] = useState('Default');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial data from storage
  useEffect(() => {
    getStyleProfiles().then(setProfiles).catch(() => {
      // Storage may be unavailable briefly after install
    });
    getModelConfig().then((c) => {
      setModelLabel(c.provider === 'default' ? 'Default' : `${c.provider}/${c.model}`);
    }).catch(() => {
      // Fall back to default label
    });
  }, []);

  // Listen for sync completion messages from the background service worker
  useEffect(() => {
    function handleSyncMessage(message: {
      type: string;
      addedCount?: number;
      updatedCount?: number;
      totalCount?: number;
    }) {
      if (message.type === 'SYNC_COMPLETE') {
        const added = message.addedCount ?? 0;
        const updated = message.updatedCount ?? 0;
        const total = message.totalCount ?? 0;

        let text: string;
        if (added === 0 && updated === 0) {
          text = `Synced — ${total} profiles up to date`;
        } else {
          const parts: string[] = [];
          if (added > 0) parts.push(`${added} added`);
          if (updated > 0) parts.push(`${updated} updated`);
          text = `Synced ${total} profiles (${parts.join(', ')})`;
        }

        setSyncMessage(text);
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
          setSyncMessage(null);
          syncTimerRef.current = null;
        }, 3000);

        // Refresh profiles in the side panel
        getStyleProfiles().then(setProfiles).catch(() => {});
      }
    }

    chrome.runtime.onMessage.addListener(handleSyncMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleSyncMessage);
    };
  }, []);

  // Clean up port and timers on unmount
  useEffect(() => {
    return () => {
      portRef.current?.disconnect();
      portRef.current = null;
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  // Auto-scroll output during streaming
  useEffect(() => {
    if (isStreaming && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputs, isStreaming]);

  // ── Refinement stream ──────────────────────────────────────────────────

  const startRefinement = useCallback(
    (targetTab?: TabKey) => {
      const tab = targetTab ?? activeTab;
      if (!inputText.trim() || isStreaming) return;

      setIsStreaming(true);
      setOutputs((prev) => ({ ...prev, [tab]: '' }));

      // Disconnect any previous port
      portRef.current?.disconnect();

      let port: chrome.runtime.Port;
      try {
        port = chrome.runtime.connect({ name: 'refine-stream' });
      } catch {
        // Extension context invalidated
        setIsStreaming(false);
        setOutputs((prev) => ({
          ...prev,
          [tab]: 'Error: Extension context lost. Please reload the page.',
        }));
        return;
      }
      portRef.current = port;

      let accumulated = '';

      // Handle unexpected port disconnection (e.g., service worker restart)
      port.onDisconnect.addListener(() => {
        if (portRef.current === port) {
          portRef.current = null;
          setIsStreaming(false);
          if (!accumulated) {
            setOutputs((prev) => ({
              ...prev,
              [tab]: 'Error: Connection lost. Please try again.',
            }));
          }
        }
      });

      port.onMessage.addListener((msg: StreamMessage) => {
        if (msg.type === 'CHUNK' && msg.text) {
          accumulated += msg.text;
          setOutputs((prev) => ({ ...prev, [tab]: accumulated }));
        } else if (msg.type === 'DONE') {
          setIsStreaming(false);
          port.disconnect();
          portRef.current = null;
        } else if (msg.type === 'ERROR') {
          setOutputs((prev) => ({
            ...prev,
            [tab]: `Error: ${msg.error ?? 'Unknown error'}`,
          }));
          setIsStreaming(false);
          port.disconnect();
          portRef.current = null;
        }
      });

      // Resolve platform preset name from tab key
      const platformMap: Record<string, string> = {
        linkedin: 'LinkedIn Professional',
        x: 'X (Twitter) Style',
        instagram: 'Instagram',
      };
      const platformPresetName = platformMap[tab] ?? undefined;

      port.postMessage({
        text: inputText,
        toneValue: 0,
        platformPresetName,
      });
    },
    [inputText, isStreaming, activeTab],
  );

  // ── Tab switch: auto-generate if output empty ──────────────────────────

  const handleTabSwitch = useCallback(
    (tabKey: TabKey) => {
      setActiveTab(tabKey);
      // Auto-generate if tab has no output and there is input text
      if (!outputs[tabKey] && inputText.trim() && !isStreaming) {
        startRefinement(tabKey);
      }
    },
    [outputs, inputText, isStreaming, startRefinement],
  );

  // ── Grab text from page ────────────────────────────────────────────────

  const grabFromPage = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      chrome.tabs.sendMessage(tab.id, { type: 'GET_ACTIVE_TEXT' }, (response) => {
        // chrome.runtime.lastError must be checked to prevent console errors
        if (chrome.runtime.lastError) return;
        if (response?.text) {
          setInputText(response.text);
        }
      });
    } catch {
      // Tab query can fail if no active tab
    }
  }, []);

  // ── Insert into page ───────────────────────────────────────────────────

  const insertIntoPage = useCallback(async () => {
    const text = outputs[activeTab];
    if (!text) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      chrome.tabs.sendMessage(tab.id, { type: 'INSERT_TEXT', text }, () => {
        // Check lastError to suppress "Receiving end does not exist" console errors
        if (chrome.runtime.lastError) {
          // Content script not available on this page
        }
      });
    } catch {
      // Tab query can fail if no active tab
    }
  }, [outputs, activeTab]);

  // ── Copy to clipboard with feedback ───────────────────────────────────

  const copyOutput = useCallback(() => {
    const text = outputs[activeTab];
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopyFeedback(false);
        copyTimerRef.current = null;
      }, 1500);
    }).catch(() => {
      // Clipboard write failed; ignore silently in extension context
    });
  }, [outputs, activeTab]);

  // ── Toggle profile ────────────────────────────────────────────────────

  const handleToggleProfile = useCallback(async (profileId: string) => {
    const updated = await toggleProfile(profileId);
    setProfiles(updated);
  }, []);

  // ── Open MDR website to trigger sync ────────────────────────────────

  const openMdrWebsite = useCallback(() => {
    chrome.tabs.create({ url: MDR_WEBSITE_URL });
  }, []);

  // ── Derive ordered style chips ────────────────────────────────────────

  const styleProfiles = profiles
    .filter((p) => p.type === 'personality' || p.type === 'custom')
    .sort((a, b) => {
      const aIdx = STYLE_ORDER.indexOf(a.name);
      const bIdx = STYLE_ORDER.indexOf(b.name);
      // Unknown profiles go to end
      const aPos = aIdx === -1 ? STYLE_ORDER.length : aIdx;
      const bPos = bIdx === -1 ? STYLE_ORDER.length : bIdx;
      return aPos - bPos;
    });

  const hasOutput = Boolean(outputs[activeTab]);
  const canRefine = Boolean(inputText.trim()) && !isStreaming;

  return (
    <div style={S.container}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <span style={S.headerTitle}>MDR</span>
        <span style={S.modelBadge}>{modelLabel}</span>
        <div style={S.headerGradientBorder} />
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────── */}
      <div style={S.body}>
        {/* INPUT section - no label, the textarea speaks for itself */}
        <div style={S.inputSection}>
          <textarea
            style={S.textarea}
            placeholder="Paste or type text to refine..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div style={S.inputActions}>
            <button
              style={{
                ...S.refineButton,
                opacity: canRefine ? 1 : 0.45,
                cursor: canRefine ? 'pointer' : 'not-allowed',
              }}
              onClick={() => startRefinement()}
              disabled={!canRefine}
            >
              {isStreaming ? 'Refining...' : 'Refine Text'}
            </button>
            <button style={S.grabButton} onClick={grabFromPage}>
              <GrabIcon />
              Grab
            </button>
          </div>
        </div>

        {/* ── STYLE section with divider-label ─────────────────────────── */}
        <div style={{ marginTop: '12px' }}>
          <div style={S.sectionDivider}>
            <div style={S.sectionDividerLine} />
            <span style={S.sectionDividerLabel}>Style</span>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: cssVar('muted'),
                fontSize: '9px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '0 2px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                transition: 'color 0.15s',
                flexShrink: 0,
              }}
              onClick={openMdrWebsite}
              title="Open MDR website to sync custom profiles"
            >
              Sync
            </button>
            <div style={S.sectionDividerLine} />
          </div>
          {syncMessage && (
            <div
              style={{
                fontSize: '10px',
                color: cssVar('amber'),
                fontWeight: 500,
                marginBottom: '6px',
                letterSpacing: '0.01em',
                transition: 'opacity 0.3s',
              }}
            >
              {syncMessage}
            </div>
          )}
          <div style={S.chipRow}>
            {styleProfiles.map((profile) => (
              <button
                key={profile.id}
                style={chipStyle(profile.isActive, profile.name === 'Proofread Only')}
                onClick={() => handleToggleProfile(profile.id)}
              >
                {profile.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── OUTPUT section (hero area) ───────────────────────────────── */}
        <div style={{ ...S.outputSection, marginTop: '12px' }}>
          <div style={S.sectionDivider}>
            <div style={S.sectionDividerLine} />
            <span style={S.sectionDividerLabel}>Output</span>
            <div style={S.sectionDividerLine} />
          </div>

          {/* Segmented tab control */}
          <div style={S.tabBar}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                style={tabStyle(activeTab === tab.key)}
                onClick={() => handleTabSwitch(tab.key)}
              >
                {tab.label}
                {tab.charLimit != null && (
                  <span
                    style={{
                      fontSize: '8px',
                      opacity: 0.5,
                      fontWeight: 400,
                      fontFamily: "'SF Mono', 'Menlo', monospace",
                      marginLeft: '1px',
                    }}
                  >
                    {tab.charLimit}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div ref={outputRef} style={S.outputArea}>
            {outputs[activeTab] || (
              <span style={{ color: cssVar('dim'), fontSize: '12px', fontStyle: 'italic' }}>
                Refined text appears here...
              </span>
            )}
            {isStreaming && <span style={S.cursor} />}
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={S.footer}>
        <button
          style={{
            ...S.footerSecondary,
            opacity: hasOutput ? 1 : 0.35,
            cursor: hasOutput ? 'pointer' : 'not-allowed',
          }}
          onClick={copyOutput}
          disabled={!hasOutput}
        >
          {copyFeedback ? <CheckIcon /> : <CopyIcon />}
          {copyFeedback ? 'Copied' : 'Copy Text'}
        </button>
        <button
          style={{
            ...S.footerPrimary,
            opacity: hasOutput ? 1 : 0.35,
            cursor: hasOutput ? 'pointer' : 'not-allowed',
          }}
          onClick={insertIntoPage}
          disabled={!hasOutput}
        >
          <InsertIcon />
          Insert into Page
        </button>
      </div>
    </div>
  );
}
