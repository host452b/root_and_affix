export interface RetryOpts {
  maxRetries: number;
  baseDelayMs: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === opts.maxRetries) break;
      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      opts.onRetry?.(attempt + 1, e as Error);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
