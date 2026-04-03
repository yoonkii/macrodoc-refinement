import { useEffect, useState } from 'react';
import { getModelConfig } from '../storage/model-config';
import { PROVIDERS } from '../shared/constants';

const COLORS = {
  bg: '#050505',
  surface: '#0D1117',
  border: '#21262D',
  amber: '#E8A838',
  textPrimary: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#484F58',
} as const;

export function Popup() {
  const [modelLabel, setModelLabel] = useState('Loading...');
  const [providerDesc, setProviderDesc] = useState('');

  useEffect(() => {
    getModelConfig().then((config) => {
      const provider = PROVIDERS[config.provider];
      setModelLabel(provider?.label ?? config.provider);
      setProviderDesc(provider?.description ?? '');
    });
  }, []);

  const openSidePanel = async () => {
    let opened = false;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Must call sidePanel.open directly from popup (user gesture context)
        // Sending via runtime.sendMessage loses the gesture context
        await chrome.sidePanel.open({ tabId: tab.id });
        opened = true;
      }
    } catch {
      // Fallback: try windowId-based open
      try {
        const win = await chrome.windows.getCurrent();
        if (win.id) {
          await chrome.sidePanel.open({ windowId: win.id });
          opened = true;
        }
      } catch {
        // Side panel API unavailable
      }
    }
    if (opened) {
      window.close();
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  return (
    <div
      style={{
        width: '280px',
        background: COLORS.bg,
        color: COLORS.textPrimary,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: COLORS.amber,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '16px',
            color: '#1A1816',
          }}
        >
          M
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: COLORS.amber }}>
            Macro Doc Refinement
          </div>
          <div style={{ fontSize: '11px', color: COLORS.textMuted }}>
            Text refinement everywhere
          </div>
        </div>
      </div>

      {/* Model status */}
      <div
        style={{
          padding: '10px',
          background: COLORS.surface,
          borderRadius: '8px',
          border: `1px solid ${COLORS.border}`,
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '11px', color: COLORS.textSecondary, marginBottom: '2px' }}>
          Using
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>{modelLabel}</div>
        {providerDesc && (
          <div style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>
            {providerDesc}
          </div>
        )}
      </div>

      {/* Buttons */}
      <button
        onClick={openSidePanel}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '8px',
          background: COLORS.amber,
          color: '#1A1816',
          fontWeight: 600,
          fontSize: '13px',
          border: 'none',
          cursor: 'pointer',
          marginBottom: '8px',
        }}
      >
        Open Side Panel
      </button>

      <button
        onClick={openOptions}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '8px',
          background: COLORS.surface,
          color: COLORS.textPrimary,
          fontWeight: 500,
          fontSize: '13px',
          border: `1px solid ${COLORS.border}`,
          cursor: 'pointer',
        }}
      >
        Settings
      </button>
    </div>
  );
}
