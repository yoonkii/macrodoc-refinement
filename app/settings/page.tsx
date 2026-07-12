"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
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

/** Rack-channel accent per provider row — the mono craft tag above the label. */
const CHANNEL_LABELS: Record<ProviderKey, string> = {
  default: "DEFAULT (FREE)",
  openai: "OPENAI",
  anthropic: "ANTHROPIC",
  google: "GOOGLE",
  grok: "XAI",
};

function channelTag(key: ProviderKey, index: number): string {
  const number = String(index + 1).padStart(2, "0");
  return `CH ${number} — ${CHANNEL_LABELS[key]}`;
}

// ── Signal-chain theater ────────────────────────────────────────────────────
// Three mono-labelled nodes wired KEY → PROVIDER → STREAM. Their lit/dim/error
// state is driven by the live test lifecycle (see handleTestConnection).

const SIGNAL_NODES = ["KEY", "PROVIDER", "STREAM"] as const;

type NodeState = "dim" | "lit" | "error";

/** A single signal node: an LED dot plus its mono label. */
function SignalNode({ label, state }: { label: string; state: NodeState }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full border transition-[background-color,box-shadow,border-color] duration-150 ease-out motion-reduce:transition-none",
          state === "lit" && "bg-[var(--teal)] border-[var(--teal)]",
          state === "error" &&
            "bg-[var(--error)] border-[var(--error)] signal-node-error-blink",
          state === "dim" && "bg-transparent border-[var(--text-muted)]",
        )}
        style={
          state === "lit"
            ? { boxShadow: "0 0 6px var(--teal)" }
            : state === "error"
              ? { boxShadow: "0 0 6px var(--error)" }
              : undefined
        }
      />
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-150",
          state === "lit" && "text-[var(--teal)]",
          state === "error" && "text-[var(--error)]",
          state === "dim" && "text-[var(--text-muted)]",
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** The 1px connector between two nodes; its teal fill scales in from the left
 *  (transform-origin left, 200ms ease-out) as the signal advances. */
