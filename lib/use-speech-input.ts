"use client";

// ---------------------------------------------------------------------------
// Voice input hook — thin wrapper over the browser Web Speech API.
//
// The Web Speech API is unevenly implemented (Chrome/Edge ship it under the
// `webkitSpeechRecognition` prefix; Firefox ships nothing). We feature-detect
// and expose `isSupported` so callers can hide the mic entirely rather than
// render a dead button. Types are declared locally to avoid a @types dependency
// for an API that isn't in the standard DOM lib.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

// ── Minimal Web Speech API typings ─────────────────────────────────────────

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechCapableWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechCapableWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

// ── Public shape ────────────────────────────────────────────────────────────

export interface UseSpeechInputOptions {
  /** Invoked with each finalized (trimmed, non-empty) transcript segment. */
  onFinalTranscript: (text: string) => void;
}

export interface UseSpeechInput {
  /** False when the browser lacks the Web Speech API (e.g. Firefox). */
  isSupported: boolean;
  isRecording: boolean;
  /** Live, not-yet-finalized text. Cleared on stop and between utterances. */
  interimTranscript: string;
  /** True after a `not-allowed` error until the next `start()`. */
  permissionDenied: boolean;
  start: () => void;
  stop: () => void;
}

export function useSpeechInput({
  onFinalTranscript,
}: UseSpeechInputOptions): UseSpeechInput {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Tracks user intent. Chrome fires `onend` after a silence window even mid-
  // dictation; while this is true we transparently restart so recording feels
  // continuous. An explicit stop()/error/unmount sets it false.
  const wantRecordingRef = useRef(false);
  // Hold the latest callback without re-binding recognition handlers.
  const onFinalRef = useRef(onFinalTranscript);
  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  // Feature-detect on mount (client only — SSR has no window).
  useEffect(() => {
    setIsSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const start = useCallback(() => {
    const RecognitionCtor = getSpeechRecognitionCtor();
    // Guard: unsupported, or an instance is already live.
    if (!RecognitionCtor || recognitionRef.current) return;

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      (typeof navigator !== "undefined" && navigator.language) || "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const finalized = transcript.trim();
          if (finalized.length > 0) onFinalRef.current(finalized);
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      setInterimTranscript("");
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setPermissionDenied(true);
        wantRecordingRef.current = false;
        setIsRecording(false);
      } else if (event.error === "no-speech" || event.error === "aborted") {
        // Transient — `onend` decides whether to restart or clean up.
      } else {
        // Any other error (network, audio-capture): stop gracefully.
        wantRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      setInterimTranscript("");
      // Silence auto-stop mid-dictation: restart the SAME instance so the user
      // sees uninterrupted recording. Only when they haven't pressed stop.
      if (wantRecordingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          return;
        } catch {
          // start() throws if it can't resume — fall through to cleanup.
        }
      }
      recognitionRef.current = null;
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    wantRecordingRef.current = true;
    setPermissionDenied(false);
    setInterimTranscript("");

    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      // Defensive reset — start() throws if called while already started.
      recognitionRef.current = null;
      wantRecordingRef.current = false;
      setIsRecording(false);
    }
  }, []);

  const stop = useCallback(() => {
    wantRecordingRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Already stopped — ignore.
      }
    }
    setIsRecording(false);
    setInterimTranscript("");
  }, []);

  // Unmount cleanup — detach handlers and abort any live session so no callback
  // fires after the component is gone.
  useEffect(() => {
    return () => {
      wantRecordingRef.current = false;
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.onstart = null;
        try {
          recognition.abort();
        } catch {
          // Ignore — best-effort teardown.
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isSupported, isRecording, interimTranscript, permissionDenied, start, stop };
}
