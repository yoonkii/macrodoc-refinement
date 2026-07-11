// ---------------------------------------------------------------------------
// API layer — communicates with the Gemini Cloud Run proxy.
// Ported from Flutter: services/gemini_service_cloud_run.dart
// ---------------------------------------------------------------------------

import { MODEL_NAME, PROXY_URL } from './constants';

// ── Streaming inactivity watchdog ───────────────────────────────────────────

/** Abort a stream if no chunk (including the first byte) arrives within this window. */
const STREAM_INACTIVITY_TIMEOUT_MS = 30_000;

/** User-facing message surfaced when the watchdog trips. */
const STREAM_TIMEOUT_MESSAGE = 'Connection timed out — try again';

/**
 * Race a single `reader.read()` against an inactivity timeout. If no chunk
 * arrives before `timeoutMs`, reject with a friendly timeout error so a stalled
 * connection surfaces instead of hanging the spinner forever.
 */
async function readWithTimeout<T>(
  reader: ReadableStreamDefaultReader<T>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(STREAM_TIMEOUT_MESSAGE)), timeoutMs);
  });
  try {
    return await Promise.race([reader.read(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ── Streaming refinement ────────────────────────────────────────────────────

/**
 * Stream refined text from the proxy's SSE endpoint.
 *
 * Uses native `fetch` + `ReadableStream` (NOT EventSource) because the proxy
 * requires a POST body. Each yielded string is a text chunk to be appended to
 * the output buffer.
 *
 * @throws {Error} On network failures, non-200 status, or server-reported errors.
 */
export async function* streamRefine(
  prompt: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(`${PROXY_URL}/api/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model: MODEL_NAME }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Stream request failed (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await readWithTimeout(reader, STREAM_INACTIVITY_TIMEOUT_MS);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        if (data.length === 0) continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data) as Record<string, unknown>;
        } catch {
          // Skip malformed JSON chunks silently
          continue;
        }

        if (typeof parsed['error'] === 'string') {
          throw new Error(parsed['error']);
        }
        if (typeof parsed['text'] === 'string') {
          yield parsed['text'];
        }
      }
    }

    // Process any remaining data left in the buffer after the stream ends
    if (buffer.length > 0) {
      const remainingLines = buffer.split('\n');
      for (const line of remainingLines) {
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6).trim();
        if (data === '[DONE]' || data.length === 0) continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          if (typeof parsed['text'] === 'string') {
            yield parsed['text'];
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    // On a watchdog timeout the read() promise is still outstanding, so cancel
    // before releasing the lock (releaseLock throws while a read is pending).
    await reader.cancel().catch(() => {});
    try {
      reader.releaseLock();
    } catch {
      // Reader was already released — safe to ignore.
    }
  }
}

// ── Batch generation (non-streaming) ────────────────────────────────────────

/**
 * Generate refined text in a single request (non-streaming).
 *
 * @throws {Error} On network failures or non-200 status.
 */
export async function generateBatch(prompt: string): Promise<string> {
  const response = await fetch(`${PROXY_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model: MODEL_NAME }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: 'Unknown error',
    })) as Record<string, unknown>;
    throw new Error(
      `Generate failed: ${errorBody['error'] ?? response.statusText}`,
    );
  }

  const json = (await response.json()) as Record<string, unknown>;
  const text = json['text'];
  if (typeof text !== 'string') {
    throw new Error('Empty response received from generate endpoint');
  }
  return text;
}

// ── Multi-post generation ───────────────────────────────────────────────────

export interface MultiPostResult {
  linkedin: string;
  x: string;
  instagram: string;
  substack: string;
}

/**
 * Generate all 4 platform-optimized versions in a single API call.
 *
 * @throws {Error} On network failures or non-200 status.
 */
export async function generateMultiPost(
  prompt: string,
  signal?: AbortSignal,
): Promise<MultiPostResult> {
  const response = await fetch(`${PROXY_URL}/api/multi-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model: MODEL_NAME }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: 'Unknown error',
    })) as Record<string, unknown>;
    throw new Error(
      `Multi-post failed: ${errorBody['error'] ?? response.statusText}`,
    );
  }

  const json = (await response.json()) as Record<string, unknown>;
  return {
    linkedin: typeof json['linkedin'] === 'string' ? json['linkedin'] : '',
    x: typeof json['x'] === 'string' ? json['x'] : '',
    instagram: typeof json['instagram'] === 'string' ? json['instagram'] : '',
    substack: typeof json['substack'] === 'string' ? json['substack'] : '',
  };
}
