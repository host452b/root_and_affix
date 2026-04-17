import type { WordEntry } from '../core/types.js';

export interface LLMConfig {
  enabled: boolean;
  endpoint: string;     // e.g., 'http://localhost:11434' for Ollama
  model: string;        // e.g., 'llama3' or 'qwen2'
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  enabled: false,
  endpoint: 'http://localhost:11434',
  model: 'qwen2',
};

interface OllamaResponse {
  response: string;
}

/**
 * Ask LLM to disambiguate which English word best matches the Chinese word in context.
 * Returns the best-matching word ID, or null if LLM is unavailable.
 *
 * TODO(v2): Wire into runtime matching pipeline.
 * Currently: config UI + connection test work, but this function is never called
 * from findMatches(). Integration deferred to product maturity phase because:
 * 1. Async LLM calls would block the synchronous matching loop
 * 2. Need a caching strategy to avoid re-querying the same word in context
 * 3. Requires fallback UX when LLM is slow/unavailable
 * See: https://github.com/host452b/Flipword/issues (create tracking issue)
 */
export async function llmDisambiguate(
  chineseWord: string,
  sentenceContext: string,
  candidates: WordEntry[],
  config: LLMConfig,
): Promise<string | null> {
  if (!config.enabled || candidates.length <= 1) return null;

  const candidateList = candidates.map(c => `- ${c.word}: ${c.meanings[0]?.definitionCn ?? ''}`).join('\n');

  const prompt = `Given the Chinese sentence: "${sentenceContext}"
The word "${chineseWord}" could map to these English words:
${candidateList}

Which English word is the best translation for "${chineseWord}" in this context? Reply with ONLY the English word, nothing else.`;

  try {
    const resp = await fetch(`${config.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 20 },
      }),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!resp.ok) return null;

    const data: OllamaResponse = await resp.json();
    const answer = data.response.trim().toLowerCase();

    // Find matching candidate
    const match = candidates.find(c => c.word.toLowerCase() === answer);
    return match?.id ?? null;
  } catch {
    return null; // LLM unavailable, graceful fallback
  }
}
