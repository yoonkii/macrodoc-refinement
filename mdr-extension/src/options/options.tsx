import { useCallback, useEffect, useState } from 'react';
import { PROVIDERS, PROVIDER_MODELS } from '../shared/constants';
import type { ProviderKey } from '../storage/model-config';
import {
  getModelConfig,
  resetModelConfig,
  setModelConfig,
} from '../storage/model-config';
import { getSettings, setSettings } from '../storage/settings';
import { getStyleProfiles, resetStyleProfiles } from '../storage/style-profiles';

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
  red: '#F85149',
  green: '#3FB950',
} as const;

const cardStyle: React.CSSProperties = {
  background: COLORS.surface,
  borderRadius: '12px',
  border: `1px solid ${COLORS.border}`,
  padding: '20px',
  marginBottom: '16px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: COLORS.textSecondary,
  marginBottom: '6px',
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.textPrimary,
  fontFamily: 'inherit',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto',
};

const buttonStyle = (variant: 'primary' | 'secondary' | 'danger'): React.CSSProperties => ({
  padding: '10px 20px',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '13px',
  border: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
  ...(variant === 'primary' && {
    background: COLORS.amber,
    color: '#1A1816',
  }),
  ...(variant === 'secondary' && {
    background: COLORS.surface,
    color: COLORS.textPrimary,
    border: `1px solid ${COLORS.border}`,
  }),
  ...(variant === 'danger' && {
    background: 'transparent',
    color: COLORS.red,
    border: `1px solid ${COLORS.red}`,
  }),
});

// ── Component ──────────────────────────────────────────────────────────────

