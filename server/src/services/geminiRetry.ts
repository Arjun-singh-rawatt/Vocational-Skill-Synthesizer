type GeminiRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

const TRANSIENT_HTTP_STATUSES = new Set([408, 500, 502, 503, 504]);
const TRANSIENT_PROVIDER_STATUSES = new Set([
  'UNAVAILABLE',
  'INTERNAL',
  'DEADLINE_EXCEEDED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);

function errorDetails(error: unknown): Record<string, any> {
  if (error && typeof error === 'object') return error as Record<string, any>;
  if (typeof error === 'string') return { message: error };
  return {};
}

function getProviderStatusValues(error: unknown): unknown[] {
  const details = errorDetails(error);
  const values: unknown[] = [
    details.status,
    details.statusCode,
    details.code,
    details.error?.status,
    details.error?.code,
    details.response?.status,
  ];

  const message = typeof details.message === 'string' ? details.message : '';
  if (message) {
    try {
      const parsed = JSON.parse(message);
      values.push(parsed.status, parsed.code, parsed.error?.status, parsed.error?.code);
    } catch {
      // SDKs sometimes put a JSON error payload inside the message; inspect its status below too.
    }
    const statusMatch = message.match(/\b(408|500|502|503|504)\b/);
    if (statusMatch) values.push(Number(statusMatch[1]));
    const providerStatusMatch = message.match(/\b(UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|EAI_AGAIN)\b/i);
    if (providerStatusMatch) values.push(providerStatusMatch[1]);
  }
  return values;
}

export function isTransientGeminiError(error: unknown): boolean {
  return getProviderStatusValues(error).some((value) => {
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
      return TRANSIENT_HTTP_STATUSES.has(Number(value));
    }
    return typeof value === 'string' && TRANSIENT_PROVIDER_STATUSES.has(value.toUpperCase());
  });
}

export function toUserFacingGeminiError(error: unknown): Error {
  if (isTransientGeminiError(error)) {
    return new Error('The AI service is temporarily busy. Please wait a moment, then retry your analysis. Your recording is still available.');
  }

  const details = errorDetails(error);
  return new Error(typeof details.message === 'string' && details.message.trim()
    ? details.message
    : 'The AI service could not complete this request. Please try again.');
}

const defaultSleep = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: GeminiRetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 750);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 3000);
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientGeminiError(error) || attempt === maxAttempts) {
        throw toUserFacingGeminiError(error);
      }

      const delayMs = Math.min(baseDelayMs * (2 ** (attempt - 1)), maxDelayMs);
      console.warn(`[Gemini] ${operationName} temporarily failed; retrying (${attempt + 1}/${maxAttempts}) in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }

  throw new Error('The AI service could not complete this request. Please try again.');
}
