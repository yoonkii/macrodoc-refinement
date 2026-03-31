"use client";

import { Suspense } from "react";
import { PlaygroundContent } from "./playground-content";

export default function PlaygroundPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-dvh text-[var(--text-muted)] text-sm">
          Loading playground...
        </div>
      }
    >
      <PlaygroundContent />
    </Suspense>
  );
}
