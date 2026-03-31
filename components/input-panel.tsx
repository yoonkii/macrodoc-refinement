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
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-medium text-[var(--text)]">
          Input Text
        </h2>
        <CharCounter current={charCount} max={MAX_CHARACTERS} />
      </div>

      {/* Textarea container with amber focus border */}
      <div
        className={cn(
          "flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)]",
          "transition-colors duration-150",
          "focus-within:border-[var(--amber)]"
        )}
      >
        <textarea
          ref={textareaRef}
          defaultValue={store.inputText}
          onChange={handleChange}
          placeholder="Type or paste your text here..."
          className={cn(
            "w-full h-full min-h-[200px] resize-none p-3",
            "bg-transparent text-[var(--text)] placeholder:text-[var(--text-muted)]",
            "font-sans text-sm leading-relaxed",
            "outline-none border-none rounded-md"
          )}
        />
      </div>

      {/* Legal disclaimer */}
      <p className="pt-3 pb-3 text-[10px] text-[var(--text-muted)] leading-relaxed">
        Text is processed by Google&apos;s Gemini AI. By using this service, you
        confirm that you are at least 18 years of age. Users under 18 are not
        permitted to use this service.
      </p>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="h-8 text-xs text-[var(--error)] border-[var(--error)]/30 hover:bg-[var(--error-dim)]"
        >
          <X className="size-3.5" data-icon="inline-start" />
          Clear
        </Button>

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

          <button
            type="button"
            onClick={() => store.processNow()}
            disabled={isEmpty}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-1.5 h-8 rounded-full",
              "font-sans text-xs font-medium transition-colors",
              isEmpty
                ? "bg-[var(--amber)]/10 text-[var(--text-muted)] cursor-not-allowed"
                : "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)]"
            )}
          >
            <RefreshCw className="size-3.5" />
            Process Now
          </button>
        </div>
      </div>
    </div>
  );
}
