import { readFileSync } from "fs";
import { join } from "path";

export interface MarketConfig {
  marketKey: string;
  displayName: string;
  poolAddress: string;
  subgraphId: string;
  chainId: number;
  rpcUrls: string[];
  url?: string;
}

let marketsCache: MarketConfig[] | null = null;

export function loadMarkets(): MarketConfig[] {
  if (marketsCache) {
    return marketsCache;
  }

  try {
    const filePath = join(process.cwd(), "data", "markets.json");
    const content = readFileSync(filePath, "utf-8");
    marketsCache = JSON.parse(content) as MarketConfig[];
    return marketsCache;
  } catch {
    console.warn("Failed to load markets.json, returning empty array");
    return [];
  }
}

export function validateMarketKey(marketKey: string): boolean {
  const markets = loadMarkets();
  return markets.some((m) => m.marketKey === marketKey);
}

export function getMarket(marketKey: string): MarketConfig | null {
  const markets = loadMarkets();
  return markets.find((m) => m.marketKey === marketKey) || null;
}
