"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Shield,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass-card";
import {
  useModelConfigStore,
  type ProviderKey,
} from "@/lib/stores/model-config";
import { PROVIDERS, PROVIDER_MODELS } from "@/lib/constants";
import { streamWithProvider } from "@/lib/byom-api";

type TestStatus = "idle" | "testing" | "success" | "error";

const PROVIDER_KEYS: ProviderKey[] = [
  "default",
  "openai",
  "anthropic",
  "google",
  "grok",
];

export default function SettingsPage() {
  const { config, setProvider, setModel, setApiKey, reset } =
    useModelConfigStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");

  const handleProviderChange = useCallback(
    (provider: ProviderKey) => {
      setProvider(provider);
      setTestStatus("idle");
      setTestMessage("");
    },
    [setProvider],
  );

  const handleTestConnection = useCallback(async () => {
    if (config.provider === "default") {
      setTestStatus("success");
      setTestMessage("Default proxy is always available.");
      return;
    }

    if (!config.apiKey.trim()) {
      setTestStatus("error");
      setTestMessage("Please enter an API key first.");
      return;
    }

    setTestStatus("testing");
    setTestMessage("");

    const abortController = new AbortController();
    // Timeout after 15 seconds
    const timeout = setTimeout(() => abortController.abort(), 15_000);

    try {
      let receivedText = "";
      for await (const chunk of streamWithProvider(
        "Say hello in exactly 3 words.",
        config,
        abortController.signal,
      )) {
        receivedText += chunk;
        // Stop early once we have enough to confirm it works
        if (receivedText.length > 10) {
          abortController.abort();
          break;
        }
      }
      setTestStatus("success");
      setTestMessage("Connection successful! Your API key is valid.");
    } catch (error: unknown) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError" &&
        testStatus === "testing"
      ) {
        // If we aborted because we already received text, that counts as success
        setTestStatus("success");
        setTestMessage("Connection successful! Your API key is valid.");
        return;
      }
      const message =
        error instanceof Error ? error.message : "Connection failed";
      setTestStatus("error");
      setTestMessage(message);
    } finally {
      clearTimeout(timeout);
    }
  }, [config, testStatus]);

  const handleReset = useCallback(() => {
    reset();
    setTestStatus("idle");
    setTestMessage("");
    setShowApiKey(false);
  }, [reset]);

  const currentProviderLabel =
    PROVIDERS[config.provider]?.label ?? "Unknown";
  const currentModelLabel =
    PROVIDER_MODELS[config.provider]?.find((m) => m.id === config.model)
      ?.label ?? config.model;
  const availableModels = PROVIDER_MODELS[config.provider] ?? [];
  const requiresApiKey = config.provider !== "default";

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg)]/80 border-b border-[var(--border)]">
        <div className="flex items-center h-14 px-5 max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <div className="flex-1" />
          <h1 className="font-display text-lg font-bold text-[var(--text)]">
            Settings
          </h1>
          <div className="flex-1" />
          <div className="w-14" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        {/* Security notice — TOP, prominent */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <Shield className="size-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-emerald-400 mb-1">
                We never store your API keys.
              </h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Your API key is saved in your browser&apos;s local storage only and is never transmitted to our servers.
                When using your own model, all API calls go directly from your browser to the AI provider (OpenAI, Anthropic, Google, or xAI).
                We have no access to your keys, your prompts, or your usage data.
              </p>
            </div>
          </div>
        </div>

        {/* Current model indicator */}
        <GlassCard>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="size-4 text-[var(--amber)]" />
              <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                Currently using
              </span>
            </div>
            <p className="text-base font-semibold text-[var(--text)]">
              {currentProviderLabel} &mdash; {currentModelLabel}
            </p>
            {config.provider === "default" && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Free tier (30 requests/minute shared limit)
              </p>
            )}
          </div>
        </GlassCard>

        {/* Provider selection */}
        <GlassCard>
          <div className="px-5 py-4 space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--amber)]">
              AI Provider
            </h2>

            <div className="grid gap-2">
              {PROVIDER_KEYS.map((providerKey) => {
                const meta = PROVIDERS[providerKey];
                if (!meta) return null;
                const isSelected = config.provider === providerKey;

                return (
                  <button
                    key={providerKey}
                    type="button"
                    onClick={() => handleProviderChange(providerKey)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border transition-all",
                      isSelected
                        ? "border-[var(--amber)] bg-[var(--amber-dim)]"
                        : "border-[var(--border)] hover:border-[var(--text-muted)] bg-transparent",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "size-3 rounded-full border-2 flex-shrink-0 transition-colors",
                          isSelected
                            ? "border-[var(--amber)] bg-[var(--amber)]"
                            : "border-[var(--text-muted)] bg-transparent",
                        )}
                      />
                      <div>
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isSelected
                              ? "text-[var(--text)]"
                              : "text-[var(--text)]",
                          )}
                        >
                          {meta.label}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {meta.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </GlassCard>

        {/* Model selection */}
        {availableModels.length > 1 && (
          <GlassCard>
            <div className="px-5 py-4 space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--amber)]">
                Model
              </h2>
              <select
                value={config.model}
                onChange={(e) => setModel(e.target.value)}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-sm",
                  "bg-[var(--bg)] border border-[var(--border)]",
                  "text-[var(--text)]",
                  "focus:outline-none focus:border-[var(--amber)]",
                  "transition-colors",
                )}
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          </GlassCard>
        )}

        {/* API Key input */}
        {requiresApiKey && (
          <GlassCard>
            <div className="px-5 py-4 space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--amber)]">
                API Key
              </h2>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestStatus("idle");
                    setTestMessage("");
                  }}
                  placeholder={`Enter your ${PROVIDERS[config.provider]?.label ?? ""} API key`}
                  className={cn(
                    "w-full px-3 py-2.5 pr-10 rounded-lg text-sm font-mono",
                    "bg-[var(--bg)] border border-[var(--border)]",
                    "text-[var(--text)] placeholder:text-[var(--text-muted)]",
                    "focus:outline-none focus:border-[var(--amber)]",
                    "transition-colors",
                  )}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>

              {/* Test connection */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === "testing"}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors",
                    testStatus === "testing"
                      ? "bg-[var(--amber-dim)] text-[var(--text-muted)] cursor-not-allowed"
                      : "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)]",
                  )}
                >
                  {testStatus === "testing" ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </button>

                {testStatus === "success" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                    <CheckCircle2 className="size-3.5" />
                    {testMessage}
                  </span>
                )}
                {testStatus === "error" && (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--error)]">
                    <XCircle className="size-3.5" />
                    {testMessage}
                  </span>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        {/* Reset button */}
        {config.provider !== "default" && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--error)] hover:text-[var(--error)] transition-colors"
          >
            <RotateCcw className="size-3.5" />
            Reset to Default (Free Tier)
          </button>
        )}

        {/* Rate limit notice */}
        <GlassCard>
          <div className="px-5 py-4 space-y-2">
            <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Rate Limits
            </h2>
            <p className="text-sm text-[var(--text)]">
              The free tier uses our shared Gemini Flash Lite instance (30
              requests/minute).
            </p>
            <p className="text-sm text-[var(--text)]">
              Add your own API key for unlimited usage with your preferred
              model.
            </p>
          </div>
        </GlassCard>
      </main>
    </div>
  );
}
