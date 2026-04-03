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
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: cssVar('bg'),
    color: cssVar('text'),
  },

  // Header
  header: {
    padding: '12px',
    borderBottom: `1px solid ${cssVar('border')}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: cssVar('text'),
    letterSpacing: '-0.01em',
  },
  headerModel: {
    fontSize: '10px',
    color: cssVar('muted'),
    letterSpacing: '0.02em',
  },

  // Section labels
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: cssVar('muted'),
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '6px',
  },

  // Body scroll area
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },

  // Textarea
  textarea: {
    width: '100%',
    minHeight: '120px',
    background: cssVar('surface'),
    border: `1px solid ${cssVar('border')}`,
    borderRadius: '6px',
    color: cssVar('text'),
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: '1.5',
    padding: '10px',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },

  // Refine button (full-width amber)
  refineButton: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    background: cssVar('amber'),
    color: cssVar('amber-text'),
    fontWeight: 600,
    fontSize: '13px',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    marginTop: '8px',
  },

  // "Grab from page" text link
  grabLink: {
    background: 'none',
    border: 'none',
    color: cssVar('muted'),
    fontSize: '11px',
    cursor: 'pointer',
    padding: '4px 0',
    marginTop: '4px',
    textAlign: 'center' as const,
    width: '100%',
    transition: 'color 0.15s',
  },

  // Style chips container
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },

  // Tab row (horizontal scrollable)
  tabRow: {
    display: 'flex',
    gap: '2px',
    overflowX: 'auto' as const,
    flexShrink: 0,
    paddingBottom: '1px',
  },

  // Output container (takes remaining space)
  outputSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0,
  },
  outputArea: {
    flex: 1,
    padding: '10px',
    background: cssVar('surface'),
    borderRadius: '6px',
    border: `1px solid ${cssVar('border')}`,
    fontSize: '13px',
    lineHeight: '1.6',
    color: cssVar('text'),
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    overflowY: 'auto' as const,
    marginTop: '6px',
    minHeight: '120px',
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
  },

  // Sticky bottom bar
  footer: {
    padding: '12px',
    borderTop: `1px solid ${cssVar('border')}`,
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
    background: cssVar('bg'),
  },
  footerSecondary: {
    flex: 1,
    padding: '9px',
    borderRadius: '6px',
    background: cssVar('surface'),
    color: cssVar('text'),
    fontWeight: 500,
    fontSize: '12px',
    border: `1px solid ${cssVar('border')}`,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  footerPrimary: {
    flex: 1,
    padding: '9px',
    borderRadius: '6px',
    background: cssVar('amber'),
    color: cssVar('amber-text'),
    fontWeight: 600,
    fontSize: '12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
} as const;

// Dynamic style helpers (depend on state)
function chipStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: '999px',
    background: isActive ? cssVar('amber') : 'transparent',
    color: isActive ? cssVar('amber-text') : cssVar('muted'),
    fontSize: '12px',
    fontWeight: isActive ? 600 : 400,
    border: `1px solid ${isActive ? cssVar('amber') : cssVar('border')}`,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  };
}

function tabStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: '5px 8px',
    background: 'transparent',
    color: isActive ? cssVar('amber') : cssVar('muted'),
    fontWeight: isActive ? 600 : 400,
    fontSize: '12px',
    border: 'none',
    borderBottom: isActive ? `2px solid ${cssVar('amber')}` : '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };
}

// ── Component ──────────────────────────────────────────────────────────────

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
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Load initial data from storage
  useEffect(() => {
    getStyleProfiles().then(setProfiles);
    getModelConfig().then((c) => {
      setModelLabel(c.provider === 'default' ? 'Default' : `${c.provider}/${c.model}`);
    });
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

      const port = chrome.runtime.connect({ name: 'refine-stream' });
      portRef.current = port;

      let accumulated = '';

      port.onMessage.addListener((msg: StreamMessage) => {
        if (msg.type === 'CHUNK' && msg.text) {
          accumulated += msg.text;
          setOutputs((prev) => ({ ...prev, [tab]: accumulated }));
        }
        if (msg.type === 'DONE') {
          setIsStreaming(false);
          port.disconnect();
          portRef.current = null;
        }
        if (msg.type === 'ERROR') {
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { type: 'GET_ACTIVE_TEXT' }, (response) => {
      if (response?.text) {
        setInputText(response.text);
      }
    });
  }, []);

  // ── Insert into page ───────────────────────────────────────────────────

  const insertIntoPage = useCallback(async () => {
    const text = outputs[activeTab];
    if (!text) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { type: 'INSERT_TEXT', text });
  }, [outputs, activeTab]);

  // ── Copy to clipboard with feedback ───────────────────────────────────

  const copyOutput = useCallback(() => {
    const text = outputs[activeTab];
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    });
  }, [outputs, activeTab]);

  // ── Toggle profile ────────────────────────────────────────────────────

  const handleToggleProfile = useCallback(async (profileId: string) => {
    const updated = await toggleProfile(profileId);
    setProfiles(updated);
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
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>Macro Doc Refinement.</span>
        <span style={S.headerModel}>{modelLabel}</span>
      </div>

      {/* Scrollable body */}
      <div style={S.body}>
        {/* INPUT section */}
        <div>
          <div style={S.sectionLabel}>Input</div>
          <textarea
            style={S.textarea}
            placeholder="Type or paste text..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            style={{
              ...S.refineButton,
              opacity: canRefine ? 1 : 0.5,
              cursor: canRefine ? 'pointer' : 'not-allowed',
            }}
            onClick={() => startRefinement()}
            disabled={!canRefine}
          >
            {isStreaming ? 'Refining...' : 'Refine'}
          </button>
          <button style={S.grabLink} onClick={grabFromPage}>
            Grab from page
          </button>
        </div>

        {/* STYLE section */}
        <div>
          <div style={S.sectionLabel}>Style</div>
          <div style={S.chipRow}>
            {styleProfiles.map((profile) => (
              <button
                key={profile.id}
                style={chipStyle(profile.isActive)}
                onClick={() => handleToggleProfile(profile.id)}
              >
                {profile.name}
              </button>
            ))}
          </div>
        </div>

        {/* OUTPUT section */}
        <div style={S.outputSection}>
          <div style={S.sectionLabel}>Output</div>
          <div style={S.tabRow}>
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
                      fontSize: '9px',
                      opacity: 0.6,
                      fontWeight: 400,
                      marginLeft: '2px',
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
              <span style={{ color: cssVar('muted'), fontSize: '12px' }}>
                Refined text will appear here...
              </span>
            )}
            {isStreaming && <span style={S.cursor} />}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div style={S.footer}>
        <button
          style={{
            ...S.footerSecondary,
            opacity: hasOutput ? 1 : 0.4,
            cursor: hasOutput ? 'pointer' : 'not-allowed',
          }}
          onClick={copyOutput}
          disabled={!hasOutput}
        >
          {copyFeedback ? 'Copied' : 'Copy'}
        </button>
        <button
          style={{
            ...S.footerPrimary,
            opacity: hasOutput ? 1 : 0.4,
            cursor: hasOutput ? 'pointer' : 'not-allowed',
          }}
          onClick={insertIntoPage}
          disabled={!hasOutput}
        >
          Insert into page
        </button>
      </div>
    </div>
  );
}
