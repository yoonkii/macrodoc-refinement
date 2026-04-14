// ---------------------------------------------------------------------------
// BYOM (Bring Your Own Model) — direct browser-to-provider streaming API.
//
// When a user provides their own API key, requests go directly from the
// browser to the AI provider. No data passes through our servers.
// ---------------------------------------------------------------------------

import type { ModelConfig } from './stores/model-config';

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Stream text tokens from the configured AI provider.
 *
 * Routes to the correct provider-specific implementation based on
 * `config.provider`. Yields individual text chunks as they arrive.
 *
 * @throws {Error} On network failures, auth errors, or unexpected responses.
 */
export async function* streamWithProvider(
  prompt: string,
  config: ModelConfig,
  signal: AbortSignal,
): AsyncGenerator<string> {
  switch (config.provider) {
    case 'openai':
    case 'grok':
      yield* streamOpenAICompatible(prompt, config, signal);
      break;
    case 'anthropic':
      yield* streamAnthropic(prompt, config, signal);
      break;
    case 'google':
      yield* streamGoogle(prompt, config, signal);
      break;
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Generate text in a single request (non-streaming).
 * Used by multi-post where we need the complete response at once.
 *
 * @throws {Error} On network failures, auth errors, or unexpected responses.
 */
export async function generateWithProvider(
  prompt: string,
  config: ModelConfig,
  signal?: AbortSignal,
): Promise<string> {
  switch (config.provider) {
    case 'openai':
    case 'grok':
      return generateOpenAICompatible(prompt, config, signal);
    case 'anthropic':
      return generateAnthropic(prompt, config, signal);
    case 'google':
      return generateGoogle(prompt, config, signal);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// ── OpenAI / Grok (same API format) ────────────────────────────────────────

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const GROK_BASE_URL = 'https://api.x.ai/v1';

function getOpenAIBaseUrl(provider: string): string {
  return provider === 'grok' ? GROK_BASE_URL : OPENAI_BASE_URL;
}

async function* streamOpenAICompatible(
  prompt: string,
  config: ModelConfig,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const baseUrl = getOpenAIBaseUrl(config.provider);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`${config.provider} API error (${response.status}): ${errorText}`);
  }

  yield* parseSSEStream(response, (json: Record<string, unknown>) => {
    const choices = json['choices'] as Array<Record<string, unknown>> | undefined;
    if (!choices || choices.length === 0) return undefined;
    const delta = choices[0]['delta'] as Record<string, unknown> | undefined;
    return typeof delta?.['content'] === 'string' ? delta['content'] as string : undefined;
  });
}

async function generateOpenAICompatible(
  prompt: string,
  config: ModelConfig,
  signal?: AbortSignal,
): Promise<string> {
  const baseUrl = getOpenAIBaseUrl(config.provider);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`${config.provider} API error (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const choices = json['choices'] as Array<Record<string, unknown>> | undefined;
  if (!choices || choices.length === 0) {
    throw new Error('Empty response from API');
  }
  const message = choices[0]['message'] as Record<string, unknown> | undefined;
  const content = message?.['content'];
  if (typeof content !== 'string') {
    throw new Error('No content in API response');
  }
  return content;
}

// ── Anthropic ──────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MAX_TOKENS = 4096;

async function* streamAnthropic(
  prompt: string,
  config: ModelConfig,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  yield* parseSSEStream(response, (json: Record<string, unknown>) => {
    if (json['type'] !== 'content_block_delta') return undefined;
    const delta = json['delta'] as Record<string, unknown> | undefined;
    return typeof delta?.['text'] === 'string' ? delta['text'] as string : undefined;
  });
}

async function generateAnthropic(
  prompt: string,
  config: ModelConfig,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const content = json['content'] as Array<Record<string, unknown>> | undefined;
  if (!content || content.length === 0) {
    throw new Error('Empty response from Anthropic API');
  }
  const textBlock = content.find((block) => block['type'] === 'text');
  if (!textBlock || typeof textBlock['text'] !== 'string') {
    throw new Error('No text content in Anthropic response');
  }
  return textBlock['text'] as string;
}

// ── Google Gemini (direct) ─────────────────────────────────────────────────

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_TEMPERATURE = 0.7;
const GEMINI_MAX_OUTPUT_TOKENS = 4096;

async function* streamGoogle(
  prompt: string,
  config: ModelConfig,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const url = `${GEMINI_API_BASE}/${config.model}:streamGenerateContent?alt=sse`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: GEMINI_TEMPERATURE,
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Google Gemini API error (${response.status}): ${errorText}`);
  }

  yield* parseSSEStream(response, (json: Record<string, unknown>) => {
    const candidates = json['candidates'] as Array<Record<string, unknown>> | undefined;
    if (!candidates || candidates.length === 0) return undefined;
    const content = candidates[0]['content'] as Record<string, unknown> | undefined;
    const parts = content?.['parts'] as Array<Record<string, unknown>> | undefined;
    if (!parts || parts.length === 0) return undefined;
    return typeof parts[0]['text'] === 'string' ? parts[0]['text'] as string : undefined;
  });
}

async function generateGoogle(
  prompt: string,
  config: ModelConfig,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${config.model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: GEMINI_TEMPERATURE,
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Google Gemini API error (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const candidates = json['candidates'] as Array<Record<string, unknown>> | undefined;
  if (!candidates || candidates.length === 0) {
    throw new Error('Empty response from Google Gemini API');
  }
  const content = candidates[0]['content'] as Record<string, unknown> | undefined;
  const parts = content?.['parts'] as Array<Record<string, unknown>> | undefined;
  if (!parts || parts.length === 0 || typeof parts[0]['text'] !== 'string') {
    throw new Error('No text content in Google Gemini response');
  }
  return parts[0]['text'] as string;
}

// ── Shared SSE parser ──────────────────────────────────────────────────────

/**
 * Generic SSE stream parser. Reads the response body as SSE events,
 * parses JSON from each `data:` line, and yields the text extracted
 * by the provided `extractText` function.
 */
async function* parseSSEStream(
  response: Response,
  extractText: (json: Record<string, unknown>) => string | undefined,
): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
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
          // Skip malformed JSON chunks
          continue;
        }

        const text = extractText(parsed);
        if (text) yield text;
      }
    }

    // Process any remaining data in the buffer
    if (buffer.length > 0) {
      const remainingLines = buffer.split('\n');
      for (const line of remainingLines) {
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6).trim();
        if (data === '[DONE]' || data.length === 0) continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          const text = extractText(parsed);
          if (text) yield text;
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
