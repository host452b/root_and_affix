import { LLM } from './config.js';
import { logger } from './logger.js';

export interface CachedBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface LLMCallArgs {
  system: CachedBlock[];
  userText: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCallResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cacheWrite: number;
}

export async function callClaude(args: LLMCallArgs): Promise<LLMCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const body = {
    model: LLM.model,
    max_tokens: args.maxTokens ?? LLM.maxOutputTokens,
    temperature: args.temperature ?? LLM.temperature,
    system: args.system,
    messages: [{ role: 'user', content: args.userText }],
  };

  const res = await fetch(LLM.apiUrl, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': LLM.apiVersion,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errTxt}`);
  }

  const json = await res.json() as {
    content: Array<{ type: string; text?: string }>;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };

  const text = json.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
  return {
    text,
    tokensIn: json.usage.input_tokens,
    tokensOut: json.usage.output_tokens,
    cacheRead: json.usage.cache_read_input_tokens ?? 0,
    cacheWrite: json.usage.cache_creation_input_tokens ?? 0,
  };
}

export function extractJson<T = unknown>(text: string): T {
  // Strip Markdown code fences if present
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fence) t = fence[1];
  return JSON.parse(t) as T;
}
