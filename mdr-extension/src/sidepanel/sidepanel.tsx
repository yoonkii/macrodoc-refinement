import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlatformKey } from '../shared/types';
import type { StyleProfile } from '../shared/types';
import { PLATFORM_META } from '../shared/constants';
import { getStyleProfiles, toggleProfile } from '../storage/style-profiles';
import { getSettings, setSettings } from '../storage/settings';
import { getModelConfig } from '../storage/model-config';

// ── Types ──────────────────────────────────────────────────────────────────

type TabKey = 'refined' | PlatformKey;

interface StreamMessage {
  type: 'CHUNK' | 'DONE' | 'ERROR';
  text?: string;
  error?: string;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#050505',
  surface: '#0D1117',
  surfaceHover: '#161B22',
  border: '#21262D',
  amber: '#E8A838',
  amberDim: '#C8892A',
  textPrimary: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#484F58',
} as const;

const styles = {
  container: {
    background: COLORS.bg,
    color: COLORS.textPrimary,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '16px',
    borderBottom: `1px solid ${COLORS.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.amber,
    letterSpacing: '-0.02em',
  },
  headerModel: {
    fontSize: '11px',
    color: COLORS.textMuted,
  },
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '6px',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    color: COLORS.textPrimary,
    fontFamily: 'inherit',
    fontSize: '13px',
    padding: '10px',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
  },
  primaryButton: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    background: COLORS.amber,
    color: '#1A1816',
    fontWeight: 600,
    fontSize: '13px',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  secondaryButton: {
    padding: '10px 14px',
    borderRadius: '8px',
    background: COLORS.surface,
    color: COLORS.textPrimary,
    fontWeight: 500,
    fontSize: '13px',
    border: `1px solid ${COLORS.border}`,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  tabRow: {
    display: 'flex',
    gap: '2px',
    overflowX: 'auto' as const,
    paddingBottom: '4px',
  },
  tab: (isActive: boolean) => ({
    padding: '6px 10px',
    borderRadius: '6px',
    background: isActive ? COLORS.amber : 'transparent',
    color: isActive ? '#1A1816' : COLORS.textSecondary,
    fontWeight: isActive ? 600 : 400,
    fontSize: '12px',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s',
  }),
  outputArea: {
    minHeight: '120px',
    padding: '10px',
    background: COLORS.surface,
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    fontSize: '13px',
    lineHeight: '1.6',
    color: COLORS.textPrimary,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    overflowY: 'auto' as const,
    maxHeight: '300px',
  },
  profileChip: (isActive: boolean) => ({
    padding: '4px 10px',
    borderRadius: '999px',
    background: isActive ? COLORS.amber : COLORS.surface,
    color: isActive ? '#1A1816' : COLORS.textSecondary,
    fontSize: '11px',
    fontWeight: isActive ? 600 : 400,
    border: `1px solid ${isActive ? COLORS.amber : COLORS.border}`,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  }),
  profileRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
  },
  toneSlider: {
    width: '100%',
    accentColor: COLORS.amber,
    cursor: 'pointer',
  },
  toneLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: COLORS.textMuted,
  },
  cursor: {
    display: 'inline-block',
    width: '2px',
    height: '14px',
    background: COLORS.amber,
    marginLeft: '1px',
    animation: 'mdr-blink 0.8s step-end infinite',
    verticalAlign: 'text-bottom',
  },
  footer: {
    padding: '12px',
    borderTop: `1px solid ${COLORS.border}`,
    display: 'flex',
    gap: '8px',
  },
} as const;

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
  const [toneValue, setToneValue] = useState(0);
  const [modelLabel, setModelLabel] = useState('Default');
  const portRef = useRef<chrome.runtime.Port | null>(null);

  // Load initial data from storage
  useEffect(() => {
    getStyleProfiles().then(setProfiles);
    getSettings().then((s) => setToneValue(s.toneValue));
    getModelConfig().then((c) => {
      setModelLabel(c.provider === 'default' ? 'Default (Free)' : `${c.provider}: ${c.model}`);
    });
  }, []);

  // ── Refinement stream ──────────────────────────────────────────────────

  const startRefinement = useCallback(() => {
    if (!inputText.trim() || isStreaming) return;

    setIsStreaming(true);
    setOutputs((prev) => ({ ...prev, [activeTab]: '' }));

    // Disconnect any previous port
    portRef.current?.disconnect();

    const port = chrome.runtime.connect({ name: 'refine-stream' });
    portRef.current = port;

    let accumulated = '';

    port.onMessage.addListener((msg: StreamMessage) => {
      if (msg.type === 'CHUNK' && msg.text) {
        accumulated += msg.text;
        setOutputs((prev) => ({ ...prev, [activeTab]: accumulated }));
      }
      if (msg.type === 'DONE') {
        setIsStreaming(false);
        port.disconnect();
        portRef.current = null;
      }
      if (msg.type === 'ERROR') {
        setOutputs((prev) => ({
          ...prev,
          [activeTab]: `Error: ${msg.error ?? 'Unknown error'}`,
        }));
        setIsStreaming(false);
        port.disconnect();
        portRef.current = null;
      }
    });

    // Resolve platform preset name from active tab
    const platformMap: Record<string, string> = {
      linkedin: 'LinkedIn Professional',
      x: 'X (Twitter) Style',
      instagram: 'Instagram',
    };
    const platformPresetName = platformMap[activeTab] ?? undefined;

    port.postMessage({
      text: inputText,
      toneValue,
      platformPresetName,
    });
  }, [inputText, isStreaming, activeTab, toneValue]);

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

  // ── Copy to clipboard ─────────────────────────────────────────────────

  const copyOutput = useCallback(() => {
    const text = outputs[activeTab];
    if (text) {
      navigator.clipboard.writeText(text);
    }
  }, [outputs, activeTab]);

  // ── Toggle profile ────────────────────────────────────────────────────

  const handleToggleProfile = useCallback(async (profileId: string) => {
    const updated = await toggleProfile(profileId);
    setProfiles(updated);
  }, []);

  // ── Tone change ───────────────────────────────────────────────────────

  const handleToneChange = useCallback((value: number) => {
    setToneValue(value);
    setSettings({ toneValue: value });
  }, []);

  // ── Tabs ──────────────────────────────────────────────────────────────

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'refined', label: 'Refined' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'x', label: 'X' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'substack', label: 'Substack' },
  ];

  const toneLabels: Record<number, string> = {
    [-1]: 'Board Memo',
    [-0.5]: 'Professional',
    [0]: 'Balanced',
    [0.5]: 'Conversational',
    [1]: 'Texting a Friend',
  };

  const closestTone = [-1, -0.5, 0, 0.5, 1].reduce((prev, curr) =>
    Math.abs(curr - toneValue) < Math.abs(prev - toneValue) ? curr : prev,
  );

  // Personality profiles for the style selector
  const personalityProfiles = profiles.filter(
    (p) => p.type === 'personality' || p.type === 'custom',
  );

  return (
    <div style={styles.container}>
      {/* Blink animation */}
      <style>{`@keyframes mdr-blink { 50% { opacity: 0; } }`}</style>

      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Macro Doc Refinement</span>
        <span style={styles.headerModel}>{modelLabel}</span>
      </div>

      {/* Scrollable body */}
      <div style={styles.body}>
        {/* Input */}
        <div>
          <div style={styles.sectionLabel}>Input</div>
          <textarea
            style={styles.textarea}
            placeholder="Paste or type text to refine..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div style={{ ...styles.buttonRow, marginTop: '8px' }}>
            <button
              style={styles.primaryButton}
              onClick={startRefinement}
              disabled={isStreaming || !inputText.trim()}
            >
              {isStreaming ? 'Refining...' : 'Refine'}
            </button>
            <button style={styles.secondaryButton} onClick={grabFromPage}>
              Grab from page
            </button>
          </div>
        </div>

        {/* Tone slider */}
        <div>
          <div style={styles.sectionLabel}>Tone</div>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.5}
            value={toneValue}
            onChange={(e) => handleToneChange(parseFloat(e.target.value))}
            style={styles.toneSlider}
          />
          <div style={styles.toneLabel}>
            <span>Formal</span>
            <span style={{ color: COLORS.amber, fontWeight: 600 }}>
              {toneLabels[closestTone] ?? 'Balanced'}
            </span>
            <span>Casual</span>
          </div>
        </div>

        {/* Style profiles */}
        <div>
          <div style={styles.sectionLabel}>Style</div>
          <div style={styles.profileRow}>
            {personalityProfiles.map((profile) => (
              <button
                key={profile.id}
                style={styles.profileChip(profile.isActive)}
                onClick={() => handleToggleProfile(profile.id)}
              >
                {profile.name}
              </button>
            ))}
          </div>
        </div>

        {/* Output tabs */}
        <div>
          <div style={styles.sectionLabel}>Output</div>
          <div style={styles.tabRow}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                style={styles.tab(activeTab === tab.key)}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.key !== 'refined' && (
                  <span
                    style={{
                      marginLeft: '4px',
                      fontSize: '10px',
                      opacity: 0.6,
                    }}
                  >
                    {PLATFORM_META[tab.key as PlatformKey]?.charLimit}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Output display */}
          <div style={{ ...styles.outputArea, marginTop: '8px' }}>
            {outputs[activeTab] || (
              <span style={{ color: COLORS.textMuted }}>
                Refined text will appear here...
              </span>
            )}
            {isStreaming && <span style={styles.cursor} />}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div style={styles.footer}>
        <button
          style={{ ...styles.secondaryButton, flex: 1 }}
          onClick={copyOutput}
          disabled={!outputs[activeTab]}
        >
          Copy
        </button>
        <button
          style={{ ...styles.primaryButton, flex: 1 }}
          onClick={insertIntoPage}
          disabled={!outputs[activeTab]}
        >
          Insert into page
        </button>
      </div>
    </div>
  );
}