function SignalSegment({ filled }: { filled: boolean }) {
  return (
    <div className="relative h-px w-6 shrink-0 overflow-hidden bg-[var(--border)]">
      <div
        className={cn(
          "absolute inset-0 origin-left bg-[var(--teal)] transition-transform duration-200 ease-out motion-reduce:transition-none",
          filled ? "scale-x-100" : "scale-x-0",
        )}
        style={filled ? { boxShadow: "0 0 4px var(--teal)" } : undefined}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { config, setProvider, setModel, setApiKey, reset } =
    useModelConfigStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");

  // Signal-chain state. `signalStage` = count of nodes that have confirmed
  // (0..3); `failedNode` freezes the chain at the node where the signal died;
  // `chainSettle` fires the one-shot success glow.
  const [signalStage, setSignalStage] = useState(0);
  const [failedNode, setFailedNode] = useState<number | null>(null);
  const [chainSettle, setChainSettle] = useState(false);

  // Mirror of signalStage read synchronously inside async error handling to
  // decide which node failed (state updates are async and would lag).
  const stageRef = useRef(0);
  // Timers that stage PROVIDER / default-proxy nodes; cleared on any reset.
  const stageTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const setStage = useCallback((next: number) => {
    stageRef.current = next;
    setSignalStage(next);
  }, []);

  const clearStageTimers = useCallback(() => {
    for (const timer of stageTimersRef.current) clearTimeout(timer);
    stageTimersRef.current = [];
  }, []);

  const resetChain = useCallback(() => {
    clearStageTimers();
    setFailedNode(null);
    setChainSettle(false);
    setStage(0);
  }, [clearStageTimers, setStage]);

  // Clear pending stage timers if the page unmounts mid-test.
  useEffect(() => clearStageTimers, [clearStageTimers]);

  const handleProviderChange = useCallback(
    (provider: ProviderKey) => {
      setProvider(provider);
      setTestStatus("idle");
      setTestMessage("");
      resetChain();
    },
    [setProvider, resetChain],
  );

  const handleTestConnection = useCallback(async () => {
    resetChain();

    // Default proxy needs no key and is always available — stage the chain on
    // timers so it still reads as signal flow, then confirm.
    if (config.provider === "default") {
      setTestStatus("testing");
      setTestMessage("");
      setStage(1); // KEY — nothing to validate, passes immediately
      stageTimersRef.current.push(setTimeout(() => setStage(2), 250));
      stageTimersRef.current.push(
        setTimeout(() => {
          setStage(3);
          setChainSettle(true);
          setTestStatus("success");
          setTestMessage("Default proxy is always available.");
        }, 500),
      );
      return;
    }

    // KEY is validated locally — a missing key fails at the first node.
    if (!config.apiKey.trim()) {
      setStage(0);
      setFailedNode(0);
      setTestStatus("error");
      setTestMessage("Please enter an API key first.");
      return;
    }

    // KEY passes locally → lights immediately.
    setStage(1);
    setTestStatus("testing");
    setTestMessage("");

    // PROVIDER lights once the request is plausibly in flight (~250ms). STREAM
    // is only lit below, by real streamed bytes.
    stageTimersRef.current.push(
      setTimeout(() => {
        if (stageRef.current < 2) setStage(2);
      }, 250),
    );

    const succeed = () => {
      clearStageTimers();
      setFailedNode(null);
      setStage(3);
      setChainSettle(true);
      setTestStatus("success");
      setTestMessage("Connection successful! Your API key is valid.");
    };

    const abortController = new AbortController();
    // Timeout after 15 seconds
    const timeout = setTimeout(() => abortController.abort(), 15_000);

    let gotBytes = false;
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
          gotBytes = true;
          abortController.abort();
          break;
        }
      }
      // Either broke early with bytes, or the stream ended cleanly.
      if (gotBytes || receivedText.length > 0) {
        succeed();
      } else {
        // Connected but produced nothing — treat the empty stream as a STREAM
        // node failure rather than a false success.
        clearStageTimers();
        setFailedNode(2);
        setStage(2);
        setTestStatus("error");
        setTestMessage("Connected, but the model returned no output.");
      }
    } catch (error: unknown) {
      // An abort AFTER we captured bytes is our own early stop — that's success.
      if (
        error instanceof DOMException &&
        error.name === "AbortError" &&
        gotBytes
      ) {
        succeed();
        return;
      }
      clearStageTimers();
      // Freeze at the node that never confirmed: if only KEY is lit the
      // provider handshake failed (node 1); if PROVIDER lit too, the stream
      // failed (node 2).
      const failIndex = Math.min(Math.max(stageRef.current, 1), 2);
      setFailedNode(failIndex);
      setStage(failIndex);
      const message =
        error instanceof Error ? error.message : "Connection failed";
      setTestStatus("error");
      setTestMessage(message);
    } finally {
      clearTimeout(timeout);
    }
  }, [config, resetChain, setStage, clearStageTimers]);

  const handleReset = useCallback(() => {
    reset();
    setTestStatus("idle");
    setTestMessage("");
    setShowApiKey(false);
    resetChain();
  }, [reset, resetChain]);

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
        <div className="rounded-lg border border-[var(--teal)]/30 bg-[var(--teal-dim)] px-5 py-4">
          <div className="flex items-start gap-3">
            <Shield className="size-5 text-[var(--teal)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--teal)] mb-1">
                We never store your API keys.
              </h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Your API key is saved in your browser&apos;s local storage only and is never transmitted to our servers.
                When using your own model, all API calls go directly from your browser to the AI provider (OpenAI, Anthropic, Google, or xAI).
                We don&apos;t store your keys or your prompts. We do collect anonymous usage and error diagnostics to help keep the app reliable.
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
            {config.provider === "default" ? (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Free tier (15 requests/minute shared limit)
              </p>
            ) : !config.apiKey.trim() ? (
              <p className="text-xs text-[var(--error)] mt-1">
                ⚠ API key not set — using free tier (Default) until you add a key below
              </p>
            ) : (
              <p className="text-xs text-[var(--teal)] mt-1">
                ✓ API key configured — using your own key
              </p>
            )}
          </div>
        </GlassCard>

        {/* Provider selection — a rack of signal channels */}
        <GlassCard>
          <div className="px-5 py-4 space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--amber)]">
              AI Provider
            </h2>

            <div className="grid gap-2" role="radiogroup" aria-label="AI Provider">
              {PROVIDER_KEYS.map((providerKey, index) => {
                const meta = PROVIDERS[providerKey];
                if (!meta) return null;
                const isSelected = config.provider === providerKey;
                const isDefault = providerKey === "default";
                // LED is lit only when this channel is selected AND active: the
                // free default (amber) or a provider with a key entered (teal).
                const ledLit =
                  isSelected && (isDefault || config.apiKey.trim().length > 0);
                const ledColor = isDefault ? "var(--amber)" : "var(--teal)";

                return (
                  <label
                    key={providerKey}
                    className="block cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="ai-provider"
                      value={providerKey}
                      checked={isSelected}
                      onChange={() => handleProviderChange(providerKey)}
                      className="peer sr-only"
                    />
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-150 ease-out",
                        isSelected
                          ? "border-[var(--amber)]/40 bg-[var(--amber-dim)]"
                          : "border-[var(--border)] bg-transparent hover:border-[var(--text-muted)] hover:bg-[var(--hover)]",
                        "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--amber)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--bg)]",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                          {channelTag(providerKey, index)}
                        </span>
                        <p className="text-sm font-medium text-[var(--text)] mt-0.5">
                          {meta.label}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {meta.description}
                        </p>
                      </div>
                      {/* LED status dot — steady when the channel is live. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2.5 rounded-full border shrink-0 transition-[background-color,box-shadow,border-color] duration-150 ease-out motion-reduce:transition-none",
                          ledLit
                            ? "border-transparent"
                            : "bg-transparent border-[var(--text-muted)]",
                        )}
                        style={
                          ledLit
                            ? {
                                backgroundColor: ledColor,
                                boxShadow: `0 0 6px ${ledColor}`,
                              }
                            : undefined
                        }
                      />
                    </div>
                  </label>
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

              {/* Custom model override — providers ship new models faster than
                  our static list. A non-empty value overrides the dropdown via
                  setModel; when it matches a listed id the dropdown stays in
                  sync automatically (both read config.model). */}
              {requiresApiKey && (
                <div className="space-y-2 pt-1">
                  <label
                    htmlFor="custom-model-id"
                    className="block font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]"
                  >
                    Custom model ID
                  </label>
                  <input
                    id="custom-model-id"
                    type="text"
                    value={config.model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="gpt-5.2-mini"
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm font-mono",
                      "bg-[var(--bg)] border border-[var(--border)]",
                      "text-[var(--text)] placeholder:text-[var(--text-muted)]",
                      "focus:outline-none focus:border-[var(--amber)]",
                      "transition-colors",
                    )}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    The dropdown can lag behind new provider releases. Enter an
                    exact model ID to use one that isn&apos;t listed yet.
                  </p>
                </div>
              )}
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
                    resetChain();
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
              </div>

              {/* Signal chain — KEY → PROVIDER → STREAM. Always visible; nodes
                  light as the test advances and freeze on failure. */}
              <div
                className={cn(
                  "rounded-lg",
                  chainSettle && "signal-chain-settle",
                )}
                onAnimationEnd={() => setChainSettle(false)}
              >
                <div
                  className="flex items-center gap-2 py-1"
                  role="status"
                  aria-live="polite"
                >
                  {SIGNAL_NODES.map((label, i) => {
                    const state: NodeState =
                      failedNode === i
                        ? "error"
                        : i < signalStage
                          ? "lit"
                          : "dim";
                    return (
                      <Fragment key={label}>
                        {i > 0 && (
                          <SignalSegment filled={signalStage >= i + 1} />
                        )}
                        <SignalNode label={label} state={state} />
                      </Fragment>
                    );
                  })}
                </div>
                {testStatus === "error" && (
                  <p className="mt-2 text-xs text-[var(--error)]">
                    {testMessage}
                  </p>
                )}
                {testStatus === "success" && (
                  <p className="mt-2 text-xs text-[var(--teal)]">
                    {testMessage}
                  </p>
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
              The free tier uses our shared Gemini Flash Lite instance. Signing
              in with Google lifts your limit:
            </p>
            <ul className="text-sm text-[var(--text)] space-y-1">
              <li className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] shrink-0">
                  Signed out
                </span>
                <span>15 requests/min</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--amber)] shrink-0">
                  Signed in with Google
                </span>
                <span>40 requests/min</span>
              </li>
            </ul>
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
