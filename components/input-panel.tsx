"use client";

import { useEffect, useRef } from "react";
import { X, ClipboardPaste, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTextRefineStore } from "@/lib/stores/text-refine";
import { MAX_CHARACTERS } from "@/lib/constants";
import { CharCounter } from "@/components/char-counter";
import { Button } from "@/components/ui/button";

export function InputPanel() {
  const store = useTextRefineStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync textarea value when store.inputText changes externally (e.g. acceptRefinement)
  useEffect(() => {
    const el = textareaRef.current;
    if (el && el.value !== store.inputText) {
      el.value = store.inputText;
    }
  }, [store.inputText]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    store.setInputText(e.target.value);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        store.setInputText(text);
        if (textareaRef.current) {
          textareaRef.current.value = text;
        }
      }
    } catch {
      // Clipboard API may be denied; silently fail
    }
  }

  function handleClear() {
    store.setInputText("");
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.focus();
    }
  }

  const charCount = store.inputText.length;
  const isEmpty = charCount === 0;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header — matches output panel tab bar height */}
      <div className="shrink-0 flex items-center px-5 py-3 border-b border-[var(--border)]">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim,var(--text-muted))]">
          Input Text
        </h2>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 flex flex-col p-5 pt-3">
        {/* Textarea container with char counter inside */}
        <div
          className={cn(
            "flex-1 min-h-0 rounded-md border border-[var(--border)] bg-[var(--bg)] relative",
            "transition-all duration-150",
            "focus-within:border-[var(--amber)] focus-within:shadow-[0_0_0_2px_rgba(232,168,56,0.15)]"
          )}
        >
          <textarea
            ref={textareaRef}
            defaultValue={store.inputText}
            onChange={handleChange}
            placeholder="Type or paste your text here..."
            className={cn(
              "w-full h-full resize-none p-3 pb-7",
              "bg-transparent text-[var(--text)] placeholder:text-[var(--text-muted)]",
              "font-sans text-sm leading-relaxed",
              "outline-none border-none rounded-md"
            )}
          />
          {/* Char counter inside textarea, bottom-right */}
          <span className="absolute bottom-2 right-3 font-mono text-[10px] text-[var(--text-muted)] opacity-50 pointer-events-none">
            {charCount} / {MAX_CHARACTERS}
          </span>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center justify-between pt-3">
          <button
            type="button"
            onClick={() => store.processNow()}
            disabled={isEmpty}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-1.5 h-8 rounded-full",
              "font-sans text-xs font-medium transition-all",
              isEmpty
                ? "bg-[var(--amber)]/10 text-[var(--text-muted)] cursor-not-allowed"
                : "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)] shadow-[0_0_12px_var(--amber-dim)]"
            )}
          >
            <RefreshCw className="size-3.5" />
            Process Now
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              className="h-8 text-xs text-[var(--amber)] border-[var(--amber)]/30 hover:bg-[var(--amber-dim)]"
            >
              <ClipboardPaste className="size-3.5" data-icon="inline-start" />
              Paste
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-8 text-xs text-[var(--error)] border-[var(--error)]/30 hover:bg-[var(--error-dim)]"
            >
              <X className="size-3.5" data-icon="inline-start" />
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
