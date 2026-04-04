import { useEffect, useState } from 'react';
import { getModelConfig } from '../storage/model-config';
import { PROVIDERS } from '../shared/constants';

function v(name: string) { return `var(--mdr-${name})`; }

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
        await chrome.sidePanel.open({ tabId: tab.id });
        opened = true;
      }
    } catch {
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
        background: v('bg'),
        color: v('text'),
        fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
        padding: '16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: v('icon-bg'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 500,
            fontSize: '18px',
            color: v('icon-text'),
            border: `1px solid ${v('icon-border')}`,
            flexShrink: 0,
          }}
        >
          m
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: v('text') }}>
            Macro Doc Refinement
          </div>
          <div style={{ fontSize: '11px', color: v('muted') }}>
            Text refinement everywhere
          </div>
        </div>
      </div>

      {/* Model status */}
      <div
        style={{
          padding: '10px 12px',
          background: v('surface'),
          borderRadius: '8px',
          border: `1px solid ${v('border')}`,
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '11px', color: v('muted'), marginBottom: '2px' }}>
          Using
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: v('text') }}>{modelLabel}</div>
        {providerDesc && (
          <div style={{ fontSize: '11px', color: v('muted'), marginTop: '2px' }}>
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
          background: v('amber'),
          color: v('amber-text'),
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
          background: v('surface'),
          color: v('text'),
          fontWeight: 500,
          fontSize: '13px',
          border: `1px solid ${v('border')}`,
          cursor: 'pointer',
        }}
      >
        Settings
      </button>
    </div>
  );
}
