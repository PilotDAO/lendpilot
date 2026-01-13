import { LRUCache } from "./lru-cache";
import { env } from "@/lib/config/env";

// Cache instances per data type
export const liveDataCache = new LRUCache<string, Record<string, unknown>>({
  ttl: env.CACHE_TTL_LIVE,
  maxSize: env.CACHE_MAX_SIZE,
});

export const snapshotsCache = new LRUCache<string, unknown>({
  ttl: env.CACHE_TTL_SNAPSHOTS,
  maxSize: env.CACHE_MAX_SIZE,
});

export const mappingsCache = new LRUCache<string, Record<string, unknown>>({
  ttl: env.CACHE_TTL_SNAPSHOTS * 24, // Cache mappings longer (24 hours)
  maxSize: 100, // Smaller cache for mappings
});

/**
 * Stale-if-error pattern: return stale cache if available after error
 */
export async function withStaleIfError<T>(
  cache: LRUCache<string, T>,
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const result = await fetcher();
    cache.set(key, result);
    return result;
  } catch (error) {
    const stale = cache.get(key);
    if (stale) {
      console.warn(`Returning stale cache for key: ${key}`, error);
      return stale;
    }
    throw error;
  }
}