export function Options() {
  const [provider, setProvider] = useState<ProviderKey>('default');
  const [model, setModel] = useState('gemini-3.1-flash-lite-preview');
  const [apiKey, setApiKey] = useState('');
  const [inlineWidgetEnabled, setInlineWidgetEnabled] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saved, setSaved] = useState(false);

  // Load config on mount
  useEffect(() => {
    getModelConfig().then((config) => {
      setProvider(config.provider);
      setModel(config.model);
      setApiKey(config.apiKey);
    });
    getSettings().then((settings) => {
      setInlineWidgetEnabled(settings.inlineWidgetEnabled);
    });
  }, []);

  // ── Save handler ───────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    try {
      await setModelConfig({ provider, model, apiKey });
      await setSettings({ inlineWidgetEnabled });
      setTestStatus('idle');
      setTestMessage('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setTestStatus('error');
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestMessage(`Save failed: ${errorMsg}`);
    }
  }, [provider, model, apiKey, inlineWidgetEnabled]);

  // ── Provider change ────────────────────────────────────────────────────

  const handleProviderChange = useCallback((newProvider: ProviderKey) => {
    setProvider(newProvider);
    const models = PROVIDER_MODELS[newProvider];
    setModel(models?.[0]?.id ?? '');
    if (newProvider === 'default') {
      setApiKey('');
    }
  }, []);

  // ── Test connection ────────────────────────────────────────────────────

  const handleTestConnection = useCallback(async () => {
    if (provider === 'default') {
      setTestStatus('success');
      setTestMessage('Default proxy is always available.');
      return;
    }

    if (!apiKey.trim()) {
      setTestStatus('error');
      setTestMessage('Please enter an API key first.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Testing connection...');

    try {
      // Build a minimal test prompt
      const testPrompt = 'Say "ok" and nothing else.';

      // Use dynamic import pattern to test with the BYOM API
      const { generateWithProvider } = await import('../shared/byom-api');
      const response = await generateWithProvider(testPrompt, { provider, model, apiKey });

      if (response && response.length > 0) {
        setTestStatus('success');
        setTestMessage(`Connection successful. Response: "${response.slice(0, 50)}"`);
      } else {
        setTestStatus('error');
        setTestMessage('Empty response received.');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestMessage(`Connection failed: ${errorMsg}`);
    }
  }, [provider, model, apiKey]);

  // ── Reset all ──────────────────────────────────────────────────────────

  const handleReset = useCallback(async () => {
    await resetModelConfig();
    await resetStyleProfiles();
    const config = await getModelConfig();
    setProvider(config.provider);
    setModel(config.model);
    setApiKey(config.apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  // ── Export/Import profiles ─────────────────────────────────────────────

  const handleExportProfiles = useCallback(async () => {
    const profiles = await getStyleProfiles();
    const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mdr-style-profiles.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportProfiles = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      try {
        const parsed: unknown = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error('File must contain a JSON array');
        }
        // Validate each profile has required fields
        for (const item of parsed) {
          if (
            typeof item !== 'object' ||
            item === null ||
            typeof (item as Record<string, unknown>)['id'] !== 'string' ||
            typeof (item as Record<string, unknown>)['name'] !== 'string' ||
            typeof (item as Record<string, unknown>)['instructions'] !== 'string' ||
            typeof (item as Record<string, unknown>)['type'] !== 'string'
          ) {
            throw new Error('Each profile must have id, name, instructions, and type fields');
          }
        }
        const { setStyleProfiles } = await import('../storage/style-profiles');
        await setStyleProfiles(parsed);
        setTestStatus('success');
        setTestMessage(`Imported ${parsed.length} profile(s) successfully.`);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err: unknown) {
        setTestStatus('error');
        const errorMsg = err instanceof Error ? err.message : 'Invalid profile file format.';
        setTestMessage(errorMsg);
      }
    };
    input.click();
  }, []);

  // ── Available models for selected provider ────────────────────────────

  const availableModels = PROVIDER_MODELS[provider] ?? [];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        color: COLORS.textPrimary,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '32px',
      }}
    >
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: COLORS.amber,
              margin: 0,
            }}
          >
            MDR Settings
          </h1>
          <p style={{ fontSize: '13px', color: COLORS.textSecondary, marginTop: '4px' }}>
            Configure your AI provider, model, and extension preferences.
          </p>
        </div>

        {/* AI Provider Card */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0' }}>
            AI Provider
          </h2>

          {/* Provider selector */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Provider</label>
            <select
              style={selectStyle}
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderKey)}
            >
              {Object.entries(PROVIDERS).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          {/* Model selector */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Model</label>
            <select
              style={selectStyle}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key (only for non-default providers) */}
          {provider !== 'default' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>API Key</label>
              <input
                style={inputStyle}
                type="password"
                placeholder={`Enter your ${PROVIDERS[provider]?.label} API key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p
                style={{
                  fontSize: '11px',
                  color: COLORS.textMuted,
                  marginTop: '6px',
                  lineHeight: '1.5',
                }}
              >
                Your API key is stored locally in Chrome and never sent to our servers.
                Requests go directly from your browser to the provider.
              </p>
            </div>
          )}

          {/* Test + Save buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button style={buttonStyle('secondary')} onClick={handleTestConnection}>
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            <button style={buttonStyle('primary')} onClick={handleSave}>
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>

          {/* Test status message */}
          {testMessage && (
            <p
              style={{
                fontSize: '12px',
                marginTop: '10px',
                color: testStatus === 'success' ? COLORS.green : testStatus === 'error' ? COLORS.red : COLORS.textSecondary,
              }}
            >
              {testMessage}
            </p>
          )}
        </div>

        {/* Extension Settings Card */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0' }}>
            Extension
          </h2>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            <input
              type="checkbox"
              checked={inlineWidgetEnabled}
              onChange={(e) => setInlineWidgetEnabled(e.target.checked)}
              style={{ accentColor: COLORS.amber, width: '16px', height: '16px' }}
            />
            Show inline "Refine" button on text selection
          </label>
        </div>

        {/* Style Profiles Card */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0' }}>
            Style Profiles
          </h2>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={buttonStyle('secondary')} onClick={handleExportProfiles}>
              Export Profiles
            </button>
            <button style={buttonStyle('secondary')} onClick={handleImportProfiles}>
              Import Profiles
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ ...cardStyle, borderColor: COLORS.red }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0', color: COLORS.red }}>
            Danger Zone
          </h2>
          <p style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '12px' }}>
            Reset all settings and style profiles to defaults. This cannot be undone.
          </p>
          <button style={buttonStyle('danger')} onClick={handleReset}>
            Reset Everything
          </button>
        </div>
      </div>
    </div>
  );
}
