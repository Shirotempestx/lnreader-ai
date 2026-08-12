/**
 * aiTranslationService.ts
 *
 * Multi-provider AI translation service with:
 *  - Adapter pattern (one function per provider)
 *  - Automatic fallback loop (tries next provider on 4xx/5xx or network error)
 *  - Strict JSON prompting to prevent markdown in responses
 *  - Per-paragraph HTML-aware translation (preserves <p>, <strong>, etc.)
 *  - Graceful degradation: always returns original text on total failure
 */

import { getAiTranslationSettings, AiProviderId } from '@hooks/persisted';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt helpers
// ─────────────────────────────────────────────────────────────────────────────

const buildSystemPrompt = (targetLanguage: string): string =>
  `You are a professional novel translator specializing in light novels and web novels. ` +
  `Translate the following English text to ${targetLanguage}. ` +
  `You MUST return ONLY a valid JSON object in this exact format: ` +
  `{ "chapter_text": "<translated text here>" }. ` +
  `Do not add markdown code blocks. Do not add any commentary, preamble, or explanation. ` +
  `Preserve the meaning, tone, and any character names exactly as they appear.`;

// ─────────────────────────────────────────────────────────────────────────────
// Response parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the `chapter_text` value from the AI response.
 * Handles both clean JSON and responses with accidental markdown fences.
 */
