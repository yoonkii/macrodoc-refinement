"use client";

import { Suspense } from "react";
import { VoiceContent } from "./voice-content";

export default function VoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-dvh text-[var(--text-muted)] text-sm">
          Loading voice studio...
        </div>
      }
    >
      <VoiceContent />
    </Suspense>
  );
}
