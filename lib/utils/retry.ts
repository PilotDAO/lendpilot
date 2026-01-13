/**
 * Exponential backoff retry utility
 * Attempts: 3 (1s, 2s, 4s intervals)
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number; // Base delay in milliseconds
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3;
  const baseDelay = options.baseDelay || 1000;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      
      if (options.onRetry) {
        options.onRetry(attempt, lastError);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Retry failed");
}