const parseTranslationResponse = (raw: string): string => {
  // Strip accidental markdown fences (```json ... ```)
  const stripped = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  const parsed = JSON.parse(stripped) as { chapter_text: string };
  if (typeof parsed.chapter_text !== 'string') {
    throw new Error('Missing chapter_text field in AI response');
  }
  return parsed.chapter_text;
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider adapters
// ─────────────────────────────────────────────────────────────────────────────

/** Translate a plain-text paragraph using Google Gemini. */
async function fetchFromGemini(
  text: string,
  apiKey: string,
  targetLanguage: string,
): Promise<string> {
  const model = 'gemini-2.0-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: {
      parts: [{ text: buildSystemPrompt(targetLanguage) }],
    },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw Object.assign(new Error(`Gemini ${res.status}`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return parseTranslationResponse(raw);
}

/** Translate a plain-text paragraph using Mistral AI. */
async function fetchFromMistral(
  text: string,
  apiKey: string,
  targetLanguage: string,
): Promise<string> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      temperature: 0.1,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: buildSystemPrompt(targetLanguage) },
        { role: 'user', content: text },
      ],
    }),
  });

  if (!res.ok) {
    throw Object.assign(new Error(`Mistral ${res.status}`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  return parseTranslationResponse(raw);
}

/** Translate a plain-text paragraph using Groq. */
async function fetchFromGroq(
  text: string,
  apiKey: string,
  targetLanguage: string,
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: buildSystemPrompt(targetLanguage) },
        { role: 'user', content: text },
      ],
    }),
  });

  if (!res.ok) {
    throw Object.assign(new Error(`Groq ${res.status}`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  return parseTranslationResponse(raw);
}

/** Translate a plain-text paragraph using OpenRouter. */
async function fetchFromOpenRouter(
  text: string,
  apiKey: string,
  targetLanguage: string,
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/LNReader/lnreader',
      'X-Title': 'LNReader AI Translation',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-lite-001',
      temperature: 0.1,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: buildSystemPrompt(targetLanguage) },
        { role: 'user', content: text },
      ],
    }),
  });

  if (!res.ok) {
    throw Object.assign(new Error(`OpenRouter ${res.status}`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  return parseTranslationResponse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider dispatch
// ─────────────────────────────────────────────────────────────────────────────

type ProviderFn = (
  text: string,
  apiKey: string,
  targetLanguage: string,
) => Promise<string>;

const PROVIDER_FNS: Record<AiProviderId, ProviderFn> = {
  gemini: fetchFromGemini,
  mistral: fetchFromMistral,
  groq: fetchFromGroq,
  openrouter: fetchFromOpenRouter,
};

/** Status codes that warrant trying the next provider in the chain. */
const RETRYABLE_STATUSES = new Set([429, 401, 403, 500, 502, 503]);

/**
 * Try translating `text` with the provider `id` using the user's stored API
 * key.  Returns `null` if the provider should be skipped (no key, or a
 * retryable HTTP error).  Throws for unexpected errors (network failures, bad
 * JSON, etc.) so the caller can surface them.
 */
async function tryProvider(
  id: AiProviderId,
  text: string,
  apiKeys: Record<AiProviderId, string>,
  targetLanguage: string,
): Promise<string | null> {
  const key = apiKeys[id]?.trim();
  if (!key) {
    return null; // no key configured → skip silently
  }
  try {
    return await PROVIDER_FNS[id](text, key, targetLanguage);
  } catch (e: any) {
    const status = e?.status as number | undefined;
    if (status !== undefined && RETRYABLE_STATUSES.has(status)) {
      return null; // retryable → try next provider
    }
    throw e; // unexpected error → propagate up
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML-aware paragraph extraction & reconstruction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Naive but robust paragraph text extractor.
 * Captures the raw inner HTML of every <p>...</p> block.
 * Returns an array of { openTag, innerHtml, closeTag } tuples.
 */
const P_REGEX = /(<p\b[^>]*>)([\s\S]*?)(<\/p>)/gi;

interface ParagraphSegment {
  openTag: string;
  innerText: string; // HTML-stripped plain text for the AI
  innerHtml: string; // raw inner HTML to fall back to on failure
  closeTag: string;
}

function extractParagraphs(html: string): ParagraphSegment[] {
  const segments: ParagraphSegment[] = [];
  let match: RegExpExecArray | null;
  while ((match = P_REGEX.exec(html)) !== null) {
    const innerHtml = match[2] ?? '';
    // Strip nested tags to give the AI clean text
    const innerText = innerHtml.replace(/<[^>]+>/g, '').trim();
    segments.push({
      openTag: match[1] ?? '<p>',
      innerHtml,
      innerText,
      closeTag: match[3] ?? '</p>',
    });
  }
  return segments;
}

/**
 * Reconstruct the full HTML from the original, replacing each <p> inner content
 * with the supplied translated strings.  If the translated array is shorter
 * than the segments array (can happen on partial failure), falls back to the
 * original inner HTML for the missing positions.
 */
function reinsertParagraphs(
  html: string,
  segments: ParagraphSegment[],
  translations: (string | null)[],
): string {
  let result = html;
  // Iterate in reverse so that character offsets remain valid after each replace
  const matches: RegExpExecArray[] = [];
  const regex = /(<p\b[^>]*>)([\s\S]*?)(<\/p>)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(result)) !== null) {
    matches.push(m);
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const translated = translations[i];
    const replacement = translated ?? segments[i]?.innerHtml ?? '';
    result =
      result.slice(0, match.index + match[1].length) +
      replacement +
      result.slice(match.index + match[1].length + match[2].length);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch translation with fallback loop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translate a single plain-text paragraph using the user's configured
 * provider priority list.  Returns the original text if all providers fail.
 */
async function translateParagraph(
  text: string,
  providerOrder: AiProviderId[],
  apiKeys: Record<AiProviderId, string>,
  targetLanguage: string,
): Promise<string | null> {
  if (!text.trim()) {
    return null; // empty paragraph — no translation needed
  }
  for (const id of providerOrder) {
    try {
      const result = await tryProvider(id, text, apiKeys, targetLanguage);
      if (result !== null) {
        return result;
      }
    } catch {
      // Non-retryable error from this provider; try next
    }
  }
  return null; // all providers exhausted — caller falls back to original
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translate the HTML content of a chapter.
 *
 * Strategy (Option B — per-paragraph):
 *  1. Extract every <p> element's inner text.
 *  2. Batch-translate each paragraph through the fallback provider loop.
 *  3. Re-inject translated text back into the original HTML, preserving all
 *     surrounding markup (images, headings, custom CSS classes, etc.).
 *
 * Always returns valid HTML.  On total failure (no providers configured, all
 * API calls fail) the original `chapterHtml` is returned unchanged.
 *
 * @param chapterHtml  The sanitized chapter HTML from `loadChapterHtml`.
 * @returns            The translated HTML, or the original on failure.
 */
export async function translateChapterHtml(
  chapterHtml: string,
): Promise<string> {
  const settings = getAiTranslationSettings();
  const { providerOrder, apiKeys, targetLanguage } = settings;

  const segments = extractParagraphs(chapterHtml);
  if (segments.length === 0) {
    // No <p> tags found — return as-is (could be a chapter with only headers/images)
    return chapterHtml;
  }

  // Translate paragraphs sequentially to respect rate limits; concurrency
  // during download is controlled at the download-queue level separately.
  const translations: (string | null)[] = [];
  for (const seg of segments) {
    const result = await translateParagraph(
      seg.innerText,
      providerOrder,
      apiKeys,
      targetLanguage,
    );
    translations.push(result);
  }

  // If every paragraph failed to translate, return original unchanged.
  const anyTranslated = translations.some(t => t !== null);
  if (!anyTranslated) {
    return chapterHtml;
  }

  return reinsertParagraphs(chapterHtml, segments, translations);
}
