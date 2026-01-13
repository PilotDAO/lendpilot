import { LRUCache as LRU } from "lru-cache";
import { env } from "@/lib/config/env";

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Maximum number of entries
}

export class LRUCache<K extends string | number | symbol, V = unknown> {
  private cache: LRU<K, V & {}>;

  constructor(options: CacheOptions = {}) {
    const ttl = options.ttl || env.CACHE_TTL_LIVE;
    const maxSize = options.maxSize || env.CACHE_MAX_SIZE;

    this.cache = new LRU<K, V & {}>({
      max: maxSize,
      ttl: ttl * 1000, // Convert seconds to milliseconds
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });
  }

  get(key: K): V | undefined {
    return this.cache.get(key) as V | undefined;
  }

  set(key: K, value: V, ttl?: number): void {
    if (ttl) {
      this.cache.set(key, value as V & {}, { ttl: ttl * 1000 });
    } else {
      this.cache.set(key, value as V & {});
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
