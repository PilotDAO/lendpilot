import { readFileSync } from "fs";
import { join } from "path";

export interface StablecoinConfig {
  symbol: string;
  address: string;
  markets: string[];
}

let stablecoinsCache: StablecoinConfig[] | null = null;

export function loadStablecoins(): StablecoinConfig[] {
  if (stablecoinsCache) {
    return stablecoinsCache;
  }

  try {
    const filePath = join(process.cwd(), "data", "stablecoins.json");
    const content = readFileSync(filePath, "utf-8");
    stablecoinsCache = JSON.parse(content) as StablecoinConfig[];
    return stablecoinsCache;
  } catch {
    console.warn("Failed to load stablecoins.json, returning empty array");
    return [];
  }
}

export function getStablecoinByAddress(address: string): StablecoinConfig | null {
  const stablecoins = loadStablecoins();
  return (
    stablecoins.find(
      (s) => s.address.toLowerCase() === address.toLowerCase()
    ) || null
  );
}

export function getStablecoinsByMarket(marketKey: string): StablecoinConfig[] {
  const stablecoins = loadStablecoins();
  return stablecoins.filter((s) => s.markets.includes(marketKey));
}

export function isStablecoin(address: string): boolean {
  return getStablecoinByAddress(address) !== null;
}
