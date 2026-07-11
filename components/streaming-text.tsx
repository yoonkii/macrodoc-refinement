"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StreamingCursor } from "@/components/streaming-cursor";

/**
 * Number of trailing words that render as individually-animated "fresh tail"
 * spans. Everything before them collapses into a single static text node so we
 * never mount thousands of spans for a long take.
 */
const FRESH_TAIL_WORDS = 12;

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

interface TailToken {
  /** Global word index from stream start — stable across chunks. */
  wordIndex: number;
  text: string;
  isWord: boolean;
}

interface SplitResult {
  head: string;
  tail: TailToken[];
}

/**
 * Split `text` so that only the last {@link FRESH_TAIL_WORDS} words become
 * individually-keyed tokens. Whitespace is preserved verbatim so `pre-wrap`
 * keeps newlines and spacing intact.
 */
function splitFreshTail(text: string): SplitResult {
  const tokens = text.match(/\s+|\S+/g) ?? [];

  // Count words and find the token index where the fresh tail begins.
  let totalWords = 0;
  for (const token of tokens) {
    if (/\S/.test(token)) totalWords++;
  }

  const freshStartWord = Math.max(0, totalWords - FRESH_TAIL_WORDS);

  let headEnd = 0; // token index where the tail starts
  let wordCounter = 0;
  for (let t = 0; t < tokens.length; t++) {
    if (/\S/.test(tokens[t])) {
      if (wordCounter === freshStartWord) {
        headEnd = t;
        break;
      }
      wordCounter++;
    }
    headEnd = t + 1;
  }

  const head = tokens.slice(0, headEnd).join("");

  const tail: TailToken[] = [];
  let wordIndex = freshStartWord;
  for (let t = headEnd; t < tokens.length; t++) {
    const token = tokens[t];
    const isWord = /\S/.test(token);
    tail.push({ wordIndex: isWord ? wordIndex : -1, text: token, isWord });
    if (isWord) wordIndex++;
  }

  return { head, tail };
}

/**
 * Renders streamed refinement text with a per-word "token bloom": the freshest
 * trailing words fade + glow in once via a one-shot CSS animation, while older
 * text is a single static node for performance. The blinking cursor is appended
 * while `isStreaming`.
 */
export function StreamingText({ text, isStreaming }: StreamingTextProps) {
  const { head, tail } = useMemo(() => splitFreshTail(text), [text]);

  return (
    <p className="font-sans text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap select-text">
      {head}
      {tail.map((token, index) =>
        token.isWord ? (
          // Key by stable global word index so already-shown words never
          // re-trigger their one-shot bloom as new chunks arrive.
          <span key={`w-${token.wordIndex}`} className="token-bloom">
            {token.text}
          </span>
        ) : (
          // Whitespace nodes carry no animation; keying by position is fine.
          <span key={`s-${index}`}>{token.text}</span>
        ),
      )}
      {isStreaming && <StreamingCursor />}
    </p>
  );
}

/**
 * Returns `true` for a brief window right after `isStreaming` flips from true to
 * false, so the parent output container can play a one-shot "take finished"
 * settle (border/box-shadow breathe). Self-clears after the animation window.
 */
export function useTakeFinishedSettle(isStreaming: boolean): boolean {
  const [isSettling, setIsSettling] = useState(false);
  const prevStreamingRef = useRef(isStreaming);

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;

    if (wasStreaming && !isStreaming) {
      setIsSettling(true);
      const timer = setTimeout(() => setIsSettling(false), 450);
      return () => clearTimeout(timer);
    }
  }, [isStreaming]);

  return isSettling;
}
